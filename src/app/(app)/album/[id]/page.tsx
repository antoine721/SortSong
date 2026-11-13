"use client";
import { Disc } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { HideSortedToggle, PageHeader, PlayButtons, useVisible } from "@/components/common";
import { TrackList } from "@/components/TrackList";
import { Empty, Spinner } from "@/components/ui";
import { api } from "@/lib/client/api";
import { fmtLong, plural } from "@/lib/client/format";
import type { AlbumDTO, TrackDTO } from "@/lib/types";

/** E4 : page album — grande cover, titres avec badges. */
export default function AlbumPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{ album: AlbumDTO & { label?: string | null }; tracks: TrackDTO[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    setData(null);
    api(`/api/album/${id}`).then(setData).catch((e) => setErr(e.message));
  }, [id]);
  const tracks = useVisible(data?.tracks || []);
  if (err) return <Empty icon={<Disc />} title="Album indisponible">{err}</Empty>;
  if (!data) return <div className="grid h-64 place-items-center"><Spinner /></div>;
  const a = data.album;
  return (
    <div>
      <PageHeader
        color="#14b8a6"
        cover={a.cover}
        coverSize={300}
        kicker={a.albumType === "single" ? "Single" : a.albumType === "compilation" ? "Compilation" : "Album"}
        title={a.name}
        meta={
          <>
            {a.artists.map((x, i) => (
              <span key={i} className="font-semibold text-fg">
                {x.id ? <Link href={`/artist/${x.id}?name=${encodeURIComponent(x.name)}`} className="hover:underline">{x.name}</Link> : x.name}
              </span>
            ))}
            <span>· {a.releaseDate?.slice(0, 4)}</span>
            <span>· {plural(data.tracks.length, "titre")}</span>
            <span>· {fmtLong(data.tracks.reduce((s, t) => s + t.durationMs, 0))}</span>
            {a.label && <span className="text-fg-3">· {a.label}</span>}
          </>
        }
      >
        <PlayButtons tracks={tracks} label={a.name} />
        <div className="ml-auto">
          <HideSortedToggle />
        </div>
      </PageHeader>
      <div className="px-2 pb-10 md:px-6">
        <TrackList tracks={tracks} label={a.name} showIndex emptyText="Tous les titres sont déjà rangés." />
      </div>
    </div>
  );
}
