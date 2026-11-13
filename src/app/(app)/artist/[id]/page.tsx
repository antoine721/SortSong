"use client";
import { MicVocal, Sparkles } from "lucide-react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AlbumGrid, ArtistGrid, HideSortedToggle, PageHeader, PlayButtons, SectionTitle, useVisible } from "@/components/common";
import { TrackList } from "@/components/TrackList";
import { Button, Empty, Spinner } from "@/components/ui";
import { api } from "@/lib/client/api";
import type { AlbumDTO, ArtistDTO, TrackDTO } from "@/lib/types";
import { useApp } from "@/store/app";

type R = { artist: ArtistDTO; top: TrackDTO[]; albums: AlbumDTO[]; albumsHasMore: boolean };

export default function ArtistPage() {
  return (
    <Suspense>
      <ArtistInner />
    </Suspense>
  );
}

function ArtistInner() {
  const { id } = useParams<{ id: string }>();
  const name = useSearchParams().get("name") || "";
  const [data, setData] = useState<R | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [related, setRelated] = useState<ArtistDTO[] | null>(null);
  const [moreBusy, setMoreBusy] = useState(false);
  const lib = useApp((s) => s.libTracks);

  useEffect(() => {
    setData(null);
    setRelated(null);
    api<R>(`/api/artist/${id}?name=${encodeURIComponent(name)}`)
      .then((d) => {
        setData(d);
        api<{ artists: ArtistDTO[] }>(`/api/artist/${id}/related?name=${encodeURIComponent(d.artist.name)}`)
          .then((r) => setRelated(r.artists))
          .catch(() => setRelated([]));
      })
      .catch((e) => setErr(e.message));
    useApp.getState().loadLibrary().catch(() => {});
  }, [id, name]);

  const top = useVisible(data?.top || []);
  const inLib = useVisible((lib || []).filter((t) => t.artists.some((a) => a.id === id)));

  if (err) return <Empty icon={<MicVocal />} title="Artiste indisponible">{err}</Empty>;
  if (!data) return <div className="grid h-64 place-items-center"><Spinner /></div>;
  const a = data.artist;

  const more = async () => {
    setMoreBusy(true);
    try {
      const r = await api<{ albums: AlbumDTO[]; hasMore: boolean }>(`/api/artist/${id}/albums?offset=${data.albums.length}`);
      setData({ ...data, albums: [...data.albums, ...r.albums], albumsHasMore: r.hasMore });
    } finally {
      setMoreBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        color="#ec4899"
        cover={a.image}
        coverSize={200}
        roundedCover
        kicker="Artiste"
        title={a.name}
        meta={
          <>
            {a.genres.slice(0, 4).map((g) => (
              <span key={g} className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs">{g}</span>
            ))}
            {a.followers ? <span className="text-fg-3">{a.followers.toLocaleString("fr-FR")} abonnés</span> : null}
          </>
        }
      >
        <PlayButtons tracks={top} label={a.name} />
        {data.top[0] && (
          <Link href={`/mix/${data.top[0].id}`}>
            <Button variant="secondary">
              <Sparkles className="h-4 w-4" /> Mix inspiré de {a.name}
            </Button>
          </Link>
        )}
        <div className="ml-auto">
          <HideSortedToggle />
        </div>
      </PageHeader>
      <div className="px-2 pb-10 md:px-6">
        <div className="px-2">
          <SectionTitle>Titres populaires</SectionTitle>
        </div>
        <TrackList tracks={top} label={`${a.name} · populaires`} showAlbum emptyText="Aucun titre (ou tous déjà rangés)." />

        {inLib.length > 0 && (
          <>
            <div className="px-2">
              <SectionTitle right={<span className="text-sm text-fg-3">{inLib.length}</span>}>Dans ta bibliothèque</SectionTitle>
            </div>
            <TrackList tracks={inLib} label={`${a.name} · bibliothèque`} showAlbum />
          </>
        )}

        <div className="px-2">
          <SectionTitle>Discographie</SectionTitle>
          {data.albums.length ? <AlbumGrid albums={data.albums} /> : <p className="text-sm text-fg-3">Discographie indisponible.</p>}
          {data.albumsHasMore && (
            <Button className="mt-4" onClick={more} disabled={moreBusy}>
              {moreBusy && <Spinner />} Voir plus
            </Button>
          )}

          <SectionTitle>Artistes proches</SectionTitle>
          {related === null ? <Spinner /> : related.length ? <ArtistGrid artists={related} /> : <p className="text-sm text-fg-3">Aucun artiste proche trouvé (Last.fm/Deezer).</p>}
        </div>
      </div>
    </div>
  );
}
