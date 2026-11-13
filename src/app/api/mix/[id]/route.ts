import { NextRequest } from "next/server";
import { prisma } from "@/lib/server/db";
import { handler, requireUser, HttpError } from "@/lib/server/session";
import { normTrack, spSafe } from "@/lib/server/spotify";
import { rowToDTO, upsertTracks, enrich } from "@/lib/server/tracks";
import { buildMix } from "@/lib/server/mix";
import type { TrackDTO } from "@/lib/types";

export const maxDuration = 120;
type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const refresh = req.nextUrl.searchParams.get("refresh") === "1";
  let seed: TrackDTO | null = null;
  const row = await prisma.track.findUnique({ where: { spotifyId: id } });
  if (row) seed = rowToDTO(row);
  else {
    const raw = await spSafe(user.id, `/tracks/${id}`);
    seed = raw ? normTrack(raw) : null;
    if (seed) await upsertTracks([seed]);
  }
  if (!seed) throw new HttpError(404, "Morceau de départ introuvable");
  const tracks = await buildMix(
    user.id,
    { spotifyId: seed.id, title: seed.title, artist: seed.artists[0]?.name || "", isrc: seed.isrc, durationMs: seed.durationMs },
    { refresh },
  );
  return { seed: (await enrich([seed]))[0], tracks };
});
