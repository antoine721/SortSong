import { NextRequest } from "next/server";
import { prisma } from "@/lib/server/db";
import { handler, requireUser } from "@/lib/server/session";
import { fetchBpm } from "@/lib/server/mix";
import { pool } from "@/lib/server/match";

export const maxDuration = 300;

/** Récupère les BPM manquants de la bibliothèque, par lots (Deezer : ~10 req/s). */
export const POST = handler(async (req: NextRequest) => {
  const user = await requireUser();
  const { limit } = (await req.json().catch(() => ({}))) as { limit?: number };
  const rows = await prisma.libraryTrack.findMany({
    where: { userId: user.id, track: { bpm: null, deezerId: null } },
    select: { track: { select: { spotifyId: true } } },
    take: Math.min(limit || 100, 300),
  });
  const results: Record<string, number | null> = {};
  await pool(rows, 4, async (r) => {
    results[r.track.spotifyId] = await fetchBpm(r.track.spotifyId);
  });
  const remaining = await prisma.libraryTrack.count({ where: { userId: user.id, track: { bpm: null, deezerId: null } } });
  return { results, remaining };
});
