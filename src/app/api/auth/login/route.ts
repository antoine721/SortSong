import { NextResponse } from "next/server";
import { randomString, sha256base64url } from "@/lib/server/crypto";
import { SPOTIFY_SCOPES, clientId, redirectUri } from "@/lib/server/spotify";

export async function GET() {
  let id: string;
  try {
    id = clientId();
  } catch {
    return NextResponse.redirect(new URL("/login?error=config", redirectUri()));
  }
  const verifier = randomString(64);
  const state = randomString(16);
  const url = new URL("https://accounts.spotify.com/authorize");
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: id,
    scope: SPOTIFY_SCOPES.join(" "),
    redirect_uri: redirectUri(),
    state,
    code_challenge_method: "S256",
    code_challenge: sha256base64url(verifier),
  }).toString();
  const res = NextResponse.redirect(url);
  const opts = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 600 };
  res.cookies.set("ss_pkce", verifier, opts);
  res.cookies.set("ss_state", state, opts);
  return res;
}
