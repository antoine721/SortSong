import { prisma } from "@/lib/server/db";
import { getAccessToken } from "@/lib/server/spotify";
import { handler, requireUser } from "@/lib/server/session";

/** Jeton d'accès pour le Web Playback SDK et le pilotage Spotify Connect côté navigateur. */
export const GET = handler(async () => {
  const user = await requireUser();
  const accessToken = await getAccessToken(user.id);
  const u = await prisma.user.findUnique({ where: { id: user.id }, select: { accessExpiresAt: true } });
  return { accessToken, expiresAt: u!.accessExpiresAt.toISOString() };
});
