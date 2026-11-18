"use client";
import { CheckCircle2, Link2, Loader2, X, XCircle } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useApp, type ImportResult } from "@/store/app";
import { Button, Toggle } from "./ui";

/** Import par lien Spotify (playlist, album ou titre) : les morceaux arrivent dans « Noter ». */
export function LinkDialog() {
  const dlg = useApp((s) => s.linkDialog);
  const folders = useApp((s) => s.folders);
  const router = useRouter();
  const pathname = usePathname();
  const [urls, setUrls] = useState("");
  const [createPlaylist, setCreatePlaylist] = useState(false);
  const [folderId, setFolderId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<ImportResult[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  if (!dlg) return null;
  const close = () => {
    useApp.setState({ linkDialog: null });
    setUrls("");
    setErr(null);
    setResults(null);
  };
  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!urls.trim()) return;
    setBusy(true);
    setErr(null);
    setResults(null);
    try {
      const r = await useApp.getState().importLinks(urls, { createPlaylist, folderId: folderId || dlg.folderId || null });
      setResults(r);
      const added = r.reduce((a, x) => a + (x.added || 0), 0);
      if (!r.some((x) => x.error)) {
        useApp.getState().toast(`${added} morceau${added > 1 ? "x" : ""} à noter`);
        close();
        const pl = r.find((x) => x.playlistId)?.playlistId;
        if (pl && r.length === 1) router.push(`/playlist/${pl}`);
        else if (pathname !== "/rate") router.push("/rate");
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-[12vh] backdrop-blur-sm" onMouseDown={close}>
      <form onSubmit={submit} onMouseDown={(e) => e.stopPropagation()} className="fadein w-full max-w-lg space-y-4 rounded-2xl border border-line bg-bg-1 p-6 shadow-soft">
        <div className="flex items-center gap-2">
          <Link2 className="h-5 w-5 text-accent-2" />
          <h2 className="flex-1 text-lg font-bold">Importer depuis Spotify</h2>
          <button type="button" onClick={close} className="text-fg-3 hover:text-fg"><X className="h-5 w-5" /></button>
        </div>
        <p className="text-sm text-fg-2">
          Colle le lien d'une <b className="text-fg">playlist</b>, d'un <b className="text-fg">album</b> ou d'un <b className="text-fg">titre</b> (dans Spotify : ⋯ → Partager → Copier le lien).
          Plusieurs liens : un par ligne. Les morceaux arrivent non notés dans « Noter ».
        </p>
        <textarea
          autoFocus
          rows={3}
          value={urls}
          onChange={(e) => setUrls(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
          }}
          placeholder={"https://open.spotify.com/playlist/…\nhttps://open.spotify.com/album/…"}
          className="w-full resize-none rounded-xl border border-line bg-bg px-3 py-2.5 text-sm outline-none focus:border-accent"
        />
        <div className="flex flex-wrap items-center gap-3">
          <Toggle checked={createPlaylist} onChange={setCreatePlaylist} label="Créer aussi une playlist avec ces titres" />
          {createPlaylist && folders.length > 0 && (
            <select value={folderId || dlg.folderId || ""} onChange={(e) => setFolderId(e.target.value)} className="h-8 rounded-lg border border-line bg-bg-2 px-2 text-xs outline-none">
              <option value="">Racine</option>
              {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          )}
        </div>
        {results && (
          <div className="space-y-1.5 rounded-xl bg-bg-2 p-3 text-sm">
            {results.map((r, i) => (
              <div key={i} className="flex gap-2">
                {r.error ? <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />}
                <div className="min-w-0">
                  <div className="truncate font-medium">{r.name || r.url}</div>
                  <div className="text-xs text-fg-3">
                    {r.error || `${r.added} ajouté(s) · ${r.already} déjà présent(s)${r.skippedDeleted ? ` dont ${r.skippedDeleted} supprimé(s), ignoré(s)` : ""}`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {err && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{err}</div>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={close}>{results ? "Fermer" : "Annuler"}</Button>
          <Button type="submit" variant="primary" disabled={busy || !urls.trim()}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Importer
          </Button>
        </div>
      </form>
    </div>
  );
}
