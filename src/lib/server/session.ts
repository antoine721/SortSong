import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "./db";
import { sign, unsign } from "./crypto";
import { ensureSecret } from "./config";

export const SESSION_COOKIE = "ss_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 182; // ~6 mois, comme le jeton Spotify

export async function getUserId(): Promise<string | null> {
  await ensureSecret();
  const store = await cookies();
  return unsign(store.get(SESSION_COOKIE)?.value);
}

export async function getUser() {
  const id = await getUserId();
  if (!id) return null;
  return prisma.user.findUnique({ where: { id } });
}

export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

export async function requireUser() {
  const user = await getUser();
  if (!user) throw new HttpError(401, "Non connecté", "unauthenticated");
  return user;
}

export function sessionCookieValue(userId: string) {
  return sign(userId);
}

/** Enveloppe les handlers d'API : erreurs → JSON propre. */
export function handler<A extends unknown[]>(fn: (...args: A) => Promise<Response | unknown>) {
  return async (...args: A): Promise<Response> => {
    try {
      const out = await fn(...args);
      if (out instanceof Response) return out;
      return NextResponse.json(out ?? { ok: true });
    } catch (e) {
      if (e instanceof HttpError) {
        return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
      }
      console.error(e);
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  };
}
