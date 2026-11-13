import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { encrypt } from "@/lib/server/crypto";
import { originOf } from "@/lib/server/config";
import { lfGetSession } from "@/lib/server/lastfm";
import { getUserId } from "@/lib/server/session";

export async function GET(req: NextRequest) {
  const origin = originOf(req);
  const uid = await getUserId();
  if (!uid) return NextResponse.redirect(new URL("/login", origin));
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.redirect(new URL("/settings?lastfm=refused", origin));
  try {
    const s = await lfGetSession(token);
    await prisma.user.update({ where: { id: uid }, data: { lastfmUser: s.name, lastfmSessionEnc: encrypt(s.key) } });
    return NextResponse.redirect(new URL("/settings?lastfm=ok", origin));
  } catch (e) {
    console.error(e);
    return NextResponse.redirect(new URL(`/settings?lastfm=error&msg=${encodeURIComponent((e as Error).message)}`, origin));
  }
}
