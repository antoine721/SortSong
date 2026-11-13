"use client";
import Link from "next/link";
import { Sparkle } from "lucide-react";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useApp } from "@/store/app";
import { cx } from "./ui";

const EMPTY: string[] = [];

/** D1/D2/D4 : pastilles aux couleurs des playlists + nombre ; détail au survol. */
export function Badges({ trackId, compact }: { trackId: string; compact?: boolean }) {
  const ids = useApp((s) => s.membership[trackId] || EMPTY);
  const inLib = useApp((s) => s.library.has(trackId));
  const playlists = useApp((s) => s.playlists);
  const [hover, setHover] = useState<DOMRect | null>(null);
  const timer = useRef<any>(null);
  const pls = ids.map((id) => playlists.find((p) => p.id === id)).filter(Boolean) as typeof playlists;

  if (!pls.length) {
    return inLib ? (
      <span title="Dans ta bibliothèque, pas encore rangé" className="inline-flex h-5 items-center gap-1 rounded-full border border-dashed border-fg-3/60 px-2 text-[10px] font-medium uppercase tracking-wide text-fg-3">
        {compact ? "–" : "Non rangé"}
      </span>
    ) : (
      <span title="Jamais vu : absent de ta bibliothèque" className="inline-flex h-5 items-center gap-1 rounded-full bg-amber-400/10 px-2 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
        <Sparkle className="h-3 w-3" /> {!compact && "Nouveau"}
      </span>
    );
  }

  return (
    <span
      className="relative inline-flex cursor-default items-center gap-1.5"
      onMouseEnter={(e) => {
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setHover(r), 150);
      }}
      onMouseLeave={() => {
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setHover(null), 200);
      }}
    >
      <span className="flex -space-x-1">
        {pls.slice(0, 4).map((p) => (
          <span key={p.id} className="h-3.5 w-3.5 rounded-full ring-2 ring-bg-1" style={{ background: p.color }} />
        ))}
      </span>
      {compact ? (
        <span className="text-[11px] font-semibold text-fg-2">{pls.length}</span>
      ) : (
        <span className="max-w-[140px] truncate text-xs font-medium text-fg-2">{pls.length === 1 ? pls[0].name : `${pls.length} playlists`}</span>
      )}
      {hover &&
        createPortal(
          <div
            onMouseEnter={() => clearTimeout(timer.current)}
            onMouseLeave={() => setHover(null)}
            style={{ left: Math.min(hover.left, window.innerWidth - 250), top: hover.bottom + 4 }}
            className="fadein fixed z-50 w-60 rounded-xl border border-line bg-bg-2 p-1.5 shadow-soft"
          >
            <div className="px-2 pb-1 pt-0.5 text-[11px] font-semibold uppercase tracking-wider text-fg-3">Dans {pls.length} playlist{pls.length > 1 ? "s" : ""}</div>
            {pls.map((p) => (
              <Link key={p.id} href={`/playlist/${p.id}`} onClick={() => setHover(null)} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-bg-3">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.color }} />
                <span className="truncate">{p.name}</span>
              </Link>
            ))}
          </div>,
          document.body,
        )}
    </span>
  );
}

export function ColorDot({ color, className }: { color: string; className?: string }) {
  return <span className={cx("inline-block h-2.5 w-2.5 shrink-0 rounded-full", className)} style={{ background: color }} />;
}
