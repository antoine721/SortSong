import { prisma } from "./db";
import { dzArtistRadio, dzArtistTop, dzRelated, dzSearchArtist, dzSearchTrack, dzTrack, dzTrackByIsrc, type DzTrack } from "./deezer";
import { lfSimilarArtists, lfSimilarTracks } from "./lastfm";
import { matchOnSpotify, pool, type Candidate } from "./match";
import { enrich, upsertTracks } from "./tracks";
import { similarity } from "./text";
import type { TrackDTO } from "../types";

const CACHE_DAYS = 7;

/** Trouve l'équivalent Deezer d'un morceau (pour BPM et radio). */
export async function findOnDeezer(t: { title: string; artist: string; isrc?: string | null; durationMs?: number }): Promise<DzTrack | null> {
  if (t.isrc) {
    const d = await dzTrackByIsrc(t.isrc);
    if (d?.id) return d;
  }
  const res = await dzSearchTrack(t.title, t.artist);
  let best: DzTrack | null = null;
  let bestScore = 0;
  for (const r of res) {
    let s = similarity(t.title, r.title) * 0.6 + similarity(t.artist, r.artist.name) * 0.4;
    if (t.durationMs && Math.abs(r.duration - t.durationMs / 1000) > 15) s -= 0.15;
    if (s > bestScore) {
      bestScore = s;
      best = r;
    }
  }
  if (!best || bestScore < 0.75) return null;
  return (await dzTrack(best.id)) || best;
}

/** Récupère le BPM Deezer d'un morceau et le stocke (sans écraser une saisie manuelle). */
export async function fetchBpm(spotifyId: string): Promise<number | null> {
  const row = await prisma.track.findUnique({ where: { spotifyId } });
  if (!row) return null;
  if (row.bpmSource === "manual" && row.bpm) return row.bpm;
  let dzt: DzTrack | null = row.deezerId && row.deezerId !== "none" ? await dzTrack(row.deezerId) : null;
  if (!dzt) {
    const artist = JSON.parse(row.artists)[0]?.name || "";
    dzt = await findOnDeezer({ title: row.title, artist, isrc: row.isrc, durationMs: row.durationMs });
  }
  if (!dzt) return null;
  const bpm = dzt.bpm && dzt.bpm > 0 ? Math.round(dzt.bpm * 10) / 10 : null;
  await prisma.track.update({
    where: { id: row.id },
    data: { deezerId: String(dzt.id), ...(bpm ? { bpm, bpmSource: "deezer" } : {}), ...(!row.isrc && dzt.isrc ? { isrc: dzt.isrc } : {}) },
  });
  return bpm;
}

type Seed = { spotifyId: string; title: string; artist: string; isrc?: string | null; durationMs?: number };

/**
 * « Mix inspiré de » : morceaux similaires Last.fm + radio de l'artiste Deezer
 * (+ titres phares des artistes proches), retrouvés sur Spotify. 30 à 50 titres.
 */
