import { NextRequest } from "next/server";
import { prisma } from "@/lib/server/db";
import { handler, requireUser } from "@/lib/server/session";

/**
 * Supprime des morceaux de la bibliothèque : retirés de toutes les playlists internes et masqués partout.
 * Statut « deleted » conservé pour qu'une resynchronisation ne les réimporte pas. Renvoie un instantané pour annuler.
 */
export const POST = handler(async (req: NextRequest) => {
  const user = await requireUser();
  const { ids } = (await req.json()) as { ids: string[] };
  const tracks = await prisma.track.findMany({ where: { spotifyId: { in: ids || [] } }, select: { id: true, spotifyId: true } });
  const trackIds = tracks.map((t) => t.id);
  const memberships = await prisma.playlistTrack.findMany({
    where: { trackId: { in: trackIds }, playlist: { userId: user.id } },
    select: { playlistId: true, trackId: true, position: true, note: true, addedAt: true },
  });
  const library = await prisma.libraryTrack.findMany({ where: { userId: user.id, trackId: { in: trackIds } }, select: { trackId: true, status: true } });
  await prisma.$transaction([
    prisma.playlistTrack.deleteMany({ where: { trackId: { in: trackIds }, playlist: { userId: user.id } } }),
    prisma.libraryTrack.updateMany({ where: { userId: user.id, trackId: { in: trackIds } }, data: { status: "deleted" } }),
  ]);
  const inboxCount = await prisma.libraryTrack.count({ where: { userId: user.id, status: "inbox" } });
  return { snapshot: { memberships, library }, inboxCount };
});
