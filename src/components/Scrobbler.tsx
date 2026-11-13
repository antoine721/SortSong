"use client";
import { useEffect, useRef } from "react";
import { useApp } from "@/store/app";
import { usePlayer } from "@/store/player";

/** Envoie les écoutes à Last.fm (règle officielle : moitié du titre ou 4 min, titres > 30 s). */
export function Scrobbler() {
  const enabled = useApp((s) => !!s.me?.lastfm?.scrobble);
  const state = useRef({ id: "", listened: 0, startedAt: 0, done: false, last: Date.now() });
  useEffect(() => {
    if (!enabled) return;
    const send = (body: unknown) => fetch("/api/lastfm/scrobble", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => {});
    const t = setInterval(() => {
      const p = usePlayer.getState();
      const s = state.current;
      const now = Date.now();
      const cur = p.current;
      if (!cur) return;
      if (cur.id !== s.id) {
        state.current = { id: cur.id, listened: 0, startedAt: now, done: false, last: now };
        if (!p.paused) send({ track: cur, nowPlaying: true });
        return;
      }
      if (!p.paused) s.listened += now - s.last;
      s.last = now;
      const dur = p.duration || cur.durationMs;
      if (!s.done && dur > 30000 && s.listened >= Math.min(dur / 2, 240000)) {
        s.done = true;
        send({ track: cur, startedAt: s.startedAt });
      }
    }, 1000);
    return () => clearInterval(t);
  }, [enabled]);
  return null;
}
