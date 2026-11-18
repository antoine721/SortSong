"use client";
import { create } from "zustand";

/**
 * Lecteur d'extraits de 30 s (MP3 Deezer) directement dans la page, sans l'appli Spotify.
 * Les extraits des morceaux suivants sont préchargés pour démarrer instantanément.
 */
type PState = {
  playingId: string | null;
  paused: boolean;
  time: number;
  duration: number;
  blocked: boolean; // lecture auto bloquée par le navigateur (pas encore d'interaction)
};

export const usePreview = create<PState>(() => ({ playingId: null, paused: true, time: 0, duration: 30, blocked: false }));

const URL_TTL = 8 * 60 * 1000; // les URL signées Deezer expirent
const urls = new Map<string, { url: string | null; at: number }>();
const audios = new Map<string, HTMLAudioElement>();
let pending: Promise<void> | null = null;
let volume = 0.8;

export function setPreviewVolume(v: number) {
  volume = v;
  audios.forEach((a) => (a.volume = v));
}

/** Récupère (en un appel) les URL d'extraits manquantes ou expirées. */
export async function resolvePreviews(ids: string[]): Promise<void> {
  if (pending) await pending.catch(() => {});
  const now = Date.now();
  const missing = ids.filter((id) => {
    const u = urls.get(id);
    return !u || (u.url && now - u.at > URL_TTL);
  });
  if (!missing.length) return;
  pending = (async () => {
    const r = await fetch(`/api/preview?ids=${missing.join(",")}`);
    if (!r.ok) return;
    const { previews } = (await r.json()) as { previews: Record<string, string | null> };
    for (const [id, url] of Object.entries(previews)) urls.set(id, { url, at: Date.now() });
  })();
  try {
    await pending;
  } finally {
    pending = null;
  }
}

export function hasPreview(id: string): boolean | undefined {
  const u = urls.get(id);
  return u ? !!u.url : undefined;
}

function audioFor(id: string): HTMLAudioElement | null {
  const u = urls.get(id)?.url;
  if (!u) return null;
  let a = audios.get(id);
  if (a && a.src !== u) {
    a.pause();
    a = undefined;
  }
  if (!a) {
    a = new Audio();
    a.preload = "auto";
    a.volume = volume;
    a.src = u;
    a.load();
    const sync = () => {
      if (usePreview.getState().playingId !== id) return;
      usePreview.setState({ time: a!.currentTime, duration: a!.duration || 30, paused: a!.paused });
    };
    a.addEventListener("timeupdate", sync);
    a.addEventListener("play", sync);
    a.addEventListener("pause", sync);
    a.addEventListener("ended", sync);
    audios.set(id, a);
  }
  return a;
}

/** Précharge ces morceaux et libère les autres (garde aussi celui en cours). */
export function preloadPreviews(ids: string[]) {
  const keep = new Set(ids);
  const playing = usePreview.getState().playingId;
  if (playing) keep.add(playing);
  for (const [id, a] of audios) {
    if (!keep.has(id)) {
      a.pause();
      a.removeAttribute("src");
      a.load();
      audios.delete(id);
    }
  }
  ids.forEach((id) => audioFor(id));
}

/** Joue l'extrait du morceau (depuis le début). Renvoie false s'il n'y a pas d'extrait. */
export async function playPreview(id: string): Promise<boolean> {
  const a = audioFor(id);
  if (!a) return false;
  for (const [other, x] of audios) if (other !== id) x.pause();
  usePreview.setState({ playingId: id, time: 0, duration: a.duration || 30, paused: false });
  try {
    a.currentTime = 0;
    await a.play();
    usePreview.setState({ blocked: false });
  } catch (e) {
    if ((e as Error).name === "NotAllowedError") usePreview.setState({ blocked: true, paused: true });
  }
  return true;
}

export function togglePreview() {
  const id = usePreview.getState().playingId;
  const a = id ? audios.get(id) : null;
  if (!a) return;
  if (a.paused) a.play().then(() => usePreview.setState({ blocked: false })).catch(() => {});
  else a.pause();
}

export function seekPreview(sec: number) {
  const id = usePreview.getState().playingId;
  const a = id ? audios.get(id) : null;
  if (a) a.currentTime = Math.max(0, Math.min(sec, (a.duration || 30) - 0.1));
}

export function stopPreviews() {
  audios.forEach((a) => a.pause());
  usePreview.setState({ playingId: null, paused: true, time: 0 });
}
