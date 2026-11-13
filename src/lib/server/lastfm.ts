import crypto from "node:crypto";
import { getConfig } from "./config";

/** API Last.fm : clé gratuite (lecture) + shared secret (connexion du compte, scrobbling). */
const API = "https://ws.audioscrobbler.com/2.0/";

export async function hasLastfm() {
  return !!(await getConfig()).lastfmApiKey;
}

function signature(params: Record<string, string>, secret: string) {
  const base = Object.keys(params)
    .filter((k) => k !== "format" && k !== "callback")
    .sort()
    .map((k) => k + params[k])
    .join("");
  return crypto.createHash("md5").update(base + secret, "utf8").digest("hex");
}

/** Appel Last.fm. signed = requiert le shared secret ; post = méthode d'écriture. */
export async function lf(params: Record<string, string>, opts: { signed?: boolean; post?: boolean; throwOnError?: boolean } = {}): Promise<any | null> {
  const { lastfmApiKey, lastfmSecret } = await getConfig();
  if (!lastfmApiKey) return null;
  const p: Record<string, string> = { ...params, api_key: lastfmApiKey };
  if (opts.signed) {
    if (!lastfmSecret) throw new Error("Shared secret Last.fm non configuré");
    p.api_sig = signature(p, lastfmSecret);
  }
  p.format = "json";
  try {
    const body = new URLSearchParams(p);
    const res = opts.post
      ? await fetch(API, { method: "POST", body, cache: "no-store", signal: AbortSignal.timeout(10000) })
      : await fetch(`${API}?${body}`, { cache: "no-store", signal: AbortSignal.timeout(10000) });
    const j = await res.json().catch(() => null);
    if (!res.ok || !j || j.error) {
      if (opts.throwOnError) throw new Error(j?.message || `Last.fm ${res.status}`);
      return null;
    }
    return j;
  } catch (e) {
    if (opts.throwOnError) throw e;
    return null;
  }
}

export async function lfSimilarTracks(artist: string, track: string, limit = 60): Promise<{ title: string; artist: string; match: number }[]> {
  const j = await lf({ method: "track.getsimilar", artist, track, limit: String(limit), autocorrect: "1" });
  const list = j?.similartracks?.track || [];
  return list.map((t: any) => ({ title: t.name, artist: t.artist?.name || "", match: Number(t.match) || 0 }));
}

export async function lfSimilarArtists(artist: string, limit = 20): Promise<{ name: string; match: number }[]> {
  const j = await lf({ method: "artist.getsimilar", artist, limit: String(limit), autocorrect: "1" });
  const list = j?.similarartists?.artist || [];
  return list.map((a: any) => ({ name: a.name, match: Number(a.match) || 0 }));
}

/** Échange le jeton du retour d'autorisation contre une clé de session permanente. */
export async function lfGetSession(token: string): Promise<{ name: string; key: string }> {
  const j = await lf({ method: "auth.getSession", token }, { signed: true, throwOnError: true });
  return { name: j.session.name, key: j.session.key };
}

export type LfTrack = { title: string; artist: string; playcount?: number; date?: number };

/** Titres aimés (♥) ou titres les plus écoutés d'un compte Last.fm. */
export async function lfUserTracks(user: string, kind: "loved" | "top", max: number, period = "overall"): Promise<LfTrack[]> {
  const out: LfTrack[] = [];
  for (let page = 1; out.length < max && page <= 20; page++) {
    const j =
      kind === "loved"
        ? await lf({ method: "user.getlovedtracks", user, limit: "200", page: String(page) })
        : await lf({ method: "user.gettoptracks", user, limit: "200", page: String(page), period });
    const list = (kind === "loved" ? j?.lovedtracks?.track : j?.toptracks?.track) || [];
    for (const t of list) {
      out.push({
        title: t.name,
        artist: t.artist?.name || t.artist?.["#text"] || "",
        playcount: t.playcount ? Number(t.playcount) : undefined,
        date: t.date?.uts ? Number(t.date.uts) : undefined,
      });
    }
    const attr = kind === "loved" ? j?.lovedtracks?.["@attr"] : j?.toptracks?.["@attr"];
    if (!list.length || !attr || page >= Number(attr.totalPages)) break;
  }
  return out.slice(0, max);
}

export async function lfNowPlaying(sk: string, t: { artist: string; title: string; album?: string; durationSec?: number }) {
  return lf(
    { method: "track.updateNowPlaying", sk, artist: t.artist, track: t.title, ...(t.album ? { album: t.album } : {}), ...(t.durationSec ? { duration: String(t.durationSec) } : {}) },
    { signed: true, post: true },
  );
}

export async function lfScrobble(sk: string, t: { artist: string; title: string; album?: string; durationSec?: number; timestamp: number }) {
  return lf(
    {
      method: "track.scrobble",
      sk,
      "artist[0]": t.artist,
      "track[0]": t.title,
      "timestamp[0]": String(t.timestamp),
      ...(t.album ? { "album[0]": t.album } : {}),
      ...(t.durationSec ? { "duration[0]": String(t.durationSec) } : {}),
    },
    { signed: true, post: true, throwOnError: true },
  );
}
