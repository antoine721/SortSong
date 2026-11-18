import { prisma } from "./db";
import { normTrack, paginate, playlistItemTrack, sp, spSafe } from "./spotify";
import { refreshStatus, upsertTracks } from "./tracks";
import type { TrackDTO } from "../types";
import { dz, dzTrack, type DzTrack } from "./deezer";
import { matchOnSpotify, pool } from "./match";

type Progress = (msg: { step: string; done?: number; total?: number; detail?: string }) => void;

async function kvGet(key: string) {
  return (await prisma.artistCache.findUnique({ where: { key } }))?.data ?? null;
}
async function kvSet(key: string, data: string) {
  await prisma.artistCache.upsert({ where: { key }, create: { key, data }, update: { data, createdAt: new Date() } });
}

/** Récupère les éléments d'une playlist Spotify (endpoint /items depuis 2026, repli /tracks). */
export async function fetchPlaylistTracks(userId: string, playlistId: string): Promise<{ track: TrackDTO; addedAt: string | null }[]> {
  let items: any[];
  try {
    items = await paginate(userId, `https://api.spotify.com/v1/playlists/${playlistId}/items?limit=50&additional_types=track`);
  } catch {
    items = await paginate(userId, `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50`);
  }
  const out: { track: TrackDTO; addedAt: string | null }[] = [];
  for (const it of items) {
    const t = normTrack(playlistItemTrack(it));
    if (t) out.push({ track: t, addedAt: it.added_at || null });
  }
  return out;
}

export async function listSpotifyPlaylists(userId: string) {
  const items = await paginate(userId, "https://api.spotify.com/v1/me/playlists?limit=50");
  return items
    .filter(Boolean)
    .map((p: any) => ({
      id: p.id,
      name: p.name,
      owner: p.owner?.display_name || p.owner?.id || "",
      image: p.images?.[0]?.url || null,
      total: p.items?.total ?? p.tracks?.total ?? null,
      snapshot: p.snapshot_id as string,
    }));
}

/**
 * Import (A2) et resynchronisation (A4) : titres likés + toutes les playlists Spotify.
 * En mode sync, on s'arrête aux likes déjà connus et on saute les playlists inchangées (snapshot_id).
 */