export async function buildMix(userId: string, seed: Seed, opts: { refresh?: boolean } = {}): Promise<TrackDTO[]> {
  if (!opts.refresh) {
    const cached = await prisma.similarCache.findUnique({ where: { seedKey: seed.spotifyId } });
    if (cached && Date.now() - cached.createdAt.getTime() < CACHE_DAYS * 86400_000) {
      const ids: string[] = JSON.parse(cached.results);
      const rows = await prisma.track.findMany({ where: { spotifyId: { in: ids } }, include: { tags: true } });
      const { rowToDTO } = await import("./tracks");
      const m = new Map(rows.map((r) => [r.spotifyId, rowToDTO(r)]));
      const list = ids.map((id) => m.get(id)).filter(Boolean) as TrackDTO[];
      if (list.length >= 10) return list;
    }
  }

  // 1. Candidats
  const lastfm: Candidate[] = (await lfSimilarTracks(seed.artist, seed.title, 50)).map((t) => ({ title: t.title, artist: t.artist }));

  const dzCands: Candidate[] = [];
  const dzSeed = await findOnDeezer({ title: seed.title, artist: seed.artist, isrc: seed.isrc, durationMs: seed.durationMs });
  let dzArtistId = dzSeed?.artist?.id;
  if (!dzArtistId) dzArtistId = (await dzSearchArtist(seed.artist))?.id;
  if (dzArtistId) {
    const radio = await dzArtistRadio(dzArtistId);
    for (const r of radio) dzCands.push({ title: r.title, artist: r.artist.name, durationSec: r.duration, isrc: r.isrc, bpm: r.bpm });
    const related = (await dzRelated(dzArtistId)).slice(0, 6);
    for (const a of related) {
      const top = await dzArtistTop(a.id, 3);
      for (const r of top) dzCands.push({ title: r.title, artist: r.artist.name, durationSec: r.duration, isrc: r.isrc, bpm: r.bpm });
    }
  }
  // Pas de Last.fm configuré : artistes proches via Deezer déjà inclus. Si tout est vide, Last.fm artistes.
  if (!lastfm.length && !dzCands.length) {
    const sims = await lfSimilarArtists(seed.artist, 10);
    for (const s of sims) {
      const a = await dzSearchArtist(s.name);
      if (!a) continue;
      for (const r of await dzArtistTop(a.id, 3)) dzCands.push({ title: r.title, artist: r.artist.name, durationSec: r.duration });
    }
  }

  // 2. Entrelacement + dédoublonnage
  const seen = new Set<string>([`${seed.title}|${seed.artist}`.toLowerCase()]);
  const merged: Candidate[] = [];
  const maxLen = Math.max(lastfm.length, dzCands.length);
  for (let i = 0; i < maxLen; i++) {
    for (const c of [lastfm[i], dzCands[i]]) {
      if (!c) continue;
      const k = `${c.title}|${c.artist}`.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      merged.push(c);
    }
  }
  const candidates = merged.slice(0, 75);

  // 3. ISRC + BPM via Deezer, puis correspondance Spotify
  const results = await pool(candidates, 4, async (c) => {
    let cand = c;
    if (!c.isrc) {
      const d = await findOnDeezer({ title: c.title, artist: c.artist, durationMs: c.durationSec ? c.durationSec * 1000 : undefined });
      if (d) cand = { ...c, isrc: d.isrc, bpm: d.bpm, durationSec: d.duration };
    } else if (c.bpm === undefined) {
      // les pistes radio/top n'ont pas toujours le BPM
    }
    const m = await matchOnSpotify(userId, cand);
    if (!m) return null;
    return { ...m, bpm: m.bpm || (cand.bpm && cand.bpm > 0 ? cand.bpm : null), isrc: m.isrc || cand.isrc || null } as TrackDTO;
  });

  const out: TrackDTO[] = [];
  const ids = new Set<string>([seed.spotifyId]);
  for (const r of results) {
    if (!r || ids.has(r.id)) continue;
    ids.add(r.id);
    out.push(r);
    if (out.length >= 50) break;
  }

  // BPM manquants : complète via Deezer pour les premiers titres (filtre ±4 %).
  await upsertTracks(out);
  const missing = out.filter((t) => !t.bpm).slice(0, 25);
  await pool(missing, 3, async (t) => {
    t.bpm = await fetchBpm(t.id);
  });

  await prisma.similarCache.upsert({
    where: { seedKey: seed.spotifyId },
    create: { seedKey: seed.spotifyId, results: JSON.stringify(out.map((t) => t.id)) },
    update: { results: JSON.stringify(out.map((t) => t.id)), createdAt: new Date() },
  });
  return enrich(out);
}

/** Les URL d'extraits Deezer sont signées et expirent : on les relit au plus toutes les 10 min. */
const PREVIEW_TTL = 10 * 60 * 1000;

/**
 * Extrait de 30 s (MP3 Deezer) pour un morceau Spotify : ISRC d'abord, sinon titre + artiste.
 * Mémorise l'ID Deezer (et le BPM s'il est connu) pour les fois suivantes.
 */
export async function previewFor(spotifyId: string): Promise<string | null> {
  const row = await prisma.track.findUnique({ where: { spotifyId } });
  if (!row) return null;
  if (row.deezerId === "none") return null; // déjà cherché, introuvable
  let dzt: DzTrack | null = row.deezerId ? await dzTrack(row.deezerId, PREVIEW_TTL) : null;
  if (!dzt) {
    const artist = JSON.parse(row.artists)[0]?.name || "";
    const found = await findOnDeezer({ title: row.title, artist, isrc: row.isrc, durationMs: row.durationMs });
    dzt = found?.id ? await dzTrack(found.id, PREVIEW_TTL) : null;
    const bpm = dzt?.bpm && dzt.bpm > 0 ? Math.round(dzt.bpm * 10) / 10 : null;
    await prisma.track.update({
      where: { id: row.id },
      data: {
        deezerId: dzt ? String(dzt.id) : "none",
        ...(bpm && !row.bpm ? { bpm, bpmSource: "deezer" } : {}),
        ...(!row.isrc && dzt?.isrc ? { isrc: dzt.isrc } : {}),
      },
    });
  }
  return dzt?.preview || null;
}
