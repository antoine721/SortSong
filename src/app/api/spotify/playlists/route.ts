import { handler, requireUser } from "@/lib/server/session";
import { listSpotifyPlaylists } from "@/lib/server/library";

export const GET = handler(async () => {
  const user = await requireUser();
  return { playlists: await listSpotifyPlaylists(user.id) };
});
