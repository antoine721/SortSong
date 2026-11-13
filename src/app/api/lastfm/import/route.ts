import { NextRequest } from "next/server";
import { prisma } from "@/lib/server/db";
import { lfUserTracks } from "@/lib/server/lastfm";
import { matchOnSpotify, pool } from "@/lib/server/match";
import { requireUser, HttpError } from "@/lib/server/session";
import { upsertTracks } from "@/lib/server/tracks";
import type { TrackDTO } from "@/lib/types";

export const maxDuration = 300;

/** Importe les titres aimés / les plus écoutés Last.fm dans « À trier » (retrouvés sur Spotify). Progression NDJSON. */
export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    return Response.json({ error: "Non connecté" }, { status: e instanceof HttpError ? e.status : 401 });
  }
  if (!user.lastfmUser) return Response.json({ error: "Compte Last.fm non connecté" }, { status: 400 });
  const { kind = "loved", max = 300, period = "overall" } = (await req.json().catch(() => ({}))) as { kind?: "loved" | "top"; max?: number; period?: string };
  const userId = user.id;
  const lfUser = user.lastfmUser;
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctrl) {
      const send = (o: unknown) => ctrl.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      try {
        send({ type: "progress", step: `Lecture de ton compte Last.fm (${kind === "loved" ? "titres aimés" : "top titres"})…` });
        const list = await lfUserTracks(lfUser, kind, Math.min(max, 1000), period);
        let done = 0;
        const matched = await pool(list, 4, async (t) => {
          const m = await matchOnSpotify(userId, { title: t.title, artist: t.artist });
          done++;
          if (done % 5 === 0 || done === list.length) send({ type: "progress", step: "Correspondance sur Spotify", done, total: list.length });
          return m;
        });
        const found = matched.filter((t): t is TrackDTO => !!t);
        const ids = await upsertTracks(found);
        const existing = new Set((await prisma.libraryTrack.findMany({ where: { userId, trackId: { in: [...ids.values()] } }, select: { trackId: true } })).map((l) => l.trackId));
        const now = new Date();
        const data = [...new Set(ids.values())]
          .filter((id) => !existing.has(id))
          .map((trackId) => ({ userId, trackId, source: "lastfm", sourceRef: kind === "loved" ? "Last.fm ♥" : "Last.fm top", status: "inbox", addedAt: now }));
        for (let i = 0; i < data.length; i += 500) await prisma.libraryTrack.createMany({ data: data.slice(i, i + 500) });
        send({ type: "done", added: data.length, scanned: list.length, matched: found.length });
      } catch (e) {
        send({ type: "error", error: e instanceof Error ? e.message : String(e) });
      }
      ctrl.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" } });
}
