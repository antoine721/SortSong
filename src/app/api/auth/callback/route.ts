import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { encrypt } from "@/lib/server/crypto";
import { exchangeCode } from "@/lib/server/spotify";
import { ensureSecret, originOf, spotifyRedirectFor } from "@/lib/server/config";
import { SESSION_COOKIE, SESSION_MAX_AGE, sessionCookieValue } from "@/lib/server/session";

export async function GET(req: NextRequest) {
  await ensureSecret();
  const origin = originOf(req);
  const base = new URL("/", origin);
  const fail = (code: string) => NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(code)}`, base));
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const err = req.nextUrl.searchParams.get("error");
  if (err) return fail(err);
  const verifier = req.cookies.get("ss_pkce")?.value;
  if (!code || !verifier || state !== req.cookies.get("ss_state")?.value) return fail("state");
  try {
    const tok = await exchangeCode(code, verifier, req.cookies.get("ss_redirect")?.value || spotifyRedirectFor(origin));
    const meRes = await fetch("https://api.spotify.com/v1/me", { headers: { Authorization: `Bearer ${tok.access_token}` } });
    if (!meRes.ok) {
      // 403 typique : compte non déclaré dans le tableau de bord (mode développement)
      return fail(meRes.status === 403 ? "not_allowed" : "profile");
    }
    const me = await meRes.json();
    const data = {
      name: me.display_name || me.id,
      email: me.email || null,
      image: me.images?.[0]?.url || null,
      product: me.product || null,
      accessTokenEnc: encrypt(tok.access_token),
      refreshTokenEnc: encrypt(tok.refresh_token || ""),
      accessExpiresAt: new Date(Date.now() + tok.expires_in * 1000),
      authorizedAt: new Date(),
    };
    const user = await prisma.user.upsert({ where: { spotifyUserId: me.id }, create: { spotifyUserId: me.id, ...data }, update: data });
    const res = NextResponse.redirect(new URL("/rate", base));
    res.cookies.set(SESSION_COOKIE, sessionCookieValue(user.id), { httpOnly: true, sameSite: "lax", path: "/", maxAge: SESSION_MAX_AGE, secure: origin.startsWith("https") });
    res.cookies.delete("ss_redirect");
    res.cookies.delete("ss_pkce");
    res.cookies.delete("ss_state");
    return res;
  } catch (e) {
    console.error(e);
    return fail("token");
  }
}
