import { NextRequest } from "next/server";
import { handler, requireUser } from "@/lib/server/session";
import { importSpotifyPlaylist } from "@/lib/server/library";

export const maxDuration = 300;

export const POST = handler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const { folderId } = (await req.json().catch(() => ({}))) as { folderId?: string | null };
  return importSpotifyPlaylist(user.id, id, folderId ?? null);
});
