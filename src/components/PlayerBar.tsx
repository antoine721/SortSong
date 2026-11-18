"use client";
import {
  Info, ListMusic, MonitorSpeaker, Pause, Play, Plus, Redo2, SkipBack, SkipForward, Undo2, Volume1, Volume2, VolumeX, Zap,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fmtDuration } from "@/lib/client/format";
import { useApp } from "@/store/app";
import { usePlayer } from "@/store/player";
import { Badges } from "./Badges";
import { Cover, IconButton, Popover, cx } from "./ui";

function useLivePosition() {
  const [, force] = useState(0);
  const paused = usePlayer((s) => s.paused);
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => force((x) => x + 1), 250);
    return () => clearInterval(t);
  }, [paused]);
  return usePlayer.getState().livePosition();
}

export function PlayerBar() {
  const p = usePlayer();
  const rightPanel = useApp((s) => s.rightPanel);
  const position = useLivePosition();
  const [scrub, setScrub] = useState<number | null>(null);
  const [devMenu, setDevMenu] = useState<DOMRect | null>(null);
  const t = p.current;
  const duration = p.duration || t?.durationMs || 0;
  const shown = scrub ?? position;
  const pct = duration ? (shown / duration) * 100 : 0;
  const allPlaylists = useApp((s) => s.playlists);
  const hotkeys = useMemo(() => allPlaylists.filter((x) => x.hotkey).sort((a, b) => a.hotkey! - b.hotkey!), [allPlaylists]);
  const membership = useApp((s) => (t ? s.membership[t.id] : undefined));

  return (
    <footer className="relative z-20 flex h-[88px] shrink-0 items-center gap-3 border-t border-line bg-bg-1 px-3 md:gap-4 md:px-4 [.discreet_&]:h-[60px]">
      {/* Morceau en cours */}
      <div className="flex min-w-0 flex-1 items-center gap-3 md:w-[30%] md:flex-none">
        {t ? (
          <>
            <button onClick={() => useApp.getState().openTrack(t)} title="Fiche du morceau">
              <Cover src={t.cover} size={56} className="shadow-soft [.discreet_&]:!h-9 [.discreet_&]:!w-9" />
            </button>
            <div className="min-w-0">
              <div className="truncate font-semibold">{t.title}</div>
              <div className="truncate text-[13px] text-fg-2">
                {t.artists.map((a, i) => (
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
              <div className="mt-1 hidden md:block">
                <Badges trackId={t.id} compact />
              </div>
            </div>
            <IconButton
              title="Ajouter à une playlist"
              className="hover:!bg-accent hover:!text-white"
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                useApp.setState({ addMenu: { track: t, x: r.right + 140, y: r.top - 340 } });
              }}
            >
              <Plus className="h-5 w-5" />
            </IconButton>
          </>
        ) : (
          <div className="text-sm text-fg-3">Rien en lecture · double-clique un titre</div>
        )}
      </div>

      {/* Contrôles */}
      <div className="flex flex-col items-center gap-1 md:flex-1">
        <div className="flex items-center gap-1 md:gap-2">
          <IconButton title="−10 s (Maj+←)" onClick={() => p.seekRel(-10000)} disabled={!t} className="hidden sm:inline-grid">
            <Undo2 className="h-4 w-4" />
          </IconButton>
          <IconButton title="Précédent (←)" onClick={() => p.prev()} disabled={!t}>
            <SkipBack className="h-5 w-5 fill-current" />
          </IconButton>
          <button
            title="Lecture / pause (Espace)"
            onClick={() => p.toggle()}
            disabled={!t}
            className="grid h-10 w-10 place-items-center rounded-full bg-fg text-bg transition hover:scale-105 disabled:opacity-30"
          >
            {p.paused ? <Play className="ml-0.5 h-5 w-5 fill-current" /> : <Pause className="h-5 w-5 fill-current" />}
          </button>
          <IconButton title="Suivant (→)" onClick={() => p.next()} disabled={!t}>
            <SkipForward className="h-5 w-5 fill-current" />
          </IconButton>
          <IconButton title="+30 s (Maj+→)" onClick={() => p.seekRel(30000)} disabled={!t} className="hidden sm:inline-grid">
            <Redo2 className="h-4 w-4" />
          </IconButton>
          <button
            title="Sauter au milieu — le drop (M)"
            onClick={() => p.seekMiddle()}
            disabled={!t}
            className="ml-1 hidden h-7 items-center gap-1 rounded-full border border-line px-2.5 text-[11px] font-semibold text-fg-2 hover:border-accent hover:text-accent-2 disabled:opacity-30 sm:inline-flex"
          >
            <Zap className="h-3.5 w-3.5" /> Drop
          </button>
        </div>
        <div className="hidden w-full max-w-[620px] items-center gap-2 text-[11px] text-fg-3 tnum md:flex">
          <span className="w-10 text-right">{fmtDuration(shown)}</span>
          <input
            type="range"
            className="range flex-1"
            min={0}
            max={duration || 1}
            value={shown}
            disabled={!t}
            style={{ ["--p" as any]: `${pct}%` }}
            onChange={(e) => setScrub(Number(e.target.value))}
            onMouseUp={() => {
              if (scrub !== null) p.seek(scrub);
              setScrub(null);
            }}
            onTouchEnd={() => {
              if (scrub !== null) p.seek(scrub);
              setScrub(null);
            }}
          />
          <span className="w-10">{fmtDuration(duration)}</span>
        </div>
      </div>

      {/* Droite */}
      <div className="hidden w-[30%] items-center justify-end gap-1 md:flex">
        {t && hotkeys.length > 0 && (
          <div className="mr-2 hidden items-center gap-1 2xl:flex">
            {hotkeys.slice(0, 9).map((h) => {
              const on = membership?.includes(h.id);
              return (
                <button
                  key={h.id}
                  title={`${h.hotkey} → ${h.name}`}
                  onClick={() => useApp.getState().togglePlaylist(t, h.id)}
                  className={cx("grid h-6 w-6 place-items-center rounded font-mono text-[10px] font-bold transition", on ? "text-white" : "bg-bg-3 text-fg-2 hover:bg-bg-4")}
                  style={on ? { background: h.color } : undefined}
                >
                  {h.hotkey}
                </button>
              );
            })}
          </div>
        )}
        <IconButton
          title={p.mode === "sdk" ? "Lecture dans le navigateur" : "Spotify Connect : choisir l'appareil"}
          active={p.mode === "connect"}
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            p.refreshDevices();
            setDevMenu(r);
          }}
        >
          <MonitorSpeaker className="h-[18px] w-[18px]" />
        </IconButton>
        <IconButton title="File d'attente" active={rightPanel === "queue"} onClick={() => useApp.setState({ rightPanel: rightPanel === "queue" ? null : "queue" })}>
          <ListMusic className="h-[18px] w-[18px]" />
        </IconButton>
        <IconButton
          title="Fiche du morceau"
          active={rightPanel === "track"}
          onClick={() => useApp.setState({ rightPanel: rightPanel === "track" ? null : "track", panelTrack: t || useApp.getState().panelTrack })}
        >
          <Info className="h-[18px] w-[18px]" />
        </IconButton>
        <Volume />
      </div>
      {devMenu && <DeviceMenu anchor={devMenu} onClose={() => setDevMenu(null)} />}
    </footer>
  );
}

