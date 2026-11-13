"use client";
import { Link2, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/store/app";
import { Button } from "./ui";

/** Ajouter une playlist en collant son lien Spotify. */
export function LinkDialog() {
  const dlg = useApp((s) => s.linkDialog);
  const folders = useApp((s) => s.folders);
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [folderId, setFolderId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!dlg) return null;
  const close = () => {
    useApp.setState({ linkDialog: null });
    setUrl("");
    setErr(null);
  };
  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!url.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const id = await useApp.getState().importPlaylistLink(url, folderId || dlg.folderId || null);
      close();
      router.push(`/playlist/${id}`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-[15vh] backdrop-blur-sm" onMouseDown={close}>
      <form onSubmit={submit} onMouseDown={(e) => e.stopPropagation()} className="fadein w-full max-w-lg space-y-4 rounded-2xl border border-line bg-bg-1 p-6 shadow-soft">
        <div className="flex items-center gap-2">
          <Link2 className="h-5 w-5 text-accent-2" />
          <h2 className="flex-1 text-lg font-bold">Ajouter une playlist depuis un lien</h2>
          <button type="button" onClick={close} className="text-fg-3 hover:text-fg"><X className="h-5 w-5" /></button>
        </div>
        <p className="text-sm text-fg-2">
          Dans Spotify : <b className="text-fg">⋯ → Partager → Copier le lien de la playlist</b>, puis colle-le ici. Une copie est créée dans l'app (la playlist Spotify n'est pas modifiée).
        </p>
        <input
          autoFocus
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onPaste={(e) => {
            const v = e.clipboardData.getData("text");
            if (/open\.spotify\.com\/.*playlist\//.test(v)) setTimeout(() => setUrl(v.trim()), 0);
          }}
          placeholder="https://open.spotify.com/playlist/…"
          className="h-11 w-full rounded-xl border border-line bg-bg px-3 text-sm outline-none focus:border-accent"
        />
        {folders.length > 0 && (
          <label className="flex items-center gap-2 text-sm text-fg-2">
            Ranger dans
            <select value={folderId || dlg.folderId || ""} onChange={(e) => setFolderId(e.target.value)} className="h-9 flex-1 rounded-lg border border-line bg-bg-2 px-2 text-sm outline-none">
              <option value="">Racine</option>
              {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </label>
        )}
        {err && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{err}</div>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={close}>Annuler</Button>
          <Button type="submit" variant="primary" disabled={busy || !url.trim()}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Ajouter la playlist
          </Button>
        </div>
      </form>
    </div>
  );
}
