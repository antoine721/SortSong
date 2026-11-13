import { prisma } from "./db";
import { normTrack, sp } from "./spotify";
import { similarity, norm } from "./text";
import { rowToDTO } from "./tracks";
import type { TrackDTO } from "../types";

export type Candidate = { title: string; artist: string; isrc?: string | null; durationSec?: number | null; bpm?: number | null };

function score(c: Candidate, t: TrackDTO): number {
  const ts = similarity(c.title, t.title);
  const as = Math.max(...t.artists.map((a) => similarity(c.artist, a.name)), 0);
  let s = ts * 0.6 + as * 0.4;
  if (c.durationSec && t.durationMs) {
    const diff = Math.abs(c.durationSec - t.durationMs / 1000);
    if (diff > 15) s -= Math.min(0.3, diff / 200);
  }
  return s;
}

/**
 * Retrouve un morceau externe (Last.fm / Deezer) sur Spotify.
 * 1) cache local par ISRC, 2) recherche Spotify isrc:, 3) titre + artiste avec score ; doute → null.
 */
export async function matchOnSpotify(userId: string, c: Candidate): Promise<TrackDTO | null> {
  if (c.isrc) {
    const local = await prisma.track.findFirst({ where: { isrc: c.isrc } });
    if (local) return rowToDTO(local);
    try {
      const r = await sp(userId, "/search", { query: { q: `isrc:${c.isrc}`, type: "track", limit: 3 } });
      const items = (r?.tracks?.items || []).map((t: any) => normTrack(t)).filter(Boolean) as TrackDTO[];
      const best = items.find((t) => score(c, t) > 0.45) || (items.length === 1 ? items[0] : null);
      if (best) return { ...best, isrc: best.isrc || c.isrc };
    } catch {}
  }
  // Cache local par titre + artiste normalisés
  const nt = norm(c.title);
  const local = await prisma.track.findMany({ where: { title: { contains: c.title.slice(0, 40) } }, take: 10 });
  for (const l of local) {
    const d = rowToDTO(l);
    if (norm(d.title) === nt && score(c, d) > 0.85) return d;
  }
  try {
    const q = `track:${c.title.replace(/["']/g, "")} artist:${c.artist.replace(/["']/g, "")}`;
    const r = await sp(userId, "/search", { query: { q, type: "track", limit: 5 } });
    let items = (r?.tracks?.items || []).map((t: any) => normTrack(t)).filter(Boolean) as TrackDTO[];
    if (!items.length) {
      const r2 = await sp(userId, "/search", { query: { q: `${c.title} ${c.artist}`, type: "track", limit: 5 } });
      items = (r2?.tracks?.items || []).map((t: any) => normTrack(t)).filter(Boolean) as TrackDTO[];
    }
    let best: TrackDTO | null = null;
    let bestScore = 0;
    for (const t of items) {
      const s = score(c, t);
      if (s > bestScore) {
        bestScore = s;
        best = t;
      }
    }
    return bestScore >= 0.78 ? best : null;
  } catch {
    return null;
  }
}

/** Exécute des tâches avec une concurrence limitée. */
export async function pool<T, R>(items: T[], n: number, fn: (x: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k], k);
      }
    }),
  );
  return out;
}
