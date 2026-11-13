import { NextRequest } from "next/server";
import { handler, requireUser } from "@/lib/server/session";
import { normAlbum, normArtist, normTrack, sp } from "@/lib/server/spotify";
import { enrich } from "@/lib/server/tracks";
import type { TrackDTO } from "@/lib/types";

/** Catalogue Spotify : 10 résultats max par requête (depuis février 2026) → pagination « voir plus ». */
export const GET = handler(async (req: NextRequest) => {
  const user = await requireUser();
  const q = req.nextUrl.searchParams.get("q")?.trim();
  const type = req.nextUrl.searchParams.get("type") || "track,artist,album";
  const offset = Number(req.nextUrl.searchParams.get("offset") || 0);
  if (!q) return { tracks: [], artists: [], albums: [] };
  const r = await sp(user.id, "/search", { query: { q, type, limit: 10, offset } });
  const tracks = (r.tracks?.items || []).map((t: any) => normTrack(t)).filter(Boolean) as TrackDTO[];
  return {
    tracks: await enrich(tracks),
    artists: (r.artists?.items || []).filter(Boolean).map(normArtist),
    albums: (r.albums?.items || []).filter(Boolean).map(normAlbum),
    hasMore: {
      tracks: !!r.tracks?.next,
      artists: !!r.artists?.next,
      albums: !!r.albums?.next,
    },
  };
});
