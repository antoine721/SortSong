import crypto from "node:crypto";
import { prisma } from "./db";

export type AppConfig = {
  spotifyClientId: string | null;
  lastfmApiKey: string | null;
  lastfmSecret: string | null;
};

const ENV: Record<keyof AppConfig, string> = {
  spotifyClientId: "SPOTIFY_CLIENT_ID",
  lastfmApiKey: "LASTFM_API_KEY",
  lastfmSecret: "LASTFM_SHARED_SECRET",
};

let cache: { at: number; db: Record<string, string> } | null = null;

async function dbConfig(): Promise<Record<string, string>> {
  if (cache && Date.now() - cache.at < 5000) return cache.db;
  const rows = await prisma.appConfig.findMany();
  const db = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  cache = { at: Date.now(), db };
  return db;
}

/** Configuration effective : variable d'environnement > valeur saisie dans /setup. */
export async function getConfig(): Promise<AppConfig> {
  const db = await dbConfig();
  const out = {} as AppConfig;
  for (const k of Object.keys(ENV) as (keyof AppConfig)[]) out[k] = process.env[ENV[k]]?.trim() || db[k]?.trim() || null;
  return out;
}

/** Champs figés par une variable d'environnement (non modifiables depuis l'écran). */
export function envLocked(): Record<keyof AppConfig, boolean> {
  const out = {} as Record<keyof AppConfig, boolean>;
  for (const k of Object.keys(ENV) as (keyof AppConfig)[]) out[k] = !!process.env[ENV[k]]?.trim();
  return out;
}

export async function setConfig(patch: Partial<AppConfig>) {
  for (const [key, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    if (v === null || v === "") await prisma.appConfig.deleteMany({ where: { key } });
    else await prisma.appConfig.upsert({ where: { key }, create: { key, value: v.trim() }, update: { value: v.trim() } });
  }
  cache = null;
}

let secret: string | null = null;
/** Secret de chiffrement : APP_SECRET, sinon généré une fois et conservé en base. */
export async function ensureSecret(): Promise<string> {
  if (secret) return secret;
  const env = process.env.APP_SECRET?.trim();
  if (env && env.length >= 16) return (secret = env);
  const row = await prisma.appConfig.findUnique({ where: { key: "appSecret" } });
  if (row) return (secret = row.value);
  const gen = crypto.randomBytes(32).toString("hex");
  try {
    await prisma.appConfig.create({ data: { key: "appSecret", value: gen } });
    return (secret = gen);
  } catch {
    // créé en parallèle par une autre requête
    return (secret = (await prisma.appConfig.findUniqueOrThrow({ where: { key: "appSecret" } })).value);
  }
}

export function loadedSecret(): string {
  if (!secret) throw new Error("Secret non initialisé (ensureSecret)");
  return secret;
}

/** Origine publique de la requête (gère les proxys type Vercel). */
export function originOf(req: Request): string {
  const h = req.headers;
  const host = h.get("x-forwarded-host") || h.get("host");
  const proto = h.get("x-forwarded-proto")?.split(",")[0] || new URL(req.url).protocol.replace(":", "");
  return host ? `${proto}://${host}` : new URL(req.url).origin;
}

export function spotifyRedirectFor(origin: string) {
  return process.env.SPOTIFY_REDIRECT_URI?.trim() || `${origin}/api/auth/callback`;
}
