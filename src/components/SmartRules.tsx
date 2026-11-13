"use client";
import { useState } from "react";
import type { SmartRules } from "@/lib/types";
import { CAMELOT, TAG_CATEGORIES } from "@/lib/client/format";
import { useApp } from "@/store/app";
import { Button, Chip, cx } from "./ui";

/** C8 : éditeur de règles (ex. tag Disco House + BPM 124-128). */
export function SmartRulesEditor({ value, onSave }: { value: SmartRules; onSave: (r: SmartRules) => void }) {
  const tags = useApp((s) => s.tags);
  const [r, setR] = useState<SmartRules>(value);
  const set = (p: Partial<SmartRules>) => setR((x) => ({ ...x, ...p }));
  const inp = "h-8 w-20 rounded-full border border-line bg-bg-2 px-3 text-center text-xs outline-none focus:border-accent";
  const toggleIn = (arr: string[] | undefined, id: string) => (arr?.includes(id) ? arr.filter((x) => x !== id) : [...(arr || []), id]);
  return (
    <div className="mb-4 space-y-4 rounded-2xl border border-accent/40 bg-accent-soft p-4">
      <div className="text-sm font-semibold">Règles de la playlist intelligente</div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <label className="flex items-center gap-2 text-xs text-fg-2">
          BPM
          <input className={inp} placeholder="min" value={r.bpmMin ?? ""} onChange={(e) => set({ bpmMin: e.target.value ? Number(e.target.value) : null })} />
          –
          <input className={inp} placeholder="max" value={r.bpmMax ?? ""} onChange={(e) => set({ bpmMax: e.target.value ? Number(e.target.value) : null })} />
        </label>
        <label className="flex items-center gap-2 text-xs text-fg-2">
          Énergie
          <input className={inp} placeholder="min" value={r.energyMin ?? ""} onChange={(e) => set({ energyMin: e.target.value ? Number(e.target.value) : null })} />
          –
          <input className={inp} placeholder="max" value={r.energyMax ?? ""} onChange={(e) => set({ energyMax: e.target.value ? Number(e.target.value) : null })} />
        </label>
        <label className="flex items-center gap-2 text-xs text-fg-2">
          Artiste contient
          <input className={cx(inp, "w-36 text-left")} value={r.artist ?? ""} onChange={(e) => set({ artist: e.target.value || null })} />
        </label>
        <label className="flex items-center gap-2 text-xs text-fg-2">
          Statut
          <select className={cx(inp, "w-32")} value={r.status ?? ""} onChange={(e) => set({ status: (e.target.value || null) as SmartRules["status"] })}>
            <option value="">Tous</option>
            <option value="inbox">Non rangés</option>
            <option value="sorted">Rangés</option>
          </select>
        </label>
      </div>
      <div>
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-fg-3">Tonalités (au moins une)</div>
        <div className="flex flex-wrap gap-1">
          {CAMELOT.map((k) => (
            <button key={k} onClick={() => set({ keys: toggleIn(r.keys, k) })} className={cx("h-6 w-9 rounded text-[11px] font-semibold", r.keys?.includes(k) ? "bg-accent text-white" : "bg-bg-3 text-fg-2")}>
              {k}
            </button>
          ))}
        </div>
      </div>
      {tags.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-fg-3">Tous ces tags</div>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <Chip key={t.id} color={t.color} active={r.tagIds?.includes(t.id)} onClick={() => set({ tagIds: toggleIn(r.tagIds, t.id) })}>
                  {t.name} <span className="opacity-60">· {TAG_CATEGORIES.find((c) => c.id === t.category)?.label}</span>
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-fg-3">Au moins un de ces tags</div>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <Chip key={t.id} color={t.color} active={r.anyTagIds?.includes(t.id)} onClick={() => set({ anyTagIds: toggleIn(r.anyTagIds, t.id) })}>
                  {t.name}
                </Chip>
              ))}
            </div>
          </div>
        </div>
      )}
      <Button variant="primary" size="sm" onClick={() => onSave(r)}>
        Appliquer les règles
      </Button>
    </div>
  );
}