function Volume() {
  const volume = usePlayer((s) => s.volume);
  const setVolume = usePlayer((s) => s.setVolume);
  const [prev, setPrev] = useState(0.7);
  const Icon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  return (
    <div className="flex items-center gap-1.5">
      <IconButton
        title="Muet"
        onClick={() => {
          if (volume > 0) {
            setPrev(volume);
            setVolume(0);
          } else setVolume(prev || 0.7);
        }}
      >
        <Icon className="h-[18px] w-[18px]" />
      </IconButton>
      <input
        type="range"
        className="range w-24"
        min={0}
        max={100}
        value={Math.round(volume * 100)}
        style={{ ["--p" as any]: `${volume * 100}%` }}
        onChange={(e) => setVolume(Number(e.target.value) / 100)}
      />
    </div>
  );
}

function DeviceMenu({ anchor, onClose }: { anchor: DOMRect; onClose: () => void }) {
  const p = usePlayer();
  return (
    <Popover anchor={{ x: anchor.right, y: anchor.top - 8 } as any} onClose={onClose} width={300}>
      <div className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-fg-3">Lire sur</div>
      <button
        onClick={() => {
          p.setMode("sdk");
          onClose();
        }}
        className={cx("flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-bg-3", p.mode === "sdk" && "text-accent-2")}
      >
        <MonitorSpeaker className="mt-0.5 h-4 w-4" />
        <span className="flex-1">
          <span className="block text-sm font-medium">Ce navigateur (SortSong)</span>
          <span className="block text-[11px] text-fg-3">
            {p.sdkStatus === "ready" ? "Lecteur web prêt" : p.sdkStatus === "loading" ? "Connexion…" : p.sdkError || "Indisponible"}
          </span>
        </span>
      </button>
      <div className="my-1 h-px bg-line" />
      <div className="px-2.5 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-fg-3">Spotify Connect</div>
      {p.devices.filter((d) => d.name !== "SortSong").map((d) => (
        <button
          key={d.id}
          onClick={() => {
            p.setMode("connect");
            p.setConnectDevice(d.id);
            onClose();
          }}
          className={cx("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-bg-3", p.mode === "connect" && p.connectDeviceId === d.id && "text-accent-2")}
        >
          <span className="h-2 w-2 rounded-full" style={{ background: d.is_active ? "#22c55e" : "#6b6b7b" }} />
          <span className="flex-1 truncate">{d.name}</span>
          <span className="text-[11px] text-fg-3">{d.type}</span>
        </button>
      ))}
      {!p.devices.filter((d) => d.name !== "SortSong").length && (
        <div className="px-2.5 py-2 text-xs text-fg-3">Aucun appareil. Ouvre l'appli Spotify sur ton ordinateur ou ton téléphone.</div>
      )}
    </Popover>
  );
}
