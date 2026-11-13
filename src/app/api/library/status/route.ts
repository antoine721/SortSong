import { NextRequest } from "next/server";
import { prisma } from "@/lib/server/db";
import { handler, requireUser, HttpError } from "@/lib/server/session";
import { upsertTracks, refreshStatus } from "@/lib/server/tracks";
import type { TrackDTO } from "@/lib/types";

/** Écarter / remettre à trier des morceaux (ou les ajouter à la bibliothèque). */
export const POST = handler(async (req: NextRequest) => {
  const user = await requireUser();
  const body = (await req.json()) as { ids?: string[]; tracks?: TrackDTO[]; status: "inbox" | "dismissed" };
  if (!["inbox", "dismissed"].includes(body.status)) throw new HttpError(400, "Statut invalide");
  if (body.tracks?.length) {
    const map = await upsertTracks(body.tracks);
    const existing = new Set((await prisma.libraryTrack.findMany({ where: { userId: user.id, trackId: { in: [...map.values()] } } })).map((l) => l.trackId));
    const now = new Date();
    const data = [...map.values()].filter((id) => !existing.has(id)).map((trackId) => ({ userId: user.id, trackId, source: "search", status: "inbox", addedAt: now }));
    if (data.length) await prisma.libraryTrack.createMany({ data });
  }
  const spIds = [...(body.ids || []), ...(body.tracks || []).map((t) => t.id)];
  const tracks = await prisma.track.findMany({ where: { spotifyId: { in: spIds } }, select: { id: true } });
  const ids = tracks.map((t) => t.id);
  await prisma.libraryTrack.updateMany({ where: { userId: user.id, trackId: { in: ids } }, data: { status: body.status } });
  await refreshStatus(user.id, ids); // un morceau rangé reste « rangé »
  const inboxCount = await prisma.libraryTrack.count({ where: { userId: user.id, status: "inbox" } });
  return { ok: true, inboxCount };
});
