import { NextRequest } from "next/server";
import { handler, requireUser, HttpError } from "@/lib/server/session";
import { importFromLink, parseSpotifyLink, resolveShortLink } from "@/lib/server/library";

export const maxDuration = 300;

/** Import d'un ou plusieurs liens Spotify (playlist, album, titre). */
export const POST = handler(async (req: NextRequest) => {
  const user = await requireUser();
  const { urls, createPlaylist, folderId } = (await req.json()) as { urls: string[] | string; createPlaylist?: boolean; folderId?: string | null };
  const list = (Array.isArray(urls) ? urls : String(urls || "").split(/[\s,]+/)).map((u) => u.trim()).filter(Boolean);
  if (!list.length) throw new HttpError(400, "Colle au moins un lien Spotify");
  const results = [];
  for (const u of list.slice(0, 20)) {
    const link = parseSpotifyLink(await resolveShortLink(u));
    if (!link) {
      results.push({ url: u, error: "Lien non reconnu (playlist, album ou titre Spotify ou Deezer attendu)" });
      continue;
    }
    try {
      results.push({ url: u, ...(await importFromLink(user.id, link, { createPlaylist, folderId })) });
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 0;
      results.push({
        url: u,
        error:
          status === 403 || status === 404
            ? "Spotify refuse l'accès (en mode développement, certaines playlists d'autres comptes ou générées par Spotify sont bloquées : copie-la dans ton compte puis réessaie)"
            : e instanceof Error ? e.message : String(e),
      });
    }
  }
  return { results };
});
