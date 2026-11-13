import { NextRequest } from "next/server";
import { prisma } from "@/lib/server/db";
import { handler, requireUser, HttpError } from "@/lib/server/session";
import { playlistTracks } from "@/lib/server/playlists";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (_req: NextRequest, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  return { tracks: await playlistTracks(user.id, id) };
});

/** C7 : réordonner (order = liste complète des spotifyIds) ou annoter (note). */
export const PATCH = handler(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const pl = await prisma.playlist.findFirst({ where: { id, userId: user.id } });
  if (!pl) throw new HttpError(404, "Playlist introuvable");
  const b = (await req.json()) as { order?: string[]; note?: { trackId: string; note: string | null } };
  if (b.order) {
    const rows = await prisma.playlistTrack.findMany({ where: { playlistId: id }, include: { track: { select: { spotifyId: true } } } });
    const bySp = new Map(rows.map((r) => [r.track.spotifyId, r]));
    let pos = 0;
    const ops = [];
    for (const sid of b.order) {
      const r = bySp.get(sid);
      if (!r) continue;
      bySp.delete(sid);
      ops.push(prisma.playlistTrack.update({ where: { id: r.id }, data: { position: pos++ } }));
    }
    for (const r of bySp.values()) ops.push(prisma.playlistTrack.update({ where: { id: r.id }, data: { position: pos++ } }));
    await prisma.$transaction(ops);
  }
  if (b.note) {
    const t = await prisma.track.findUnique({ where: { spotifyId: b.note.trackId } });
    if (t) await prisma.playlistTrack.updateMany({ where: { playlistId: id, trackId: t.id }, data: { note: b.note.note || null } });
  }
  return { ok: true };
});
