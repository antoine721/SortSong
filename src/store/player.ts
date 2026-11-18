"use client";
import { create } from "zustand";
import type { TrackDTO } from "@/lib/types";
import { useApp } from "./app";

/* ------------------------------------------------------------------ */
/* Jeton + appels Web API côté navigateur (lecture / Spotify Connect)  */
/* ------------------------------------------------------------------ */
let tokenCache: { token: string; exp: number } | null = null;
export async function getToken(): Promise<string> {
  if (tokenCache && tokenCache.exp - Date.now() > 60_000) return tokenCache.token;
  const r = await fetch("/api/auth/token");
  if (!r.ok) throw new Error("Session expirée");
  const j = await r.json();
  tokenCache = { token: j.accessToken, exp: new Date(j.expiresAt).getTime() };
  return j.accessToken;
}

async function spc(path: string, init: RequestInit = {}, attempt = 0): Promise<any> {
  const token = await getToken();
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.body ? { "Content-Type": "application/json" } : {}) },
  });
  if (res.status === 429 && attempt < 3) {
    await new Promise((r) => setTimeout(r, (Number(res.headers.get("Retry-After")) || 1) * 1000));
    return spc(path, init, attempt + 1);
  }
  if (res.status === 204 || res.status === 202) return null;
  const text = await res.text();
  const j = text ? (() => { try { return JSON.parse(text); } catch { return null; } })() : null;
  if (!res.ok) {
    const err = new Error(j?.error?.message || `Spotify ${res.status}`) as Error & { status?: number; reason?: string };
    err.status = res.status;
    err.reason = j?.error?.reason;
    throw err;
  }
  return j;
}

/* ------------------------------------------------------------------ */
export type Device = { id: string; name: string; type: string; is_active: boolean; volume_percent: number | null };

type PlayerState = {
  mode: "init" | "sdk" | "connect";
  sdkStatus: "idle" | "loading" | "ready" | "failed";
  sdkError: string | null;
  sdkDeviceId: string | null;
  connectDeviceId: string | null;
  devices: Device[];
  current: TrackDTO | null;
  paused: boolean;
  position: number;
  duration: number;
  updatedAt: number;
  volume: number;
  queue: TrackDTO[];
  index: number;
  contextLabel: string | null;
  queueDirty: boolean;
  windowEnd: number;
  lastError: string | null;

  init: () => void;
  setMode: (m: "sdk" | "connect") => void;
  refreshDevices: () => Promise<Device[]>;
  setConnectDevice: (id: string) => Promise<void>;
  playList: (tracks: TrackDTO[], start: number, label?: string, startMs?: number) => Promise<void>;
  playTrack: (t: TrackDTO) => Promise<void>;
  playNext: (t: TrackDTO) => Promise<void>;
  addToQueueEnd: (t: TrackDTO) => void;
  removeFromQueue: (i: number) => void;
  jumpTo: (i: number) => Promise<void>;
  toggle: () => Promise<void>;
  next: () => Promise<void>;
  prev: () => Promise<void>;
  seek: (ms: number) => Promise<void>;
  seekRel: (delta: number) => Promise<void>;
  seekMiddle: () => Promise<void>;
  setVolume: (v: number) => Promise<void>;
  livePosition: () => number;
};

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady?: () => void;
    Spotify?: any;
  }
}

let sdkPlayer: any = null;
let pollTimer: any = null;
const WINDOW = 150;

function fromSdkTrack(t: any): TrackDTO | null {
  if (!t) return null;
  const idFromUri = (u?: string) => (u ? u.split(":").pop() || null : null);
  const imgs = [...(t.album?.images || [])].sort((a: any, b: any) => (b.width || 0) - (a.width || 0));
  return {
    id: t.id || idFromUri(t.uri)!,
    title: t.name,
    artists: (t.artists || []).map((a: any) => ({ id: idFromUri(a.uri), name: a.name })),
    album: t.album?.name || "",
    albumId: idFromUri(t.album?.uri),
    cover: imgs[0]?.url || null,
    coverSmall: imgs[imgs.length - 1]?.url || null,
    durationMs: t.duration_ms || 0,
  };
}

