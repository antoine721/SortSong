"use client";
import { Link2, Play, RefreshCw, Shuffle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { AlbumDTO, ArtistDTO, TrackDTO } from "@/lib/types";
import { setHideSorted, useApp } from "@/store/app";
import { usePlayer } from "@/store/player";
import { Button, Cover, Toggle, cx } from "./ui";

export function PageHeader({
  color = "#7c5cff",
  cover,
  coverSize = 200,
  roundedCover,
  kicker,
  title,
  meta,
  children,
  description,
}: {
  color?: string;
  cover?: React.ReactNode | string | null;
  coverSize?: number;
  roundedCover?: boolean;
  kicker?: React.ReactNode;
  title: React.ReactNode;
  meta?: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="relative overflow-hidden px-4 pb-6 pt-8 md:px-8 md:pt-12" style={{ background: `linear-gradient(180deg, ${color}55 0%, ${color}14 60%, transparent 100%)` }}>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
        {cover !== undefined &&
          (typeof cover === "string" || cover === null ? (
            <Cover src={cover} size={coverSize} rounded={roundedCover ? "rounded-full" : "rounded-xl"} className="shadow-[0_20px_60px_rgba(0,0,0,0.5)]" />
          ) : (
            cover
          ))}
        <div className="min-w-0 flex-1">
          {kicker && <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-fg-2">{kicker}</div>}
          <h1 className="break-words text-3xl font-extrabold tracking-tight md:text-5xl">{title}</h1>
          {description && <div className="mt-2 max-w-2xl text-sm text-fg-2">{description}</div>}
          {meta && <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-fg-2">{meta}</div>}
        </div>
      </div>
      {children && <div className="mt-6 flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  );
}

export function PlayButtons({ tracks, label }: { tracks: TrackDTO[]; label: string }) {
  return (
    <>
      <button
        disabled={!tracks.length}
        onClick={() => usePlayer.getState().playList(tracks, 0, label)}
        className="grid h-14 w-14 place-items-center rounded-full bg-accent text-white shadow-[0_8px_30px_-6px_rgba(124,92,255,0.8)] transition hover:scale-105 hover:bg-accent-2 disabled:opacity-40"
        title="Lire"
      >
        <Play className="ml-1 h-6 w-6 fill-current" />
      </button>
      <Button
        variant="ghost"
        disabled={!tracks.length}
        onClick={() => {
          const sh = [...tracks].sort(() => Math.random() - 0.5);
          usePlayer.getState().playList(sh, 0, `${label} (aléatoire)`);
        }}
        title="Lecture aléatoire"
      >
        <Shuffle className="h-4 w-4" />
      </Button>
    </>
  );
}

/** D3 : masquer les morceaux déjà rangés. */
export function HideSortedToggle() {
  const v = useApp((s) => s.hideSorted);
  return <Toggle checked={v} onChange={setHideSorted} label="Masquer les déjà rangés" />;
}

export function useVisible(tracks: TrackDTO[]) {
  const hide = useApp((s) => s.hideSorted);
  const membership = useApp((s) => s.membership);
  if (!hide) return tracks;
  return tracks.filter((t) => !membership[t.id]?.length);
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-3 mt-8 flex items-center gap-3">
      <h2 className="text-xl font-bold tracking-tight">{children}</h2>
      <div className="ml-auto">{right}</div>
    </div>
  );
}

export function AlbumGrid({ albums }: { albums: AlbumDTO[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
      {albums.map((a) => (
        <Link key={a.id} href={`/album/${a.id}`} className="group rounded-xl bg-bg-2/50 p-3 transition hover:bg-bg-3">
          <Cover src={a.cover} size={300} className="!h-auto !w-full aspect-square shadow-soft" rounded="rounded-lg" />
          <div className="mt-2.5 truncate text-sm font-semibold">{a.name}</div>
          <div className="truncate text-xs text-fg-2">
            {a.releaseDate?.slice(0, 4)} · {a.albumType === "single" ? "Single" : a.albumType === "compilation" ? "Compilation" : "Album"}
          </div>
        </Link>
      ))}
    </div>
  );
}

export function ArtistGrid({ artists }: { artists: ArtistDTO[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {artists.map((a) => (
        <Link key={a.id} href={`/artist/${a.id}?name=${encodeURIComponent(a.name)}`} className="group rounded-xl p-3 text-center transition hover:bg-bg-3">
          <Cover src={a.image} size={300} className="!h-auto !w-full aspect-square shadow-soft" rounded="rounded-full" />
          <div className="mt-2.5 truncate text-sm font-semibold">{a.name}</div>
          <div className="truncate text-xs text-fg-3">{a.genres?.slice(0, 2).join(", ") || "Artiste"}</div>
        </Link>
      ))}
    </div>
  );
}

export function ImportLinkButton({ variant = "primary" }: { variant?: "primary" | "secondary" }) {
  return (
    <Button variant={variant} onClick={() => useApp.setState({ linkDialog: { folderId: null } })}>
      <Link2 className="h-4 w-4" /> Importer un lien Spotify
    </Button>
  );
}

type Progress = { step: string; done?: number; total?: number; detail?: string };

/** A2/A4 : import ou resynchronisation avec progression. */
export function ImportButton({ mode, variant = "primary", label }: { mode: "full" | "sync"; variant?: "primary" | "secondary"; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const run = async () => {
    setBusy(true);
    setProgress({ step: "Connexion à Spotify…" });
    try {
      const res = await fetch("/api/library/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode }) });
      if (!res.body) throw new Error("Pas de réponse");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const l of lines) {
          if (!l.trim()) continue;
          const msg = JSON.parse(l);
          if (msg.type === "progress") setProgress(msg);
          if (msg.type === "error") throw new Error(msg.error);
          if (msg.type === "done") useApp.getState().toast(`${msg.added} nouveau${msg.added > 1 ? "x" : ""} morceau${msg.added > 1 ? "x" : ""} importé${msg.added > 1 ? "s" : ""} (${msg.scanned} parcourus)`);
        }
      }
      await useApp.getState().bootstrap();
      await useApp.getState().loadLibrary(true);
    } catch (e) {
      useApp.getState().toast(`Import interrompu : ${(e as Error).message}`, { tone: "err" });
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };
  return (
    <div className="inline-flex flex-col gap-1.5">
      <Button variant={variant} onClick={run} disabled={busy}>
        <RefreshCw className={cx("h-4 w-4", busy && "animate-spin")} />
        {label || (mode === "full" ? "Importer ma bibliothèque Spotify" : "Resynchroniser")}
      </Button>
      {progress && (
        <div className="w-72 text-xs text-fg-2">
          <div className="truncate">
            {progress.step}
            {progress.total ? ` · ${progress.done}/${progress.total}` : ""}
          </div>
          {progress.total ? (
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-bg-4">
              <div className="h-full bg-accent transition-all" style={{ width: `${Math.min(100, ((progress.done || 0) / progress.total) * 100)}%` }} />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
