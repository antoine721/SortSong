"use client";
import { RefreshCw, Save, Sparkles } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { HideSortedToggle, PageHeader, PlayButtons } from "@/components/common";
import { TrackList } from "@/components/TrackList";
import { Button, Empty, Spinner, Toggle } from "@/components/ui";
import { api } from "@/lib/client/api";
import { fmtLong, plural } from "@/lib/client/format";
import type { TrackDTO } from "@/lib/types";
import { useApp } from "@/store/app";

/** Module F : « Mix inspiré de » un morceau (Last.fm + Deezer, retrouvés sur Spotify). */
export default function MixPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<{ seed: TrackDTO; tracks: TrackDTO[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [bpmNear, setBpmNear] = useState(false);
  const [target, setTarget] = useState<string>("");
  const hide = useApp((s) => s.hideSorted);
  const membership = useApp((s) => s.membership);
  const meta = useApp((s) => s.meta);
  const lastfm = useApp((s) => s.config.lastfm);

  const load = async (refresh = false) => {
    setLoading(true);
    setErr(null);
    try {
      const d = await api<{ seed: TrackDTO; tracks: TrackDTO[] }>(`/api/mix/${id}${refresh ? "?refresh=1" : ""}`);
      setData(d);
      if (d.seed.bpm) setTarget(String(Math.round(d.seed.bpm)));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    setData(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const seedBpm = Number(target) || 0;
  const visible = useMemo(() => {
    let list = data?.tracks || [];
    if (hide) list = list.filter((t) => !membership[t.id]?.length);
    if (bpmNear && seedBpm) {
      list = list.filter((t) => {
        const b = meta[t.id]?.bpm ?? t.bpm;
        if (!b) return false;
        // ±4 %, en tolérant le demi/double tempo
        return [b, b * 2, b / 2].some((x) => Math.abs(x - seedBpm) / seedBpm <= 0.04);
      });
    }
    return list;
  }, [data, hide, bpmNear, seedBpm, membership, meta]);

  const save = async () => {
    if (!data) return;
    const app = useApp.getState();
    const pid = await app.createPlaylist({ name: `Mix · ${data.seed.title}` });
    await api("/api/membership", { json: { add: visible.map((track, position) => ({ playlistId: pid, track, position })) } });
    await app.bootstrap();
    app.toast(`Mix sauvegardé (${visible.length} titres)`);
    router.push(`/playlist/${pid}`);
  };

  if (err) return <Empty icon={<Sparkles />} title="Mix indisponible">{err}</Empty>;
  const seed = data?.seed;

  return (
    <div>
      <PageHeader
        color="#f59e0b"
        cover={seed?.cover ?? null}
        coverSize={200}
        kicker={<span className="flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Mix inspiré de</span>}
        title={seed?.title || "…"}
        description={seed ? seed.artists.map((a) => a.name).join(", ") : undefined}
        meta={
          data && (
            <>
              <span>{plural(visible.length, "titre")}</span>
              {visible.length !== data.tracks.length && <span className="text-fg-3">sur {data.tracks.length}</span>}
              <span>· {fmtLong(visible.reduce((s, t) => s + t.durationMs, 0))}</span>
              <span className="text-fg-3">· sources : {lastfm ? "Last.fm + " : ""}Deezer → Spotify</span>
            </>
          )
        }
      >
        <PlayButtons tracks={visible} label={`Mix · ${seed?.title || ""}`} />
        <Button onClick={save} disabled={!visible.length}>
          <Save className="h-4 w-4" /> Sauvegarder en playlist
        </Button>
        <Button variant="ghost" onClick={() => load(true)} disabled={loading}>
          <RefreshCw className="h-4 w-4" /> Régénérer
        </Button>
        <div className="ml-auto flex flex-wrap items-center gap-4">
          <HideSortedToggle />
          <Toggle checked={bpmNear} onChange={setBpmNear} label="BPM proche (±4 %)" />
          {bpmNear && (
            <input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="BPM"
              className="h-8 w-16 rounded-full border border-line bg-bg-2 text-center text-xs outline-none focus:border-accent"
            />
          )}
        </div>
      </PageHeader>
      <div className="px-2 pb-10 md:px-6">
        {loading && !data ? (
          <div className="flex flex-col items-center gap-3 py-20 text-sm text-fg-2">
            <Spinner className="h-6 w-6" />
            Recherche de titres proches (Last.fm, Deezer) et correspondance sur Spotify…
            <span className="text-xs text-fg-3">10 à 20 secondes la première fois, puis en cache 7 jours.</span>
          </div>
        ) : data && data.tracks.length === 0 ? (
          <Empty icon={<Sparkles />} title="Aucun titre proche trouvé">
            {lastfm ? "Essaie avec un autre morceau." : "Ajoute une clé LASTFM_API_KEY dans .env pour de bien meilleurs résultats."}
          </Empty>
        ) : (
          <TrackList tracks={visible} label={`Mix · ${seed?.title}`} showAlbum emptyText="Aucun titre avec ces filtres (BPM manquant ou tout est déjà rangé)." />
        )}
      </div>
    </div>
  );
}
