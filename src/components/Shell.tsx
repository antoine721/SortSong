"use client";
import { Bell, ChevronDown, Menu, Search } from "lucide-react";
import { useEffect } from "react";
import { useApp } from "@/store/app";
import { usePlayer } from "@/store/player";
import { AddMenu } from "./AddMenu";
import { PlayerBar } from "./PlayerBar";
import { RightPanel } from "./RightPanel";
import { SearchOverlay } from "./SearchOverlay";
import { Shortcuts } from "./Shortcuts";
import { Scrobbler } from "./Scrobbler";
import { LinkDialog } from "./LinkDialog";
import { Sidebar } from "./Sidebar";
import { Toasts } from "./Toasts";
import { Button, Spinner } from "./ui";

export function Shell({ children }: { children: React.ReactNode }) {
  const ready = useApp((s) => s.ready);
  const bootError = useApp((s) => s.bootError);
  const theme = useApp((s) => s.theme);
  const me = useApp((s) => s.me);

  useEffect(() => {
    document.title = theme === "discreet" ? "Mes applications" : "SortSong";
  }, [theme]);

  useEffect(() => {
    useApp.getState().bootstrap();
    usePlayer.getState().init();
  }, []);

  if (!ready) {
    return (
      <div className="grid h-screen place-items-center">
        {bootError ? (
          <div className="text-center">
            <p className="mb-4 text-fg-2">{bootError}</p>
            <Button onClick={() => location.reload()}>Réessayer</Button>
          </div>
        ) : (
          <Spinner className="h-6 w-6" />
        )}
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col">
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          {theme === "discreet" && (
            <header className="hidden h-[52px] shrink-0 items-center gap-3 border-b border-line bg-bg-1 px-5 md:flex">
              <button
                onClick={() => useApp.setState({ searchOpen: true })}
                className="flex h-8 w-72 items-center gap-2 rounded-lg border border-line bg-bg-1 px-3 text-fg-3 hover:border-fg-3"
              >
                <Search className="h-4 w-4" />
                <span className="text-[13px]">Rechercher…</span>
              </button>
              <span className="ml-auto rounded-full border border-line bg-bg-2 px-3 py-1 text-[12px] text-fg-2">Espace de travail · {me?.name || "Mon compte"}</span>
              <span className="relative grid h-8 w-8 place-items-center rounded-lg border border-line text-fg-2">
                <Bell className="h-4 w-4" />
              </span>
              <span className="flex items-center gap-1 text-fg-3">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-accent text-[12px] font-semibold text-white">
                  {(me?.name || "?").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                </span>
                <ChevronDown className="h-4 w-4" />
              </span>
            </header>
          )}
          <div className={theme === "discreet" ? "flex min-h-0 flex-1 md:p-4 md:pb-0" : "flex min-h-0 flex-1"}>
        <main
          id="main-scroll"
          className={
            theme === "discreet"
              ? "relative min-w-0 flex-1 overflow-y-auto border-line bg-bg md:rounded-t-2xl md:border md:border-b-0"
              : "relative min-w-0 flex-1 overflow-y-auto bg-gradient-to-b from-bg-1 to-bg"
          }
        >
          <div>
            <div className="sticky top-0 z-20 flex h-12 items-center gap-2 border-b border-line bg-bg-1/90 px-3 backdrop-blur md:hidden">
              <button onClick={() => useApp.setState({ mobileNav: true })} className="grid h-9 w-9 place-items-center text-fg-2">
                <Menu className="h-5 w-5" />
              </button>
              <span className="font-bold">SortSong</span>
              <button onClick={() => useApp.setState({ searchOpen: true })} className="ml-auto grid h-9 w-9 place-items-center text-fg-2">
                <Search className="h-5 w-5" />
              </button>
            </div>
            {children}
          </div>
        </main>
          </div>
        </div>
        <RightPanel />
      </div>
      <PlayerBar />
      <AddMenu />
      <SearchOverlay />
      <Toasts />
      <Shortcuts />
      <Scrobbler />
      <LinkDialog />
    </div>
  );
}
