import { NextRequest } from "next/server";
import { prisma } from "@/lib/server/db";
import { handler, requireUser } from "@/lib/server/session";
import { refreshStatus } from "@/lib/server/tracks";

/** Annule la suppression d'une playlist à partir de son instantané. */
export const POST = handler(async (req: NextRequest) => {
  const user = await requireUser();
  const { snapshot } = (await req.json()) as { snapshot: { playlist: any; tracks: { trackId: string; position: number; note: string | null; addedAt: string }[] } };
  const p = snapshot.playlist;
  await prisma.playlist.create({
    data: {
      id: p.id,
      userId: user.id,
      folderId: p.folderId,
      name: p.name,
      color: p.color,
      description: p.description,
      position: p.position,
      hotkey: p.hotkey,
      rules: p.rules,
      spotifyExportId: p.spotifyExportId,
    },
  });
  if (snapshot.tracks.length) {
    await prisma.playlistTrack.createMany({
      data: snapshot.tracks.map((t) => ({ playlistId: p.id, trackId: t.trackId, position: t.position, note: t.note, addedAt: new Date(t.addedAt) })),
    });
  }
  await refreshStatus(user.id, snapshot.tracks.map((t) => t.trackId));
  return { ok: true };
});
