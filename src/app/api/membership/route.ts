import { NextRequest } from "next/server";
import { prisma } from "@/lib/server/db";
import { handler, requireUser } from "@/lib/server/session";
import { refreshStatus, upsertTracks } from "@/lib/server/tracks";
import type { TrackDTO } from "@/lib/types";

type Body = {
  add?: { playlistId: string; track: TrackDTO; position?: number; note?: string | null }[];
  remove?: { playlistId: string; trackId: string }[];
};

/**
 * Ajout / retrait de morceaux dans des playlists (C4, C5, C6).
 * Anti-doublon garanti par la contrainte unique (playlist_id, track_id).
 */
export const POST = handler(async (req: NextRequest) => {
  const user = await requireUser();
  const b = (await req.json()) as Body;
  const owned = new Set(
    (await prisma.playlist.findMany({ where: { userId: user.id, rules: null }, select: { id: true } })).map((p) => p.id),
  );
  const touched = new Set<string>();
  let added = 0;
  let duplicates = 0;
  if (b.add?.length) {
    const map = await upsertTracks(b.add.map((a) => a.track));
    for (const a of b.add) {
      if (!owned.has(a.playlistId)) continue;
      const trackId = map.get(a.track.id);
      if (!trackId) continue;
      touched.add(trackId);
      const exists = await prisma.playlistTrack.findUnique({ where: { playlistId_trackId: { playlistId: a.playlistId, trackId } } });
      if (exists) {
        duplicates++;
        continue;
      }
      let position = a.position;
      if (position === undefined) {
        const max = await prisma.playlistTrack.aggregate({ where: { playlistId: a.playlistId }, _max: { position: true } });
        position = (max._max.position ?? -1) + 1;
      }
      await prisma.playlistTrack.create({ data: { playlistId: a.playlistId, trackId, position, note: a.note ?? null } });
      added++;
    }
  }
  const removed: { playlistId: string; trackId: string; position: number; note: string | null }[] = [];
  if (b.remove?.length) {
    const tracks = await prisma.track.findMany({ where: { spotifyId: { in: b.remove.map((r) => r.trackId) } }, select: { id: true, spotifyId: true } });
    const ids = new Map(tracks.map((t) => [t.spotifyId, t.id]));
    for (const r of b.remove) {
      const trackId = ids.get(r.trackId);
      if (!trackId || !owned.has(r.playlistId)) continue;
      touched.add(trackId);
      const row = await prisma.playlistTrack.findUnique({ where: { playlistId_trackId: { playlistId: r.playlistId, trackId } } });
      if (!row) continue;
      await prisma.playlistTrack.delete({ where: { id: row.id } });
      removed.push({ playlistId: r.playlistId, trackId: r.trackId, position: row.position, note: row.note });
    }
  }
  await refreshStatus(user.id, [...touched]);
  const inboxCount = await prisma.libraryTrack.count({ where: { userId: user.id, status: "inbox" } });
  return { added, duplicates, removed, inboxCount };
});
