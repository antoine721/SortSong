import { NextRequest } from "next/server";
import { handler, requireUser, HttpError } from "@/lib/server/session";
import { importSpotifyPlaylist, parsePlaylistLink } from "@/lib/server/library";

export const maxDuration = 300;

/** Ajoute une playlist interne à partir du lien d'une playlist Spotify. */
export const POST = handler(async (req: NextRequest) => {
  const user = await requireUser();
  const { url, folderId } = (await req.json()) as { url: string; folderId?: string | null };
  const id = parsePlaylistLink(url || "");
  if (!id) throw new HttpError(400, "Lien invalide : colle un lien du type https://open.spotify.com/playlist/…");
  try {
    return await importSpotifyPlaylist(user.id, id, folderId ?? null);
  } catch (e) {
    if (e instanceof HttpError && (e.status === 403 || e.status === 404)) {
      throw new HttpError(
        e.status,
        "Spotify refuse l'accès à cette playlist. En mode développement, l'API peut bloquer les playlists d'autres comptes ou générées par Spotify : suis-la (ou copie-la) dans Spotify puis réessaie.",
      );
    }
    throw e;
  }
});
