/** Catalogue public Deezer (sans clé). Limite : 50 requêtes / 5 s. */
const API = "https://api.deezer.com";
const cache = new Map<string, { at: number; data: any }>();
const TTL = 1000 * 60 * 60 * 6;

let windowStart = 0;
let windowCount = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function throttle() {
  for (;;) {
    const now = Date.now();
    if (now - windowStart > 5000) {
      windowStart = now;
      windowCount = 0;
    }
    if (windowCount < 45) {
      windowCount++;
      return;
    }
    await sleep(5000 - (now - windowStart) + 50);
  }
}

export async function dz<T = any>(path: string, attempt = 0): Promise<T | null> {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < TTL) return hit.data;
  await throttle();
  try {
    const res = await fetch(`${API}${path}`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const json = await res.json();
    if (json?.error) {
      // code 4 = quota dépassé
      if (json.error.code === 4 && attempt < 3) {
        await sleep(1500);
        return dz<T>(path, attempt + 1);
      }
      return null;
    }
    cache.set(path, { at: Date.now(), data: json });
    return json as T;
  } catch {
    return null;
  }
}

export type DzTrack = {
  id: number;
  title: string;
  title_short?: string;
  duration: number;
  isrc?: string;
  bpm?: number;
  artist: { id: number; name: string };
  album?: { id: number; title: string };
};

export async function dzTrackByIsrc(isrc: string): Promise<DzTrack | null> {
  return dz<DzTrack>(`/track/isrc:${encodeURIComponent(isrc)}`);
}

export async function dzTrack(id: number | string): Promise<DzTrack | null> {
  return dz<DzTrack>(`/track/${id}`);
}

export async function dzSearchTrack(title: string, artist: string): Promise<DzTrack[]> {
  const q = `artist:"${artist.replace(/"/g, "")}" track:"${title.replace(/"/g, "")}"`;
  const r = await dz<{ data: DzTrack[] }>(`/search/track?q=${encodeURIComponent(q)}&limit=5`);
  if (r?.data?.length) return r.data;
  const r2 = await dz<{ data: DzTrack[] }>(`/search/track?q=${encodeURIComponent(`${artist} ${title}`)}&limit=5`);
  return r2?.data || [];
}

export async function dzSearchArtist(name: string): Promise<{ id: number; name: string; picture_xl?: string } | null> {
  const r = await dz<{ data: any[] }>(`/search/artist?q=${encodeURIComponent(name)}&limit=5`);
  if (!r?.data?.length) return null;
  const exact = r.data.find((a) => a.name.toLowerCase() === name.toLowerCase());
  return exact || r.data[0];
}

export async function dzArtistRadio(id: number): Promise<DzTrack[]> {
  const r = await dz<{ data: DzTrack[] }>(`/artist/${id}/radio?limit=40`);
  return r?.data || [];
}

export async function dzArtistTop(id: number, limit = 10): Promise<DzTrack[]> {
  const r = await dz<{ data: DzTrack[] }>(`/artist/${id}/top?limit=${limit}`);
  return r?.data || [];
}

export async function dzRelated(id: number): Promise<{ id: number; name: string; picture_xl?: string }[]> {
  const r = await dz<{ data: any[] }>(`/artist/${id}/related?limit=20`);
  return r?.data || [];
}
