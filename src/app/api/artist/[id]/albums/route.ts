import { NextRequest } from "next/server";
import { handler, requireUser } from "@/lib/server/session";
import { normAlbum, spSafe } from "@/lib/server/spotify";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const offset = Number(req.nextUrl.searchParams.get("offset") || 0);
  const r = await spSafe(user.id, `/artists/${id}/albums`, { query: { include_groups: "album,single,compilation", limit: 10, offset } });
  return { albums: ((r?.items || []) as any[]).filter(Boolean).map(normAlbum), hasMore: !!r?.next };
});
