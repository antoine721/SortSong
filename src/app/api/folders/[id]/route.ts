import { NextRequest } from "next/server";
import { prisma } from "@/lib/server/db";
import { handler, requireUser, HttpError } from "@/lib/server/session";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handler(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const body = (await req.json()) as { name?: string; parentId?: string | null; position?: number; collapsed?: boolean };
  const f = await prisma.folder.findFirst({ where: { id, userId: user.id } });
  if (!f) throw new HttpError(404, "Dossier introuvable");
  if (body.parentId !== undefined && body.parentId !== null) {
    // Empêche les cycles (déposer un dossier dans un de ses descendants)
    let cur: string | null = body.parentId;
    while (cur) {
      if (cur === id) throw new HttpError(400, "Impossible de ranger un dossier dans lui-même");
      cur = (await prisma.folder.findUnique({ where: { id: cur }, select: { parentId: true } }))?.parentId ?? null;
    }
  }
  await prisma.folder.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name.trim() || f.name } : {}),
      ...(body.parentId !== undefined ? { parentId: body.parentId } : {}),
      ...(body.position !== undefined ? { position: body.position } : {}),
      ...(body.collapsed !== undefined ? { collapsed: body.collapsed } : {}),
    },
  });
  return { ok: true };
});

/** Supprime le dossier ; son contenu remonte d'un niveau (rien n'est perdu). */
export const DELETE = handler(async (_req: NextRequest, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const f = await prisma.folder.findFirst({ where: { id, userId: user.id } });
  if (!f) throw new HttpError(404, "Dossier introuvable");
  const children = await prisma.folder.findMany({ where: { parentId: id }, select: { id: true } });
  const playlists = await prisma.playlist.findMany({ where: { folderId: id }, select: { id: true } });
  await prisma.$transaction([
    prisma.folder.updateMany({ where: { parentId: id }, data: { parentId: f.parentId } }),
    prisma.playlist.updateMany({ where: { folderId: id }, data: { folderId: f.parentId } }),
    prisma.folder.delete({ where: { id } }),
  ]);
  return {
    snapshot: {
      folder: { id: f.id, name: f.name, parentId: f.parentId, position: f.position },
      childFolderIds: children.map((c) => c.id),
      playlistIds: playlists.map((p) => p.id),
    },
  };
});
