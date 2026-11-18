"use client";
import {
  ChevronRight, Disc3, Link2, Star, Folder, FolderOpen, FolderPlus, Inbox, Library, ListMusic, MoreHorizontal, Pencil, Plus, Search, Settings, Sparkles, Trash2, Wand2, X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import type { FolderDTO, PlaylistDTO, TrackDTO } from "@/lib/types";
import { PLAYLIST_COLORS } from "@/lib/client/format";
import { useApp } from "@/store/app";
import { Cover, Kbd, MenuItem, Popover, cx } from "./ui";

type Node = { kind: "folder" | "playlist"; id: string };
const NODE_MIME = "application/x-sortsong-node";
const TRACK_MIME = "application/x-sortsong-track";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const inboxCount = useApp((s) => s.inboxCount);
  const unratedCount = useApp((s) => s.unratedCount);
  const me = useApp((s) => s.me);
  const folders = useApp((s) => s.folders);
  const playlists = useApp((s) => s.playlists);
  const mobileNav = useApp((s) => s.mobileNav);
  const [rootOver, setRootOver] = useState(false);
  const [newMenu, setNewMenu] = useState<DOMRect | null>(null);

  const createPlaylist = async (folderId: string | null = null, smart = false) => {
    const id = await useApp.getState().createPlaylist({
      folderId,
      name: smart ? "Playlist intelligente" : undefined,
      rules: smart ? { bpmMin: 120, bpmMax: 128 } : null,
    });
    router.push(`/playlist/${id}${smart ? "?rules=1" : ""}`);
  };

  const moveToRoot = (e: React.DragEvent) => {
    const raw = e.dataTransfer.getData(NODE_MIME);
    if (!raw) return;
    const n: Node = JSON.parse(raw);
    if (n.kind === "folder") useApp.getState().updateFolder(n.id, { parentId: null });
    else useApp.getState().updatePlaylist(n.id, { folderId: null });
  };

  const nav = [
    { href: "/rate", label: "Noter", icon: Star, count: unratedCount },
    { href: "/inbox", label: "À trier", icon: Inbox, count: inboxCount },
    { href: "/library", label: "Bibliothèque", icon: Library },
    { href: "/settings", label: "Réglages", icon: Settings },
  ];

  return (
    <>
      {mobileNav && <div className="fixed inset-0 z-30 bg-black/60 md:hidden" onClick={() => useApp.setState({ mobileNav: false })} />}
      <aside
        className={cx(
          "z-40 flex h-full w-[272px] shrink-0 flex-col border-r border-line bg-bg-1 transition-transform",
          "fixed inset-y-0 left-0 md:static md:translate-x-0",
          mobileNav ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center gap-2.5 px-5 pb-3 pt-5">
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-accent text-white shadow-[0_0_20px_rgba(124,92,255,0.5)]">
            <Disc3 className="h-[18px] w-[18px]" />
          </div>
          <span className="text-[17px] font-bold tracking-tight">SortSong</span>
          <button className="ml-auto text-fg-3 md:hidden" onClick={() => useApp.setState({ mobileNav: false })}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-3">
          <button
            onClick={() => useApp.setState({ searchOpen: true })}
            className="mb-2 flex h-10 w-full items-center gap-2.5 rounded-xl border border-line bg-bg-2 px-3 text-sm text-fg-3 transition hover:border-fg-3 hover:text-fg-2"
          >
            <Search className="h-4 w-4" />
            <span className="flex-1 text-left">Rechercher</span>
            <Kbd>Ctrl K</Kbd>
          </button>
          <button
            onClick={() => useApp.setState({ linkDialog: { folderId: null }, mobileNav: false })}
            className="mb-2 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-accent text-sm font-semibold text-white shadow-[0_6px_24px_-8px_rgba(124,92,255,0.8)] transition hover:bg-accent-2"
          >
            <Link2 className="h-4 w-4" /> Importer un lien Spotify
          </button>
          {nav.map((n) => {
            const active = pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => useApp.setState({ mobileNav: false })}
                className={cx(
                  "flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition",
                  active ? "bg-bg-3 text-fg" : "text-fg-2 hover:bg-bg-2 hover:text-fg",
                )}
              >
                <n.icon className={cx("h-[18px] w-[18px]", active && "text-accent-2")} />
                <span className="flex-1">{n.label}</span>
                {n.count !== undefined && n.count > 0 && (
                  <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-white tnum">{n.count.toLocaleString("fr-FR")}</span>
                )}
              </Link>
            );
          })}
        </div>

        <div
          onDragOver={(e) => {
            if (!e.dataTransfer.types.includes(NODE_MIME)) return;
            e.preventDefault();
            setRootOver(true);
          }}
          onDragLeave={() => setRootOver(false)}
          onDrop={(e) => {
            setRootOver(false);
            moveToRoot(e);
          }}
          className={cx("mx-3 mt-4 flex h-8 items-center rounded-lg pl-3 pr-1", rootOver && "drop-target")}
        >
          <span className="flex-1 text-[11px] font-semibold uppercase tracking-wider text-fg-3">Playlists</span>
          <button title="Nouveau…" onClick={(e) => setNewMenu(e.currentTarget.getBoundingClientRect())} className="grid h-7 w-7 place-items-center rounded-full text-fg-2 hover:bg-bg-3 hover:text-fg">
            <Plus className="h-4 w-4" />
          </button>
        </div>
        {newMenu && (
          <Popover anchor={newMenu} onClose={() => setNewMenu(null)} width={220}>
            <MenuItem icon={<ListMusic />} onClick={() => (setNewMenu(null), createPlaylist())}>
              Nouvelle playlist
            </MenuItem>
            <MenuItem icon={<FolderPlus />} onClick={() => (setNewMenu(null), useApp.getState().createFolder({}))}>
              Nouveau dossier
            </MenuItem>
            <MenuItem icon={<Wand2 />} onClick={() => (setNewMenu(null), createPlaylist(null, true))}>
              Playlist intelligente
            </MenuItem>
            <MenuItem icon={<Link2 />} onClick={() => (setNewMenu(null), useApp.setState({ linkDialog: { folderId: null } }))}>
              Playlist depuis un lien Spotify…
            </MenuItem>
          </Popover>
        )}

        <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          <Tree parentId={null} depth={0} folders={folders} playlists={playlists} onNewPlaylist={createPlaylist} />
          {!folders.length && !playlists.length && (
            <div className="mx-1 mt-2 rounded-xl border border-dashed border-line p-4 text-center text-xs text-fg-3">
              Crée ta première playlist avec le bouton <b>+</b>. Glisse-dépose pour ranger dans des dossiers.
            </div>
          )}
        </nav>

        {me && (
          <Link href="/settings" className="flex items-center gap-2.5 border-t border-line px-4 py-3 hover:bg-bg-2">
            <Cover src={me.image} size={28} rounded="rounded-full" />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{me.name}</span>
            {me.expiresSoon && <span className="rounded bg-amber-400/15 px-1.5 text-[10px] text-amber-300">reconnexion</span>}
          </Link>
        )}
      </aside>
    </>
  );
}

