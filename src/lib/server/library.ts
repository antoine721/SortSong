import { prisma } from "./db";
import { normTrack, paginate, playlistItemTrack, sp, spSafe } from "./spotify";
import { refreshStatus, upsertTracks } from "./tracks";
import type { TrackDTO } from "../types";

type Progress = (msg: { step: string; done?: number; total?: number; detail?: string }) => void;

async function kvGet(key: string) {
  return (await prisma.artistCache.findUnique({ where: { key } }))?.data ?? null;
}
async function kvSet(key: string, data: string) {
  await prisma.artistCache.upsert({ where: { key }, create: { key, data }, update: { data, createdAt: new Date() } });
}

/** Récupère les éléments d'une playlist Spotify (endpoint /items depuis 2026, repli /tracks). */
export async function fetchPlaylistTracks(userId: string, playlistId: string): Promise<{ track: TrackDTO; addedAt: string | null }[]> {
  let items: any[];
  try {
    items = await paginate(userId, `https://api.spotify.com/v1/playlists/${playlistId}/items?limit=50&additional_types=track`);
  } catch {
    items = await paginate(userId, `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50`);
  }
  const out: { track: TrackDTO; addedAt: string | null }[] = [];
  for (const it of items) {
    const t = normTrack(playlistItemTrack(it));
    if (t) out.push({ track: t, addedAt: it.added_at || null });
  }
  return out;
}

export async function listSpotifyPlaylists(userId: string) {
  const items = await paginate(userId, "https://api.spotify.com/v1/me/playlists?limit=50");
  return items
    .filter(Boolean)
    .map((p: any) => ({
      id: p.id,
      name: p.name,
      owner: p.owner?.display_name || p.owner?.id || "",
      image: p.images?.[0]?.url || null,
      total: p.items?.total ?? p.tracks?.total ?? null,
      snapshot: p.snapshot_id as string,
    }));
}

/**
 * Import (A2) et resynchronisation (A4) : titres likés + toutes les playlists Spotify.
 * En mode sync, on s'arrête aux likes déjà connus et on saute les playlists inchangées (snapshot_id).
 */
export async function importLibrary(userId: string, mode: "full" | "sync", progress: Progress) {
  const existing = new Set(
    (await prisma.libraryTrack.findMany({ where: { userId }, select: { track: { select: { spotifyId: true } } } })).map((l) => l.track.spotifyId),
  );
  const entries: { track: TrackDTO; source: string; sourceRef: string | null; addedAt: string | null }[] = [];

  // Titres likés
  progress({ step: "Titres likés…" });
  let url: string | null = "https://api.spotify.com/v1/me/tracks?limit=50";
  let total = 0;
  let stop = false;
  while (url && !stop) {
    const page: any = await sp(userId, url);
    total = page.total ?? total;
    let knownInPage = 0;
    for (const it of page.items || []) {
      const t = normTrack(it.track ?? it.item);
      if (!t) continue;
      if (existing.has(t.id)) knownInPage++;
      entries.push({ track: t, source: "liked", sourceRef: null, addedAt: it.added_at || null });
    }
    progress({ step: "Titres likés", done: entries.length, total });
    // En sync, les likes sont triés du plus récent au plus ancien : une page entièrement connue = fin.
    if (mode === "sync" && page.items?.length && knownInPage === page.items.length) stop = true;
    url = page.next;
  }

  // Playlists Spotify
  progress({ step: "Liste des playlists…" });
  const playlists = await listSpotifyPlaylists(userId);
  let i = 0;
  for (const p of playlists) {
    i++;
    const snapKey = `snap:${userId}:${p.id}`;
    if (mode === "sync" && (await kvGet(snapKey)) === p.snapshot) continue;
    progress({ step: `Playlist « ${p.name} »`, done: i, total: playlists.length });
    try {
      const tracks = await fetchPlaylistTracks(userId, p.id);
      for (const t of tracks) entries.push({ track: t.track, source: "playlist", sourceRef: p.name, addedAt: t.addedAt });
      await kvSet(snapKey, p.snapshot);
    } catch (e) {
      progress({ step: `Playlist « ${p.name} » ignorée`, detail: e instanceof Error ? e.message : String(e) });
    }
  }

  progress({ step: "Enregistrement…", done: 0, total: entries.length });
  const idMap = await upsertTracks(entries.map((e) => e.track));
  const lib = await prisma.libraryTrack.findMany({ where: { userId }, select: { trackId: true } });
  const inLib = new Set(lib.map((l) => l.trackId));
  const toCreate = new Map<string, { userId: string; trackId: string; source: string; sourceRef: string | null; addedAt: Date; status: string }>();
  for (const e of entries) {
    const trackId = idMap.get(e.track.id);
    if (!trackId || inLib.has(trackId)) continue;
    const prev = toCreate.get(trackId);
    const addedAt = e.addedAt ? new Date(e.addedAt) : new Date();
    if (!prev || (prev.source !== "liked" && e.source === "liked")) {
      toCreate.set(trackId, { userId, trackId, source: e.source, sourceRef: e.sourceRef, addedAt, status: "inbox" });
    }
  }
  const rows = [...toCreate.values()];
  for (let k = 0; k < rows.length; k += 500) await prisma.libraryTrack.createMany({ data: rows.slice(k, k + 500) });
  await refreshStatus(userId, rows.map((r) => r.trackId));
  await prisma.user.update({ where: { id: userId }, data: { lastSyncAt: new Date() } });
  progress({ step: "Terminé", done: rows.length, total: rows.length });
  return { added: rows.length, scanned: entries.length, playlists: playlists.length };
}

