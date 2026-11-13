import { prisma } from "./db";
import { rowToDTO } from "./tracks";
import type { PlaylistDTO, SmartRules, TrackDTO } from "../types";

export function parseRules(r: string | null): SmartRules | null {
  if (!r) return null;
  try {
    return JSON.parse(r);
  } catch {
    return null;
  }
}

export async function playlistDTOs(userId: string): Promise<PlaylistDTO[]> {
  const pls = await prisma.playlist.findMany({ where: { userId }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] });
  const stats = await prisma.$queryRaw<{ playlistId: string; c: bigint | number; d: bigint | number | null }[]>`
    SELECT pt.playlistId as playlistId, COUNT(*) as c, SUM(t.durationMs) as d
    FROM PlaylistTrack pt JOIN Track t ON t.id = pt.trackId
    JOIN Playlist p ON p.id = pt.playlistId
    WHERE p.userId = ${userId}
    GROUP BY pt.playlistId`;
  const sm = new Map(stats.map((s) => [s.playlistId, { c: Number(s.c), d: Number(s.d || 0) }]));
  return pls.map((p) => ({
    id: p.id,
    folderId: p.folderId,
    name: p.name,
    color: p.color,
    description: p.description,
    position: p.position,
    hotkey: p.hotkey,
    rules: parseRules(p.rules),
    count: sm.get(p.id)?.c ?? 0,
    durationMs: sm.get(p.id)?.d ?? 0,
    spotifyExportId: p.spotifyExportId,
  }));
}

export async function membershipMap(userId: string): Promise<Record<string, string[]>> {
  const rows = await prisma.$queryRaw<{ s: string; p: string }[]>`
    SELECT t.spotifyId as s, pt.playlistId as p
    FROM PlaylistTrack pt JOIN Track t ON t.id = pt.trackId
    JOIN Playlist p ON p.id = pt.playlistId
    WHERE p.userId = ${userId}`;
  const m: Record<string, string[]> = {};
  for (const r of rows) (m[r.s] ||= []).push(r.p);
  return m;
}

/** Contenu d'une playlist (classique ou intelligente). */
export async function playlistTracks(userId: string, playlistId: string): Promise<TrackDTO[]> {
  const pl = await prisma.playlist.findFirst({ where: { id: playlistId, userId } });
  if (!pl) return [];
  const rules = parseRules(pl.rules);
  if (rules) return smartTracks(userId, rules);
  const rows = await prisma.playlistTrack.findMany({
    where: { playlistId },
    orderBy: { position: "asc" },
    include: { track: { include: { tags: { select: { tagId: true } } } } },
  });
  return rows.map((r) => ({ ...rowToDTO(r.track), addedAt: r.addedAt.toISOString(), note: r.note }));
}

/** C8 : playlist intelligente, calculée à la volée sur la bibliothèque. */
export async function smartTracks(userId: string, rules: SmartRules): Promise<TrackDTO[]> {
  const lib = await prisma.libraryTrack.findMany({
    where: {
      userId,
      status: rules.status ? rules.status : { not: "dismissed" },
      track: {
        ...(rules.bpmMin || rules.bpmMax ? { bpm: { ...(rules.bpmMin ? { gte: rules.bpmMin } : {}), ...(rules.bpmMax ? { lte: rules.bpmMax } : {}) } } : {}),
        ...(rules.keys?.length ? { key: { in: rules.keys } } : {}),
        ...(rules.energyMin || rules.energyMax
          ? { energy: { ...(rules.energyMin ? { gte: rules.energyMin } : {}), ...(rules.energyMax ? { lte: rules.energyMax } : {}) } }
          : {}),
        ...(rules.artist ? { artistNames: { contains: rules.artist } } : {}),
        ...(rules.anyTagIds?.length ? { tags: { some: { tagId: { in: rules.anyTagIds } } } } : {}),
        ...(rules.tagIds?.length ? { AND: rules.tagIds.map((tagId) => ({ tags: { some: { tagId } } })) } : {}),
      },
    },
    include: { track: { include: { tags: { select: { tagId: true } } } } },
    orderBy: { addedAt: "desc" },
    take: 2000,
  });
  return lib.map((l) => ({ ...rowToDTO(l.track), addedAt: l.addedAt.toISOString(), status: l.status as any }));
}
