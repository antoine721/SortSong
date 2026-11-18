"use client";
import { create } from "zustand";
import { api, uid } from "@/lib/client/api";
import type { BootstrapDTO, FolderDTO, MeDTO, PlaylistDTO, SmartRules, TagDTO, TrackDTO } from "@/lib/types";

type Meta = { bpm?: number | null; key?: string | null; energy?: number | null; tagIds?: string[] };
type Toast = { id: string; text: string; tone?: "ok" | "err" | "info"; undo?: boolean; at: number };
type UndoEntry = { id: string; label: string; run: () => Promise<void> };
export type LibTrack = TrackDTO & { source?: string; sourceRef?: string | null };

export type ImportResult = { url: string; error?: string; name?: string; type?: string; total?: number; added?: number; already?: number; skippedDeleted?: number; notFound?: number; source?: string; playlistId?: string | null };

type AddMenu = { track: TrackDTO; x: number; y: number } | null;

type State = {
  ready: boolean;
  bootError: string | null;
  me: MeDTO | null;
  folders: FolderDTO[];
  playlists: PlaylistDTO[];
  membership: Record<string, string[]>;
  library: Set<string>;
  inboxCount: number;
  unratedCount: number;
  tags: TagDTO[];
  config: BootstrapDTO["config"];
  libTracks: LibTrack[] | null;
  libLoading: boolean;
  meta: Record<string, Meta>;
  playlistVersion: Record<string, number>;
  hideSorted: boolean;
  rightPanel: "queue" | "track" | null;
  panelTrack: TrackDTO | null;
  addMenu: AddMenu;
  searchOpen: boolean;
  mobileNav: boolean;
  toasts: Toast[];
  undoStack: UndoEntry[];

  bootstrap: () => Promise<void>;
  loadLibrary: (force?: boolean) => Promise<LibTrack[]>;
  toast: (text: string, opts?: { tone?: Toast["tone"]; undo?: boolean }) => void;
  dropToast: (id: string) => void;
  pushUndo: (label: string, run: () => Promise<void>) => void;
  undo: () => Promise<void>;
  set: (p: Partial<State>) => void;
  openTrack: (t: TrackDTO) => void;

  addToPlaylists: (track: TrackDTO, playlistIds: string[], opts?: { record?: boolean; quiet?: boolean }) => Promise<void>;
  removeFromPlaylists: (track: TrackDTO, playlistIds: string[], opts?: { record?: boolean; quiet?: boolean }) => Promise<void>;
  togglePlaylist: (track: TrackDTO, playlistId: string) => Promise<void>;
  setStatus: (tracks: TrackDTO[], status: "inbox" | "dismissed", opts?: { record?: boolean }) => Promise<void>;
  updateTrack: (track: TrackDTO, patch: Meta) => Promise<void>;

  createPlaylist: (p: { name?: string; folderId?: string | null; color?: string; rules?: SmartRules | null }) => Promise<string>;
  updatePlaylist: (id: string, patch: Partial<Pick<PlaylistDTO, "name" | "color" | "description" | "folderId" | "position" | "hotkey" | "rules">>, opts?: { record?: boolean }) => Promise<void>;
  deletePlaylist: (id: string) => Promise<void>;
  createFolder: (p: { name?: string; parentId?: string | null }) => Promise<string>;
  updateFolder: (id: string, patch: Partial<Pick<FolderDTO, "name" | "parentId" | "position" | "collapsed">>, opts?: { record?: boolean }) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  reorderPlaylist: (playlistId: string, order: string[], prev: string[]) => Promise<void>;
  createTag: (name: string, category: string, color?: string) => Promise<TagDTO>;
  deleteTracks: (tracks: TrackDTO[]) => Promise<void>;
  importPlaylistLink: (url: string, folderId?: string | null) => Promise<string>;
  importLinks: (urls: string, opts?: { createPlaylist?: boolean; folderId?: string | null }) => Promise<ImportResult[]>;
  rate: (track: TrackDTO, rating: number | null, opts?: { record?: boolean }) => Promise<void>;
  linkDialog: { folderId: string | null } | null;
  theme: "discreet" | "dark";
  setTheme: (t: "discreet" | "dark") => void;
};

const bump = (v: Record<string, number>, ids: string[]) => {
  const n = { ...v };
  for (const id of ids) n[id] = (n[id] || 0) + 1;
  return n;
};

