"use client";
import { Ban, Trash2, Inbox as InboxIcon, LayoutList, Play, Plus, SkipForward, Square, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ImportLinkButton, PageHeader, PlayButtons } from "@/components/common";
import { TrackList } from "@/components/TrackList";
import { Badges } from "@/components/Badges";
import { Button, Cover, Empty, Kbd, Spinner, Toggle, cx } from "@/components/ui";
import { fmtDuration, plural } from "@/lib/client/format";
import { useApp, useTrackMeta } from "@/store/app";
import { usePlayer } from "@/store/player";
import type { TrackDTO } from "@/lib/types";

/** Boîte « À trier » (A5) : morceaux qui ne sont dans aucune playlist interne. */
export default function InboxPage() {
  const lib = useApp((s) => s.libTracks);
  const libLoading = useApp((s) => s.libLoading);
  const inboxCount = useApp((s) => s.inboxCount);
  const [mode, setMode] = useState<"list" | "focus">("list");

  useEffect(() => {
    useApp.getState().loadLibrary().catch(() => {});
    try {
      const m = localStorage.getItem("ss_inboxMode");
      if (m === "focus") setMode("focus");
    } catch {}
  }, []);
  const setM = (m: "list" | "focus") => {
    setMode(m);
    try {
      localStorage.setItem("ss_inboxMode", m);
    } catch {}
  };

  const inbox = useMemo(() => (lib || []).filter((t) => t.status === "inbox"), [lib]);

  if (!lib) return <div className="grid h-64 place-items-center">{libLoading ? <Spinner /> : null}</div>;

  if (!lib.length) {
    return (
      <Empty icon={<InboxIcon />} title="Bienvenue ! Importe tes premiers morceaux">
        <p className="mb-5">Colle le lien d'une playlist, d'un album ou d'un titre Spotify. Rien n'est modifié côté Spotify.</p>
        <ImportLinkButton />
      </Empty>
    );
  }

  return (
    <div>
      <PageHeader
        color="#7c5cff"
        cover={
          <div className="grid h-[160px] w-[160px] place-items-center rounded-xl bg-gradient-to-br from-accent to-fuchsia-500 shadow-[0_20px_60px_rgba(124,92,255,0.4)]">
            <InboxIcon className="h-16 w-16 text-white" />
          </div>
        }
        kicker="Boîte de tri"
        title="À trier"
        meta={<span>{plural(inboxCount, "morceau non rangé", "morceaux non rangés")}</span>}
        description="Écoute, puis range avec les touches 1 à 9 (playlists favorites) ou le bouton +. Un morceau rangé disparaît d'ici automatiquement."
      >
        <PlayButtons tracks={inbox} label="À trier" />
        <div className="ml-2 flex rounded-full bg-bg-3 p-1">
          <button onClick={() => setM("list")} className={cx("flex h-8 items-center gap-1.5 rounded-full px-3 text-sm", mode === "list" ? "bg-bg-4 text-fg" : "text-fg-2")}>
            <LayoutList className="h-4 w-4" /> Liste
          </button>
          <button onClick={() => setM("focus")} className={cx("flex h-8 items-center gap-1.5 rounded-full px-3 text-sm", mode === "focus" ? "bg-bg-4 text-fg" : "text-fg-2")}>
            <Square className="h-4 w-4" /> Un par un
          </button>
        </div>
        <div className="ml-auto">
          <ImportLinkButton variant="secondary" />
        </div>
      </PageHeader>
      <div className="px-2 pb-10 md:px-6">
        {!inbox.length ? (
          <Empty icon={<Sparkles />} title="Tout est rangé 🎉">
            Importe un nouveau lien, ou découvre des titres avec un <b>Mix inspiré de</b>.
          </Empty>
        ) : mode === "list" ? (
          <TrackList tracks={inbox} label="À trier" showAlbum showAdded deletable />
        ) : (
          <Focus inbox={inbox} />
        )}
      </div>
    </div>
  );
}

