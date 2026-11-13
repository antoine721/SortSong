import { NextRequest } from "next/server";
import { prisma } from "@/lib/server/db";
import { handler, requireUser } from "@/lib/server/session";

export const POST = handler(async (req: NextRequest) => {
  const user = await requireUser();
  const { scrobble } = (await req.json()) as { scrobble: boolean };
  await prisma.user.update({ where: { id: user.id }, data: { scrobble: !!scrobble } });
  return { ok: true };
});