function fromApiTrack(t: any): TrackDTO | null {
  if (!t || !t.id) return null;
  const imgs = [...(t.album?.images || [])].sort((a: any, b: any) => (b.width || 0) - (a.width || 0));
  return {
    id: t.id,
    title: t.name,
    artists: (t.artists || []).map((a: any) => ({ id: a.id, name: a.name })),
    album: t.album?.name || "",
    albumId: t.album?.id || null,
    cover: imgs[0]?.url || null,
    coverSmall: imgs[imgs.length - 1]?.url || null,
    durationMs: t.duration_ms || 0,
  };
}

export const usePlayer = create<PlayerState>((set, get) => {
  const toastErr = (msg: string) => {
    set({ lastError: msg });
    useApp.getState().toast(msg, { tone: "err" });
  };

  /** Le morceau en cours a changé côté Spotify : on recale l'index de la file. */
  const onTrackChange = (t: TrackDTO, linkedId?: string | null) => {
    const { queue, index, queueDirty, current } = get();
    if (current?.id === t.id) return;
    const match = (q: TrackDTO) => q.id === t.id || (!!linkedId && q.id === linkedId);
    let newIndex = index;
    if (queue[index + 1] && match(queue[index + 1])) newIndex = index + 1;
    else if (queue[index] && match(queue[index])) newIndex = index;
    else {
      const found = queue.findIndex(match);
      if (found >= 0) newIndex = found;
      else if (queueDirty && queue[index + 1]) {
        // La file a été modifiée dans l'app : on rejoue la suite attendue.
        set({ queueDirty: false });
        void get().jumpTo(index + 1);
        return;
      }
    }
    const rich = newIndex !== index || match(queue[newIndex] || ({} as TrackDTO)) ? queue[newIndex] : null;
    set({ index: newIndex, current: rich && match(rich) ? rich : t });
    // Étend la fenêtre envoyée à Spotify quand on approche de la fin.
    const { windowEnd } = get();
    if (newIndex >= windowEnd - 3 && windowEnd < queue.length) {
      const extra = queue.slice(windowEnd, windowEnd + 10);
      set({ windowEnd: windowEnd + extra.length });
      extra.reduce((p, x) => p.then(() => spc(`/me/player/queue?uri=spotify:track:${x.id}${deviceQS()}`, { method: "POST" }).catch(() => {})), Promise.resolve());
    }
  };

  const deviceQS = () => {
    const s = get();
    const id = s.mode === "sdk" ? s.sdkDeviceId : s.connectDeviceId;
    return id ? `&device_id=${id}` : "";
  };

  const ensureDevice = async (): Promise<string | null> => {
    const s = get();
    if (s.mode === "sdk" && s.sdkDeviceId) return s.sdkDeviceId;
    if (s.connectDeviceId) return s.connectDeviceId;
    const devices = await get().refreshDevices();
    const d = devices.find((x) => x.is_active) || devices[0];
    if (!d) {
      toastErr("Aucun appareil Spotify : ouvre l'appli Spotify (ordinateur ou téléphone) puis réessaie.");
      return null;
    }
    set({ connectDeviceId: d.id });
    return d.id;
  };

  const startPolling = () => {
    clearInterval(pollTimer);
    pollTimer = setInterval(async () => {
      if (get().mode !== "connect" || document.hidden) return;
      try {
        const st = await spc("/me/player");
        if (!st) return;
        const t = fromApiTrack(st.item);
        if (t) onTrackChange(t, st.item?.linked_from?.id);
        set({
          paused: !st.is_playing,
          position: st.progress_ms || 0,
          duration: st.item?.duration_ms || 0,
          updatedAt: Date.now(),
          ...(st.device?.id ? { connectDeviceId: st.device.id } : {}),
          ...(st.device?.volume_percent != null ? { volume: st.device.volume_percent / 100 } : {}),
        });
      } catch {}
    }, 1500);
  };

  return {
    mode: "init",
    sdkStatus: "idle",
    sdkError: null,
    sdkDeviceId: null,
    connectDeviceId: null,
    devices: [],
    current: null,
    paused: true,
    position: 0,
    duration: 0,
    updatedAt: Date.now(),
    volume: 0.7,
    queue: [],
    index: -1,
    contextLabel: null,
    queueDirty: false,
    windowEnd: 0,
    lastError: null,

    livePosition: () => {
      const s = get();
      if (s.paused) return s.position;
      return Math.min(s.duration || Infinity, s.position + (Date.now() - s.updatedAt));
    },

    init: () => {
      if (get().sdkStatus !== "idle") return;
      let pref: string | null = null;
      try {
        pref = localStorage.getItem("ss_playerMode");
        const v = Number(localStorage.getItem("ss_volume"));
        if (v > 0) set({ volume: v });
      } catch {}
      if (pref === "connect") {
        set({ mode: "connect", sdkStatus: "failed", sdkError: "Mode Spotify Connect choisi dans les réglages" });
        startPolling();
        return;
      }
      set({ sdkStatus: "loading" });
      const fail = (msg: string) => {
        if (get().sdkStatus === "ready") return;
        set({ sdkStatus: "failed", sdkError: msg, mode: "connect" });
        startPolling();
      };
      const timeout = setTimeout(() => fail("Le lecteur web ne s'est pas connecté (délai dépassé). Repli : Spotify Connect."), 12000);
      window.onSpotifyWebPlaybackSDKReady = () => {
        const player = new window.Spotify.Player({
          name: "SortSong",
          getOAuthToken: (cb: (t: string) => void) => getToken().then(cb).catch(() => {}),
          volume: get().volume,
        });
        sdkPlayer = player;
        player.addListener("ready", ({ device_id }: { device_id: string }) => {
          clearTimeout(timeout);
          set({ sdkStatus: "ready", sdkDeviceId: device_id, mode: "sdk", sdkError: null });
        });
        player.addListener("not_ready", () => set({ sdkError: "Lecteur web hors ligne" }));
        player.addListener("initialization_error", ({ message }: any) => fail(`Lecteur web indisponible : ${message}`));
        player.addListener("authentication_error", ({ message }: any) => fail(`Authentification du lecteur refusée : ${message}`));
        player.addListener("account_error", ({ message }: any) => fail(`Compte non éligible (Premium requis) : ${message}`));
        player.addListener("playback_error", ({ message }: any) => toastErr(`Lecture : ${message}`));
        player.addListener("player_state_changed", (st: any) => {
          if (!st || get().mode !== "sdk") return;
          const cur = st.track_window?.current_track;
          const t = fromSdkTrack(cur);
          if (t) onTrackChange(t, cur?.linked_from?.id);
          set({ paused: st.paused, position: st.position, duration: st.duration, updatedAt: Date.now() });
        });
        player.connect().then((ok: boolean) => !ok && fail("Connexion du lecteur web refusée"));
      };
      const s = document.createElement("script");
      s.src = "https://sdk.scdn.co/spotify-player.js";
      s.async = true;
      s.onerror = () => fail("Impossible de charger le lecteur web Spotify");
      document.body.appendChild(s);
    },

    setMode: (m) => {
      try {
        localStorage.setItem("ss_playerMode", m);
      } catch {}
      if (m === "sdk" && get().sdkStatus !== "ready") {
        set({ sdkStatus: "idle" });
        get().init();
        return;
      }
      set({ mode: m });
      if (m === "connect") {
        startPolling();
        get().refreshDevices();
      }
    },

    refreshDevices: async () => {
      try {
        const r = await spc("/me/player/devices");
        const devices = (r?.devices || []) as Device[];
        set({ devices });
        return devices;
      } catch {
        return [];
      }
    },

    setConnectDevice: async (id) => {
      set({ connectDeviceId: id });
      try {
        await spc("/me/player", { method: "PUT", body: JSON.stringify({ device_ids: [id], play: !get().paused }) });
      } catch (e) {
        toastErr((e as Error).message);
      }
    },

    playList: async (tracks, start, label, startMs) => {
      if (!tracks.length) return;
      try {
        sdkPlayer?.activateElement?.();
      } catch {}
      const device = await ensureDevice();
      if (!device) return;
      const winStart = Math.max(0, start - 20);
      const winEnd = Math.min(tracks.length, winStart + WINDOW);
      const uris = tracks.slice(winStart, winEnd).map((t) => `spotify:track:${t.id}`);
      set({
        queue: tracks,
        index: start,
        current: tracks[start],
        contextLabel: label || null,
        queueDirty: false,
        windowEnd: winEnd,
        paused: false,
        position: 0,
        duration: tracks[start].durationMs,
        updatedAt: Date.now(),
      });
      const body = JSON.stringify({ uris, offset: { position: start - winStart }, ...(startMs ? { position_ms: Math.round(startMs) } : {}) });
      if (startMs) set({ position: startMs });
      try {
        await spc(`/me/player/play?device_id=${device}`, { method: "PUT", body });
      } catch (e: any) {
        if (e.status === 404) {
          // Appareil pas encore actif : transfert puis relance.
          try {
            await spc("/me/player", { method: "PUT", body: JSON.stringify({ device_ids: [device], play: false }) });
            await new Promise((r) => setTimeout(r, 600));
            await spc(`/me/player/play?device_id=${device}`, { method: "PUT", body });
            return;
          } catch (e2: any) {
            if (get().mode === "connect") set({ connectDeviceId: null });
            toastErr(`Lecture impossible : ${e2.message}`);
            return;
          }
        }
        toastErr(e.status === 403 ? "Lecture refusée (Premium requis ou action non autorisée)" : `Lecture impossible : ${e.message}`);
      }
    },

    playTrack: (t) => get().playList([t], 0),

    playNext: async (t) => {
      const { queue, index, current } = get();
      if (!current) return get().playList([t], 0);
      const q = [...queue];
      q.splice(index + 1, 0, t);
      set({ queue: q });
      try {
        await spc(`/me/player/queue?uri=spotify:track:${t.id}${deviceQS()}`, { method: "POST" });
        useApp.getState().toast(`« ${t.title} » sera lu ensuite`, { tone: "info" });
      } catch (e) {
        set({ queueDirty: true });
      }
    },

    addToQueueEnd: (t) => {
      const { queue, current } = get();
      if (!current) {
        void get().playList([t], 0);
        return;
      }
      set({ queue: [...queue, t], queueDirty: true });
      useApp.getState().toast(`Ajouté à la file`, { tone: "info" });
    },

    removeFromQueue: (i) => {
      const { queue, index } = get();
      if (i === index) return;
      const q = queue.filter((_, k) => k !== i);
      set({ queue: q, index: i < index ? index - 1 : index, queueDirty: true });
    },

    jumpTo: async (i) => {
      const { queue, contextLabel } = get();
      if (queue[i]) await get().playList(queue, i, contextLabel || undefined);
    },

    toggle: async () => {
      const s = get();
      if (!s.current) return;
      set({ paused: !s.paused, position: s.livePosition(), updatedAt: Date.now() });
      try {
        if (s.mode === "sdk" && sdkPlayer) await sdkPlayer.togglePlay();
        else await spc(`/me/player/${s.paused ? "play" : "pause"}${deviceQS().replace("&", "?")}`, { method: "PUT" });
      } catch (e) {
        toastErr((e as Error).message);
      }
    },

    next: async () => {
      const s = get();
      if (s.queueDirty && s.queue[s.index + 1]) return get().jumpTo(s.index + 1);
      try {
        if (s.mode === "sdk" && sdkPlayer) await sdkPlayer.nextTrack();
        else await spc(`/me/player/next${deviceQS().replace("&", "?")}`, { method: "POST" });
      } catch (e) {
        if (s.queue[s.index + 1]) await get().jumpTo(s.index + 1);
      }
    },

    prev: async () => {
      const s = get();
      if (s.livePosition() > 4000 || s.index <= 0) return get().seek(0);
      try {
        if (s.mode === "sdk" && sdkPlayer) await sdkPlayer.previousTrack();
        else await spc(`/me/player/previous${deviceQS().replace("&", "?")}`, { method: "POST" });
      } catch {
        await get().jumpTo(s.index - 1);
      }
    },

    seek: async (ms) => {
      const s = get();
      const pos = Math.max(0, Math.min(ms, (s.duration || s.current?.durationMs || 0) - 1000));
      set({ position: pos, updatedAt: Date.now() });
      try {
        if (s.mode === "sdk" && sdkPlayer) await sdkPlayer.seek(pos);
        else await spc(`/me/player/seek?position_ms=${Math.round(pos)}${deviceQS()}`, { method: "PUT" });
      } catch (e) {
        toastErr((e as Error).message);
      }
    },

    seekRel: (d) => get().seek(get().livePosition() + d),
    seekMiddle: () => get().seek((get().duration || get().current?.durationMs || 0) / 2),

    setVolume: async (v) => {
      const vol = Math.max(0, Math.min(1, v));
      set({ volume: vol });
      try {
        localStorage.setItem("ss_volume", String(vol || 0.01));
      } catch {}
      try {
        if (get().mode === "sdk" && sdkPlayer) await sdkPlayer.setVolume(vol);
        else await spc(`/me/player/volume?volume_percent=${Math.round(vol * 100)}${deviceQS()}`, { method: "PUT" });
      } catch {}
    },
  };
});
