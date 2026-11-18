"use client";
import { CheckCircle2, Download, Keyboard, Link2, LogOut, MonitorSpeaker, Play, Radio, Tags, Trash2, XCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ImportLinkButton } from "@/components/common";
import { Button, Cover, Kbd, Spinner, Toggle, cx } from "@/components/ui";
import { api } from "@/lib/client/api";
import { TAG_CATEGORIES, PLAYLIST_COLORS } from "@/lib/client/format";
import { useApp } from "@/store/app";
import { usePlayer } from "@/store/player";

type SpPl = { id: string; name: string; owner: string; image: string | null; total: number | null };

export default function SettingsPage() {
  const me = useApp((s) => s.me);
  const playlists = useApp((s) => s.playlists);
  const tags = useApp((s) => s.tags);
  const folders = useApp((s) => s.folders);
  const p = usePlayer();
  const [spPls, setSpPls] = useState<SpPl[] | null>(null);
  const [importing, setImporting] = useState<string | null>(null);
  const [bpmBusy, setBpmBusy] = useState<string | null>(null);
  const [link, setLink] = useState("");
  const [linkBusy, setLinkBusy] = useState(false);
  const [lfBusy, setLfBusy] = useState<string | null>(null);
  const lfConfigured = useApp((s) => s.config.lastfm);
  const params = useSearchParams();
  const theme = useApp((s) => s.theme);
  const setTheme = useApp((s) => s.setTheme);

  useEffect(() => {
    const st = params.get("lastfm");
    if (st === "ok") useApp.getState().toast("Compte Last.fm connecté");
    if (st === "error") useApp.getState().toast(`Connexion Last.fm refusée : ${params.get("msg") || ""}`, { tone: "err" });
    if (st) history.replaceState(null, "", "/settings");
  }, [params]);

  const addLink = async () => {
    setLinkBusy(true);
    try {
      await useApp.getState().importPlaylistLink(link);
      setLink("");
    } catch (e) {
      useApp.getState().toast((e as Error).message, { tone: "err" });
    } finally {
      setLinkBusy(false);
    }
  };

  const lfImport = async (kind: "loved" | "top") => {
    setLfBusy("Connexion à Last.fm…");
    try {
      const res = await fetch("/api/lastfm/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, max: 500 }) });
      if (!res.body) throw new Error("Pas de réponse");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const l of lines) {
          if (!l.trim()) continue;
          const m = JSON.parse(l);
          if (m.type === "progress") setLfBusy(`${m.step}${m.total ? ` · ${m.done}/${m.total}` : ""}`);
          if (m.type === "error") throw new Error(m.error);
          if (m.type === "done") useApp.getState().toast(`${m.added} titre(s) ajouté(s) à « À trier » (${m.matched}/${m.scanned} trouvés sur Spotify)`);
        }
      }
      await Promise.all([useApp.getState().bootstrap(), useApp.getState().loadLibrary(true)]);
    } catch (e) {
      useApp.getState().toast((e as Error).message, { tone: "err" });
    } finally {
      setLfBusy(null);
    }
  };

  const box = "rounded-2xl border border-line bg-bg-2/50 p-5";
  const h2 = "mb-4 flex items-center gap-2 text-lg font-bold";

  const loadSp = async () => {
    try {
      setSpPls((await api<{ playlists: SpPl[] }>("/api/spotify/playlists")).playlists);
    } catch (e) {
      useApp.getState().toast((e as Error).message, { tone: "err" });
    }
  };

  const importPl = async (pl: SpPl, folderId: string | null) => {
    setImporting(pl.id);
    try {
      const r = await api<{ id: string; count: number }>(`/api/spotify/playlists/${pl.id}/import`, { json: { folderId } });
      await useApp.getState().bootstrap();
      useApp.getState().loadLibrary(true).catch(() => {});
      useApp.getState().toast(`« ${pl.name} » importée (${r.count} titres)`);
    } catch (e) {
      useApp.getState().toast((e as Error).message, { tone: "err" });
    } finally {
      setImporting(null);
    }
  };

  const fetchBpms = async () => {
    setBpmBusy("…");
    try {
      let remaining = 1;
      let done = 0;
      while (remaining > 0 && done < 2000) {
        const r = await api<{ results: Record<string, number | null>; remaining: number }>("/api/tracks/bpm-batch", { json: { limit: 60 } });
        const n = Object.keys(r.results).length;
        if (!n) break;
        done += n;
        remaining = r.remaining;
        setBpmBusy(`${done} traités, ${remaining} restants`);
      }
      await useApp.getState().loadLibrary(true);
      useApp.getState().toast("BPM Deezer récupérés");
    } catch (e) {
      useApp.getState().toast((e as Error).message, { tone: "err" });
    } finally {
      setBpmBusy(null);
    }
  };

  const testPlay = async () => {
    try {
      const r = await api<{ tracks: any[] }>(`/api/search?q=${encodeURIComponent("Daft Punk One More Time")}&type=track`);
      if (r.tracks[0]) usePlayer.getState().playTrack(r.tracks[0]);
    } catch (e) {
      useApp.getState().toast((e as Error).message, { tone: "err" });
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 pb-16 pt-8 md:px-8">
      <h1 className="text-3xl font-extrabold tracking-tight">Réglages</h1>

      <section className={box}>
        <h2 className={h2}>Compte Spotify</h2>
        {me && (
          <div className="flex flex-wrap items-center gap-4">
            <Cover src={me.image} size={56} rounded="rounded-full" />
            <div className="flex-1">
              <div className="font-semibold">{me.name}</div>
              <div className="text-sm text-fg-2">
                {me.product === "premium" ? "Premium" : me.product || "?"} · autorisé le {new Date(me.authorizedAt).toLocaleDateString("fr-FR")} · reconnexion vers le{" "}
                {new Date(new Date(me.authorizedAt).getTime() + 182 * 86400_000).toLocaleDateString("fr-FR")}
              </div>
              {me.product && me.product !== "premium" && <div className="mt-1 text-sm text-amber-300">La lecture nécessite un compte Premium.</div>}
            </div>
            <a href="/api/auth/login"><Button>Se reconnecter</Button></a>
            <Button
              variant="danger"
              onClick={async () => {
                await fetch("/api/auth/logout", { method: "POST" });
                location.href = "/login";
              }}
            >
              <LogOut className="h-4 w-4" /> Déconnexion
            </Button>
          </div>
        )}
      </section>

      <section className={box}>
        <h2 className={h2}>Apparence</h2>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {(["discreet", "dark"] as const).map((t) => (
            <Button key={t} size="sm" variant={theme === t ? "primary" : "secondary"} onClick={() => setTheme(t)}>
              {t === "discreet" ? "Mode discret (portail clair, compact)" : "Thème sombre SortSong"}
            </Button>
          ))}
          <span className="text-fg-3">
            Raccourci <Kbd>Maj</Kbd> + <Kbd>D</Kbd> pour basculer instantanément.
          </span>
        </div>
      </section>

      <section className={box}>
        <h2 className={h2}><MonitorSpeaker className="h-5 w-5 text-accent-2" /> Lecture (test V0)</h2>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            {p.sdkStatus === "ready" ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : p.sdkStatus === "loading" ? <Spinner /> : <XCircle className="h-4 w-4 text-red-400" />}
            <span>
              Lecteur web (Web Playback SDK) :{" "}
              {p.sdkStatus === "ready" ? <b className="text-emerald-300">connecté</b> : p.sdkStatus === "loading" ? "connexion…" : <span className="text-fg-2">{p.sdkError || "indisponible"}</span>}
            </span>
          </div>
          <div className="text-fg-2">
            Mode actuel : <b className="text-fg">{p.mode === "sdk" ? "dans le navigateur" : "Spotify Connect (pilotage de l'appli Spotify)"}</b>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button variant={p.mode === "sdk" ? "primary" : "secondary"} size="sm" onClick={() => p.setMode("sdk")}>Navigateur</Button>
            <Button variant={p.mode === "connect" ? "primary" : "secondary"} size="sm" onClick={() => p.setMode("connect")}>Spotify Connect</Button>
            <Button size="sm" onClick={testPlay}><Play className="h-3.5 w-3.5" /> Tester la lecture</Button>
          </div>
          {p.mode === "connect" && (
            <div className="pt-2">
              <div className="mb-1 text-xs text-fg-3">Appareils disponibles</div>
              <div className="flex flex-wrap gap-2">
                {p.devices.map((d) => (
                  <Button key={d.id} size="sm" variant={p.connectDeviceId === d.id ? "primary" : "secondary"} onClick={() => p.setConnectDevice(d.id)}>
                    {d.name}
                  </Button>
                ))}
                <Button size="sm" variant="ghost" onClick={() => p.refreshDevices()}>Rafraîchir</Button>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className={box}>
        <h2 className={h2}><Keyboard className="h-5 w-5 text-accent-2" /> Touches 1 à 9 (ajout express)</h2>
        <p className="mb-4 text-sm text-fg-2">Pendant l'écoute, appuie sur une touche pour ajouter le morceau en cours à la playlist associée.</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => {
            const cur = playlists.find((x) => x.hotkey === k);
            return (
              <label key={k} className="flex items-center gap-2">
                <Kbd>{k}</Kbd>
                <select
                  value={cur?.id || ""}
                  onChange={(e) => {
                    if (cur) useApp.getState().updatePlaylist(cur.id, { hotkey: null }, { record: false });
                    if (e.target.value) useApp.getState().updatePlaylist(e.target.value, { hotkey: k }, { record: false });
                  }}
                  className="h-9 flex-1 rounded-lg border border-line bg-bg-2 px-2 text-sm outline-none focus:border-accent"
                  style={cur ? { borderColor: cur.color } : undefined}
                >
                  <option value="">—</option>
                  {playlists.filter((x) => !x.rules).map((x) => (
                    <option key={x.id} value={x.id}>{x.name}</option>
                  ))}
                </select>
              </label>
            );
          })}
        </div>
        <div className="mt-5 grid gap-1.5 text-sm text-fg-2 sm:grid-cols-2">
          <span><Kbd>Espace</Kbd> lecture / pause</span>
          <span><Kbd>←</Kbd> <Kbd>→</Kbd> précédent / suivant</span>
          <span><Kbd>Maj ←</Kbd> −10 s · <Kbd>Maj →</Kbd> +30 s</span>
          <span><Kbd>M</Kbd> sauter au milieu (drop)</span>
          <span><Kbd>Ctrl K</Kbd> recherche</span>
          <span><Kbd>Ctrl Z</Kbd> annuler le dernier rangement</span>
          <span><Kbd>Maj D</Kbd> mode discret / thème sombre</span>
        </div>
      </section>

      <section className={box}>
        <h2 className={h2}><Download className="h-5 w-5 text-accent-2" /> Import</h2>
        <p className="mb-4 text-sm text-fg-2">
          Les morceaux s'importent uniquement par lien Spotify (playlist, album ou titre) et arrivent non notés dans « Noter ».
          Tes likes et tes playlists Spotify ne sont jamais importés automatiquement.
        </p>
        <div className="flex flex-wrap items-start gap-4">
          <ImportLinkButton />
          <div className="flex flex-col gap-1">
            <Button variant="secondary" onClick={fetchBpms} disabled={!!bpmBusy}>
              {bpmBusy ? <Spinner /> : null} Récupérer les BPM (Deezer)
            </Button>
            {bpmBusy && <span className="text-xs text-fg-3">{bpmBusy}</span>}
          </div>
        </div>
      </section>

      <section className={box}>
        <h2 className={h2}><Radio className="h-5 w-5 text-[#ff4b45]" /> Last.fm</h2>
        {!lfConfigured ? (
          <div className="flex flex-wrap items-center gap-3 text-sm text-fg-2">
            Pas encore configuré (clé API gratuite).
            <a href="/setup"><Button size="sm" variant="primary">Configurer Last.fm</Button></a>
          </div>
        ) : !me?.lastfm ? (
          <div className="flex flex-wrap items-center gap-3 text-sm text-fg-2">
            <span className="flex-1">Connecte ton compte pour scrobbler tes écoutes et importer tes titres aimés. Les mix utilisent déjà Last.fm.</span>
            <a href="/api/lastfm/login">
              <Button className="!bg-[#d51007] !text-white hover:!bg-[#ee1d14]">Se connecter avec Last.fm</Button>
            </a>
          </div>
        ) : (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center gap-3">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span className="flex-1">
                Connecté en tant que{" "}
                <a href={`https://www.last.fm/user/${me.lastfm.user}`} target="_blank" className="font-semibold text-fg hover:underline">{me.lastfm.user}</a>
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  await api("/api/lastfm/disconnect", { method: "POST" });
                  await useApp.getState().bootstrap();
                }}
              >
                Déconnecter
              </Button>
            </div>
            <Toggle
              checked={me.lastfm.scrobble}
              onChange={async (v) => {
                await api("/api/lastfm/settings", { json: { scrobble: v } });
                useApp.setState({ me: { ...me, lastfm: { ...me.lastfm!, scrobble: v } } });
              }}
              label="Scrobbler ce que j'écoute dans SortSong"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={() => lfImport("loved")} disabled={!!lfBusy}>Importer mes titres aimés ♥ dans « À trier »</Button>
              <Button size="sm" onClick={() => lfImport("top")} disabled={!!lfBusy}>Importer mes 500 titres les plus écoutés</Button>
              {lfBusy && <span className="flex items-center gap-2 text-xs text-fg-3"><Spinner /> {lfBusy}</span>}
            </div>
          </div>
        )}
      </section>

      <section className={box}>
        <h2 className={h2}><Tags className="h-5 w-5 text-accent-2" /> Tags</h2>
        {!tags.length && <p className="text-sm text-fg-3">Crée des tags depuis la fiche d'un morceau (panneau de droite).</p>}
        <div className="space-y-4">
          {TAG_CATEGORIES.map((c) => {
            const list = tags.filter((t) => t.category === c.id);
            if (!list.length) return null;
            return (
              <div key={c.id}>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-fg-3">{c.label}</div>
                <div className="flex flex-wrap gap-2">
                  {list.map((t) => (
                    <span key={t.id} className="group inline-flex h-8 items-center gap-2 rounded-full border border-line pl-1.5 pr-2 text-sm">
                      <select
                        value={t.color}
                        onChange={async (e) => {
                          await api(`/api/tags/${t.id}`, { method: "PATCH", json: { color: e.target.value } });
                          useApp.setState({ tags: useApp.getState().tags.map((x) => (x.id === t.id ? { ...x, color: e.target.value } : x)) });
                        }}
                        className="h-5 w-5 cursor-pointer appearance-none rounded-full text-transparent"
                        style={{ background: t.color }}
                      >
                        {PLAYLIST_COLORS.map((col) => <option key={col} value={col} style={{ background: col }}>{col}</option>)}
                      </select>
                      {t.name}
                      <button
                        onClick={async () => {
                          if (!confirm(`Supprimer le tag « ${t.name} » ?`)) return;
                          await api(`/api/tags/${t.id}`, { method: "DELETE" });
                          useApp.setState({ tags: useApp.getState().tags.filter((x) => x.id !== t.id) });
                        }}
                        className={cx("text-fg-3 hover:text-red-300")}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
