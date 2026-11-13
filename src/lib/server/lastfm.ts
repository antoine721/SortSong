/** API Last.fm (clé gratuite). */
const API = "https://ws.audioscrobbler.com/2.0/";

export function hasLastfm() {
  return !!process.env.LASTFM_API_KEY;
}

async function lf(params: Record<string, string>): Promise<any | null> {
  const key = process.env.LASTFM_API_KEY;
  if (!key) return null;
  const url = new URL(API);
  for (const [k, v] of Object.entries({ ...params, api_key: key, format: "json", autocorrect: "1" })) url.searchParams.set(k, v);
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const j = await res.json();
    return j?.error ? null : j;
  } catch {
    return null;
  }
}

export async function lfSimilarTracks(artist: string, track: string, limit = 60): Promise<{ title: string; artist: string; match: number }[]> {
  const j = await lf({ method: "track.getsimilar", artist, track, limit: String(limit) });
  const list = j?.similartracks?.track || [];
  return list.map((t: any) => ({ title: t.name, artist: t.artist?.name || "", match: Number(t.match) || 0 }));
}

export async function lfSimilarArtists(artist: string, limit = 20): Promise<{ name: string; match: number }[]> {
  const j = await lf({ method: "artist.getsimilar", artist, limit: String(limit) });
  const list = j?.similarartists?.artist || [];
  return list.map((a: any) => ({ name: a.name, match: Number(a.match) || 0 }));
}

export async function lfArtistTopTracks(artist: string, limit = 5): Promise<{ title: string; artist: string }[]> {
  const j = await lf({ method: "artist.gettoptracks", artist, limit: String(limit) });
  const list = j?.toptracks?.track || [];
  return list.map((t: any) => ({ title: t.name, artist: t.artist?.name || artist }));
}