function sortedChildren(parentId: string | null, folders: FolderDTO[], playlists: PlaylistDTO[]) {
  const fs = folders.filter((f) => f.parentId === parentId).sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
  const ps = playlists.filter((p) => p.folderId === parentId).sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
  return { fs, ps };
}

function Tree({
  parentId,
  depth,
  folders,
  playlists,
  onNewPlaylist,
}: {
  parentId: string | null;
  depth: number;
  folders: FolderDTO[];
  playlists: PlaylistDTO[];
  onNewPlaylist: (folderId: string | null, smart?: boolean) => void;
}) {
  const { fs, ps } = sortedChildren(parentId, folders, playlists);
  return (
    <div>
      {fs.map((f) => (
        <FolderRow key={f.id} folder={f} depth={depth} folders={folders} playlists={playlists} onNewPlaylist={onNewPlaylist} />
      ))}
      {ps.map((p) => (
        <PlaylistRow key={p.id} playlist={p} depth={depth} siblings={ps} />
      ))}
    </div>
  );
}

function FolderRow({
  folder,
  depth,
  folders,
  playlists,
  onNewPlaylist,
}: {
  folder: FolderDTO;
  depth: number;
  folders: FolderDTO[];
  playlists: PlaylistDTO[];
  onNewPlaylist: (folderId: string | null, smart?: boolean) => void;
}) {
  const pathname = usePathname();
  const [over, setOver] = useState(false);
  const [menu, setMenu] = useState<DOMRect | null>(null);
  const [renaming, setRenaming] = useState(false);
  const active = pathname === `/folder/${folder.id}`;
  const count = playlists.filter((p) => p.folderId === folder.id).length + folders.filter((f) => f.parentId === folder.id).length;
  const app = useApp.getState;

  return (
    <div>
      <div
        draggable={!renaming}
        onDragStart={(e) => {
          e.stopPropagation();
          e.dataTransfer.setData(NODE_MIME, JSON.stringify({ kind: "folder", id: folder.id }));
        }}
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes(NODE_MIME)) return;
          e.preventDefault();
          e.stopPropagation();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOver(false);
          const raw = e.dataTransfer.getData(NODE_MIME);
          if (!raw) return;
          const n: Node = JSON.parse(raw);
          if (n.id === folder.id) return;
          if (n.kind === "folder") app().updateFolder(n.id, { parentId: folder.id });
          else app().updatePlaylist(n.id, { folderId: folder.id });
          if (folder.collapsed) app().updateFolder(folder.id, { collapsed: false }, { record: false });
        }}
        style={{ paddingLeft: 4 + depth * 14 }}
        className={cx("group flex h-9 items-center gap-1 rounded-lg pr-1 text-sm", active ? "bg-bg-3" : "hover:bg-bg-2", over && "drop-target")}
      >
        <button onClick={() => app().updateFolder(folder.id, { collapsed: !folder.collapsed }, { record: false })} className="grid h-6 w-6 place-items-center text-fg-3 hover:text-fg">
          <ChevronRight className={cx("h-4 w-4 transition-transform", !folder.collapsed && "rotate-90")} />
        </button>
        {folder.collapsed ? <Folder className="h-4 w-4 shrink-0 text-fg-2" /> : <FolderOpen className="h-4 w-4 shrink-0 text-fg-2" />}
        {renaming ? (
          <RenameInput
            value={folder.name}
            onDone={(v) => {
              setRenaming(false);
              if (v && v !== folder.name) app().updateFolder(folder.id, { name: v });
            }}
          />
        ) : (
          <Link href={`/folder/${folder.id}`} onDoubleClick={() => setRenaming(true)} className="min-w-0 flex-1 truncate px-1.5 font-medium text-fg-2 group-hover:text-fg">
            {folder.name}
          </Link>
        )}
        <span className="text-[11px] text-fg-3 group-hover:hidden">{count || ""}</span>
        <button onClick={(e) => setMenu(e.currentTarget.getBoundingClientRect())} className="hidden h-6 w-6 place-items-center rounded text-fg-3 hover:text-fg group-hover:grid">
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>
      {menu && (
        <Popover anchor={menu} onClose={() => setMenu(null)} width={220}>
          <MenuItem icon={<Pencil />} onClick={() => (setMenu(null), setRenaming(true))}>Renommer</MenuItem>
          <MenuItem icon={<ListMusic />} onClick={() => (setMenu(null), onNewPlaylist(folder.id))}>Nouvelle playlist ici</MenuItem>
          <MenuItem icon={<Sparkles />} onClick={() => (setMenu(null), onNewPlaylist(folder.id, true))}>Playlist intelligente ici</MenuItem>
          <MenuItem icon={<Link2 />} onClick={() => (setMenu(null), useApp.setState({ linkDialog: { folderId: folder.id } }))}>Playlist depuis un lien ici</MenuItem>
          <MenuItem icon={<FolderPlus />} onClick={() => (setMenu(null), app().createFolder({ parentId: folder.id }), app().updateFolder(folder.id, { collapsed: false }, { record: false }))}>
            Nouveau sous-dossier
          </MenuItem>
          <div className="my-1 h-px bg-line" />
          <MenuItem icon={<Trash2 />} danger onClick={() => (setMenu(null), app().deleteFolder(folder.id))}>
            Supprimer (garde le contenu)
          </MenuItem>
        </Popover>
      )}
      {!folder.collapsed && <Tree parentId={folder.id} depth={depth + 1} folders={folders} playlists={playlists} onNewPlaylist={onNewPlaylist} />}
    </div>
  );
}

