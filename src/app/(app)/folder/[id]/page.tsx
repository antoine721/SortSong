"use client";
import { Folder, FolderPlus, ListMusic, Plus, Wand2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/common";
import { Button, Empty, InlineEdit } from "@/components/ui";
import { fmtLong, plural } from "@/lib/client/format";
import { useApp } from "@/store/app";

/** Écran Dossier : grille des sous-dossiers et playlists. */
export default function FolderPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const folder = useApp((s) => s.folders.find((f) => f.id === id));
  const folders = useApp((s) => s.folders);
  const playlists = useApp((s) => s.playlists);
  if (!folder) return <Empty icon={<Folder />} title="Dossier introuvable" />;
  const subs = folders.filter((f) => f.parentId === id).sort((a, b) => a.position - b.position);
  const pls = playlists.filter((p) => p.folderId === id).sort((a, b) => a.position - b.position);
  const parent = folders.find((f) => f.id === folder.parentId);
  const total = pls.reduce((a, p) => a + p.count, 0);

  return (
    <div>
      <PageHeader
        color="#64748b"
        cover={
          <div className="grid h-[160px] w-[160px] place-items-center rounded-xl bg-gradient-to-br from-slate-500 to-slate-700 shadow-soft">
            <Folder className="h-16 w-16 text-white/90" />
          </div>
        }
        kicker={parent ? <Link href={`/folder/${parent.id}`} className="hover:underline">Dossier · {parent.name}</Link> : "Dossier"}
        title={<InlineEdit value={folder.name} onSave={(v) => useApp.getState().updateFolder(id, { name: v })} />}
        meta={
          <>
            <span>{plural(pls.length, "playlist")}</span>
            {subs.length > 0 && <span>· {plural(subs.length, "sous-dossier")}</span>}
            <span>· {plural(total, "titre")}</span>
          </>
        }
      >
        <Button variant="primary" onClick={async () => router.push(`/playlist/${await useApp.getState().createPlaylist({ folderId: id })}`)}>
          <Plus className="h-4 w-4" /> Playlist
        </Button>
        <Button onClick={() => useApp.getState().createFolder({ parentId: id })}>
          <FolderPlus className="h-4 w-4" /> Sous-dossier
        </Button>
      </PageHeader>
      <div className="grid grid-cols-2 gap-4 px-4 pb-10 sm:grid-cols-3 md:px-8 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {subs.map((f) => (
          <Link key={f.id} href={`/folder/${f.id}`} className="group rounded-xl bg-bg-2/60 p-3 transition hover:bg-bg-3">
            <div className="grid aspect-square place-items-center rounded-lg bg-gradient-to-br from-slate-600 to-slate-800">
              <Folder className="h-12 w-12 text-white/80" />
            </div>
            <div className="mt-2.5 truncate font-semibold">{f.name}</div>
            <div className="text-xs text-fg-3">
              {plural(playlists.filter((p) => p.folderId === f.id).length, "playlist")}
            </div>
          </Link>
        ))}
        {pls.map((p) => (
          <Link key={p.id} href={`/playlist/${p.id}`} className="group rounded-xl bg-bg-2/60 p-3 transition hover:bg-bg-3">
            <div className="relative grid aspect-square place-items-center rounded-lg shadow-soft" style={{ background: `linear-gradient(135deg, ${p.color}, ${p.color}55)` }}>
              {p.rules ? <Wand2 className="h-12 w-12 text-white/90" /> : <ListMusic className="h-12 w-12 text-white/90" />}
              {p.hotkey && <span className="absolute right-2 top-2 rounded bg-black/40 px-1.5 font-mono text-[11px] text-white">{p.hotkey}</span>}
            </div>
            <div className="mt-2.5 truncate font-semibold">{p.name}</div>
            <div className="truncate text-xs text-fg-3">{p.rules ? "Intelligente" : `${plural(p.count, "titre")} · ${fmtLong(p.durationMs)}`}</div>
          </Link>
        ))}
      </div>
      {!subs.length && !pls.length && <Empty title="Dossier vide">Glisse des playlists ou dossiers dessus dans la barre latérale.</Empty>}
    </div>
  );
}
