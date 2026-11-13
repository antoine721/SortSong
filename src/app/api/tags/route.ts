import { NextRequest } from "next/server";
import { prisma } from "@/lib/server/db";
import { handler, requireUser } from "@/lib/server/session";

export const GET = handler(async () => {
  const user = await requireUser();
  const tags = await prisma.tag.findMany({ where: { userId: user.id }, orderBy: [{ category: "asc" }, { name: "asc" }] });
  return { tags: tags.map((t) => ({ id: t.id, name: t.name, category: t.category, color: t.color })) };
});

export const POST = handler(async (req: NextRequest) => {
  const user = await requireUser();
  const b = (await req.json()) as { name: string; category?: string; color?: string };
  const name = b.name.trim();
  const category = b.category || "genre";
  const t = await prisma.tag.upsert({
    where: { userId_name_category: { userId: user.id, name, category } },
    create: { userId: user.id, name, category, color: b.color || "#8b5cf6" },
    update: {},
  });
  return { tag: { id: t.id, name: t.name, category: t.category, color: t.color } };
});