export async function importLibrary(userId: string, mode: "full" | "sync", progress: Progress) {
  const existing = new Set(
    (await prisma.libraryTrack.findMany({ where: { userId }, select: { track: { select: { spotifyId: true } } } })).map((l) => l.track.spotifyId),
  );
  const entries: { track: TrackDTO; source: string; sourceRef: string | null; addedAt: string | null }[] = [];

  // Titres likés
  progress({ step: "Titres likés…" });
  let url: string | null = "https://api.spotify.com/v1/me/tracks?limit=50";
  let total = 0;
  let stop = false;
  while (url && !stop) {
    const page: any = await sp(userId, url);
    total = page.total ?? total;
    let knownInPage = 0;
    for (const it of page.items || []) {
      const t = normTrack(it.track ?? it.item);
      if (!t) continue;
      if (existing.has(t.id)) knownInPage++;
      entries.push({ track: t, source: "liked", sourceRef: null, addedAt: it.added_at || null });
    }
    progress({ step: "Titres likés", done: entries.length, total });
    // En sync, les likes sont triés du plus récent au plus ancien : une page entièrement connue = fin.
    if (mode === "sync" && page.items?.length && knownInPage === page.items.length) stop = true;
    url = page.next;
  }

  // Playlists Spotify
  progress({ step: "Liste des playlists…" });
  const playlists = await listSpotifyPlaylists(userId);
  let i = 0;
  for (const p of playlists) {
    i++;
    const snapKey = `snap:${userId}:${p.id}`;
    if (mode === "sync" && (await kvGet(snapKey)) === p.snapshot) continue;
    progress({ step: `Playlist « ${p.name} »`, done: i, total: playlists.length });
    try {
      const tracks = await fetchPlaylistTracks(userId, p.id);
      for (const t of tracks) entries.push({ track: t.track, source: "playlist", sourceRef: p.name, addedAt: t.addedAt });
      await kvSet(snapKey, p.snapshot);
    } catch (e) {
      progress({ step: `Playlist « ${p.name} » ignorée`, detail: e instanceof Error ? e.message : String(e) });
    }
  }

  progress({ step: "Enregistrement…", done: 0, total: entries.length });
  const idMap = await upsertTracks(entries.map((e) => e.track));
  const lib = await prisma.libraryTrack.findMany({ where: { userId }, select: { trackId: true } });
  const inLib = new Set(lib.map((l) => l.trackId));
  const toCreate = new Map<string, { userId: string; trackId: string; source: string; sourceRef: string | null; addedAt: Date; status: string }>();
  for (const e of entries) {
    const trackId = idMap.get(e.track.id);
    if (!trackId || inLib.has(trackId)) continue;
    const prev = toCreate.get(trackId);
    const addedAt = e.addedAt ? new Date(e.addedAt) : new Date();
    if (!prev || (prev.source !== "liked" && e.source === "liked")) {
      toCreate.set(trackId, { userId, trackId, source: e.source, sourceRef: e.sourceRef, addedAt, status: "inbox" });
    }
  }
  const rows = [...toCreate.values()];
  for (let k = 0; k < rows.length; k += 500) await prisma.libraryTrack.createMany({ data: rows.slice(k, k + 500) });
  await refreshStatus(userId, rows.map((r) => r.trackId));
  await prisma.user.update({ where: { id: userId }, data: { lastSyncAt: new Date() } });
  progress({ step: "Terminé", done: rows.length, total: rows.length });
  return { added: rows.length, scanned: entries.length, playlists: playlists.length };
}

