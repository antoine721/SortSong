import { NextRequest } from "next/server";
import { prisma } from "@/lib/server/db";
import { envLocked, getConfig, originOf, setConfig, spotifyRedirectFor } from "@/lib/server/config";
import { getUserId, handler, HttpError } from "@/lib/server/session";

/** La configuration est libre tant que Spotify n'est pas configuré, ensuite réservée à l'utilisateur connecté. */
async function canEdit() {
  const cfg = await getConfig();
  if (!cfg.spotifyClientId) return true;
  const uid = await getUserId();
  if (uid) return true;
  return (await prisma.user.count()) === 0;
}

export const GET = handler(async (req: NextRequest) => {
  const cfg = await getConfig();
  const origin = originOf(req);
  const editable = await canEdit();
  return {
    origin,
    spotifyRedirectUri: spotifyRedirectFor(origin),
    lastfmCallback: `${origin}/api/lastfm/callback`,
    hasSpotify: !!cfg.spotifyClientId,
    hasLastfm: !!cfg.lastfmApiKey,
    hasLastfmSecret: !!cfg.lastfmSecret,
    // Valeurs visibles seulement si modifiables (le Client ID et la clé API ne sont pas secrets, le shared secret jamais renvoyé).
    spotifyClientId: editable ? cfg.spotifyClientId : null,
    lastfmApiKey: editable ? cfg.lastfmApiKey : null,
    locked: envLocked(),
    editable,
    isLocalhost: new URL(origin).hostname === "localhost",
  };
});

export const POST = handler(async (req: NextRequest) => {
  if (!(await canEdit())) throw new HttpError(403, "Connecte-toi pour modifier la configuration");
  const b = (await req.json()) as { spotifyClientId?: string; lastfmApiKey?: string; lastfmSecret?: string };
  const locked = envLocked();
  const clean = (v?: string) => (v === undefined ? undefined : v.trim());
  if (b.spotifyClientId !== undefined && !locked.spotifyClientId && b.spotifyClientId && !/^[0-9a-f]{32}$/i.test(b.spotifyClientId.trim()))
    throw new HttpError(400, "Le Client ID Spotify fait 32 caractères hexadécimaux");
  if (b.lastfmApiKey && !/^[0-9a-f]{32}$/i.test(b.lastfmApiKey.trim())) throw new HttpError(400, "La clé API Last.fm fait 32 caractères hexadécimaux");
  if (b.lastfmSecret && !/^[0-9a-f]{32}$/i.test(b.lastfmSecret.trim())) throw new HttpError(400, "Le shared secret Last.fm fait 32 caractères hexadécimaux");
  await setConfig({
    ...(locked.spotifyClientId ? {} : { spotifyClientId: clean(b.spotifyClientId) }),
    ...(locked.lastfmApiKey ? {} : { lastfmApiKey: clean(b.lastfmApiKey) }),
    ...(locked.lastfmSecret || b.lastfmSecret === undefined || b.lastfmSecret === "" ? {} : { lastfmSecret: clean(b.lastfmSecret) }),
  });
  return { ok: true };
});
