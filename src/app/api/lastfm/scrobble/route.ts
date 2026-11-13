import { NextRequest } from "next/server";
import { decrypt } from "@/lib/server/crypto";
import { lfNowPlaying, lfScrobble } from "@/lib/server/lastfm";
import { handler, requireUser } from "@/lib/server/session";
import type { TrackDTO } from "@/lib/types";

/** Scrobbling Last.fm : « en cours d'écoute » puis scrobble après la moitié du titre (ou 4 min). */
export const POST = handler(async (req: NextRequest) => {
  const user = await requireUser();
  if (!user.lastfmSessionEnc || !user.scrobble) return { ok: false, skipped: true };
  const b = (await req.json()) as { track: TrackDTO; startedAt?: number; nowPlaying?: boolean };
  const sk = decrypt(user.lastfmSessionEnc);
  const t = {
    artist: b.track.artists[0]?.name || "",
    title: b.track.title,
    album: b.track.album || undefined,
    durationSec: Math.round(b.track.durationMs / 1000) || undefined,
  };
  if (b.nowPlaying) await lfNowPlaying(sk, t);
  else await lfScrobble(sk, { ...t, timestamp: Math.floor((b.startedAt || Date.now()) / 1000) });
  return { ok: true };
});
