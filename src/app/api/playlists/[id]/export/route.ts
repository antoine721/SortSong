import { NextRequest } from "next/server";
import { prisma } from "@/lib/server/db";
import { handler, requireUser, HttpError } from "@/lib/server/session";
import { sp } from "@/lib/server/spotify";
import { playlistTracks } from "@/lib/server/playlists";

type Ctx = { params: Promise<{ id: string }> };

/** C9 : crée une NOUVELLE playlist Spotify (privée) à partir d'une playlist interne. Action explicite uniquement. */
export const POST = handler(async (_req: NextRequest, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const pl = await prisma.playlist.findFirst({ where: { id, userId: user.id } });
  if (!pl) throw new HttpError(404, "Playlist introuvable");
  const tracks = await playlistTracks(user.id, id);
  if (!tracks.length) throw new HttpError(400, "Playlist vide");
  const body = JSON.stringify({ name: pl.name, description: (pl.description || "Exporté depuis SortSong").slice(0, 300), public: false });
  let created: any;
  try {
    created = await sp(user.id, "/me/playlists", { method: "POST", body });
  } catch {
    // Ancien endpoint (avant février 2026)
    created = await sp(user.id, `/users/${encodeURIComponent(user.spotifyUserId)}/playlists`, { method: "POST", body });
  }
  const uris = tracks.map((t) => `spotify:track:${t.id}`);
  for (let i = 0; i < uris.length; i += 100) {
    const chunk = JSON.stringify({ uris: uris.slice(i, i + 100) });
    try {
      await sp(user.id, `/playlists/${created.id}/items`, { method: "POST", body: chunk });
    } catch {
      await sp(user.id, `/playlists/${created.id}/tracks`, { method: "POST", body: chunk });
    }
  }
  await prisma.playlist.update({ where: { id }, data: { spotifyExportId: created.id } });
  return { spotifyId: created.id, url: created.external_urls?.spotify || `https://open.spotify.com/playlist/${created.id}`, count: uris.length };
});
