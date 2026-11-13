"use client";
import { ArrowRight, Disc, Library, Mic2, Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AlbumDTO, ArtistDTO, TrackDTO } from "@/lib/types";
import { api } from "@/lib/client/api";
import { searchLibrary } from "@/lib/client/librarySearch";
import { fmtDuration } from "@/lib/client/format";
import { useApp } from "@/store/app";
import { usePlayer } from "@/store/player";
import { Badges } from "./Badges";
import { Cover, Kbd, Spinner, cx } from "./ui";

/** E1 : recherche globale (Ctrl+K) — bibliothèque instantanée + catalogue Spotify. */
export function SearchOverlay() {
  const open = useApp((s) => s.searchOpen);
  if (!open) return null;
  return <Overlay />;
}

function Overlay() {
  const router = useRouter();
  const lib = useApp((s) => s.libTracks);
  const [q, setQ] = useState("");
  const [remote, setRemote] = useState<{ tracks: TrackDTO[]; artists: ArtistDTO[]; albums: AlbumDTO[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState(0);
  const reqId = useRef(0);
  const close = () => useApp.setState({ searchOpen: false });

  useEffect(() => {
    useApp.getState().loadLibrary().catch(() => {});
  }, []);

  const local = useMemo(() => (q.trim() && lib ? searchLibrary(lib, q, 6) : []), [q, lib]);

  useEffect(() => {
    if (q.trim().length < 2) {
      setRemote(null);
      return;
    }
    const id = ++reqId.current;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await api(`/api/search?q=${encodeURIComponent(q)}`);
        if (id === reqId.current) setRemote(r);
      } catch {
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  type Item = { key: string; run: () => void; node: React.ReactNode };
  const sections: { title: string; icon: React.ReactNode; items: Item[] }[] = [];
  const trackItem = (t: TrackDTO, list: TrackDTO[], i: number, label: string): Item => ({
    key: "t" + label + t.id,
    run: () => {
      usePlayer.getState().playList(list, i, label);
    },
    node: (
      <>
        <Cover src={t.coverSmall || t.cover} size={40} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{t.title}</div>
          <div className="truncate text-xs text-fg-2">{t.artists.map((a) => a.name).join(", ")}</div>
        </div>
        <Badges trackId={t.id} compact />
        <span className="w-10 text-right text-xs text-fg-3 tnum">{fmtDuration(t.durationMs)}</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            const r = e.currentTarget.getBoundingClientRect();
            useApp.setState({ addMenu: { track: t, x: r.right, y: r.bottom } });
          }}
          className="grid h-7 w-7 place-items-center rounded-full text-fg-2 hover:bg-accent hover:text-white"
        >
          <Plus className="h-4 w-4" />
        </button>
      </>
    ),
  });
  if (local.length) sections.push({ title: "Ta bibliothèque", icon: <Library className="h-3.5 w-3.5" />, items: local.map((t, i) => trackItem(t, local, i, "Bibliothèque")) });
  if (remote?.tracks.length)
    sections.push({ title: "Titres · Spotify", icon: <Search className="h-3.5 w-3.5" />, items: remote.tracks.slice(0, 6).map((t, i) => trackItem(t, remote.tracks, i, `Recherche « ${q} »`)) });
  if (remote?.artists.length)
    sections.push({
      title: "Artistes",
      icon: <Mic2 className="h-3.5 w-3.5" />,
      items: remote.artists.slice(0, 4).map((a) => ({
        key: "a" + a.id,
        run: () => {
          close();
          router.push(`/artist/${a.id}?name=${encodeURIComponent(a.name)}`);
        },
        node: (
          <>
            <Cover src={a.image} size={40} rounded="rounded-full" />
            <div className="flex-1 truncate text-sm font-medium">{a.name}</div>
            <span className="text-xs text-fg-3">Artiste</span>
          </>
        ),
      })),
    });
  if (remote?.albums.length)
    sections.push({
      title: "Albums",
      icon: <Disc className="h-3.5 w-3.5" />,
      items: remote.albums.slice(0, 4).map((a) => ({
        key: "al" + a.id,
        run: () => {
          close();
          router.push(`/album/${a.id}`);
        },
        node: (
          <>
            <Cover src={a.coverSmall || a.cover} size={40} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{a.name}</div>
              <div className="truncate text-xs text-fg-2">{a.artists.map((x) => x.name).join(", ")}</div>
            </div>
            <span className="text-xs text-fg-3">{a.releaseDate?.slice(0, 4)}</span>
          </>
        ),
      })),
    });
  const all: Item[] = sections.flatMap((s) => s.items);
  const seeAll: Item | null = q.trim()
    ? {
        key: "all",
        run: () => {
          close();
          router.push(`/search?q=${encodeURIComponent(q)}`);
        },
        node: (
          <>
            <ArrowRight className="h-4 w-4 text-accent-2" />
            <span className="flex-1 text-sm text-accent-2">Tous les résultats pour « {q} »</span>
            <Kbd>Entrée</Kbd>
          </>
        ),
      }
    : null;
  if (seeAll) all.push(seeAll);

  let k = 0;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-[10vh] backdrop-blur-sm" onMouseDown={close}>
      <div className="fadein w-full max-w-2xl overflow-hidden rounded-2xl border border-line bg-bg-1 shadow-soft" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="h-5 w-5 text-fg-3" />
          <input
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setCursor(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") close();
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setCursor((c) => Math.min(c + 1, all.length - 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setCursor((c) => Math.max(c - 1, 0));
              }
              if (e.key === "Enter") {
                e.preventDefault();
                if (e.metaKey || e.ctrlKey || cursor === 0 && !all.length) seeAll?.run();
                else (all[cursor] || seeAll)?.run();
              }
            }}
            placeholder="Titre, artiste, album…"
            className="h-14 flex-1 bg-transparent text-[16px] outline-none placeholder:text-fg-3"
          />
          {loading && <Spinner />}
          <Kbd>Échap</Kbd>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {!q.trim() && <div className="px-3 py-8 text-center text-sm text-fg-3">Tape pour chercher dans ta bibliothèque et sur Spotify. Entrée = lire · Ctrl+Entrée = tous les résultats</div>}
          {sections.map((s) => (
            <div key={s.title} className="mb-1">
              <div className="flex items-center gap-1.5 px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-fg-3">
                {s.icon} {s.title}
              </div>
              {s.items.map((it) => {
                const idx = k++;
                return (
                  <div
                    key={it.key}
                    onMouseEnter={() => setCursor(idx)}
                    onClick={it.run}
                    className={cx("flex cursor-pointer items-center gap-3 rounded-lg px-3 py-1.5", cursor === idx && "bg-bg-3")}
                  >
                    {it.node}
                  </div>
                );
              })}
            </div>
          ))}
          {seeAll && (
            <div onMouseEnter={() => setCursor(all.length - 1)} onClick={seeAll.run} className={cx("flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5", cursor === all.length - 1 && "bg-bg-3")}>
              {seeAll.node}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
