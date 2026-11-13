import { NextRequest, NextResponse } from "next/server";
import { randomString, sha256base64url } from "@/lib/server/crypto";
import { SPOTIFY_SCOPES } from "@/lib/server/spotify";
import { getConfig, originOf, spotifyRedirectFor } from "@/lib/server/config";

export async function GET(req: NextRequest) {
  const origin = originOf(req);
  // Spotify refuse « localhost » : on bascule sur 127.0.0.1 (même port) pour que le cookie suive.
  const u = new URL(origin);
  if (u.hostname === "localhost" && !process.env.SPOTIFY_REDIRECT_URI) {
    u.hostname = "127.0.0.1";
    return NextResponse.redirect(new URL("/api/auth/login", u));
  }
  const { spotifyClientId } = await getConfig();
  if (!spotifyClientId) return NextResponse.redirect(new URL("/setup", origin));
  const redirectUri = spotifyRedirectFor(origin);
  const verifier = randomString(64);
  const state = randomString(16);
  const url = new URL("https://accounts.spotify.com/authorize");
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: spotifyClientId,
    scope: SPOTIFY_SCOPES.join(" "),
    redirect_uri: redirectUri,
    state,
    code_challenge_method: "S256",
    code_challenge: sha256base64url(verifier),
  }).toString();
  const res = NextResponse.redirect(url);
  const opts = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 600, secure: origin.startsWith("https") };
  res.cookies.set("ss_pkce", verifier, opts);
  res.cookies.set("ss_state", state, opts);
  res.cookies.set("ss_redirect", redirectUri, opts);
  return res;
}
