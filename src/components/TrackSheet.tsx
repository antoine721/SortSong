"use client";
import { Download, Loader2, Plus, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { TrackDTO } from "@/lib/types";
import { api } from "@/lib/client/api";
import { CAMELOT, CAMELOT_MUSICAL, TAG_CATEGORIES, fmtDuration } from "@/lib/client/format";
import { useApp, useTrackMeta } from "@/store/app";
import { Button, Cover, cx } from "./ui";
import { Stars } from "./Stars";

/** Fiche du morceau : playlists qui le contiennent, BPM, tonalité Camelot, énergie, tags (G2-G4). */
export function TrackSheet({ track }: { track: TrackDTO }) {
  const meta = useTrackMeta(track);
  const playlists = useApp((s) => s.playlists);
  const ids = useApp((s) => s.membership[track.id]);
  const tags = useApp((s) => s.tags);
  const update = useApp((s) => s.updateTrack);
  const [bpmInput, setBpmInput] = useState(meta.bpm ? String(meta.bpm) : "");
  const [fetching, setFetching] = useState(false);
  const [newTag, setNewTag] = useState<{ cat: string; name: string } | null>(null);
  const [tap, setTap] = useState<number[]>([]);
  const rating = useApp((s) => s.libTracks?.find((t) => t.id === track.id)?.rating ?? null);

  useEffect(() => setBpmInput(meta.bpm ? String(Math.round(meta.bpm * 10) / 10) : ""), [meta.bpm, track.id]);

  // Charge les méta locales si le DTO vient d'ailleurs (recherche, lecteur…)
  useEffect(() => {
    let cancel = false;
    api<{ track: TrackDTO | null }>(`/api/tracks/${track.id}`).then(({ track: t }) => {
      if (cancel || !t) return;
      const cur = useApp.getState().meta[track.id] || {};
      useApp.setState({
        meta: { ...useApp.getState().meta, [track.id]: { bpm: t.bpm, key: t.key, energy: t.energy, tagIds: t.tagIds, ...cur } },
      });
    }).catch(() => {});
    return () => {
      cancel = true;
    };
  }, [track.id]);

  const fetchBpm = async () => {
    setFetching(true);
    try {
      const { bpm } = await api<{ bpm: number | null }>(`/api/tracks/${track.id}/bpm`, { json: { track } });
      if (bpm) {
        useApp.setState({ meta: { ...useApp.getState().meta, [track.id]: { ...useApp.getState().meta[track.id], bpm } } });
        useApp.getState().toast(`BPM Deezer : ${bpm}`);
      } else useApp.getState().toast("BPM introuvable sur Deezer — saisis-le à la main", { tone: "info" });
    } catch (e) {
      useApp.getState().toast((e as Error).message, { tone: "err" });
    } finally {
      setFetching(false);
    }
  };

  const tapTempo = () => {
    const now = performance.now();
    const arr = [...tap.filter((t) => now - t < 3000), now].slice(-8);
    setTap(arr);
    if (arr.length >= 4) {
      const intervals = arr.slice(1).map((t, i) => t - arr[i]);
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      setBpmInput(String(Math.round(60000 / avg)));
    }
  };

  const saveBpm = () => {
    const v = bpmInput.trim() ? Number(bpmInput.replace(",", ".")) : null;
    if (v !== null && (isNaN(v) || v < 40 || v > 250)) return;
    if (v !== meta.bpm) update(track, { bpm: v });
  };

  const toggleTag = (id: string) => {
    const cur = meta.tagIds || [];
    update(track, { tagIds: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] });
  };

  const pls = (ids || []).map((id) => playlists.find((p) => p.id === id)).filter(Boolean) as typeof playlists;

  return (
    <div className="space-y-6 p-5">
      <div>
        <Cover src={track.cover} size={300} className="mx-auto !h-auto !w-full max-w-[300px] aspect-square shadow-soft" rounded="rounded-xl" />
        <h2 className="mt-4 text-lg font-bold leading-tight">{track.title}</h2>
        <div className="mt-0.5 text-sm text-fg-2">
          {track.artists.map((a, i) => (
            <span key={i}>
              {i > 0 && ", "}
              {a.id ? <Link href={`/artist/${a.id}?name=${encodeURIComponent(a.name)}`} className="hover:text-fg hover:underline">{a.name}</Link> : a.name}
            </span>
          ))}
        </div>
        {track.album && (
          <div className="mt-0.5 truncate text-xs text-fg-3">
            {track.albumId ? <Link href={`/album/${track.albumId}`} className="hover:underline">{track.album}</Link> : track.album} · {fmtDuration(track.durationMs)}
          </div>
        )}
        <Link href={`/mix/${track.id}`}>
          <Button variant="primary" size="sm" className="mt-3">
            <Sparkles className="h-4 w-4" /> Mix inspiré de
          </Button>
        </Link>
      </div>

      <Section title={`Playlists (${pls.length})`}>
        {pls.length ? (
          <div className="space-y-1">
            {pls.map((p) => (
              <div key={p.id} className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-bg-3">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
                <Link href={`/playlist/${p.id}`} className="flex-1 truncate text-sm hover:underline">{p.name}</Link>
                <button onClick={() => useApp.getState().removeFromPlaylists(track, [p.id])} title="Retirer" className="hidden text-fg-3 hover:text-red-300 group-hover:block">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-fg-3">Pas encore rangé.</p>
        )}
        <Button
          size="sm"
          className="mt-2"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            useApp.setState({ addMenu: { track, x: r.right, y: r.bottom } });
          }}
        >
          <Plus className="h-4 w-4" /> Ajouter à une playlist
        </Button>
      </Section>

      <Section title="BPM">
        <div className="flex items-center gap-2">
          <input
            value={bpmInput}
            onChange={(e) => setBpmInput(e.target.value)}
            onBlur={saveBpm}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            placeholder="—"
            inputMode="decimal"
            className="h-9 w-20 rounded-lg border border-line bg-bg-2 px-2.5 text-center text-lg font-semibold outline-none tnum focus:border-accent"
          />
          <Button size="sm" onClick={tapTempo} title="Tape en rythme (4 fois ou plus)">
            Tap {tap.length >= 2 ? `(${tap.length})` : ""}
          </Button>
          <Button size="sm" variant="ghost" onClick={fetchBpm} disabled={fetching} title="Récupérer depuis Deezer">
            {fetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Deezer
          </Button>
        </div>
        {tap.length >= 4 && <p className="mt-1 text-xs text-fg-3">Clique hors du champ ou Entrée pour enregistrer.</p>}
      </Section>

      <Section title={`Tonalité (Camelot)${meta.key ? ` · ${meta.key} = ${CAMELOT_MUSICAL[meta.key]}` : ""}`}>
        <div className="grid grid-cols-6 gap-1">
          {CAMELOT.map((k) => (
            <button
              key={k}
              onClick={() => update(track, { key: meta.key === k ? null : k })}
              title={CAMELOT_MUSICAL[k]}
              className={cx(
                "h-7 rounded text-[11px] font-semibold transition",
                meta.key === k ? "bg-accent text-white" : k.endsWith("A") ? "bg-bg-3 text-fg-2 hover:bg-bg-4" : "bg-bg-2 text-fg-2 hover:bg-bg-4",
              )}
            >
              {k}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Ma note">
        <Stars value={rating} onChange={(v) => useApp.getState().rate(track, v)} size={24} />
      </Section>

      <Section title="Énergie">
        <Stars value={meta.energy} onChange={(v) => update(track, { energy: v })} size={24} color="#f97316" />
      </Section>

      {TAG_CATEGORIES.map((cat) => {
        const list = tags.filter((t) => t.category === cat.id);
        return (
          <Section key={cat.id} title={cat.label}>
            <div className="flex flex-wrap gap-1.5">
              {list.map((t) => {
                const on = meta.tagIds?.includes(t.id);
                return (
                  <button
                    key={t.id}
                    onClick={() => toggleTag(t.id)}
                    className={cx("h-7 rounded-full border px-3 text-xs font-medium transition", on ? "border-transparent text-white" : "border-line text-fg-2 hover:border-fg-3")}
                    style={on ? { background: t.color } : undefined}
                  >
                    {t.name}
                  </button>
                );
              })}
              {newTag?.cat === cat.id ? (
                <input
                  autoFocus
                  value={newTag.name}
                  onChange={(e) => setNewTag({ cat: cat.id, name: e.target.value })}
                  onBlur={() => setNewTag(null)}
                  onKeyDown={async (e) => {
                    if (e.key === "Escape") setNewTag(null);
                    if (e.key === "Enter" && newTag.name.trim()) {
                      const colors = ["#8b5cf6", "#ec4899", "#06b6d4", "#f59e0b", "#22c55e", "#ef4444", "#3b82f6"];
                      const tag = await useApp.getState().createTag(newTag.name.trim(), cat.id, colors[tags.length % colors.length]);
                      setNewTag(null);
                      update(track, { tagIds: [...(meta.tagIds || []), tag.id] });
                    }
                  }}
                  placeholder="Nom + Entrée"
                  className="h-7 w-32 rounded-full border border-accent bg-bg-2 px-3 text-xs outline-none"
                />
              ) : (
                <button onClick={() => setNewTag({ cat: cat.id, name: "" })} className="grid h-7 w-7 place-items-center rounded-full border border-dashed border-line text-fg-3 hover:border-fg-3 hover:text-fg">
                  <Plus className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </Section>
        );
      })}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-fg-3">{title}</h3>
      {children}
    </section>
  );
}

