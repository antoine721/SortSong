"use client";
import { Wand2 } from "lucide-react";
import type { TrackDTO } from "@/lib/types";
import { camelotCompat } from "@/lib/client/format";
import { useApp } from "@/store/app";
import { Button, cx } from "./ui";

type M = { bpm?: number | null; key?: string | null; energy?: number | null };

/** Ordre optimisé : BPM proche, clés compatibles, énergie montante. */
export function optimizeOrder(tracks: (TrackDTO & M)[]): TrackDTO[] {
  const withBpm = tracks.filter((t) => t.bpm);
  const without = tracks.filter((t) => !t.bpm);
  if (withBpm.length < 2) return tracks;
  const rest = [...withBpm];
  rest.sort((a, b) => (a.energy || 3) - (b.energy || 3) || a.bpm! - b.bpm!);
  const out = [rest.shift()!];
  while (rest.length) {
    const cur = out[out.length - 1];
    let best = 0;
    let bestCost = Infinity;
    rest.forEach((t, i) => {
      const dBpm = Math.abs(t.bpm! - cur.bpm!) / cur.bpm!;
      const k = camelotCompat(cur.key, t.key);
      const keyCost = k === "perfect" ? 0 : k === "good" ? 0.4 : k === "bad" ? 2.5 : 1;
      const e = (t.energy || 3) - (cur.energy || 3);
      const energyCost = e < 0 ? -e * 1.2 : e > 1 ? (e - 1) * 0.6 : 0;
      const tempoDrop = t.bpm! < cur.bpm! * 0.97 ? 0.8 : 0;
      const cost = dBpm * 30 + keyCost + energyCost + tempoDrop;
      if (cost < bestCost) {
        bestCost = cost;
        best = i;
      }
    });
    out.push(rest.splice(best, 1)[0]);
  }
  return [...out, ...without];
}

/** V3 : constructeur de setlist — courbes BPM / énergie et qualité des transitions. */
export function SetlistPanel({ tracks, onApply, canReorder }: { tracks: TrackDTO[]; onApply?: (t: TrackDTO[]) => void; canReorder: boolean }) {
  const meta = useApp((s) => s.meta);
  const list = tracks.map((t) => ({ ...t, ...(meta[t.id] || {}) }));
  const W = 1000;
  const H = 140;
  const n = list.length;
  const bpms = list.map((t) => t.bpm || null);
  const known = bpms.filter(Boolean) as number[];
  const minB = known.length ? Math.min(...known) - 3 : 100;
  const maxB = known.length ? Math.max(...known) + 3 : 140;
  const x = (i: number) => (n <= 1 ? W / 2 : (i / (n - 1)) * (W - 40) + 20);
  const yB = (b: number) => H - 15 - ((b - minB) / Math.max(1, maxB - minB)) * (H - 30);
  const yE = (e: number) => H - 15 - ((e - 1) / 4) * (H - 30);
  const bpmPath = list.map((t, i) => (t.bpm ? `${x(i)},${yB(t.bpm)}` : null)).filter(Boolean).join(" L ");
  const energyPts = list.map((t, i) => (t.energy ? [x(i), yE(t.energy)] : null)).filter(Boolean) as number[][];
  const energyArea = energyPts.length > 1 ? `M ${energyPts[0][0]},${H - 15} L ${energyPts.map((p) => p.join(",")).join(" L ")} L ${energyPts[energyPts.length - 1][0]},${H - 15} Z` : "";

  const transitions = list.slice(1).map((t, i) => {
    const a = list[i];
    const d = a.bpm && t.bpm ? ((t.bpm - a.bpm) / a.bpm) * 100 : null;
    return { d, k: camelotCompat(a.key, t.key) };
  });
  const good = transitions.filter((t) => t.k === "perfect" || t.k === "good").length;
  const smooth = transitions.filter((t) => t.d !== null && Math.abs(t.d) <= 4).length;
  const missing = list.filter((t) => !t.bpm || !t.key || !t.energy).length;

  return (
    <div className="mb-4 rounded-2xl border border-line bg-bg-2/60 p-4">
      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <span className="font-semibold">Setlist</span>
        <span className="flex items-center gap-1.5 text-fg-2"><span className="h-0.5 w-4 bg-accent-2" /> BPM</span>
        <span className="flex items-center gap-1.5 text-fg-2"><span className="h-3 w-4 rounded-sm bg-amber-400/30" /> Énergie</span>
        <span className="text-fg-2">Transitions harmoniques : <b className="text-fg">{good}/{transitions.length}</b></span>
        <span className="text-fg-2">Tempo ±4 % : <b className="text-fg">{smooth}/{transitions.length}</b></span>
        {missing > 0 && <span className="text-xs text-amber-300">{missing} titre(s) sans BPM/clé/énergie</span>}
        {onApply && (
          <Button size="sm" variant="primary" className="ml-auto" disabled={!canReorder || n < 3} onClick={() => onApply(optimizeOrder(list))} title={canReorder ? "" : "Repasse en ordre de playlist pour réordonner"}>
            <Wand2 className="h-3.5 w-3.5" /> Optimiser l'enchaînement
          </Button>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-[140px] w-full" preserveAspectRatio="none">
        {[0.25, 0.5, 0.75].map((r) => (
          <line key={r} x1={0} x2={W} y1={H * r} y2={H * r} stroke="#262632" strokeDasharray="4 6" />
        ))}
        {energyArea && <path d={energyArea} fill="rgba(251,191,36,0.18)" stroke="rgba(251,191,36,0.6)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />}
        {bpmPath && <path d={`M ${bpmPath}`} fill="none" stroke="#9b83ff" strokeWidth={2.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />}
        {list.map((t, i) =>
          t.bpm ? <circle key={i} cx={x(i)} cy={yB(t.bpm)} r={3.5} fill="#9b83ff" vectorEffect="non-scaling-stroke"><title>{`${i + 1}. ${t.title} — ${Math.round(t.bpm)} BPM${t.key ? " · " + t.key : ""}`}</title></circle> : null,
        )}
        {known.length > 0 && (
          <>
            <text x={4} y={14} fill="#6b6b7b" fontSize={11}>{Math.round(maxB)}</text>
            <text x={4} y={H - 2} fill="#6b6b7b" fontSize={11}>{Math.round(minB)}</text>
          </>
        )}
      </svg>
      <div className="mt-2 flex gap-[2px] overflow-hidden rounded">
        {transitions.map((t, i) => (
          <div
            key={i}
            title={`${i + 1} → ${i + 2} : ${t.d !== null ? (t.d > 0 ? "+" : "") + t.d.toFixed(1) + " %" : "BPM ?"} · clé ${t.k === "perfect" ? "identique" : t.k === "good" ? "compatible" : t.k === "bad" ? "à risque" : "?"}`}
            className={cx(
              "h-1.5 flex-1",
              t.k === "bad" || (t.d !== null && Math.abs(t.d) > 6) ? "bg-red-500/70" : t.k === null || t.d === null ? "bg-bg-4" : Math.abs(t.d) > 4 ? "bg-amber-400/70" : "bg-emerald-500/70",
            )}
          />
        ))}
      </div>
    </div>
  );
}
