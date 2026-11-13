"use client";
import { ExternalLink, ListMusic, Settings2, Trash2, Upload, Wand2, BarChart3 } from "lucide-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader, PlayButtons } from "@/components/common";
import { SetlistPanel } from "@/components/Setlist";
import { SmartRulesEditor } from "@/components/SmartRules";
import { TrackList, type Sort } from "@/components/TrackList";
import { Button, Empty, InlineEdit, Popover, Spinner, cx } from "@/components/ui";
import { api } from "@/lib/client/api";
import { PLAYLIST_COLORS, fmtLong, plural } from "@/lib/client/format";
import type { TrackDTO } from "@/lib/types";
import { useApp } from "@/store/app";

export default function PlaylistPage() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const pl = useApp((s) => s.playlists.find((p) => p.id === id));
  const folders = useApp((s) => s.folders);
  const version = useApp((s) => s.playlistVersion[id] || 0);
  const membership = useApp((s) => s.membership);
  const meta = useApp((s) => s.meta);
  const [tracks, setTracks] = useState<TrackDTO[] | null>(null);
  const [sort, setSort] = useState<Sort | undefined>(undefined);
  const [setlist, setSetlist] = useState(false);
  const [editRules, setEditRules] = useState(search.get("rules") === "1");
  const [colorMenu, setColorMenu] = useState<DOMRect | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api<{ tracks: TrackDTO[] }>(`/api/playlists/${id}/tracks`);
      setTracks(r.tracks);
    } catch {
      setTracks([]);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load, version]);

  useEffect(() => {
    try {
      setSetlist(localStorage.getItem("ss_setlist_" + id) === "1");
    } catch {}
  }, [id]);
  const toggleSetlist = () => {
    setSetlist(!setlist);
    try {
      localStorage.setItem("ss_setlist_" + id, setlist ? "0" : "1");
    } catch {}
  };

  // Un morceau retiré ailleurs disparaît immédiatement
  const visible = useMemo(() => {
    if (!tracks || !pl) return [];
    let list = pl.rules ? tracks : tracks.filter((t) => membership[t.id]?.includes(id));
    if (sort) {
      const dir = sort.dir === "asc" ? 1 : -1;
      const m = (t: TrackDTO) => ({ ...t, ...(meta[t.id] || {}) });
      list = [...list].sort((a0, b0) => {
        const a = m(a0), b = m(b0);
        switch (sort.key) {
          case "title": return a.title.localeCompare(b.title) * dir;
          case "artist": return (a.artists[0]?.name || "").localeCompare(b.artists[0]?.name || "") * dir;
          case "album": return a.album.localeCompare(b.album) * dir;
          case "bpm": return ((a.bpm || 0) - (b.bpm || 0)) * dir;
          case "duration": return (a.durationMs - b.durationMs) * dir;
          case "addedAt": return (a.addedAt || "").localeCompare(b.addedAt || "") * dir;
          default: return 0;
        }
      });
    }
    return list;
  }, [tracks, membership, id, pl, sort, meta]);

  if (!pl) return <Empty icon={<ListMusic />} title="Playlist introuvable" />;

  const path: string[] = [];
  let cur = pl.folderId;
  while (cur) {
    const f = folders.find((x) => x.id === cur);
    if (!f) break;
    path.unshift(f.name);
    cur = f.parentId;
  }
  const total = visible.reduce((a, t) => a + t.durationMs, 0);
  const canReorder = !pl.rules && !sort;

  const reorder = (from: number, to: number) => {
    if (!tracks) return;
    const prev = visible.map((t) => t.id);
    const next = [...visible];
    const [m] = next.splice(from, 1);
    next.splice(to > from ? to - 1 : to, 0, m);
    setTracks(next);
    useApp.getState().reorderPlaylist(id, next.map((t) => t.id), prev);
  };

  const exportToSpotify = async () => {
    if (!confirm(`Créer une NOUVELLE playlist privée « ${pl.name} » dans ton compte Spotify avec ${visible.length} titres ?`)) return;
    setExporting(true);
    try {
      const r = await api<{ url: string; count: number }>(`/api/playlists/${id}/export`, { method: "POST" });
      useApp.getState().toast(`Exportée vers Spotify (${r.count} titres)`);
      useApp.setState({ playlists: useApp.getState().playlists.map((p) => (p.id === id ? { ...p, spotifyExportId: r.url.split("/").pop() || "x" } : p)) });
      window.open(r.url, "_blank");
    } catch (e) {
      useApp.getState().toast(`Export impossible : ${(e as Error).message}`, { tone: "err" });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <PageHeader
        color={pl.color}
        cover={
          <button onClick={(e) => setColorMenu(e.currentTarget.getBoundingClientRect())} title="Changer la couleur" className="grid h-[180px] w-[180px] shrink-0 place-items-center rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.5)]" style={{ background: `linear-gradient(135deg, ${pl.color}, ${pl.color}66)` }}>
            {pl.rules ? <Wand2 className="h-16 w-16 text-white/90" /> : <ListMusic className="h-16 w-16 text-white/90" />}
          </button>
        }
        kicker={
          <>
            {pl.rules ? "Playlist intelligente" : "Playlist"}
            {path.length > 0 && <span className="normal-case text-fg-3"> · {path.join(" / ")}</span>}
          </>
        }
        title={<InlineEdit value={pl.name} onSave={(v) => useApp.getState().updatePlaylist(id, { name: v })} />}
        description={<InlineEdit value={pl.description || ""} placeholder="Ajouter une description…" multiline onSave={(v) => useApp.getState().updatePlaylist(id, { description: v || null })} />}
        meta={
          <>
            <span>{plural(visible.length, "titre")}</span>
            <span>·</span>
            <span>{fmtLong(total)}</span>
            {pl.hotkey && <span className="rounded bg-bg-4 px-1.5 font-mono text-xs">touche {pl.hotkey}</span>}
            {pl.spotifyExportId && (
              <a href={`https://open.spotify.com/playlist/${pl.spotifyExportId}`} target="_blank" className="flex items-center gap-1 text-xs text-emerald-300 hover:underline">
                <ExternalLink className="h-3 w-3" /> exportée
              </a>
            )}
          </>
        }
      >
        <PlayButtons tracks={visible} label={pl.name} />
        <Button variant={setlist ? "primary" : "secondary"} onClick={toggleSetlist}>
          <BarChart3 className="h-4 w-4" /> Setlist
        </Button>
        {pl.rules && (
          <Button variant={editRules ? "primary" : "secondary"} onClick={() => setEditRules(!editRules)}>
            <Settings2 className="h-4 w-4" /> Règles
          </Button>
        )}
        <Button variant="secondary" onClick={exportToSpotify} disabled={exporting || !visible.length}>
          {exporting ? <Spinner /> : <Upload className="h-4 w-4" />} Exporter vers Spotify
        </Button>
        {sort && (
          <Button variant="ghost" onClick={() => setSort(undefined)}>
            Revenir à l'ordre de la playlist
          </Button>
        )}
        <Button
          variant="ghost"
          className="ml-auto"
          onClick={() => {
            router.push("/library");
            useApp.getState().deletePlaylist(id);
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </PageHeader>

      {colorMenu && (
        <Popover anchor={colorMenu} onClose={() => setColorMenu(null)} width={220} align="start">
          <div className="grid grid-cols-6 gap-2 p-2">
            {PLAYLIST_COLORS.map((c) => (
              <button key={c} onClick={() => useApp.getState().updatePlaylist(id, { color: c })} className={cx("h-7 w-7 rounded-full transition hover:scale-110", pl.color === c && "ring-2 ring-white ring-offset-2 ring-offset-bg-2")} style={{ background: c }} />
            ))}
          </div>
          <div className="border-t border-line p-2">
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-fg-3">Touche d'ajout express</div>
            <div className="flex flex-wrap gap-1">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => (
                <button key={k} onClick={() => useApp.getState().updatePlaylist(id, { hotkey: pl.hotkey === k ? null : k })} className={cx("h-6 w-6 rounded font-mono text-xs", pl.hotkey === k ? "bg-accent text-white" : "bg-bg-3 text-fg-2")}>
                  {k}
                </button>
              ))}
            </div>
          </div>
        </Popover>
      )}

      <div className="px-2 pb-10 md:px-6">
        {pl.rules && editRules && (
          <SmartRulesEditor
            value={pl.rules}
            onSave={(r) => {
              useApp.getState().updatePlaylist(id, { rules: r });
              setEditRules(false);
            }}
          />
        )}
        {setlist && visible.length > 0 && <SetlistPanel tracks={visible} canReorder={canReorder} onApply={(list) => {
          const prev = visible.map((t) => t.id);
          setTracks(list);
          useApp.getState().reorderPlaylist(id, list.map((t) => t.id), prev);
          useApp.getState().toast("Ordre optimisé (Ctrl+Z pour annuler)", { undo: true });
        }} />}
        {tracks === null ? (
          <div className="grid h-40 place-items-center"><Spinner /></div>
        ) : !visible.length ? (
          <Empty icon={<ListMusic />} title={pl.rules ? "Aucun morceau ne correspond aux règles" : "Playlist vide"}>
            {pl.rules ? "Ajuste les règles (BPM, tags, tonalité…)." : "Ajoute des morceaux avec le bouton + sur n'importe quel titre, ou glisse-les sur la playlist dans la barre latérale."}
          </Empty>
        ) : (
          <TrackList
            tracks={visible}
            label={pl.name}
            playlistId={pl.rules ? undefined : id}
            reorderable={canReorder}
            onReorder={canReorder ? reorder : undefined}
            showAlbum={!setlist}
            showNote={!pl.rules}
            showAdded={!setlist}
            showIndex
            sort={sort}
            onSort={setSort}
            onNote={(t, note) => {
              api(`/api/playlists/${id}/tracks`, { method: "PATCH", json: { note: { trackId: t.id, note } } }).catch(() => {});
              setTracks((ts) => ts?.map((x) => (x.id === t.id ? { ...x, note } : x)) ?? null);
            }}
          />
        )}
      </div>
    </div>
  );
}

