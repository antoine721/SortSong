import { prisma } from "@/lib/server/db";
import { handler, requireUser } from "@/lib/server/session";

export const POST = handler(async () => {
  const user = await requireUser();
  await prisma.user.update({ where: { id: user.id }, data: { lastfmUser: null, lastfmSessionEnc: null, scrobble: false } });
  return { ok: true };
});
