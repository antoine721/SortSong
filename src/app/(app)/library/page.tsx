"use client";
import { Filter, Library, Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ImportButton, PageHeader, PlayButtons } from "@/components/common";
import { TrackList, type Sort } from "@/components/TrackList";
import { Button, Chip, Empty, Spinner, cx } from "@/components/ui";
import { CAMELOT, TAG_CATEGORIES, camelotCompat, fmtLong, plural } from "@/lib/client/format";
import { searchLibrary } from "@/lib/client/librarySearch";
import { useApp, type LibTrack } from "@/store/app";

type F = {
  q: string;
  status: "all" | "inbox" | "sorted" | "dismissed";
  playlistId: string;
  folderId: string;
  artist: string;
  added: number; // jours, 0 = tout
  duration: "all" | "short" | "mid" | "long";
  bpmMin: string;
  bpmMax: string;
  key: string;
  compat: boolean;
  energyMin: number;
  tagIds: string[];
};
const INIT: F = { q: "", status: "all", playlistId: "", folderId: "", artist: "", added: 0, duration: "all", bpmMin: "", bpmMax: "", key: "", compat: false, energyMin: 0, tagIds: [] };

export default function LibraryPage() {
  const lib = useApp((s) => s.libTracks);
  const playlists = useApp((s) => s.playlists);
  const folders = useApp((s) => s.folders);
  const membership = useApp((s) => s.membership);
  const tags = useApp((s) => s.tags);
  const meta = useApp((s) => s.meta);
  const me = useApp((s) => s.me);
  const [f, setF] = useState<F>(INIT);
  const [sort, setSort] = useState<Sort>({ key: "addedAt", dir: "desc" });
  const [advanced, setAdvanced] = useState(false);
  const set = (p: Partial<F>) => setF((x) => ({ ...x, ...p }));

  useEffect(() => {
    useApp.getState().loadLibrary().catch(() => {});
  }, []);

  const folderPlaylists = useMemo(() => {
    if (!f.folderId) return null;
    const ids = new Set<string>([f.folderId]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const x of folders) if (x.parentId && ids.has(x.parentId) && !ids.has(x.id)) ids.add(x.id), (grew = true);
    }
    return new Set(playlists.filter((p) => p.folderId && ids.has(p.folderId)).map((p) => p.id));
  }, [f.folderId, folders, playlists]);

  const filtered = useMemo(() => {
    if (!lib) return [];
    const m = (t: LibTrack) => ({ ...t, ...(meta[t.id] || {}) });
    let list: LibTrack[] = lib.map(m);
    if (f.q.trim()) list = searchLibrary(list, f.q);
    if (f.status !== "all") list = list.filter((t) => t.status === f.status);
    if (f.playlistId === "__none") list = list.filter((t) => !membership[t.id]?.length);
    else if (f.playlistId) list = list.filter((t) => membership[t.id]?.includes(f.playlistId));
    if (folderPlaylists) list = list.filter((t) => membership[t.id]?.some((p) => folderPlaylists.has(p)));
    if (f.artist.trim()) {
      const a = f.artist.toLowerCase();
      list = list.filter((t) => t.artists.some((x) => x.name.toLowerCase().includes(a)));
    }
    if (f.added) {
      const since = Date.now() - f.added * 86400_000;
      list = list.filter((t) => t.addedAt && new Date(t.addedAt).getTime() >= since);
    }
    if (f.duration !== "all") {
      list = list.filter((t) => {
        const min = t.durationMs / 60000;
        return f.duration === "short" ? min < 3 : f.duration === "mid" ? min >= 3 && min <= 6 : min > 6;
      });
    }
    const bmin = Number(f.bpmMin) || 0;
    const bmax = Number(f.bpmMax) || 0;
    if (bmin || bmax) list = list.filter((t) => t.bpm && (!bmin || t.bpm >= bmin) && (!bmax || t.bpm <= bmax));
    if (f.key) list = list.filter((t) => (f.compat ? camelotCompat(f.key, t.key) !== "bad" && t.key : t.key === f.key));
    if (f.energyMin) list = list.filter((t) => (t.energy || 0) >= f.energyMin);
    if (f.tagIds.length) list = list.filter((t) => f.tagIds.every((id) => t.tagIds?.includes(id)));

    const dir = sort.dir === "asc" ? 1 : -1;
    const cmp: Record<string, (a: LibTrack, b: LibTrack) => number> = {
      title: (a, b) => a.title.localeCompare(b.title),
      artist: (a, b) => (a.artists[0]?.name || "").localeCompare(b.artists[0]?.name || ""),
      album: (a, b) => a.album.localeCompare(b.album),
      addedAt: (a, b) => (a.addedAt || "").localeCompare(b.addedAt || ""),
      bpm: (a, b) => (a.bpm || 0) - (b.bpm || 0),
      duration: (a, b) => a.durationMs - b.durationMs,
    };
    if (!f.q.trim() || sort.key !== "addedAt") list = [...list].sort((a, b) => (cmp[sort.key]?.(a, b) || 0) * dir);
    return list;
  }, [lib, f, sort, membership, folderPlaylists, meta]);

  const activeCount = Object.entries(f).filter(([k, v]) => k !== "q" && JSON.stringify(v) !== JSON.stringify((INIT as any)[k])).length;

  if (!lib) return <div className="grid h-64 place-items-center"><Spinner /></div>;
  if (!lib.length)
    return (
      <Empty icon={<Library />} title="Ta bibliothèque est vide">
        <p className="mb-5">Importe tes titres likés et tes playlists Spotify.</p>
        <ImportButton mode="full" />
      </Empty>
    );

  const total = filtered.reduce((a, t) => a + t.durationMs, 0);
  const sel = "h-8 rounded-full border border-line bg-bg-2 px-3 text-xs text-fg outline-none hover:border-fg-3 focus:border-accent";

  return (
    <div>
      <PageHeader
        color="#3b82f6"
        kicker="Bibliothèque"
        title="Tous tes morceaux"
        meta={
          <>
            <span>{plural(filtered.length, "titre")}</span>
            {filtered.length !== lib.length && <span className="text-fg-3">sur {lib.length.toLocaleString("fr-FR")}</span>}
            <span>·</span>
            <span>{fmtLong(total)}</span>
            {me?.lastSyncAt && <span className="text-fg-3">· synchro {new Date(me.lastSyncAt).toLocaleDateString("fr-FR")}</span>}
          </>
        }
      >
        <PlayButtons tracks={filtered} label="Bibliothèque" />
        <div className="relative ml-2 min-w-[220px] flex-1 md:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-3" />
          <input
            value={f.q}
            onChange={(e) => set({ q: e.target.value })}
            placeholder="Filtrer : titre, artiste, album…"
            className="h-10 w-full rounded-full border border-line bg-bg-2 pl-9 pr-9 text-sm outline-none focus:border-accent"
          />
          {f.q && (
            <button onClick={() => set({ q: "" })} className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-3 hover:text-fg">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="ml-auto">
          <ImportButton mode="sync" variant="secondary" />
        </div>
      </PageHeader>

      <div className="px-4 md:px-8">
        <div className="flex flex-wrap items-center gap-2 pb-3">
          <Filter className="h-4 w-4 text-fg-3" />
          {(["all", "inbox", "sorted", "dismissed"] as const).map((s) => (
            <Chip key={s} active={f.status === s} onClick={() => set({ status: s })}>
              {{ all: "Tous", inbox: "Non rangés", sorted: "Rangés", dismissed: "Écartés" }[s]}
            </Chip>
          ))}
          <select value={f.playlistId} onChange={(e) => set({ playlistId: e.target.value })} className={sel}>
            <option value="">Toutes les playlists</option>
            <option value="__none">Dans aucune playlist</option>
            {playlists.filter((p) => !p.rules).map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {folders.length > 0 && (
            <select value={f.folderId} onChange={(e) => set({ folderId: e.target.value })} className={sel}>
              <option value="">Tous les dossiers</option>
              {folders.map((x) => (
                <option key={x.id} value={x.id}>{x.name}</option>
              ))}
            </select>
          )}
          <input value={f.artist} onChange={(e) => set({ artist: e.target.value })} placeholder="Artiste" className={cx(sel, "w-32")} />
          <select value={f.added} onChange={(e) => set({ added: Number(e.target.value) })} className={sel}>
            <option value={0}>Ajouté : toujours</option>
            <option value={7}>7 derniers jours</option>
            <option value={30}>30 derniers jours</option>
            <option value={90}>3 derniers mois</option>
            <option value={365}>12 derniers mois</option>
          </select>
          <select value={f.duration} onChange={(e) => set({ duration: e.target.value as F["duration"] })} className={sel}>
            <option value="all">Toutes durées</option>
            <option value="short">&lt; 3 min</option>
            <option value="mid">3 – 6 min</option>
            <option value="long">&gt; 6 min (extended)</option>
          </select>
          <Button size="sm" variant={advanced ? "primary" : "secondary"} onClick={() => setAdvanced(!advanced)}>
            <SlidersHorizontal className="h-3.5 w-3.5" /> BPM, clé, tags
          </Button>
          {activeCount > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setF({ ...INIT, q: f.q })}>
              <X className="h-3.5 w-3.5" /> Réinitialiser ({activeCount})
            </Button>
          )}
        </div>

        {advanced && (
          <div className="mb-4 grid gap-4 rounded-2xl border border-line bg-bg-2/60 p-4 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-fg-3">BPM</div>
              <div className="flex items-center gap-2">
                <input value={f.bpmMin} onChange={(e) => set({ bpmMin: e.target.value })} placeholder="min" className={cx(sel, "w-20 text-center")} />
                <span className="text-fg-3">–</span>
                <input value={f.bpmMax} onChange={(e) => set({ bpmMax: e.target.value })} placeholder="max" className={cx(sel, "w-20 text-center")} />
              </div>
            </div>
            <div>
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-fg-3">Tonalité</div>
              <div className="flex items-center gap-2">
                <select value={f.key} onChange={(e) => set({ key: e.target.value })} className={sel}>
                  <option value="">Toutes</option>
                  {CAMELOT.map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
                <label className="flex items-center gap-1.5 text-xs text-fg-2">
                  <input type="checkbox" checked={f.compat} onChange={(e) => set({ compat: e.target.checked })} className="accent-[#7c5cff]" />
                  + compatibles
                </label>
              </div>
            </div>
            <div>
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-fg-3">Énergie min.</div>
              <div className="flex gap-1">
                {[0, 1, 2, 3, 4, 5].map((n) => (
                  <button key={n} onClick={() => set({ energyMin: n })} className={cx("h-8 w-8 rounded-lg text-xs font-bold", f.energyMin === n ? "bg-accent text-white" : "bg-bg-3 text-fg-2")}>
                    {n || "–"}
                  </button>
                ))}
              </div>
            </div>
            <div className="md:col-span-2 xl:col-span-1">
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-fg-3">Tags</div>
              {tags.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((t) => (
                    <Chip key={t.id} color={t.color} active={f.tagIds.includes(t.id)} onClick={() => set({ tagIds: f.tagIds.includes(t.id) ? f.tagIds.filter((x) => x !== t.id) : [...f.tagIds, t.id] })}>
                      {t.name}
                      <span className="opacity-60">· {TAG_CATEGORIES.find((c) => c.id === t.category)?.label}</span>
                    </Chip>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-fg-3">Crée des tags depuis la fiche d'un morceau.</p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="px-2 pb-10 md:px-6">
        <TrackList tracks={filtered} label="Bibliothèque" sort={sort} onSort={setSort} showAlbum showAdded deletable emptyText="Aucun morceau ne correspond à ces filtres." />
      </div>
    </div>
  );
}
