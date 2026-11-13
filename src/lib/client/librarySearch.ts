import type { TrackDTO } from "@/lib/types";
import { normText } from "./format";

const cache = new WeakMap<TrackDTO, string>();
function hay(t: TrackDTO) {
  let h = cache.get(t);
  if (!h) {
    h = normText(`${t.title} ${t.artists.map((a) => a.name).join(" ")} ${t.album}`);
    cache.set(t, h);
  }
  return h;
}

/** Recherche instantanée dans la bibliothèque (tous les mots doivent correspondre). */
export function searchLibrary<T extends TrackDTO>(tracks: T[], q: string, limit = Infinity): T[] {
  const words = normText(q).split(/\s+/).filter(Boolean);
  if (!words.length) return tracks.slice(0, limit);
  const out: { t: T; score: number }[] = [];
  for (const t of tracks) {
    const h = hay(t);
    if (words.every((w) => h.includes(w))) {
      const title = normText(t.title);
      const score = (title.startsWith(words[0]) ? 0 : 1) + (title.includes(words.join(" ")) ? 0 : 1);
      out.push({ t, score });
    }
  }
  out.sort((a, b) => a.score - b.score);
  return out.slice(0, limit).map((x) => x.t);
}
