import { NextRequest, NextResponse } from "next/server";
import { getConfig, originOf } from "@/lib/server/config";
import { getUserId } from "@/lib/server/session";

/** « Se connecter avec Last.fm » : autorisation sur last.fm puis retour sur /api/lastfm/callback. */
export async function GET(req: NextRequest) {
  const origin = originOf(req);
  if (!(await getUserId())) return NextResponse.redirect(new URL("/login", origin));
  const { lastfmApiKey, lastfmSecret } = await getConfig();
  if (!lastfmApiKey || !lastfmSecret) return NextResponse.redirect(new URL("/setup?lastfm=1", origin));
  const url = new URL("https://www.last.fm/api/auth/");
  url.searchParams.set("api_key", lastfmApiKey);
  url.searchParams.set("cb", `${origin}/api/lastfm/callback`);
  return NextResponse.redirect(url);
}
