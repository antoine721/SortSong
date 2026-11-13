import { prisma } from "@/lib/server/db";
import { handler, requireUser } from "@/lib/server/session";
import { membershipMap, playlistDTOs } from "@/lib/server/playlists";
import { hasLastfm } from "@/lib/server/lastfm";
import type { BootstrapDTO } from "@/lib/types";

export const GET = handler(async () => {
  const user = await requireUser();
  const [folders, playlists, membership, lib, tags] = await Promise.all([
    prisma.folder.findMany({ where: { userId: user.id }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] }),
    playlistDTOs(user.id),
    membershipMap(user.id),
    prisma.libraryTrack.findMany({ where: { userId: user.id, status: { not: "deleted" } }, select: { status: true, track: { select: { spotifyId: true } } } }),
    prisma.tag.findMany({ where: { userId: user.id }, orderBy: [{ category: "asc" }, { name: "asc" }] }),
  ]);
  const sixMonths = 182 * 86400_000;
  const out: BootstrapDTO = {
    me: {
      id: user.id,
      name: user.name,
      image: user.image,
      product: user.product,
      authorizedAt: user.authorizedAt.toISOString(),
      expiresSoon: Date.now() - user.authorizedAt.getTime() > sixMonths - 14 * 86400_000,
      lastSyncAt: user.lastSyncAt?.toISOString() ?? null,
      lastfm: user.lastfmUser ? { user: user.lastfmUser, scrobble: user.scrobble } : null,
    },
    folders: folders.map((f) => ({ id: f.id, parentId: f.parentId, name: f.name, position: f.position, collapsed: f.collapsed })),
    playlists,
    membership,
    library: lib.map((l) => l.track.spotifyId),
    inboxCount: lib.filter((l) => l.status === "inbox").length,
    tags: tags.map((t) => ({ id: t.id, name: t.name, category: t.category, color: t.color })),
    config: { lastfm: await hasLastfm() },
  };
  return out;
});
