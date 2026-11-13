"use client";
import { Search as SearchIcon } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { AlbumGrid, ArtistGrid, HideSortedToggle, SectionTitle, useVisible } from "@/components/common";
import { TrackList } from "@/components/TrackList";
import { Button, Empty, Spinner } from "@/components/ui";
import { api } from "@/lib/client/api";
import { searchLibrary } from "@/lib/client/librarySearch";
import type { AlbumDTO, ArtistDTO, TrackDTO } from "@/lib/types";
import { useApp } from "@/store/app";

type R = { tracks: TrackDTO[]; artists: ArtistDTO[]; albums: AlbumDTO[]; hasMore: { tracks: boolean; artists: boolean; albums: boolean } };

export default function SearchPage() {
  return (
    <Suspense>
      <SearchInner />
    </Suspense>
  );
}

function SearchInner() {
  const params = useSearchParams();
  const router = useRouter();
  const q = params.get("q") || "";
  const [input, setInput] = useState(q);
  const lib = useApp((s) => s.libTracks);
  const [res, setRes] = useState<R | null>(null);
  const [loading, setLoading] = useState(false);
  const [more, setMore] = useState<Record<string, boolean>>({});

  useEffect(() => setInput(q), [q]);
  useEffect(() => {
    useApp.getState().loadLibrary().catch(() => {});
  }, []);
  useEffect(() => {
    if (!q.trim()) return setRes(null);
    setLoading(true);
    api<R>(`/api/search?q=${encodeURIComponent(q)}`)
      .then(setRes)
      .catch((e) => useApp.getState().toast(e.message, { tone: "err" }))
      .finally(() => setLoading(false));
  }, [q]);

  const local = useMemo(() => (q.trim() && lib ? searchLibrary(lib, q, 200) : []), [q, lib]);
  const visibleLocal = useVisible(local);
  const visibleRemote = useVisible(res?.tracks || []);

  /** Pagination « voir plus » (10 résultats max par requête). */
  const loadMore = async (type: "track" | "artist" | "album") => {
    if (!res) return;
    const key = type + "s";
    setMore((m) => ({ ...m, [key]: true }));
    try {
      const offset = (res as any)[key].length;
      const r = await api<R>(`/api/search?q=${encodeURIComponent(q)}&type=${type}&offset=${offset}`);
      setRes({ ...res, [key]: [...(res as any)[key], ...(r as any)[key]], hasMore: { ...res.hasMore, [key]: (r.hasMore as any)[key] } });
    } finally {
      setMore((m) => ({ ...m, [key]: false }));
    }
  };

  return (
    <div className="px-4 pb-10 pt-6 md:px-8">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          router.push(`/search?q=${encodeURIComponent(input)}`);
        }}
        className="relative max-w-xl"
      >
        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-fg-3" />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          autoFocus
          placeholder="Que veux-tu écouter ?"
          className="h-12 w-full rounded-full border border-line bg-bg-2 pl-12 pr-4 text-[15px] outline-none focus:border-accent"
        />
      </form>
      <div className="mt-4">
        <HideSortedToggle />
      </div>
      {!q && <Empty icon={<SearchIcon />} title="Recherche">Tape un titre, un artiste ou un album. Astuce : Ctrl+K partout.</Empty>}
      {q && (
        <>
          <SectionTitle right={<span className="text-sm text-fg-3">{visibleLocal.length} résultat(s)</span>}>Dans ta bibliothèque</SectionTitle>
          <TrackList tracks={visibleLocal.slice(0, 50)} label={`Bibliothèque « ${q} »`} showAlbum emptyText="Rien dans ta bibliothèque." />
          <SectionTitle right={loading && <Spinner />}>Titres · catalogue Spotify</SectionTitle>
          {res && (
            <>
              <TrackList tracks={visibleRemote} label={`Recherche « ${q} »`} showAlbum emptyText={res.tracks.length ? "Tous les résultats sont déjà rangés." : "Aucun titre."} />
              {res.hasMore.tracks && (
                <Button className="mt-3" onClick={() => loadMore("track")} disabled={more.tracks}>
                  {more.tracks ? <Spinner /> : null} Voir plus de titres
                </Button>
              )}
            </>
          )}
          {res && res.artists.length > 0 && (
            <>
              <SectionTitle>Artistes</SectionTitle>
              <ArtistGrid artists={res.artists} />
              {res.hasMore.artists && (
                <Button className="mt-3" onClick={() => loadMore("artist")} disabled={more.artists}>
                  Voir plus d'artistes
                </Button>
              )}
            </>
          )}
          {res && res.albums.length > 0 && (
            <>
              <SectionTitle>Albums</SectionTitle>
              <AlbumGrid albums={res.albums} />
              {res.hasMore.albums && (
                <Button className="mt-3" onClick={() => loadMore("album")} disabled={more.albums}>
                  Voir plus d'albums
                </Button>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
