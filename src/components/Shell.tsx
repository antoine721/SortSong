"use client";
import { Menu, Search } from "lucide-react";
import { useEffect } from "react";
import { useApp } from "@/store/app";
import { usePlayer } from "@/store/player";
import { AddMenu } from "./AddMenu";
import { PlayerBar } from "./PlayerBar";
import { RightPanel } from "./RightPanel";
import { SearchOverlay } from "./SearchOverlay";
import { Shortcuts } from "./Shortcuts";
import { Sidebar } from "./Sidebar";
import { Toasts } from "./Toasts";
import { Button, Spinner } from "./ui";

export function Shell({ children }: { children: React.ReactNode }) {
  const ready = useApp((s) => s.ready);
  const bootError = useApp((s) => s.bootError);

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
        <main id="main-scroll" className="relative min-w-0 flex-1 overflow-y-auto bg-gradient-to-b from-bg-1 to-bg">
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
        <RightPanel />
      </div>
      <PlayerBar />
      <AddMenu />
      <SearchOverlay />
      <Toasts />
      <Shortcuts />
    </div>
  );
}
