"use client";
import { Album, Ban, ExternalLink, Trash2, Info, ListEnd, ListPlus, MicVocal, MinusCircle, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import type { TrackDTO } from "@/lib/types";
import { useApp } from "@/store/app";
import { usePlayer } from "@/store/player";
import { MenuItem, Popover } from "./ui";

export function TrackMenu({
  track,
  anchor,
  onClose,
  playlistId,
}: {
  track: TrackDTO;
  anchor: DOMRect | { x: number; y: number };
  onClose: () => void;
  playlistId?: string;
}) {
  const router = useRouter();
  const inLib = useApp((s) => s.library.has(track.id));
  const status = useApp((s) => s.libTracks?.find((t) => t.id === track.id)?.status);
  const playlistName = useApp((s) => s.playlists.find((p) => p.id === playlistId && !p.rules)?.name);
  const go = (href: string) => {
    onClose();
    router.push(href);
  };
  const run = (fn: () => void) => () => {
    onClose();
    fn();
  };
  return (
    <Popover anchor={anchor} onClose={onClose} width={250}>
      <MenuItem icon={<Sparkles />} onClick={() => go(`/mix/${track.id}`)}>
        Mix inspiré de ce titre
      </MenuItem>
      <MenuItem icon={<ListPlus />} onClick={run(() => usePlayer.getState().playNext(track))}>
        Lire ensuite
      </MenuItem>
      <MenuItem icon={<ListEnd />} onClick={run(() => usePlayer.getState().addToQueueEnd(track))}>
        Ajouter à la file
      </MenuItem>
      <div className="my-1 h-px bg-line" />
      {track.artists
        .filter((a) => a.id)
        .slice(0, 3)
        .map((a) => (
          <MenuItem key={a.id} icon={<MicVocal />} onClick={() => go(`/artist/${a.id}?name=${encodeURIComponent(a.name)}`)}>
            Voir l'artiste · {a.name}
          </MenuItem>
        ))}
      {track.albumId && (
        <MenuItem icon={<Album />} onClick={() => go(`/album/${track.albumId}`)}>
          Voir l'album
        </MenuItem>
      )}
      <MenuItem icon={<Info />} onClick={run(() => useApp.getState().openTrack(track))}>
        Fiche du morceau (BPM, tags…)
      </MenuItem>
      <div className="my-1 h-px bg-line" />
      {playlistName && (
        <MenuItem icon={<MinusCircle />} onClick={run(() => useApp.getState().removeFromPlaylists(track, [playlistId!]))}>
          Retirer de « {playlistName} »
        </MenuItem>
      )}
      {(!inLib || status === "dismissed") && (
        <MenuItem icon={<ListPlus />} onClick={run(() => useApp.getState().setStatus([track], "inbox"))}>
          Mettre dans « À trier »
        </MenuItem>
      )}
      {inLib && status === "inbox" && (
        <MenuItem icon={<Ban />} onClick={run(() => useApp.getState().setStatus([track], "dismissed"))}>
          Écarter de « À trier »
        </MenuItem>
      )}
      <MenuItem icon={<ExternalLink />} onClick={run(() => window.open(`https://open.spotify.com/track/${track.id}`, "_blank"))}>
        Ouvrir dans Spotify
      </MenuItem>
      {inLib && (
        <>
          <div className="my-1 h-px bg-line" />
          <MenuItem icon={<Trash2 />} danger onClick={run(() => useApp.getState().deleteTracks([track]))}>
            Supprimer de la bibliothèque
          </MenuItem>
        </>
      )}
    </Popover>
  );
}