function Focus({ inbox }: { inbox: TrackDTO[] }) {
  const current = usePlayer((s) => s.current);
  const paused = usePlayer((s) => s.paused);
  const playlists = useApp((s) => s.playlists);
  const membership = useApp((s) => s.membership);
  const [autoplay, setAutoplay] = useState(true);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [skip, setSkip] = useState(0);
  const lastPlayed = useRef<string | null>(null);

  const inInbox = current && inbox.some((t) => t.id === current.id);
  const focus: TrackDTO | undefined = inInbox ? inbox.find((t) => t.id === current!.id) : inbox[Math.min(skip, inbox.length - 1)];
  const focusIndex = focus ? inbox.findIndex((t) => t.id === focus.id) : -1;
  const meta = useTrackMeta(focus || ({ id: "" } as TrackDTO));

  // Lecture auto du morceau à trier
  useEffect(() => {
    if (!autoplay || !focus || inInbox || lastPlayed.current === focus.id) return;
    lastPlayed.current = focus.id;
    usePlayer.getState().playList(inbox, focusIndex, "À trier");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.id, autoplay]);

  // Rangé → passe au suivant
  const curSorted = current ? (membership[current.id]?.length || 0) > 0 : false;
  const wasIn = useRef(false);
  useEffect(() => {
    if (current && inbox.some((t) => t.id === current.id)) wasIn.current = true;
  }, [current, inbox]);
  useEffect(() => {
    if (!autoAdvance || !curSorted || !wasIn.current) return;
    wasIn.current = false;
    const t = setTimeout(() => {
      const next = inbox[0];
      if (next) usePlayer.getState().playList(inbox, 0, "À trier");
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curSorted]);

  if (!focus) return null;
  const hot = playlists.filter((p) => p.hotkey).sort((a, b) => a.hotkey! - b.hotkey!);
  const isPlaying = current?.id === focus.id && !paused;

  const dismiss = () => {
    useApp.getState().setStatus([focus], "dismissed");
    const next = inbox[focusIndex + 1] ? focusIndex : 0;
    const rest = inbox.filter((t) => t.id !== focus.id);
    if (rest[next]) usePlayer.getState().playList(rest, next, "À trier");
  };
  const next = () => {
    const n = (focusIndex + 1) % inbox.length;
    setSkip(n);
    usePlayer.getState().playList(inbox, n, "À trier");
  };

  return (
    <div className="mx-auto mt-4 max-w-3xl">
      <div className="flex flex-col items-center gap-8 rounded-3xl border border-line bg-bg-2/60 p-6 md:flex-row md:p-8">
        <button onClick={() => (current?.id === focus.id ? usePlayer.getState().toggle() : usePlayer.getState().playList(inbox, focusIndex, "À trier"))} className="group relative">
          <Cover src={focus.cover} size={260} rounded="rounded-2xl" className="shadow-[0_20px_60px_rgba(0,0,0,0.6)]" />
          <span className="absolute inset-0 grid place-items-center rounded-2xl bg-black/40 opacity-0 transition group-hover:opacity-100">
            <Play className="h-14 w-14 fill-white text-white" />
          </span>
          {isPlaying && (
            <span className="eq absolute bottom-3 left-3">
              <span />
              <span />
              <span />
            </span>
          )}
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-xs text-fg-3">
            {focusIndex + 1} / {inbox.length}
          </div>
          <h2 className="mt-1 text-2xl font-bold leading-tight">{focus.title}</h2>
          <div className="mt-1 text-fg-2">{focus.artists.map((a) => a.name).join(", ")}</div>
          <div className="mt-1 text-sm text-fg-3">
            {focus.album} · {fmtDuration(focus.durationMs)}
            {meta.bpm ? ` · ${Math.round(meta.bpm)} BPM` : ""}
            {meta.key ? ` · ${meta.key}` : ""}
          </div>
          <div className="mt-3">
            <Badges trackId={focus.id} />
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2">
            {hot.map((p) => {
              const on = membership[focus.id]?.includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => useApp.getState().togglePlaylist(focus, p.id)}
                  className={cx("flex h-10 items-center gap-2 rounded-xl border px-3 text-left text-sm transition", on ? "border-transparent text-white" : "border-line hover:border-fg-3")}
                  style={on ? { background: p.color } : undefined}
                >
                  <span className="rounded bg-black/30 px-1.5 font-mono text-[11px]">{p.hotkey}</span>
                  <span className="truncate">{p.name}</span>
                </button>
              );
            })}
            <button
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                useApp.setState({ addMenu: { track: focus, x: r.right, y: r.bottom } });
              }}
              className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-dashed border-line text-sm text-fg-2 hover:border-accent hover:text-accent-2"
            >
              <Plus className="h-4 w-4" /> Autre playlist
            </button>
          </div>
          {!hot.length && (
            <p className="mt-2 text-xs text-fg-3">
              Astuce : associe des playlists aux touches 1-9 dans les <Link href="/settings" className="underline">réglages</Link> pour ranger en une touche.
            </p>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Button variant="ghost" onClick={next}>
              <SkipForward className="h-4 w-4" /> Passer
            </Button>
            <Button variant="danger" onClick={dismiss} title="Reste dans la bibliothèque, mais sort de « À trier »">
              <Ban className="h-4 w-4" /> Écarter
            </Button>
            <Button
              variant="ghost"
              title="Supprimer de la bibliothèque (Ctrl+Z pour annuler)"
              onClick={() => {
                const rest = inbox.filter((t) => t.id !== focus.id);
                useApp.getState().deleteTracks([focus]);
                if (rest[focusIndex] || rest[0]) usePlayer.getState().playList(rest, rest[focusIndex] ? focusIndex : 0, "À trier");
              }}
            >
              <Trash2 className="h-4 w-4" /> Supprimer
            </Button>
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-fg-3">
        <Toggle checked={autoplay} onChange={setAutoplay} label="Lecture auto" />
        <Toggle checked={autoAdvance} onChange={setAutoAdvance} label="Suivant après rangement" />
        <span>
          <Kbd>1-9</Kbd> ranger · <Kbd>M</Kbd> drop · <Kbd>→</Kbd> suivant · <Kbd>Ctrl Z</Kbd> annuler
        </span>
      </div>
    </div>
  );
}

