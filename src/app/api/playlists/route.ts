import { NextRequest } from "next/server";
import { prisma } from "@/lib/server/db";
import { handler, requireUser } from "@/lib/server/session";
import { playlistDTOs } from "@/lib/server/playlists";
import type { SmartRules } from "@/lib/types";

export const GET = handler(async () => {
  const user = await requireUser();
  return { playlists: await playlistDTOs(user.id) };
});

export const POST = handler(async (req: NextRequest) => {
  const user = await requireUser();
  const b = (await req.json()) as { id?: string; name?: string; folderId?: string | null; color?: string; description?: string | null; rules?: SmartRules | null };
  const max = await prisma.playlist.aggregate({ where: { userId: user.id, folderId: b.folderId ?? null }, _max: { position: true } });
  const p = await prisma.playlist.create({
    data: {
      ...(b.id ? { id: b.id } : {}),
      userId: user.id,
      name: b.name?.trim() || "Nouvelle playlist",
      folderId: b.folderId ?? null,
      color: b.color || "#7c5cff",
      description: b.description ?? null,
      rules: b.rules ? JSON.stringify(b.rules) : null,
      position: (max._max.position ?? -1) + 1,
    },
  });
  return { id: p.id };
});
