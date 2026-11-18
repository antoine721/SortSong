"use client";
import { useEffect } from "react";
import { useApp } from "@/store/app";
import { usePlayer } from "@/store/player";

/**
 * B5 + C5 : Espace = lecture/pause, ←/→ = précédent/suivant, Maj+←/→ = −10 s/+30 s,
 * M = milieu (drop), 1-9 = ajout express, Ctrl+K = recherche, Ctrl+Z = annuler.
 */
export function Shortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        useApp.setState({ searchOpen: !useApp.getState().searchOpen });
        return;
      }
      if (typing) return;
      if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        useApp.getState().undo();
        return;
      }
      if (mod || e.altKey) return;
      if (e.shiftKey && (e.key === "D" || e.key === "d")) {
        const app = useApp.getState();
        app.setTheme(app.theme === "discreet" ? "dark" : "discreet");
        return;
      }
      const p = usePlayer.getState();
      switch (e.key) {
        case " ":
          e.preventDefault();
          p.toggle();
          return;
        case "ArrowRight":
          e.preventDefault();
          if (e.shiftKey) p.seekRel(30000);
          else p.next();
          return;
        case "ArrowLeft":
          e.preventDefault();
          if (e.shiftKey) p.seekRel(-10000);
          else p.prev();
          return;
        case "m":
        case "M":
          p.seekMiddle();
          return;
        case "Escape":
          useApp.setState({ addMenu: null });
          return;
      }
      if (/^[1-9]$/.test(e.key)) {
        const n = Number(e.key);
        const app = useApp.getState();
        const pl = app.playlists.find((x) => x.hotkey === n);
        const t = p.current;
        if (!pl) {
          app.toast(`Aucune playlist sur la touche ${n} (Réglages)`, { tone: "info" });
          return;
        }
        if (!t) {
          app.toast("Aucun morceau en cours", { tone: "info" });
          return;
        }
        app.addToPlaylists(t, [pl.id]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return null;
}
