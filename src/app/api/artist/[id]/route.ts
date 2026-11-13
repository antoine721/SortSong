import { NextRequest } from "next/server";
import { prisma } from "@/lib/server/db";
import { handler, requireUser } from "@/lib/server/session";
import { normAlbum, normArtist, normTrack, spSafe } from "@/lib/server/spotify";
import { enrich } from "@/lib/server/tracks";
import { dzArtistTop, dzSearchArtist } from "@/lib/server/deezer";
import { matchOnSpotify, pool } from "@/lib/server/match";
import type { ArtistDTO, TrackDTO } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };
const DAY = 86400_000;

async function cached<T>(key: string, ttl: number, fn: () => Promise<T>): Promise<T> {
  const hit = await prisma.artistCache.findUnique({ where: { key } });
  if (hit && Date.now() - hit.createdAt.getTime() < ttl) return JSON.parse(hit.data);
  const data = await fn();
  await prisma.artistCache.upsert({ where: { key }, create: { key, data: JSON.stringify(data) }, update: { data: JSON.stringify(data), createdAt: new Date() } });
  return data;
}

export const GET = handler(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const nameHint = req.nextUrl.searchParams.get("name") || "";

  const raw = await spSafe(user.id, `/artists/${id}`);
  const artist: ArtistDTO = raw ? normArtist(raw) : { id, name: nameHint || "Artiste", image: null, genres: [] };

  // Titres populaires : endpoint retiré en mode dev → repli Deezer puis recherche Spotify.
  const top = await cached<TrackDTO[]>(`top:${id}`, DAY, async () => {
    const r = await spSafe(user.id, `/artists/${id}/top-tracks`, { query: { market: "from_token" } });
    let tracks = ((r?.tracks || []) as any[]).map((t) => normTrack(t)).filter(Boolean) as TrackDTO[];
    if (tracks.length) return tracks;
    const dza = await dzSearchArtist(artist.name);
    if (dza) {
      const dtop = await dzArtistTop(dza.id, 10);
      const matched = await pool(dtop, 4, (t) => matchOnSpotify(user.id, { title: t.title, artist: t.artist.name, durationSec: t.duration }));
      tracks = matched.filter((t): t is TrackDTO => !!t && t.artists.some((a) => a.id === id));
    }
    if (tracks.length < 5) {
      const s = await spSafe(user.id, "/search", { query: { q: `artist:"${artist.name}"`, type: "track", limit: 10 } });
      const extra = ((s?.tracks?.items || []) as any[]).map((t) => normTrack(t)).filter((t): t is TrackDTO => !!t && t.artists.some((a) => a.id === id));
      const seen = new Set(tracks.map((t) => t.id));
      tracks = [...tracks, ...extra.filter((t) => !seen.has(t.id))].slice(0, 10);
    }
    return tracks;
  });

  const albumsRes = await spSafe(user.id, `/artists/${id}/albums`, { query: { include_groups: "album,single,compilation", limit: 10 } });
  const albums = ((albumsRes?.items || []) as any[]).filter(Boolean).map(normAlbum);

  return {
    artist,
    top: await enrich(top),
    albums,
    albumsHasMore: !!albumsRes?.next,
  };
});