/** A3 : importe une playlist Spotify comme playlist interne. */
export async function importSpotifyPlaylist(userId: string, spotifyPlaylistId: string, folderId: string | null) {
  const meta = await spSafe(userId, `/playlists/${spotifyPlaylistId}`, { query: { fields: "name,description" } });
  const tracks = await fetchPlaylistTracks(userId, spotifyPlaylistId);
  const idMap = await upsertTracks(tracks.map((t) => t.track));
  const max = await prisma.playlist.aggregate({ where: { userId, folderId }, _max: { position: true } });
  const colors = ["#7c5cff", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#84cc16", "#f97316"];
  const pl = await prisma.playlist.create({
    data: {
      userId,
      folderId,
      name: meta?.name || "Playlist importée",
      description: meta?.description ? String(meta.description).replace(/<[^>]+>/g, "") : null,
      color: colors[Math.floor(Math.random() * colors.length)],
      position: (max._max.position ?? -1) + 1,
    },
  });
  const seen = new Set<string>();
  const data = [] as { playlistId: string; trackId: string; position: number }[];
  for (const t of tracks) {
    const id = idMap.get(t.track.id);
    if (!id || seen.has(id)) continue; // anti-doublon
    seen.add(id);
    data.push({ playlistId: pl.id, trackId: id, position: data.length });
  }
  for (let k = 0; k < data.length; k += 500) await prisma.playlistTrack.createMany({ data: data.slice(k, k + 500) });
  // Les morceaux entrent dans la bibliothèque (source playlist)
  const lib = new Set((await prisma.libraryTrack.findMany({ where: { userId, trackId: { in: [...seen] } }, select: { trackId: true } })).map((l) => l.trackId));
  const now = new Date();
  const newLib = [...seen].filter((id) => !lib.has(id)).map((trackId) => ({ userId, trackId, source: "playlist", sourceRef: pl.name, addedAt: now, status: "sorted" }));
  for (let k = 0; k < newLib.length; k += 500) await prisma.libraryTrack.createMany({ data: newLib.slice(k, k + 500) });
  await refreshStatus(userId, [...seen]);
  return { id: pl.id, count: data.length };
}

/** Extrait l'ID d'une playlist depuis un lien Spotify (open.spotify.com/…/playlist/ID, spotify:playlist:ID ou l'ID seul). */
export function parsePlaylistLink(input: string): string | null {
  const s = input.trim();
  const m =
    /open\.spotify\.com\/(?:[a-z-]+\/)*playlist\/([A-Za-z0-9]{22})/.exec(s) ||
    /spotify:playlist:([A-Za-z0-9]{22})/.exec(s) ||
    /^([A-Za-z0-9]{22})$/.exec(s);
  return m ? m[1] : null;
}
