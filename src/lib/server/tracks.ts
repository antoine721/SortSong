import type { Track } from "@prisma/client";
import { prisma } from "./db";
import type { TrackDTO } from "../types";

export function rowToDTO(t: Track & { tags?: { tagId: string }[] }): TrackDTO {
  let artists: TrackDTO["artists"] = [];
  try {
    artists = JSON.parse(t.artists);
  } catch {}
  return {
    id: t.spotifyId,
    title: t.title,
    artists,
    album: t.album,
    albumId: t.albumId,
    cover: t.coverUrl,
    coverSmall: t.coverSmall,
    durationMs: t.durationMs,
    isrc: t.isrc,
    bpm: t.bpm,
    key: t.key,
    energy: t.energy,
    explicit: t.explicit,
    releaseDate: t.releaseDate,
    tagIds: t.tags?.map((x) => x.tagId),
  };
}

/**
 * Enregistre (ou complète) des morceaux en cache. Renvoie spotifyId -> id interne.
 * Les champs saisis à la main (bpm/clé/énergie) ne sont jamais écrasés.
 */
export async function upsertTracks(dtos: TrackDTO[]): Promise<Map<string, string>> {
  const unique = new Map<string, TrackDTO>();
  for (const d of dtos) if (d && d.id && !unique.has(d.id)) unique.set(d.id, d);
  const ids = [...unique.keys()];
  const map = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500);
    const existing = await prisma.track.findMany({
      where: { spotifyId: { in: chunk } },
      select: { id: true, spotifyId: true, isrc: true, coverUrl: true, bpm: true },
    });
    const known = new Map(existing.map((e) => [e.spotifyId, e]));
    const toCreate = chunk.filter((id) => !known.has(id)).map((id) => unique.get(id)!);
    if (toCreate.length) {
      await prisma.track.createMany({
        data: toCreate.map((d) => ({
          spotifyId: d.id,
          title: d.title,
          artists: JSON.stringify(d.artists),
          artistNames: d.artists.map((a) => a.name).join(", "),
          album: d.album,
          albumId: d.albumId,
          coverUrl: d.cover,
          coverSmall: d.coverSmall,
          durationMs: d.durationMs,
          isrc: d.isrc || null,
          explicit: !!d.explicit,
          releaseDate: d.releaseDate || null,
          bpm: d.bpm ?? null,
          bpmSource: d.bpm ? "deezer" : null,
        })),
      });
    }
    // Complète les infos manquantes (ISRC, cover, BPM Deezer) sans toucher aux saisies manuelles.
    const updates = existing.filter((e) => {
      const d = unique.get(e.spotifyId)!;
      return (!e.isrc && d.isrc) || (!e.coverUrl && d.cover) || (!e.bpm && d.bpm);
    });
    for (const e of updates) {
      const d = unique.get(e.spotifyId)!;
      await prisma.track.update({
        where: { id: e.id },
        data: {
          ...(!e.isrc && d.isrc ? { isrc: d.isrc } : {}),
          ...(!e.coverUrl && d.cover ? { coverUrl: d.cover, coverSmall: d.coverSmall } : {}),
          ...(!e.bpm && d.bpm ? { bpm: d.bpm, bpmSource: "deezer" } : {}),
        },
      });
    }
    const rows = await prisma.track.findMany({ where: { spotifyId: { in: chunk } }, select: { id: true, spotifyId: true } });
    for (const r of rows) map.set(r.spotifyId, r.id);
  }
  return map;
}

/** Complète des DTO venant de Spotify avec les données locales (BPM, clé, énergie, tags). */
export async function enrich(dtos: TrackDTO[]): Promise<TrackDTO[]> {
  const ids = dtos.map((d) => d.id);
  if (!ids.length) return dtos;
  const rows = await prisma.track.findMany({
    where: { spotifyId: { in: ids } },
    select: { spotifyId: true, bpm: true, key: true, energy: true, tags: { select: { tagId: true } } },
  });
  const m = new Map(rows.map((r) => [r.spotifyId, r]));
  return dtos.map((d) => {
    const r = m.get(d.id);
    if (!r) return d;
    return { ...d, bpm: r.bpm ?? d.bpm ?? null, key: r.key, energy: r.energy, tagIds: r.tags.map((t) => t.tagId) };
  });
}

/** Recalcule le statut « à trier / rangé » des morceaux de la bibliothèque. */
export async function refreshStatus(userId: string, trackIds: string[]) {
  if (!trackIds.length) return;
  const inPlaylists = await prisma.playlistTrack.findMany({
    where: { trackId: { in: trackIds }, playlist: { userId } },
    select: { trackId: true },
    distinct: ["trackId"],
  });
  const sorted = new Set(inPlaylists.map((p) => p.trackId));
  const lib = await prisma.libraryTrack.findMany({ where: { userId, trackId: { in: trackIds } } });
  const libIds = new Set(lib.map((l) => l.trackId));
  const now = new Date();
  // Morceaux ajoutés en playlist depuis la recherche → entrent dans la bibliothèque.
  const missing = trackIds.filter((t) => sorted.has(t) && !libIds.has(t));
  if (missing.length) {
    await prisma.libraryTrack.createMany({
      data: missing.map((trackId) => ({ userId, trackId, source: "search", status: "sorted", addedAt: now })),
    });
  }
  for (const l of lib) {
    const want = sorted.has(l.trackId) ? "sorted" : l.status === "sorted" ? "inbox" : l.status;
    if (want !== l.status) await prisma.libraryTrack.update({ where: { id: l.id }, data: { status: want } });
  }
}
