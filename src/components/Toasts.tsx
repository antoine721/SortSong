"use client";
import { CheckCircle2, Info, Undo2, XCircle } from "lucide-react";
import { useApp } from "@/store/app";
import { cx } from "./ui";

export function Toasts() {
  const toasts = useApp((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed bottom-[104px] left-1/2 z-[60] flex w-full max-w-md -translate-x-1/2 flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <div key={t.id} className="fadein pointer-events-auto flex w-full items-center gap-3 rounded-xl border border-line bg-bg-3/95 px-4 py-2.5 text-sm shadow-soft backdrop-blur">
          {t.tone === "err" ? <XCircle className="h-4 w-4 shrink-0 text-red-400" /> : t.tone === "info" ? <Info className="h-4 w-4 shrink-0 text-fg-2" /> : <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />}
          <span className={cx("min-w-0 flex-1", t.tone === "err" && "text-red-200")}>{t.text}</span>
          {t.undo && (
            <button
              onClick={() => {
                useApp.getState().dropToast(t.id);
                useApp.getState().undo();
              }}
              className="flex shrink-0 items-center gap-1 rounded-full bg-bg-4 px-3 py-1 text-xs font-semibold hover:bg-accent"
            >
              <Undo2 className="h-3.5 w-3.5" /> Annuler
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
