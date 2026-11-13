import { NextRequest } from "next/server";
import { handler, requireUser } from "@/lib/server/session";
import { upsertTracks } from "@/lib/server/tracks";
import { fetchBpm } from "@/lib/server/mix";
import type { TrackDTO } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

/** G2 : BPM depuis le catalogue Deezer. */
export const POST = handler(async (req: NextRequest, ctx: Ctx) => {
  await requireUser();
  const { id } = await ctx.params;
  const b = (await req.json().catch(() => ({}))) as { track?: TrackDTO };
  if (b.track) await upsertTracks([b.track]);
  return { bpm: await fetchBpm(id) };
});
