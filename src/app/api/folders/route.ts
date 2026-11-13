import { NextRequest } from "next/server";
import { prisma } from "@/lib/server/db";
import { handler, requireUser } from "@/lib/server/session";

export const POST = handler(async (req: NextRequest) => {
  const user = await requireUser();
  const { name, parentId, id, position, childFolderIds, playlistIds } = (await req.json()) as {
    name: string;
    parentId?: string | null;
    id?: string;
    position?: number;
    childFolderIds?: string[];
    playlistIds?: string[];
  };
  const max = await prisma.folder.aggregate({ where: { userId: user.id, parentId: parentId ?? null }, _max: { position: true } });
  const f = await prisma.folder.create({
    data: { ...(id ? { id } : {}), userId: user.id, name: name?.trim() || "Nouveau dossier", parentId: parentId ?? null, position: position ?? (max._max.position ?? -1) + 1 },
  });
  // Restauration (annuler une suppression) : on y remet son ancien contenu.
  if (childFolderIds?.length) await prisma.folder.updateMany({ where: { id: { in: childFolderIds }, userId: user.id }, data: { parentId: f.id } });
  if (playlistIds?.length) await prisma.playlist.updateMany({ where: { id: { in: playlistIds }, userId: user.id }, data: { folderId: f.id } });
  return { folder: { id: f.id, parentId: f.parentId, name: f.name, position: f.position, collapsed: f.collapsed } };
});
