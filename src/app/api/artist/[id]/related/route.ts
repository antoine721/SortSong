import { NextRequest } from "next/server";
import { prisma } from "@/lib/server/db";
import { handler, requireUser } from "@/lib/server/session";
import { normArtist, spSafe } from "@/lib/server/spotify";
import { dzRelated, dzSearchArtist } from "@/lib/server/deezer";
import { lfSimilarArtists } from "@/lib/server/lastfm";
import { pool } from "@/lib/server/match";
import { similarity } from "@/lib/server/text";
import type { ArtistDTO } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

/** E3 : artistes proches via Last.fm + Deezer, retrouvés sur Spotify. Cache 7 jours. */
export const GET = handler(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const name = req.nextUrl.searchParams.get("name") || "";
  const key = `related:${id}`;
  const hit = await prisma.artistCache.findUnique({ where: { key } });
  if (hit && Date.now() - hit.createdAt.getTime() < 7 * 86400_000) return { artists: JSON.parse(hit.data) };

  const names = new Map<string, number>();
  for (const a of await lfSimilarArtists(name, 20)) names.set(a.name, a.match);
  const dza = await dzSearchArtist(name);
  if (dza) for (const a of await dzRelated(dza.id)) names.set(a.name, Math.max(names.get(a.name) || 0, 0.5));
  const ranked = [...names.entries()].sort((a, b) => b[1] - a[1]).slice(0, 16).map(([n]) => n);

  const found = await pool(ranked, 4, async (n) => {
    const r = await spSafe(user.id, "/search", { query: { q: n, type: "artist", limit: 3 } });
    const best = ((r?.artists?.items || []) as any[]).find((a) => a && similarity(a.name, n) > 0.85);
    return best ? normArtist(best) : null;
  });
  const artists = found.filter((a): a is ArtistDTO => !!a && a.id !== id);
  const uniq = [...new Map(artists.map((a) => [a.id, a])).values()].slice(0, 12);
  await prisma.artistCache.upsert({ where: { key }, create: { key, data: JSON.stringify(uniq) }, update: { data: JSON.stringify(uniq), createdAt: new Date() } });
  return { artists: uniq };
});
