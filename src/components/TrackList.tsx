"use client";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp, Clock, GripVertical, MoreHorizontal, Pause, Play, Plus } from "lucide-react";
import Link from "next/link";
import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { TrackDTO } from "@/lib/types";
import { fmtDate, fmtDuration } from "@/lib/client/format";
import { useApp, useTrackMeta } from "@/store/app";
import { usePlayer } from "@/store/player";
import { Badges } from "./Badges";
import { TrackMenu } from "./TrackMenu";
import { Cover, cx } from "./ui";

export type SortKey = "title" | "artist" | "addedAt" | "bpm" | "duration" | "album" | "position";
export type Sort = { key: SortKey; dir: "asc" | "desc" };

type Opts = {
  showAlbum?: boolean;
  showAdded?: boolean;
  showNote?: boolean;
  showIndex?: boolean;
  showCover?: boolean;
  playlistId?: string; // contexte (retrait, notes, réordonnancement)
  reorderable?: boolean;
};

export function TrackList({
  tracks,
  label,
  sort,
  onSort,
  onReorder,
  onNote,
  emptyText,
  ...opts
}: Opts & {
  tracks: TrackDTO[];
  label?: string;
  sort?: Sort;
  onSort?: (s: Sort) => void;
  onReorder?: (from: number, to: number) => void;
  onNote?: (t: TrackDTO, note: string) => void;
  emptyText?: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [scrollEl, setScrollEl] = useState<HTMLElement | null>(null);
  const [margin, setMargin] = useState(0);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const dragFrom = useRef<number | null>(null);

  useLayoutEffect(() => {
    const el = document.getElementById("main-scroll");
    setScrollEl(el);
    const measure = () => {
      if (!el || !listRef.current) return;
      const m = listRef.current.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop;
      setMargin((prev) => (Math.abs(prev - m) > 1 ? m : prev));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (el?.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, []);

  const virt = useVirtualizer({
    count: tracks.length,
    getScrollElement: () => scrollEl,
    estimateSize: () => 60,
    overscan: 12,
    scrollMargin: margin,
  });

  const play = (i: number) => usePlayer.getState().playList(tracks, i, label);
  const opt = { showCover: true, ...opts };

  if (!tracks.length && emptyText) return <div className="px-2 py-10 text-center text-sm text-fg-3">{emptyText}</div>;

  return (
    <div>
      <Header sort={sort} onSort={onSort} {...opt} />
      <div ref={listRef} style={{ height: virt.getTotalSize(), position: "relative" }}>
        {virt.getVirtualItems().map((v) => {
          const t = tracks[v.index];
          return (
            <div
              key={t.id + ":" + v.index}
              style={{ position: "absolute", top: 0, left: 0, right: 0, height: v.size, transform: `translateY(${v.start - virt.options.scrollMargin}px)` }}
              onDragOver={
                onReorder
                  ? (e) => {
                      if (dragFrom.current === null) return;
                      e.preventDefault();
                      setDragOver(v.index);
                    }
                  : undefined
              }
              onDrop={
                onReorder
                  ? (e) => {
                      e.preventDefault();
                      if (dragFrom.current !== null && dragFrom.current !== v.index) onReorder(dragFrom.current, v.index);
                      dragFrom.current = null;
                      setDragOver(null);
                    }
                  : undefined
              }
              className={cx(dragOver === v.index && "border-t-2 border-accent")}
            >
              <TrackRow
                track={t}
                index={v.index}
                onPlay={play}
                onDragStartReorder={onReorder ? () => (dragFrom.current = v.index) : undefined}
                onDragEnd={() => {
                  dragFrom.current = null;
                  setDragOver(null);
                }}
                onNote={onNote}
                {...opt}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Header({ sort, onSort, showAlbum, showAdded, showNote, showIndex, reorderable }: Opts & { sort?: Sort; onSort?: (s: Sort) => void }) {
  const H = ({ k, children, className }: { k?: SortKey; children: React.ReactNode; className?: string }) => {
    const active = k && sort?.key === k;
    return (
      <button
        disabled={!k || !onSort}
        onClick={() => k && onSort?.({ key: k, dir: active && sort?.dir === "asc" ? "desc" : "asc" })}
        className={cx("flex items-center gap-1 truncate text-left uppercase", active ? "text-fg" : "hover:text-fg disabled:hover:text-fg-3", className)}
      >
        {children}
        {active && (sort!.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
      </button>
    );
  };
  return (
    <div className="sticky top-0 z-10 mb-1 flex h-9 items-center gap-3 border-b border-line bg-bg-1/95 px-3 text-[11px] font-semibold uppercase tracking-wider text-fg-3 backdrop-blur">
      {(showIndex || reorderable) && <span className="w-7 text-center">#</span>}
      <span className="w-12" />
      <H k="title" className="min-w-0 flex-[3]">Titre</H>
      {showAlbum && <H k="album" className="hidden min-w-0 flex-[2] lg:flex">Album</H>}
      {showNote && <span className="hidden min-w-0 flex-[2] xl:block">Note</span>}
      <span className="hidden w-36 sm:block">Playlists</span>
      <H k="bpm" className="hidden w-12 justify-end md:flex">BPM</H>
      <span className="hidden w-9 text-center md:block">Clé</span>
      {showAdded && <H k="addedAt" className="hidden w-24 xl:flex">Ajouté</H>}
      <H k="duration" className="w-11 justify-end">
        <Clock className="h-3.5 w-3.5" />
      </H>
      <span className="w-[72px]" />
    </div>
  );
}

const TrackRow = memo(function TrackRow({
  track,
  index,
  onPlay,
  onDragStartReorder,
  onDragEnd,
  onNote,
  showAlbum,
  showAdded,
  showNote,
  showIndex,
  showCover,
  playlistId,
  reorderable,
}: Opts & {
  track: TrackDTO;
  index: number;
  onPlay: (i: number) => void;
  onDragStartReorder?: () => void;
  onDragEnd?: () => void;
  onNote?: (t: TrackDTO, note: string) => void;
}) {
  const isCurrent = usePlayer((s) => s.current?.id === track.id);
  const paused = usePlayer((s) => s.paused);
  const meta = useTrackMeta(track);
  const [menu, setMenu] = useState<DOMRect | { x: number; y: number } | null>(null);
  const [note, setNote] = useState(track.note || "");
  useEffect(() => setNote(track.note || ""), [track.note]);

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("application/x-sortsong-track", JSON.stringify(track));
        e.dataTransfer.effectAllowed = "copyMove";
        onDragStartReorder?.();
      }}
      onDragEnd={onDragEnd}
      onDoubleClick={() => onPlay(index)}
      onContextMenu={(e) => {
        e.preventDefault();
        setMenu({ x: e.clientX + 250, y: e.clientY });
      }}
      className={cx(
        "group flex h-[60px] items-center gap-3 rounded-lg px-3 transition-colors hover:bg-white/[0.04]",
        isCurrent && "bg-accent-soft hover:bg-accent-soft",
      )}
    >
      {(showIndex || reorderable) && (
        <span className="relative flex w-7 items-center justify-center text-xs text-fg-3 tnum">
          {reorderable ? (
            <>
              <span className="group-hover:hidden">{index + 1}</span>
              <GripVertical className="hidden h-4 w-4 cursor-grab group-hover:block" />
            </>
          ) : (
            index + 1
          )}
        </span>
      )}
      {showCover && (
        <button onClick={() => (isCurrent ? usePlayer.getState().toggle() : onPlay(index))} className="relative shrink-0" title="Lire">
          <Cover src={track.coverSmall || track.cover} size={48} />
          <span className={cx("absolute inset-0 grid place-items-center rounded-md bg-black/50 transition", isCurrent ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
            {isCurrent && !paused ? (
              <>
                <span className="eq group-hover:hidden">
                  <span />
                  <span />
                  <span />
                </span>
                <Pause className="hidden h-5 w-5 fill-white group-hover:block" />
              </>
            ) : (
              <Play className="h-5 w-5 fill-white" />
            )}
          </span>
        </button>
      )}
      <div className="min-w-0 flex-[3]">
        <div className={cx("truncate font-medium", isCurrent ? "text-accent-2" : "text-fg")}>
          {track.title}
          {track.explicit && <span className="ml-1.5 rounded-sm bg-fg-3/30 px-1 text-[9px] font-bold text-fg-2 align-middle">E</span>}
        </div>
        <div className="truncate text-[13px] text-fg-2">
          {track.artists.map((a, i) => (
            <span key={i}>
              {i > 0 && ", "}
              {a.id ? (
                <Link href={`/artist/${a.id}?name=${encodeURIComponent(a.name)}`} className="hover:text-fg hover:underline">
                  {a.name}
                </Link>
              ) : (
                a.name
              )}
            </span>
          ))}
        </div>
      </div>
      {showAlbum && (
        <div className="hidden min-w-0 flex-[2] truncate text-[13px] text-fg-2 lg:block">
          {track.albumId ? (
            <Link href={`/album/${track.albumId}`} className="hover:text-fg hover:underline">
              {track.album}
            </Link>
          ) : (
            track.album
          )}
        </div>
      )}
      {showNote && (
        <div className="hidden min-w-0 flex-[2] xl:block">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => note !== (track.note || "") && onNote?.(track, note)}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            placeholder="Ajouter une note…"
            className="w-full truncate rounded bg-transparent px-1.5 py-1 text-[13px] text-fg-2 outline-none placeholder:text-transparent focus:bg-bg-3 focus:text-fg group-hover:placeholder:text-fg-3"
          />
        </div>
      )}
      <div className="hidden w-36 sm:block">
        <Badges trackId={track.id} />
      </div>
      <div className="hidden w-12 text-right text-[13px] text-fg-2 tnum md:block">{meta.bpm ? Math.round(meta.bpm) : ""}</div>
      <div className="hidden w-9 text-center md:block">
        {meta.key && <span className="rounded bg-bg-3 px-1.5 py-0.5 text-[11px] font-semibold text-fg-2">{meta.key}</span>}
      </div>
      {showAdded && <div className="hidden w-24 truncate text-xs text-fg-3 xl:block">{fmtDate(track.addedAt)}</div>}
      <div className="w-11 text-right text-[13px] text-fg-2 tnum">{fmtDuration(track.durationMs)}</div>
      <div className="flex w-[72px] items-center justify-end gap-0.5">
        <button
          title="Ajouter à une playlist"
          onClick={(e) => {
            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
            useApp.setState({ addMenu: { track, x: r.right, y: r.bottom } });
          }}
          className="grid h-8 w-8 place-items-center rounded-full text-fg-2 transition hover:bg-accent hover:text-white"
        >
          <Plus className="h-[18px] w-[18px]" />
        </button>
        <button
          title="Plus d'options"
          onClick={(e) => setMenu((e.currentTarget as HTMLElement).getBoundingClientRect())}
          className="grid h-8 w-8 place-items-center rounded-full text-fg-3 opacity-60 transition hover:bg-bg-3 hover:text-fg group-hover:opacity-100"
        >
          <MoreHorizontal className="h-[18px] w-[18px]" />
        </button>
      </div>
      {menu && <TrackMenu track={track} anchor={menu} onClose={() => setMenu(null)} playlistId={playlistId} />}
    </div>
  );
});
