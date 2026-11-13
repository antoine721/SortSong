import { NextRequest } from "next/server";
import { prisma } from "@/lib/server/db";
import { handler, requireUser } from "@/lib/server/session";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handler(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const b = (await req.json()) as { name?: string; color?: string; category?: string };
  await prisma.tag.updateMany({ where: { id, userId: user.id }, data: b });
  return { ok: true };
});

export const DELETE = handler(async (_req: NextRequest, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  await prisma.tag.deleteMany({ where: { id, userId: user.id } });
  return { ok: true };
});
