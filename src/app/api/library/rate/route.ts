import { NextRequest } from "next/server";
import { prisma } from "@/lib/server/db";
import { handler, requireUser, HttpError } from "@/lib/server/session";
import { refreshStatus, upsertTracks } from "@/lib/server/tracks";
import type { TrackDTO } from "@/lib/types";

/**
 * Note un morceau : 1-5 = note (et le remet dans la bibliothèque s'il avait été supprimé),
 * 0 = « ne m'intéresse pas » → supprimé de la bibliothèque et de toutes les playlists,
 * null = redevient « non noté ».
 */
export const POST = handler(async (req: NextRequest) => {
  const user = await requireUser();
  const { track, rating } = (await req.json()) as { track: TrackDTO; rating: number | null };
  if (rating !== null && (!Number.isInteger(rating) || rating < 0 || rating > 5)) throw new HttpError(400, "Note de 0 à 5");
  const map = await upsertTracks([track]);
  const trackId = map.get(track.id);
  if (!trackId) throw new HttpError(404, "Morceau inconnu");
  const lib = await prisma.libraryTrack.findUnique({ where: { userId_trackId: { userId: user.id, trackId } } });
  if (rating === 0) {
    await prisma.playlistTrack.deleteMany({ where: { trackId, playlist: { userId: user.id } } });
    if (lib) await prisma.libraryTrack.update({ where: { id: lib.id }, data: { status: "deleted", rating: null, ratedAt: null } });
  } else {
    const data = { rating, ratedAt: rating ? new Date() : null };
    if (lib) await prisma.libraryTrack.update({ where: { id: lib.id }, data: { ...data, ...(lib.status === "deleted" ? { status: "inbox" } : {}) } });
    else await prisma.libraryTrack.create({ data: { userId: user.id, trackId, source: "search", status: "inbox", addedAt: new Date(), ...data } });
    await refreshStatus(user.id, [trackId]);
  }
  const [inboxCount, unratedCount] = await Promise.all([
    prisma.libraryTrack.count({ where: { userId: user.id, status: "inbox" } }),
    prisma.libraryTrack.count({ where: { userId: user.id, status: { not: "deleted" }, rating: null } }),
  ]);
  return { ok: true, inboxCount, unratedCount };
});