export const useApp = create<State>((set, get) => ({
  ready: false,
  bootError: null,
  me: null,
  folders: [],
  playlists: [],
  membership: {},
  library: new Set(),
  inboxCount: 0,
  unratedCount: 0,
  tags: [],
  config: { lastfm: false },
  libTracks: null,
  libLoading: false,
  meta: {},
  playlistVersion: {},
  hideSorted: false,
  rightPanel: null,
  panelTrack: null,
  addMenu: null,
  searchOpen: false,
  mobileNav: false,
  toasts: [],
  undoStack: [],
  linkDialog: null,
  theme: typeof document !== "undefined" && !document.documentElement.classList.contains("discreet") ? "dark" : "discreet",
  setTheme: (t) => {
    document.documentElement.classList.toggle("discreet", t === "discreet");
    document.title = t === "discreet" ? "Mes applications" : "SortSong";
    try {
      localStorage.setItem("ss_theme", t);
    } catch {}
    set({ theme: t });
  },

  set: (p) => set(p),

  bootstrap: async () => {
    try {
      const b = await api<BootstrapDTO>("/api/bootstrap");
      let hideSorted = false;
      try {
        hideSorted = localStorage.getItem("ss_hideSorted") === "1";
      } catch {}
      set({
        ready: true,
        me: b.me,
        folders: b.folders,
        playlists: b.playlists,
        membership: b.membership,
        library: new Set(b.library),
        inboxCount: b.inboxCount,
        unratedCount: b.unratedCount,
        tags: b.tags,
        config: b.config,
        hideSorted,
      });
    } catch (e) {
      set({ bootError: e instanceof Error ? e.message : String(e) });
    }
  },

  loadLibrary: async (force) => {
    const cur = get().libTracks;
    if (cur && !force) return cur;
    set({ libLoading: true });
    try {
      const { tracks } = await api<{ tracks: LibTrack[] }>("/api/library");
      set({ libTracks: tracks, library: new Set(tracks.map((t) => t.id)) });
      return tracks;
    } finally {
      set({ libLoading: false });
    }
  },

  toast: (text, opts = {}) => {
    // Même message déjà affiché (hors « Annuler ») : on ne l'empile pas.
    if (!opts.undo && get().toasts.some((x) => x.text === text && !x.undo)) return;
    const t: Toast = { id: uid(), text, tone: opts.tone || "ok", undo: opts.undo, at: Date.now() };
    set({ toasts: [...get().toasts.slice(-3), t] });
    setTimeout(() => get().dropToast(t.id), opts.undo ? 6000 : 3500);
  },
  dropToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),

  pushUndo: (label, run) => set({ undoStack: [...get().undoStack.slice(-49), { id: uid(), label, run }] }),
  undo: async () => {
    const stack = get().undoStack;
    const last = stack[stack.length - 1];
    if (!last) {
      get().toast("Rien à annuler", { tone: "info" });
      return;
    }
    set({ undoStack: stack.slice(0, -1) });
    try {
      await last.run();
      get().toast(`Annulé : ${last.label}`, { tone: "info" });
    } catch (e) {
      get().toast(`Annulation impossible : ${(e as Error).message}`, { tone: "err" });
    }
  },

  openTrack: (t) => set({ panelTrack: t, rightPanel: "track" }),

  addToPlaylists: async (track, playlistIds, opts = {}) => {
    const s = get();
    const current = new Set(s.membership[track.id] || []);
    const ids = playlistIds.filter((id) => !current.has(id) && s.playlists.some((p) => p.id === id && !p.rules));
    if (!ids.length) {
      if (!opts.quiet) {
        const names = playlistIds.map((id) => s.playlists.find((p) => p.id === id)?.name).filter(Boolean);
        s.toast(`Déjà dans ${names.join(", ")}`, { tone: "info" });
      }
      return;
    }
    // Mise à jour optimiste : le badge apparaît instantanément.
    const membership = { ...s.membership, [track.id]: [...current, ...ids] };
    const library = new Set(s.library);
    library.add(track.id);
    set({
      membership,
      library,
      playlists: s.playlists.map((p) => (ids.includes(p.id) ? { ...p, count: p.count + 1, durationMs: p.durationMs + track.durationMs } : p)),
      libTracks: s.libTracks
        ? s.libTracks.some((t) => t.id === track.id)
          ? s.libTracks.map((t) => (t.id === track.id ? { ...t, status: "sorted" } : t))
          : [{ ...track, status: "sorted", addedAt: new Date().toISOString(), source: "search" }, ...s.libTracks]
        : null,
    });
    try {
      const r = await api<{ inboxCount: number }>("/api/membership", { json: { add: ids.map((playlistId) => ({ playlistId, track })) } });
      set({ inboxCount: r.inboxCount, playlistVersion: bump(get().playlistVersion, ids) });
    } catch (e) {
      set({ membership: { ...get().membership, [track.id]: [...current] } });
      get().toast(`Échec de l'ajout : ${(e as Error).message}`, { tone: "err" });
      return;
    }
    const names = ids.map((id) => s.playlists.find((p) => p.id === id)?.name).join(", ");
    if (opts.record !== false) {
      get().pushUndo(`ajout à ${names}`, () => get().removeFromPlaylists(track, ids, { record: false, quiet: true }));
      if (!opts.quiet) get().toast(`« ${track.title} » → ${names}`, { undo: true });
    }
  },

  removeFromPlaylists: async (track, playlistIds, opts = {}) => {
    const s = get();
    const current = s.membership[track.id] || [];
    const ids = playlistIds.filter((id) => current.includes(id));
    if (!ids.length) return;
    const rest = current.filter((id) => !ids.includes(id));
    const membership = { ...s.membership };
    if (rest.length) membership[track.id] = rest;
    else delete membership[track.id];
    set({
      membership,
      playlists: s.playlists.map((p) => (ids.includes(p.id) ? { ...p, count: Math.max(0, p.count - 1), durationMs: Math.max(0, p.durationMs - track.durationMs) } : p)),
      libTracks: s.libTracks?.map((t) => (t.id === track.id && !rest.length && t.status === "sorted" ? { ...t, status: "inbox" } : t)) ?? null,
    });
    let removed: { playlistId: string; position: number; note: string | null }[] = [];
    try {
      const r = await api<{ inboxCount: number; removed: typeof removed }>("/api/membership", {
        json: { remove: ids.map((playlistId) => ({ playlistId, trackId: track.id })) },
      });
      removed = r.removed;
      set({ inboxCount: r.inboxCount, playlistVersion: bump(get().playlistVersion, ids) });
    } catch (e) {
      set({ membership: { ...get().membership, [track.id]: current } });
      get().toast(`Échec du retrait : ${(e as Error).message}`, { tone: "err" });
      return;
    }
    const names = ids.map((id) => s.playlists.find((p) => p.id === id)?.name).join(", ");
    if (opts.record !== false) {
      get().pushUndo(`retrait de ${names}`, async () => {
        // Restaure à la même position, avec la note.
        const cur = new Set(get().membership[track.id] || []);
        set({
          membership: { ...get().membership, [track.id]: [...cur, ...ids] },
          playlists: get().playlists.map((p) => (ids.includes(p.id) ? { ...p, count: p.count + 1, durationMs: p.durationMs + track.durationMs } : p)),
        });
        const r = await api<{ inboxCount: number }>("/api/membership", {
          json: { add: removed.map((x) => ({ playlistId: x.playlistId, track, position: x.position, note: x.note })) },
        });
        set({ inboxCount: r.inboxCount, playlistVersion: bump(get().playlistVersion, ids) });
      });
      if (!opts.quiet) get().toast(`Retiré de ${names}`, { undo: true });
    }
  },

  togglePlaylist: async (track, playlistId) => {
    const has = (get().membership[track.id] || []).includes(playlistId);
    if (has) await get().removeFromPlaylists(track, [playlistId]);
    else await get().addToPlaylists(track, [playlistId]);
  },

  setStatus: async (tracks, status, opts = {}) => {
    const s = get();
    const ids = new Set(tracks.map((t) => t.id));
    const prev = new Map((s.libTracks || []).filter((t) => ids.has(t.id)).map((t) => [t.id, t.status]));
    const library = new Set(s.library);
    tracks.forEach((t) => library.add(t.id));
    set({
      library,
      libTracks: s.libTracks?.map((t) => (ids.has(t.id) && t.status !== "sorted" ? { ...t, status } : t)) ?? null,
    });
    const r = await api<{ inboxCount: number }>("/api/library/status", { json: { tracks, status } });
    set({ inboxCount: r.inboxCount });
    if (opts.record !== false) {
      const label = status === "dismissed" ? `écarter ${tracks.length > 1 ? tracks.length + " morceaux" : "« " + tracks[0]?.title + " »"}` : "remettre à trier";
      get().pushUndo(label, async () => {
        const back = tracks.filter((t) => prev.get(t.id) && prev.get(t.id) !== status);
        if (back.length) await get().setStatus(back, (prev.get(back[0].id) as any) || "inbox", { record: false });
      });
      get().toast(status === "dismissed" ? "Écarté de « À trier »" : "Remis dans « À trier »", { undo: true });
    }
  },

  updateTrack: async (track, patch) => {
    const before = { ...get().meta[track.id] };
    set({ meta: { ...get().meta, [track.id]: { ...get().meta[track.id], ...patch } } });
    const s = get();
    if (s.libTracks) set({ libTracks: s.libTracks.map((t) => (t.id === track.id ? { ...t, ...patch } : t)) });
    try {
      await api(`/api/tracks/${track.id}`, { method: "PATCH", json: { ...patch, track } });
    } catch (e) {
      set({ meta: { ...get().meta, [track.id]: before } });
      get().toast(`Échec : ${(e as Error).message}`, { tone: "err" });
    }
  },

  createPlaylist: async ({ name, folderId = null, color, rules = null }) => {
    const id = uid();
    const pos = Math.max(-1, ...get().playlists.filter((p) => p.folderId === folderId).map((p) => p.position)) + 1;
    const pl: PlaylistDTO = {
      id,
      folderId,
      name: name || "Nouvelle playlist",
      color: color || ["#7c5cff", "#22c55e", "#f59e0b", "#ec4899", "#06b6d4", "#ef4444", "#84cc16", "#f97316"][get().playlists.length % 8],
      description: null,
      position: pos,
      hotkey: null,
      rules,
      count: 0,
      durationMs: 0,
      spotifyExportId: null,
    };
    set({ playlists: [...get().playlists, pl] });
    await api("/api/playlists", { json: { id, name: pl.name, folderId, color: pl.color, rules } });
    get().pushUndo(`création de « ${pl.name} »`, async () => {
      set({ playlists: get().playlists.filter((p) => p.id !== id) });
      await api(`/api/playlists/${id}`, { method: "DELETE" });
    });
    return id;
  },

  updatePlaylist: async (id, patch, opts = {}) => {
    const prev = get().playlists.find((p) => p.id === id);
    if (!prev) return;
    let playlists = get().playlists.map((p) => (p.id === id ? { ...p, ...patch } : p));
    if (patch.hotkey) playlists = playlists.map((p) => (p.id !== id && p.hotkey === patch.hotkey ? { ...p, hotkey: null } : p));
    set({ playlists });
    if (patch.rules !== undefined) set({ playlistVersion: bump(get().playlistVersion, [id]) });
    await api(`/api/playlists/${id}`, { method: "PATCH", json: patch });
    if (opts.record !== false && (patch.folderId !== undefined || patch.name !== undefined || patch.position !== undefined)) {
      const back: any = {};
      for (const k of Object.keys(patch) as (keyof typeof patch)[]) back[k] = prev[k];
      get().pushUndo(`modification de « ${prev.name} »`, () => get().updatePlaylist(id, back, { record: false }));
    }
  },

  deletePlaylist: async (id) => {
    const prev = get().playlists.find((p) => p.id === id);
    if (!prev) return;
    const membership: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(get().membership)) {
      const r = v.filter((x) => x !== id);
      if (r.length) membership[k] = r;
    }
    const prevMembership = get().membership;
    set({ playlists: get().playlists.filter((p) => p.id !== id), membership });
    const { snapshot } = await api<{ snapshot: unknown }>(`/api/playlists/${id}`, { method: "DELETE" });
    get().loadLibrary(true).catch(() => {});
    api<{ inboxCount: number }>("/api/library/status", { json: { ids: [], status: "inbox" } }).then((r) => set({ inboxCount: r.inboxCount })).catch(() => {});
    get().pushUndo(`suppression de « ${prev.name} »`, async () => {
      await api("/api/playlists/restore", { json: { snapshot } });
      set({ playlists: [...get().playlists, prev], membership: prevMembership });
      get().loadLibrary(true).catch(() => {});
      await get().bootstrap();
    });
    get().toast(`Playlist « ${prev.name} » supprimée`, { undo: true });
  },

  createFolder: async ({ name, parentId = null }) => {
    const id = uid();
    const pos = Math.max(-1, ...get().folders.filter((f) => f.parentId === parentId).map((f) => f.position)) + 1;
    const f: FolderDTO = { id, parentId, name: name || "Nouveau dossier", position: pos, collapsed: false };
    set({ folders: [...get().folders, f] });
    await api("/api/folders", { json: { id, name: f.name, parentId } });
    get().pushUndo(`création du dossier « ${f.name} »`, async () => {
      set({ folders: get().folders.filter((x) => x.id !== id) });
      await api(`/api/folders/${id}`, { method: "DELETE" });
      await get().bootstrap();
    });
    return id;
  },

  updateFolder: async (id, patch, opts = {}) => {
    const prev = get().folders.find((f) => f.id === id);
    if (!prev) return;
    set({ folders: get().folders.map((f) => (f.id === id ? { ...f, ...patch } : f)) });
    try {
      await api(`/api/folders/${id}`, { method: "PATCH", json: patch });
    } catch (e) {
      set({ folders: get().folders.map((f) => (f.id === id ? prev : f)) });
      get().toast((e as Error).message, { tone: "err" });
      return;
    }
    if (opts.record !== false && (patch.parentId !== undefined || patch.name !== undefined)) {
      const back: any = {};
      for (const k of Object.keys(patch) as (keyof typeof patch)[]) back[k] = prev[k];
      get().pushUndo(`modification du dossier « ${prev.name} »`, () => get().updateFolder(id, back, { record: false }));
    }
  },

  deleteFolder: async (id) => {
    const f = get().folders.find((x) => x.id === id);
    if (!f) return;
    const { snapshot } = await api<{ snapshot: { childFolderIds: string[]; playlistIds: string[] } }>(`/api/folders/${id}`, { method: "DELETE" });
    set({
      folders: get().folders.filter((x) => x.id !== id).map((x) => (x.parentId === id ? { ...x, parentId: f.parentId } : x)),
      playlists: get().playlists.map((p) => (p.folderId === id ? { ...p, folderId: f.parentId } : p)),
    });
    get().pushUndo(`suppression du dossier « ${f.name} »`, async () => {
      await api("/api/folders", { json: { id: f.id, name: f.name, parentId: f.parentId, position: f.position, ...snapshot } });
      await get().bootstrap();
    });
    get().toast(`Dossier « ${f.name} » supprimé (contenu conservé)`, { undo: true });
  },

  reorderPlaylist: async (playlistId, order, prev) => {
    await api(`/api/playlists/${playlistId}/tracks`, { method: "PATCH", json: { order } });
    set({ playlistVersion: bump(get().playlistVersion, [playlistId]) });
    get().pushUndo("réorganisation", async () => {
      await api(`/api/playlists/${playlistId}/tracks`, { method: "PATCH", json: { order: prev } });
      set({ playlistVersion: bump(get().playlistVersion, [playlistId]) });
    });
  },

  deleteTracks: async (tracks) => {
    if (!tracks.length) return;
    const s = get();
    const ids = new Set(tracks.map((t) => t.id));
    const prevMembership = s.membership;
    const prevPlaylists = s.playlists;
    const prevLib = s.libTracks;
    const membership = { ...s.membership };
    const touched = new Set<string>();
    for (const t of tracks) {
      for (const pid of membership[t.id] || []) touched.add(pid);
      delete membership[t.id];
    }
    const library = new Set(s.library);
    tracks.forEach((t) => library.delete(t.id));
    set({
      membership,
      library,
      libTracks: s.libTracks?.filter((t) => !ids.has(t.id)) ?? null,
      playlists: s.playlists.map((p) => {
        const n = tracks.filter((t) => prevMembership[t.id]?.includes(p.id));
        return n.length ? { ...p, count: p.count - n.length, durationMs: p.durationMs - n.reduce((a, t) => a + t.durationMs, 0) } : p;
      }),
    });
    let snapshot: unknown;
    try {
      const r = await api<{ snapshot: unknown; inboxCount: number }>("/api/library/delete", { json: { ids: [...ids] } });
      snapshot = r.snapshot;
      set({ inboxCount: r.inboxCount, playlistVersion: bump(get().playlistVersion, [...touched]) });
    } catch (e) {
      set({ membership: prevMembership, playlists: prevPlaylists, libTracks: prevLib });
      get().toast(`Suppression impossible : ${(e as Error).message}`, { tone: "err" });
      return;
    }
    const label = tracks.length > 1 ? `${tracks.length} morceaux` : `« ${tracks[0].title} »`;
    get().pushUndo(`suppression de ${label}`, async () => {
      const r = await api<{ inboxCount: number }>("/api/library/restore", { json: { snapshot } });
      set({ membership: { ...get().membership, ...Object.fromEntries(tracks.map((t) => [t.id, prevMembership[t.id]]).filter(([, v]) => v)) }, inboxCount: r.inboxCount });
      const lib2 = new Set(get().library);
      tracks.forEach((t) => lib2.add(t.id));
      set({ library: lib2, playlistVersion: bump(get().playlistVersion, [...touched]) });
      await Promise.all([get().bootstrap(), get().loadLibrary(true)]);
    });
    get().toast(`${label} supprimé${tracks.length > 1 ? "s" : ""} de ta bibliothèque`, { undo: true });
  },

  importPlaylistLink: async (url, folderId = null) => {
    const r = await api<{ id: string; count: number }>("/api/spotify/playlists/link", { json: { url, folderId } });
    await get().bootstrap();
    get().loadLibrary(true).catch(() => {});
    const name = get().playlists.find((p) => p.id === r.id)?.name || "Playlist";
    get().pushUndo(`ajout de « ${name} »`, async () => {
      set({ playlists: get().playlists.filter((p) => p.id !== r.id) });
      await api(`/api/playlists/${r.id}`, { method: "DELETE" });
      await get().bootstrap();
    });
    get().toast(`« ${name} » ajoutée (${r.count} titres)`, { undo: true });
    return r.id;
  },

  importLinks: async (urls, opts = {}) => {
    const { results } = await api<{ results: ImportResult[] }>("/api/import/link", { json: { urls, ...opts } });
    await Promise.all([get().bootstrap(), get().loadLibrary(true)]);
    return results;
  },

  rate: async (track, rating, opts = {}) => {
    const s = get();
    const prev = s.libTracks?.find((t) => t.id === track.id);
    const prevRating = prev ? prev.rating ?? null : null;
    const wasDeleted = !s.library.has(track.id);
    const library = new Set(s.library);
    const membership = { ...s.membership };
    let libTracks = s.libTracks;
    if (rating === 0) {
      library.delete(track.id);
      delete membership[track.id];
      libTracks = libTracks?.filter((t) => t.id !== track.id) ?? null;
    } else {
      library.add(track.id);
      if (libTracks) {
        libTracks = libTracks.some((t) => t.id === track.id)
          ? libTracks.map((t) => (t.id === track.id ? { ...t, rating } : t))
          : [{ ...track, rating, status: "inbox", addedAt: track.addedAt || new Date().toISOString() }, ...libTracks];
      }
    }
    set({ library, membership, libTracks });
    try {
      const r = await api<{ inboxCount: number; unratedCount: number }>("/api/library/rate", { json: { track, rating } });
      set({ inboxCount: r.inboxCount, unratedCount: r.unratedCount });
      if (rating === 0 && s.membership[track.id]?.length) set({ playlists: get().playlists, playlistVersion: bump(get().playlistVersion, s.membership[track.id]) });
    } catch (e) {
      set({ library: s.library, membership: s.membership, libTracks: s.libTracks });
      get().toast(`Note non enregistrée : ${(e as Error).message}`, { tone: "err" });
      return;
    }
    if (opts.record !== false) {
      get().pushUndo(rating === 0 ? `suppression de « ${track.title} »` : `note de « ${track.title} »`, async () => {
        await get().rate(track, wasDeleted && rating !== 0 ? 0 : prevRating, { record: false });
        if (rating === 0) await get().bootstrap();
      });
    }
  },

  createTag: async (name, category, color) => {
    const { tag } = await api<{ tag: TagDTO }>("/api/tags", { json: { name, category, color } });
    if (!get().tags.some((t) => t.id === tag.id)) set({ tags: [...get().tags, tag] });
    return tag;
  },
}));

/** Méta effectives d'un morceau (overrides locaux > données du DTO). */
export function useTrackMeta(t: TrackDTO) {
  const m = useApp((s) => s.meta[t.id]);
  return {
    bpm: m?.bpm !== undefined ? m.bpm : t.bpm,
    key: m?.key !== undefined ? m.key : t.key,
    energy: m?.energy !== undefined ? m.energy : t.energy,
    tagIds: m?.tagIds !== undefined ? m.tagIds : t.tagIds || [],
  };
}

export function setHideSorted(v: boolean) {
  useApp.setState({ hideSorted: v });
  try {
    localStorage.setItem("ss_hideSorted", v ? "1" : "0");
  } catch {}
}
