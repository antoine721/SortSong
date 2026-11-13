import { NextRequest } from "next/server";
import { handler, requireUser } from "@/lib/server/session";
import { prisma } from "@/lib/server/db";

/** Méta locales (BPM, clé, énergie, tags) pour une liste d'IDs Spotify. */
export const POST = handler(async (req: NextRequest) => {
  await requireUser();
  const { ids } = (await req.json()) as { ids: string[] };
  const rows = await prisma.track.findMany({
    where: { spotifyId: { in: (ids || []).slice(0, 2000) } },
    select: { spotifyId: true, bpm: true, key: true, energy: true, tags: { select: { tagId: true } } },
  });
  return { meta: Object.fromEntries(rows.map((r) => [r.spotifyId, { bpm: r.bpm, key: r.key, energy: r.energy, tagIds: r.tags.map((t) => t.tagId) }])) };
});