/** A3 : importe une playlist Spotify comme playlist interne. */
export async function importSpotifyPlaylist(userId: string, spotifyPlaylistId: string, folderId: string | null) {
  const meta = await spSafe(userId, `/playlists/${spotifyPlaylistId}`, { query: { fields: "name,description" } });
  const tracks = await fetchPlaylistTracks(userId, spotifyPlaylistId);
  const idMap = await upsertTracks(tracks.map((t) => t.track));
  const max = await prisma.playlist.aggregate({ where: { userId, folderId }, _max: { position: true } });
  const colors = ["#7c5cff", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#84cc16", "#f97316"];
  const pl = await prisma.playlist.create({
    data: {
      userId,
      folderId,
      name: meta?.name || "Playlist importée",
      description: meta?.description ? String(meta.description).replace(/<[^>]+>/g, "") : null,
      color: colors[Math.floor(Math.random() * colors.length)],
      position: (max._max.position ?? -1) + 1,
    },
  });
  const seen = new Set<string>();
  const data = [] as { playlistId: string; trackId: string; position: number }[];
  for (const t of tracks) {
    const id = idMap.get(t.track.id);
    if (!id || seen.has(id)) continue; // anti-doublon
    seen.add(id);
    data.push({ playlistId: pl.id, trackId: id, position: data.length });
  }
  for (let k = 0; k < data.length; k += 500) await prisma.playlistTrack.createMany({ data: data.slice(k, k + 500) });
  // Les morceaux entrent dans la bibliothèque (source playlist)
  const lib = new Set((await prisma.libraryTrack.findMany({ where: { userId, trackId: { in: [...seen] } }, select: { trackId: true } })).map((l) => l.trackId));
  const now = new Date();
  const newLib = [...seen].filter((id) => !lib.has(id)).map((trackId) => ({ userId, trackId, source: "playlist", sourceRef: pl.name, addedAt: now, status: "sorted" }));
  for (let k = 0; k < newLib.length; k += 500) await prisma.libraryTrack.createMany({ data: newLib.slice(k, k + 500) });
  await refreshStatus(userId, [...seen]);
  return { id: pl.id, count: data.length };
}

/** Extrait l'ID d'une playlist depuis un lien Spotify (open.spotify.com/…/playlist/ID, spotify:playlist:ID ou l'ID seul). */
export function parsePlaylistLink(input: string): string | null {
  const s = input.trim();
  const m =
    /open\.spotify\.com\/(?:[a-z-]+\/)*playlist\/([A-Za-z0-9]{22})/.exec(s) ||
    /spotify:playlist:([A-Za-z0-9]{22})/.exec(s) ||
    /^([A-Za-z0-9]{22})$/.exec(s);
  return m ? m[1] : null;
}

export type SpotifyLink = { type: "playlist" | "album" | "track"; id: string; source?: "spotify" | "deezer" };

/** Lien Spotify (open.spotify.com/…, spotify:type:id) ou Deezer (deezer.com/…/playlist/123) → source + type + ID. */
export function parseSpotifyLink(input: string): SpotifyLink | null {
  const s = input.trim();
  const d = /deezer\.com\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?(playlist|album|track)\/(\d+)/i.exec(s);
  if (d) return { source: "deezer", type: d[1].toLowerCase() as SpotifyLink["type"], id: d[2] };
  const m =
    /open\.spotify\.com\/(?:[a-z-]+\/)*(playlist|album|track)\/([A-Za-z0-9]{22})/.exec(s) ||
    /spotify:(playlist|album|track):([A-Za-z0-9]{22})/.exec(s);
  return m ? { source: "spotify", type: m[1] as SpotifyLink["type"], id: m[2] } : null;
}

/** Liens courts de partage Deezer (link.deezer.com, deezer.page.link) → lien complet. */
export async function resolveShortLink(input: string): Promise<string> {
  const s = input.trim();
  if (!/^https?:\/\/(link\.deezer\.com|deezer\.page\.link)\//i.test(s)) return s;
  try {
    const res = await fetch(s, { redirect: "follow", signal: AbortSignal.timeout(8000) });
    if (/deezer\.com\/.*(playlist|album|track)\/\d+/.test(res.url)) return res.url;
    const html = await res.text();
    const m = /https?:\/\/www\.deezer\.com\/[^"'\s]*(?:playlist|album|track)\/\d+/.exec(html);
    return m ? m[0] : s;
  } catch {
    return s;
  }
}

/** Morceaux d'un lien Deezer (API publique, sans clé). */
async function deezerItems(link: SpotifyLink): Promise<{ name: string; items: DzTrack[] }> {
  if (link.type === "track") {
    const t = await dzTrack(link.id);
    if (!t?.id) throw new Error("Titre Deezer introuvable");
    return { name: `${t.title} — ${t.artist.name}`, items: [t] };
  }
  const meta = await dz<any>(`/${link.type}/${link.id}`);
  if (!meta?.id) throw new Error(link.type === "playlist" ? "Playlist Deezer introuvable ou privée (elle doit être publique)" : "Album Deezer introuvable");
  const items: DzTrack[] = [];
  let next: string | null = `/${link.type}/${link.id}/tracks?limit=100`;
  while (next && items.length < 2000) {
    const page: any = await dz(next);
    items.push(...(page?.data || []));
    next = page?.next ? String(page.next).replace(/^https?:\/\/api\.deezer\.com/, "") : null;
  }
  return { name: meta.title || "Deezer", items };
}

/**
 * Import par lien : les morceaux d'une playlist, d'un album ou un titre seul entrent dans la bibliothèque,
 * non notés. Un titre supprimé auparavant n'est pas réimporté. Option : créer aussi une playlist interne.
 */
export async function importFromLink(userId: string, link: SpotifyLink, opts: { createPlaylist?: boolean; folderId?: string | null } = {}) {
  let name = "";
  let tracks: TrackDTO[] = [];
  let notFound = 0;
  const deezerIds = new Map<string, string>(); // spotifyId -> deezerId
  if (link.source === "deezer") {
    const { name: n, items } = await deezerItems(link);
    name = n;
    // ISRC via la fiche complète Deezer, puis correspondance sur Spotify (doute → ignoré)
    const matched = await pool(items, 4, async (it): Promise<TrackDTO | null> => {
      const full = it.isrc ? it : (await dzTrack(it.id)) || it;
      const m = await matchOnSpotify(userId, { title: full.title, artist: full.artist?.name || "", isrc: full.isrc, durationSec: full.duration });
      if (m) deezerIds.set(m.id, String(it.id));
      return m ? { ...m, bpm: full.bpm && full.bpm > 0 ? full.bpm : m.bpm } : null;
    });
    tracks = matched.filter((t): t is TrackDTO => !!t);
    notFound = items.length - tracks.length;
  } else if (link.type === "playlist") {
    const meta = await spSafe(userId, `/playlists/${link.id}`, { query: { fields: "name" } });
    name = meta?.name || "Playlist";
    tracks = (await fetchPlaylistTracks(userId, link.id)).map((t) => t.track);
  } else if (link.type === "album") {
    const raw = await sp(userId, `/albums/${link.id}`);
    name = raw.name;
    let items: any[] = raw.tracks?.items || [];
    if (raw.tracks?.next) items = [...items, ...(await paginate(userId, raw.tracks.next, 500))];
    tracks = items.map((t) => normTrack(t, raw)).filter(Boolean) as TrackDTO[];
  } else {
    const raw = await sp(userId, `/tracks/${link.id}`);
    const t = normTrack(raw);
    if (t) tracks = [t];
    name = t ? `${t.title} — ${t.artists.map((a) => a.name).join(", ")}` : "Titre";
  }
  const idMap = await upsertTracks(tracks);
  for (const [sid, did] of deezerIds) await prisma.track.updateMany({ where: { spotifyId: sid, deezerId: null }, data: { deezerId: did } });
  const trackIds = [...new Set(tracks.map((t) => idMap.get(t.id)).filter(Boolean) as string[])];
  const existing = await prisma.libraryTrack.findMany({ where: { userId, trackId: { in: trackIds } }, select: { trackId: true, status: true } });
  const known = new Map(existing.map((e) => [e.trackId, e.status]));
  const now = Date.now();
  // addedAt décalé d'1 ms par titre pour garder l'ordre d'origine
  const data = trackIds
    .filter((id) => !known.has(id))
    .map((trackId, i) => ({ userId, trackId, source: link.type, sourceRef: name, status: "inbox", addedAt: new Date(now + i) }));
  for (let k = 0; k < data.length; k += 500) await prisma.libraryTrack.createMany({ data: data.slice(k, k + 500) });

  let playlistId: string | null = null;
  if (opts.createPlaylist && link.type !== "track" && trackIds.length) {
    const max = await prisma.playlist.aggregate({ where: { userId, folderId: opts.folderId ?? null }, _max: { position: true } });
    const colors = ["#7c5cff", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#84cc16", "#f97316"];
    const pl = await prisma.playlist.create({
      data: { userId, name, folderId: opts.folderId ?? null, color: colors[Math.floor(Math.random() * colors.length)], position: (max._max.position ?? -1) + 1 },
    });
    playlistId = pl.id;
    await prisma.playlistTrack.createMany({ data: trackIds.map((trackId, position) => ({ playlistId: pl.id, trackId, position })) });
    await refreshStatus(userId, trackIds);
  }
  return {
    name,
    type: link.type,
    total: trackIds.length,
    added: data.length,
    already: trackIds.length - data.length,
    notFound,
    source: link.source || "spotify",
    skippedDeleted: existing.filter((e) => e.status === "deleted").length,
    playlistId,
  };
}
