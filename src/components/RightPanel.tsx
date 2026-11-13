"use client";
import { X } from "lucide-react";
import { useApp } from "@/store/app";
import { usePlayer } from "@/store/player";
import { fmtDuration } from "@/lib/client/format";
import { TrackSheet } from "./TrackSheet";
import { Badges } from "./Badges";
import { Cover, IconButton, cx } from "./ui";

export function RightPanel() {
  const panel = useApp((s) => s.rightPanel);
  const panelTrack = useApp((s) => s.panelTrack);
  const current = usePlayer((s) => s.current);
  if (!panel) return null;
  const track = panelTrack || current;
  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => useApp.setState({ rightPanel: null })} />
      <aside className="fixed inset-y-0 right-0 z-40 flex w-[360px] max-w-[92vw] shrink-0 flex-col border-l border-line bg-bg-1 lg:static lg:z-auto">
        <div className="flex h-14 shrink-0 items-center gap-1 border-b border-line px-3">
          <Tab active={panel === "queue"} onClick={() => useApp.setState({ rightPanel: "queue" })}>
            File d'attente
          </Tab>
          <Tab active={panel === "track"} onClick={() => useApp.setState({ rightPanel: "track", panelTrack: panelTrack || current })}>
            Fiche du morceau
          </Tab>
          <IconButton className="ml-auto" size="sm" onClick={() => useApp.setState({ rightPanel: null })}>
            <X className="h-4 w-4" />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {panel === "queue" ? <Queue /> : track ? <TrackSheet key={track.id} track={track} /> : <p className="p-6 text-sm text-fg-3">Aucun morceau sélectionné.</p>}
        </div>
      </aside>
    </>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cx("h-8 rounded-full px-3 text-sm font-medium transition", active ? "bg-bg-3 text-fg" : "text-fg-2 hover:text-fg")}>
      {children}
    </button>
  );
}

function Queue() {
  const { queue, index, contextLabel, jumpTo, removeFromQueue } = usePlayer();
  const upcoming = queue.slice(index + 1, index + 101);
  const cur = queue[index];
  return (
    <div className="p-3">
      {cur && (
        <>
          <h3 className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-fg-3">En cours</h3>
          <QItem t={cur} active />
        </>
      )}
      <h3 className="px-2 pb-2 pt-5 text-[11px] font-semibold uppercase tracking-wider text-fg-3">
        À suivre {contextLabel ? `· ${contextLabel}` : ""} ({Math.max(0, queue.length - index - 1)})
      </h3>
      {upcoming.map((t, i) => (
        <QItem key={t.id + i} t={t} onPlay={() => jumpTo(index + 1 + i)} onRemove={() => removeFromQueue(index + 1 + i)} />
      ))}
      {!upcoming.length && <p className="px-2 text-sm text-fg-3">La file est vide. « Lire ensuite » depuis le menu d'un titre.</p>}
    </div>
  );
}

function QItem({ t, active, onPlay, onRemove }: { t: any; active?: boolean; onPlay?: () => void; onRemove?: () => void }) {
  return (
    <div onDoubleClick={onPlay} className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-bg-2">
      <button onClick={onPlay}>
        <Cover src={t.coverSmall || t.cover} size={40} />
      </button>
      <div className="min-w-0 flex-1">
        <div className={cx("truncate text-sm font-medium", active && "text-accent-2")}>{t.title}</div>
        <div className="truncate text-xs text-fg-2">{t.artists.map((a: any) => a.name).join(", ")}</div>
      </div>
      <Badges trackId={t.id} compact />
      <span className="w-9 text-right text-xs text-fg-3 tnum group-hover:hidden">{fmtDuration(t.durationMs)}</span>
      {onRemove && (
        <button onClick={onRemove} className="hidden w-9 justify-end text-fg-3 hover:text-fg group-hover:flex">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
