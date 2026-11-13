import { NextRequest } from "next/server";
import { handler, requireUser, HttpError } from "@/lib/server/session";
import { normAlbum, normTrack, paginate, spSafe } from "@/lib/server/spotify";
import { enrich } from "@/lib/server/tracks";
import type { TrackDTO } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (_req: NextRequest, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const raw = await spSafe(user.id, `/albums/${id}`);
  if (!raw) throw new HttpError(404, "Album introuvable");
  const album = normAlbum(raw);
  let items: any[] = raw.tracks?.items || [];
  if (raw.tracks?.next) {
    items = [...items, ...(await paginate(user.id, raw.tracks.next, 500))];
  }
  const tracks = items.map((t) => normTrack(t, raw)).filter(Boolean) as TrackDTO[];
  return { album: { ...album, label: raw.label || null }, tracks: await enrich(tracks) };
});
