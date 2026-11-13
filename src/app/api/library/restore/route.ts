import { NextRequest } from "next/server";
import { prisma } from "@/lib/server/db";
import { handler, requireUser } from "@/lib/server/session";

type Snapshot = {
  memberships: { playlistId: string; trackId: string; position: number; note: string | null; addedAt: string }[];
  library: { trackId: string; status: string }[];
};

/** Annule une suppression de la bibliothèque. */
export const POST = handler(async (req: NextRequest) => {
  const user = await requireUser();
  const { snapshot } = (await req.json()) as { snapshot: Snapshot };
  const owned = new Set((await prisma.playlist.findMany({ where: { userId: user.id }, select: { id: true } })).map((p) => p.id));
  for (const l of snapshot.library) {
    await prisma.libraryTrack.updateMany({ where: { userId: user.id, trackId: l.trackId }, data: { status: l.status } });
  }
  for (const m of snapshot.memberships) {
    if (!owned.has(m.playlistId)) continue;
    const exists = await prisma.playlistTrack.findUnique({ where: { playlistId_trackId: { playlistId: m.playlistId, trackId: m.trackId } } });
    if (!exists) await prisma.playlistTrack.create({ data: { ...m, addedAt: new Date(m.addedAt) } });
  }
  const inboxCount = await prisma.libraryTrack.count({ where: { userId: user.id, status: "inbox" } });
  return { ok: true, inboxCount };
});
