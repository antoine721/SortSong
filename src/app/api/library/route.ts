import { prisma } from "@/lib/server/db";
import { handler, requireUser } from "@/lib/server/session";
import { rowToDTO } from "@/lib/server/tracks";

/** Toute la bibliothèque (filtrage/tri côté client pour une recherche instantanée). */
export const GET = handler(async () => {
  const user = await requireUser();
  const rows = await prisma.libraryTrack.findMany({
    where: { userId: user.id },
    include: { track: { include: { tags: { select: { tagId: true } } } } },
    orderBy: { addedAt: "desc" },
  });
  return {
    tracks: rows.map((r) => ({ ...rowToDTO(r.track), addedAt: r.addedAt.toISOString(), status: r.status, source: r.source, sourceRef: r.sourceRef })),
  };
});
