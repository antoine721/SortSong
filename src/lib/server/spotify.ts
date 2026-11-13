import { prisma } from "./db";
import { decrypt, encrypt } from "./crypto";
import { HttpError } from "./session";
import { getConfig } from "./config";
import type { AlbumDTO, ArtistDTO, TrackDTO } from "../types";

export const SPOTIFY_SCOPES = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-library-read",
  "playlist-read-private",
  "playlist-read-collaborative",
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
  // Export volontaire d'une playlist interne (C9) — rien n'est écrit sans clic explicite.
  "playlist-modify-private",
  "playlist-modify-public",
];

const API = "https://api.spotify.com/v1";
const ACCOUNTS = "https://accounts.spotify.com";

export async function clientId() {
  const id = (await getConfig()).spotifyClientId;
  if (!id) throw new HttpError(500, "Client ID Spotify non configuré (écran /setup)", "config");
  return id;
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  error?: string;
  error_description?: string;
};

export async function exchangeCode(code: string, verifier: string, redirectUri: string): Promise<TokenResponse> {
  const res = await fetch(`${ACCOUNTS}/api/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: await clientId(),
      code_verifier: verifier,
    }),
  });
  const json = (await res.json()) as TokenResponse;
  if (!res.ok) throw new HttpError(400, json.error_description || json.error || "Échange du code refusé");
  return json;
}

const refreshing = new Map<string, Promise<string>>();

/** Jeton d'accès valide pour l'utilisateur (rafraîchi si besoin). */
export async function getAccessToken(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new HttpError(401, "Non connecté", "unauthenticated");
  if (user.accessExpiresAt.getTime() - Date.now() > 60_000) return decrypt(user.accessTokenEnc);

  const pending = refreshing.get(userId);
  if (pending) return pending;
  const p = (async () => {
    const res = await fetch(`${ACCOUNTS}/api/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: decrypt(user.refreshTokenEnc),
        client_id: await clientId(),
      }),
    });
    const json = (await res.json()) as TokenResponse;
    if (!res.ok) {
      // Jeton révoqué ou expiré (6 mois) → reconnexion.
      throw new HttpError(401, "Session Spotify expirée, reconnecte-toi", "reauth");
    }
    await prisma.user.update({
      where: { id: userId },
      data: {
        accessTokenEnc: encrypt(json.access_token),
        refreshTokenEnc: json.refresh_token ? encrypt(json.refresh_token) : user.refreshTokenEnc,
        accessExpiresAt: new Date(Date.now() + json.expires_in * 1000),
      },
    });
    return json.access_token;
  })().finally(() => refreshing.delete(userId));
  refreshing.set(userId, p);
  return p;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Appel Web API avec rafraîchissement du jeton et attente automatique sur 429. */
export async function sp<T = any>(
  userId: string,
  path: string,
  init: RequestInit & { query?: Record<string, string | number | undefined | null> } = {},
  attempt = 0,
): Promise<T> {
  const token = await getAccessToken(userId);
  const url = new URL(path.startsWith("http") ? path : `${API}${path}`);
  if (init.query) {
    for (const [k, v] of Object.entries(init.query)) if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {}),
    },
    cache: "no-store",
  });
  if (res.status === 429 && attempt < 5) {
    const retry = Number(res.headers.get("Retry-After") || "1");
    await sleep(Math.min(30, Math.max(1, retry)) * 1000 + 250);
    return sp<T>(userId, path, init, attempt + 1);
  }
  if (res.status >= 500 && attempt < 2) {
    await sleep(800 * (attempt + 1));
    return sp<T>(userId, path, init, attempt + 1);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let json: any = undefined;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const msg = json?.error?.message || json?.error_description || `Spotify ${res.status}`;
    if (res.status === 401) throw new HttpError(401, msg, "reauth");
    throw new HttpError(res.status, `Spotify : ${msg}`, `spotify_${res.status}`);
  }
  return json as T;
}

/** Variante qui renvoie null au lieu de lever (endpoints potentiellement retirés en mode dev). */
export async function spSafe<T = any>(userId: string, path: string, init: Parameters<typeof sp>[2] = {}): Promise<T | null> {
  try {
    return await sp<T>(userId, path, init);
  } catch (e) {
    if (e instanceof HttpError && (e.code === "reauth" || e.code === "unauthenticated")) throw e;
    return null;
  }
}

function pickImage(images: any[] | undefined, preferSmall = false): string | null {
  if (!images || images.length === 0) return null;
  const sorted = [...images].sort((a, b) => (b.width || 0) - (a.width || 0));
  if (preferSmall) {
    const small = sorted.filter((i) => (i.width || 0) >= 48).pop();
    return (small || sorted[sorted.length - 1]).url;
  }
  return sorted[0].url;
}

/** Normalise un objet "track" Spotify. albumOverride : pour les pistes d'album (sans album imbriqué). */
export function normTrack(t: any, albumOverride?: any): TrackDTO | null {
  if (!t || !t.id || (t.type && t.type !== "track") || t.is_local) return null;
  const album = t.album || albumOverride || {};
  return {
    id: t.id,
    title: t.name,
    artists: (t.artists || []).map((a: any) => ({ id: a.id ?? null, name: a.name })),
    album: album.name || "",
    albumId: album.id || null,
    cover: pickImage(album.images),
    coverSmall: pickImage(album.images, true),
    durationMs: t.duration_ms || 0,
    isrc: t.external_ids?.isrc || null,
    explicit: !!t.explicit,
    releaseDate: album.release_date || null,
  };
}

export function normArtist(a: any): ArtistDTO {
  return {
    id: a.id,
    name: a.name,
    image: pickImage(a.images),
    genres: a.genres || [],
    followers: a.followers?.total ?? null,
  };
}

export function normAlbum(a: any): AlbumDTO {
  return {
    id: a.id,
    name: a.name,
    artists: (a.artists || []).map((x: any) => ({ id: x.id, name: x.name })),
    cover: pickImage(a.images),
    coverSmall: pickImage(a.images, true),
    releaseDate: a.release_date || null,
    totalTracks: a.total_tracks ?? null,
    albumType: a.album_type || null,
  };
}

/** Élément de playlist : depuis 2026 le champ peut s'appeler `item` (au lieu de `track`). */
export function playlistItemTrack(it: any): any {
  return it?.item ?? it?.track ?? null;
}

/** Récupère toutes les pages d'une ressource paginée Spotify. */
export async function paginate<T = any>(userId: string, firstUrl: string, max = 20000): Promise<T[]> {
  const out: T[] = [];
  let url: string | null = firstUrl;
  while (url && out.length < max) {
    const page: any = await sp(userId, url);
    out.push(...(page?.items || []));
    url = page?.next || null;
  }
  return out;
}
