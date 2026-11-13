import { NextRequest } from "next/server";
import { prisma } from "@/lib/server/db";
import { handler, requireUser, HttpError } from "@/lib/server/session";
import { refreshStatus } from "@/lib/server/tracks";
import type { SmartRules } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handler(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const b = (await req.json()) as {
    name?: string;
    color?: string;
    description?: string | null;
    folderId?: string | null;
    position?: number;
    hotkey?: number | null;
    rules?: SmartRules | null;
  };
  const p = await prisma.playlist.findFirst({ where: { id, userId: user.id } });
  if (!p) throw new HttpError(404, "Playlist introuvable");
  if (b.hotkey !== undefined && b.hotkey !== null) {
    if (b.hotkey < 1 || b.hotkey > 9) throw new HttpError(400, "Touche 1 à 9");
    // Une touche = une playlist
    await prisma.playlist.updateMany({ where: { userId: user.id, hotkey: b.hotkey }, data: { hotkey: null } });
  }
  await prisma.playlist.update({
    where: { id },
    data: {
      ...(b.name !== undefined ? { name: b.name.trim() || p.name } : {}),
      ...(b.color !== undefined ? { color: b.color } : {}),
      ...(b.description !== undefined ? { description: b.description } : {}),
      ...(b.folderId !== undefined ? { folderId: b.folderId } : {}),
      ...(b.position !== undefined ? { position: b.position } : {}),
      ...(b.hotkey !== undefined ? { hotkey: b.hotkey } : {}),
      ...(b.rules !== undefined ? { rules: b.rules ? JSON.stringify(b.rules) : null } : {}),
    },
  });
  return { ok: true };
});

/** Supprime la playlist et renvoie un instantané pour pouvoir annuler. */
export const DELETE = handler(async (_req: NextRequest, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const p = await prisma.playlist.findFirst({ where: { id, userId: user.id }, include: { tracks: { orderBy: { position: "asc" } } } });
  if (!p) throw new HttpError(404, "Playlist introuvable");
  await prisma.playlist.delete({ where: { id } });
  await refreshStatus(user.id, p.tracks.map((t) => t.trackId));
  const { tracks, ...rest } = p;
  return { snapshot: { playlist: rest, tracks: tracks.map((t) => ({ trackId: t.trackId, position: t.position, note: t.note, addedAt: t.addedAt })) } };
});
