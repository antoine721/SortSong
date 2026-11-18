"use client";
import { ArrowLeft, ArrowRight, Link2, Music2, Pause, Play, Star, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Stars } from "@/components/Stars";
import { Badges } from "@/components/Badges";
import { Button, Kbd, Spinner, Toggle, cx } from "@/components/ui";
import { fmtDuration } from "@/lib/client/format";
import type { TrackDTO } from "@/lib/types";
import { useApp, type LibTrack } from "@/store/app";
import { usePlayer } from "@/store/player";

const START_MS = 30_000;
const LABELS = ["Pas pour moi", "Bof", "Moyen", "Bien", "Très bien", "Pépite"];

/**
 * Section « Noter » : un morceau à la fois en carrousel.
 * 1-5 = note puis suivant · 0 = supprimer puis suivant · ← = revenir en arrière · → = passer.
 */
export default function RatePage() {
  const lib = useApp((s) => s.libTracks);
  const rate = useApp((s) => s.rate);
  const current = usePlayer((s) => s.current);
  const paused = usePlayer((s) => s.paused);
  const [list, setList] = useState<LibTrack[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [given, setGiven] = useState<Record<string, number>>({}); // notes données pendant la session (0 = supprimé)
  const [autoplay, setAutoplay] = useState(true);
  const [fromDrop, setFromDrop] = useState(false);
  const [flash, setFlash] = useState<{ id: string; n: number } | null>(null);
  const lastPlayed = useRef<string | null>(null);

  useEffect(() => {
    useApp.getState().loadLibrary().catch(() => {});
    try {
      setAutoplay(localStorage.getItem("ss_rate_autoplay") !== "0");
      setFromDrop(localStorage.getItem("ss_rate_drop") === "1");
    } catch {}
  }, []);
  const persist = (k: string, v: boolean) => {
    try {
      localStorage.setItem(k, v ? "1" : "0");
    } catch {}
  };

  // File de la session : morceaux non notés, dans l'ordre d'import. Les nouveaux imports s'ajoutent à la fin.
  useEffect(() => {
    if (!lib) return;
    const unrated = lib.filter((t) => t.rating == null).sort((a, b) => (a.addedAt || "").localeCompare(b.addedAt || ""));
    setList((prev) => {
      if (!prev) return unrated;
      const ids = new Set(prev.map((t) => t.id));
      const extra = unrated.filter((t) => !ids.has(t.id));
      return extra.length ? [...prev, ...extra] : prev;
    });
  }, [lib]);

  const track = list?.[idx];
  const done = list ? list.filter((t) => given[t.id] !== undefined).length : 0;

  const play = useCallback(
    (i: number) => {
      if (!list?.[i]) return;
      const rest = list.slice(i).filter((t) => given[t.id] !== 0);
      const t = list[i];
      lastPlayed.current = t.id;
      // Départ à 30 s (ou au milieu si « Démarrer au drop »), sauf pour les titres trop courts.
      const startMs = fromDrop ? t.durationMs / 2 : t.durationMs > START_MS + 15000 ? START_MS : 0;
      usePlayer.getState().playList(rest.length ? rest : [t], 0, "Noter", startMs);
    },
    [list, given, fromDrop],
  );

  // Lecture automatique du morceau affiché
  useEffect(() => {
    if (!autoplay || !track || lastPlayed.current === track.id) return;
    const t = setTimeout(() => play(idx), 120);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track?.id, autoplay]);

  const give = useCallback(
    (n: number) => {
      if (!list || !track) return;
      setGiven((g) => ({ ...g, [track.id]: n }));
      setFlash({ id: track.id, n });
      rate(track, n);
      setTimeout(() => setIdx((i) => Math.min(i + 1, list.length)), 140);
    },
    [list, track, rate],
  );

  // Clavier (phase de capture : prend le pas sur les raccourcis globaux 1-9 et ←/→)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (useApp.getState().searchOpen || useApp.getState().linkDialog) return;
      // Chiffres de la rangée du haut ou du pavé numérique (même sans Verr. num.)
      const digit = /^(?:Digit|Numpad)([0-9])$/.exec(e.code)?.[1] ?? (/^[0-9]$/.test(e.key) ? e.key : null);
      if (digit !== null && Number(digit) <= 5) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!e.repeat) give(Number(digit));
      } else if (e.key === "ArrowLeft" && !e.shiftKey) {
        e.preventDefault();
        e.stopImmediatePropagation();
        setIdx((i) => Math.max(0, i - 1));
      } else if (e.key === "ArrowRight" && !e.shiftKey) {
        e.preventDefault();
        e.stopImmediatePropagation();
        setIdx((i) => Math.min(i + 1, list?.length ?? 0));
      } else if (digit !== null) {
        e.stopImmediatePropagation();
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true } as any);
  }, [give, list]);

  const window5 = useMemo(() => {
    if (!list) return [];
    const out: { t: LibTrack; d: number; i: number }[] = [];
    for (let d = -3; d <= 3; d++) if (list[idx + d]) out.push({ t: list[idx + d], d, i: idx + d });
    return out;
  }, [list, idx]);

  if (!list) return <div className="grid h-64 place-items-center"><Spinner /></div>;

  const isPlaying = current?.id === track?.id && !paused;
  const currentRating = track ? given[track.id] ?? track.rating ?? null : null;

  return (
    <div className="flex min-h-full flex-col">
      <section className="relative overflow-hidden bg-gradient-to-br from-[#5b21b6] via-[#a21caf] to-[#e11d48] px-4 pb-10 pt-8 md:px-8">
        <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 right-0 h-96 w-96 rounded-full bg-black/20 blur-3xl" />
        <div className="relative flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-extrabold tracking-tight text-white md:text-4xl">Noter</h1>
          <span className="rounded-full bg-white/15 px-3 py-1 text-sm font-medium text-white/90 backdrop-blur">
            {Math.max(0, list.length - done)} à noter · {done} noté{done > 1 ? "s" : ""} cette session
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-4 text-white/90 [&_span]:!text-white/90">
            <Toggle checked={autoplay} onChange={(v) => (setAutoplay(v), persist("ss_rate_autoplay", v))} label="Lecture auto" />
            <Toggle checked={fromDrop} onChange={(v) => (setFromDrop(v), persist("ss_rate_drop", v))} label="Démarrer au drop (sinon à 0:30)" />
          </div>
        </div>

        {!track ? (
          <div className="relative mx-auto mt-12 max-w-md rounded-3xl bg-white/90 p-8 text-center text-[#2e1065] shadow-2xl">
            <Star className="mx-auto h-12 w-12 fill-amber-400 text-amber-400" />
            <h2 className="mt-3 text-xl font-bold">{list.length ? "Tout est noté 🎉" : "Rien à noter"}</h2>
            <p className="mt-1 text-sm text-[#4c1d95]/80">Importe une playlist, un album ou un titre Spotify avec son lien.</p>
            <Button variant="primary" className="mt-5" onClick={() => useApp.setState({ linkDialog: { folderId: null } })}>
              <Link2 className="h-4 w-4" /> Importer depuis un lien
            </Button>
            {idx > 0 && (
              <button onClick={() => setIdx(idx - 1)} className="mt-4 block w-full text-sm text-[#4c1d95]/70 hover:underline">
                ← Revenir au dernier morceau
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Carrousel */}
            <div className="relative mx-auto mt-8 h-[min(56vw,400px)] max-w-6xl">
              {window5.map(({ t, d, i }) => {
                const g = given[t.id];
                const deleted = g === 0;
                const center = d === 0;
                const ad = Math.abs(d);
                return (
                  <div
                    key={t.id}
                    onClick={() => !center && setIdx(i)}
                    className={cx(
                      "absolute left-1/2 top-1/2 w-[min(46vw,330px)] rounded-[22px] p-3 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)] transition-all duration-300 ease-out",
                      center ? "z-20 bg-white" : "z-10 cursor-pointer bg-white/85 hover:bg-white",
                    )}
                    style={{
                      transform: `translate(calc(-50% + ${d * 78}%), -50%) scale(${center ? 1 : ad === 1 ? 0.74 : 0.6})`,
                      opacity: ad >= 3 ? 0 : ad === 2 ? 0.55 : 1,
                      zIndex: 20 - ad,
                    }}
                  >
                    <div className="relative aspect-square overflow-hidden rounded-2xl bg-[#f0d6ff]">
                      {t.cover ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={t.cover}
                          alt=""
                          className={cx("h-full w-full object-cover", deleted && "grayscale")}
                          draggable={false}
                          onError={(e) => (e.currentTarget.style.visibility = "hidden")}
                        />
                      ) : (
                        <div className="grid h-full w-full place-items-center text-[#c084fc]"><Music2 className="h-1/3 w-1/3" /></div>
                      )}
                      {center && (
                        <button
                          onClick={() => (current?.id === t.id ? usePlayer.getState().toggle() : play(i))}
                          className="absolute inset-0 grid place-items-center bg-black/0 opacity-0 transition hover:bg-black/30 hover:opacity-100"
                          title="Lecture / pause (Espace)"
                        >
                          {isPlaying ? <Pause className="h-16 w-16 fill-white text-white" /> : <Play className="h-16 w-16 fill-white text-white" />}
                        </button>
                      )}
                      {center && isPlaying && (
                        <span className="eq absolute bottom-3 left-3"><span /><span /><span /></span>
                      )}
                      {deleted && (
                        <span className="absolute inset-0 grid place-items-center bg-black/50 text-sm font-bold uppercase tracking-wider text-white">Supprimé</span>
                      )}
                      {center && flash?.id === t.id && (
                        <span className="fadein absolute right-3 top-3 rounded-full bg-black/60 px-3 py-1 text-sm font-bold text-white">
                          {flash.n === 0 ? "Supprimé" : "★".repeat(flash.n)}
                        </span>
                      )}
                    </div>
                    <div className="px-1.5 pb-1 pt-3 text-[#2e1065]">
                      <div className={cx("truncate font-bold", center ? "text-lg" : "text-base")}>{t.title}</div>
                      <div className="truncate text-sm text-[#6b21a8]/80">{t.artists.map((a) => a.name).join(", ")}</div>
                      {!center && (
                        <div className="mt-1.5 h-4">{g ? <Stars value={g} size={13} empty="#e9d5ff" /> : !deleted && <div className="h-2 w-16 rounded-full bg-[#e9d5ff]" />}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Notation */}
            <div className="relative mx-auto mt-6 flex max-w-2xl flex-col items-center gap-4 text-white">
              <div className="flex items-center gap-2 text-sm text-white/80">
                <span>{track.album}</span>·<span>{fmtDuration(track.durationMs)}</span>
                {track.bpm ? <>·<span>{Math.round(track.bpm)} BPM</span></> : null}
                {track.sourceRef && <>·<span className="truncate">de « {track.sourceRef} »</span></>}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIdx((i) => Math.max(0, i - 1))}
                  disabled={idx === 0}
                  title="Revenir en arrière (←)"
                  className="grid h-11 w-11 place-items-center rounded-full bg-white/15 backdrop-blur transition hover:bg-white/25 disabled:opacity-30"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={() => give(0)}
                  title="0 — Ne m'intéresse pas : supprimer"
                  className="flex h-14 items-center gap-2 rounded-2xl bg-black/25 px-4 font-semibold backdrop-blur transition hover:bg-red-600"
                >
                  <span className="rounded bg-white/20 px-1.5 font-mono text-xs">0</span>
                  <Trash2 className="h-5 w-5" />
                </button>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => give(n)}
                    title={`${n} — ${LABELS[n]}`}
                    className={cx(
                      "flex h-14 w-14 flex-col items-center justify-center rounded-2xl backdrop-blur transition hover:scale-105 md:w-16",
                      currentRating && n <= currentRating ? "bg-amber-400 text-[#3b0764]" : "bg-white/15 hover:bg-white/30",
                    )}
                  >
                    <Star className={cx("h-5 w-5", currentRating && n <= currentRating ? "fill-[#3b0764]" : "fill-white/0")} />
                    <span className="font-mono text-xs font-bold">{n}</span>
                  </button>
                ))}
                <button
                  onClick={() => setIdx((i) => Math.min(i + 1, list.length))}
                  title="Passer sans noter (→)"
                  className="grid h-11 w-11 place-items-center rounded-full bg-white/15 backdrop-blur transition hover:bg-white/25"
                >
                  <ArrowRight className="h-5 w-5" />
                </button>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-white/75 [&_kbd]:border-white/20 [&_kbd]:bg-white/10 [&_kbd]:text-white">
                <span><Kbd>1</Kbd>…<Kbd>5</Kbd> noter et passer</span>
                <span><Kbd>0</Kbd> supprimer</span>
                <span><Kbd>←</Kbd> revenir</span>
                <span><Kbd>→</Kbd> passer</span>
                <span><Kbd>Espace</Kbd> pause</span>
                <span><Kbd>M</Kbd> drop</span>
              </div>
            </div>
          </>
        )}
      </section>

      {track && (
        <div className="mx-auto mt-6 w-full max-w-3xl px-4 pb-10 text-sm text-fg-2">
          <div className="flex flex-wrap items-center gap-3">
            <span>Déjà en playlist :</span>
            <Badges trackId={track.id} />
            <Button
              size="sm"
              className="ml-auto"
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                useApp.setState({ addMenu: { track: track as TrackDTO, x: r.right, y: r.bottom } });
              }}
            >
              Ajouter à une playlist
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