function PlaylistRow({ playlist: p, depth, siblings }: { playlist: PlaylistDTO; depth: number; siblings: PlaylistDTO[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const [over, setOver] = useState<"track" | "node" | null>(null);
  const [menu, setMenu] = useState<DOMRect | null>(null);
  const [renaming, setRenaming] = useState(false);
  const active = pathname === `/playlist/${p.id}`;
  const app = useApp.getState;

  return (
    <>
      <div
        draggable={!renaming}
        onDragStart={(e) => {
          e.stopPropagation();
          e.dataTransfer.setData(NODE_MIME, JSON.stringify({ kind: "playlist", id: p.id }));
        }}
        onDragOver={(e) => {
          const isTrack = e.dataTransfer.types.includes(TRACK_MIME);
          const isNode = e.dataTransfer.types.includes(NODE_MIME);
          if (!isTrack && !isNode) return;
          if (isTrack && p.rules) return;
          e.preventDefault();
          e.stopPropagation();
          setOver(isTrack ? "track" : "node");
        }}
        onDragLeave={() => setOver(null)}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOver(null);
          const tr = e.dataTransfer.getData(TRACK_MIME);
          if (tr) {
            app().addToPlaylists(JSON.parse(tr) as TrackDTO, [p.id]);
            return;
          }
          const raw = e.dataTransfer.getData(NODE_MIME);
          if (!raw) return;
          const n: Node = JSON.parse(raw);
          if (n.id === p.id) return;
          if (n.kind === "folder") {
            app().updateFolder(n.id, { parentId: p.folderId });
            return;
          }
          // Réordonne : place la playlist déplacée juste avant celle-ci.
          const moved = app().playlists.find((x) => x.id === n.id);
          if (!moved) return;
          const order = siblings.filter((x) => x.id !== n.id);
          order.splice(order.findIndex((x) => x.id === p.id), 0, moved);
          order.forEach((x, i) => {
            if (x.id === moved.id) app().updatePlaylist(x.id, { folderId: p.folderId, position: i });
            else if (x.position !== i) app().updatePlaylist(x.id, { position: i }, { record: false });
          });
        }}
        style={{ paddingLeft: 10 + depth * 14 }}
        className={cx(
          "group flex h-9 items-center gap-2 rounded-lg pr-1 text-sm",
          active ? "bg-bg-3 text-fg" : "text-fg-2 hover:bg-bg-2 hover:text-fg",
          over === "track" && "drop-target",
          over === "node" && "border-t-2 border-accent",
        )}
      >
        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md" style={{ background: p.color + "33" }}>
          {p.rules ? <Wand2 className="h-3 w-3" style={{ color: p.color }} /> : <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />}
        </span>
        {renaming ? (
          <RenameInput
            value={p.name}
            onDone={(v) => {
              setRenaming(false);
              if (v && v !== p.name) app().updatePlaylist(p.id, { name: v });
            }}
          />
        ) : (
          <Link
            href={`/playlist/${p.id}`}
            onClick={() => useApp.setState({ mobileNav: false })}
            onDoubleClick={() => setRenaming(true)}
            className="min-w-0 flex-1 truncate"
          >
            {p.name}
          </Link>
        )}
        {p.hotkey && <span className="rounded bg-bg-4 px-1.5 font-mono text-[10px] text-fg-2">{p.hotkey}</span>}
        <span className="text-[11px] text-fg-3 tnum group-hover:hidden">{p.rules ? "" : p.count}</span>
        <button onClick={(e) => setMenu(e.currentTarget.getBoundingClientRect())} className="hidden h-6 w-6 place-items-center rounded text-fg-3 hover:text-fg group-hover:grid">
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>
      {menu && (
        <Popover anchor={menu} onClose={() => setMenu(null)} width={240}>
          <MenuItem icon={<Pencil />} onClick={() => (setMenu(null), setRenaming(true))}>Renommer</MenuItem>
          <div className="px-2.5 py-2">
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-fg-3">Couleur</div>
            <div className="grid grid-cols-6 gap-1.5">
              {PLAYLIST_COLORS.map((c) => (
                <button key={c} onClick={() => app().updatePlaylist(p.id, { color: c })} className={cx("h-6 w-6 rounded-full transition hover:scale-110", p.color === c && "ring-2 ring-white ring-offset-2 ring-offset-bg-2")} style={{ background: c }} />
              ))}
            </div>
          </div>
          {!p.rules && (
            <div className="px-2.5 pb-2">
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-fg-3">Touche d'ajout express</div>
              <div className="flex flex-wrap gap-1">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => (
                  <button
                    key={k}
                    onClick={() => app().updatePlaylist(p.id, { hotkey: p.hotkey === k ? null : k })}
                    className={cx("h-6 w-6 rounded font-mono text-xs", p.hotkey === k ? "bg-accent text-white" : "bg-bg-3 text-fg-2 hover:bg-bg-4")}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="my-1 h-px bg-line" />
          <MenuItem
            icon={<Trash2 />}
            danger
            onClick={() => {
              setMenu(null);
              if (active) router.push("/library");
              app().deletePlaylist(p.id);
            }}
          >
            Supprimer
          </MenuItem>
        </Popover>
      )}
    </>
  );
}

function RenameInput({ value, onDone }: { value: string; onDone: (v: string) => void }) {
  const [v, setV] = useState(value);
  return (
    <input
      autoFocus
      value={v}
      onFocus={(e) => e.target.select()}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => onDone(v.trim())}
      onKeyDown={(e) => {
        if (e.key === "Enter") onDone(v.trim());
        if (e.key === "Escape") onDone(value);
      }}
      className="h-7 min-w-0 flex-1 rounded bg-bg-3 px-1.5 text-sm text-fg outline-none ring-1 ring-accent"
    />
  );
}
