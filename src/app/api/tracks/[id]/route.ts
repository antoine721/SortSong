import { NextRequest } from "next/server";
import { prisma } from "@/lib/server/db";
import { handler, requireUser, HttpError } from "@/lib/server/session";
import { rowToDTO, upsertTracks } from "@/lib/server/tracks";
import type { TrackDTO } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (_req: NextRequest, ctx: Ctx) => {
  await requireUser();
  const { id } = await ctx.params;
  const t = await prisma.track.findUnique({ where: { spotifyId: id }, include: { tags: { select: { tagId: true } } } });
  return { track: t ? { ...rowToDTO(t), bpmSource: t.bpmSource } : null };
});

/** G2-G4 : BPM, tonalité (Camelot), énergie, tags — saisie manuelle. */
export const PATCH = handler(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const b = (await req.json()) as { track?: TrackDTO; bpm?: number | null; key?: string | null; energy?: number | null; tagIds?: string[] };
  let t = await prisma.track.findUnique({ where: { spotifyId: id } });
  if (!t && b.track) {
    await upsertTracks([b.track]);
    t = await prisma.track.findUnique({ where: { spotifyId: id } });
  }
  if (!t) throw new HttpError(404, "Morceau inconnu");
  if (b.key && !/^(1[0-2]|[1-9])[AB]$/.test(b.key)) throw new HttpError(400, "Tonalité Camelot invalide (ex. 8A)");
  await prisma.track.update({
    where: { id: t.id },
    data: {
      ...(b.bpm !== undefined ? { bpm: b.bpm, bpmSource: b.bpm ? "manual" : null } : {}),
      ...(b.key !== undefined ? { key: b.key } : {}),
      ...(b.energy !== undefined ? { energy: b.energy } : {}),
    },
  });
  if (b.tagIds) {
    const valid = (await prisma.tag.findMany({ where: { userId: user.id, id: { in: b.tagIds } }, select: { id: true } })).map((x) => x.id);
    await prisma.$transaction([
      prisma.trackTag.deleteMany({ where: { trackId: t.id, tag: { userId: user.id } } }),
      prisma.trackTag.createMany({ data: valid.map((tagId) => ({ trackId: t!.id, tagId })) }),
    ]);
  }
  const out = await prisma.track.findUnique({ where: { id: t.id }, include: { tags: { select: { tagId: true } } } });
  return { track: rowToDTO(out!) };
});
