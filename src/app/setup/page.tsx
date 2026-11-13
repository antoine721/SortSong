"use client";
import { Check, Copy, Disc3, ExternalLink, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

type Status = {
  origin: string;
  spotifyRedirectUri: string;
  lastfmCallback: string;
  hasSpotify: boolean;
  hasLastfm: boolean;
  hasLastfmSecret: boolean;
  spotifyClientId: string | null;
  lastfmApiKey: string | null;
  locked: { spotifyClientId: boolean; lastfmApiKey: boolean; lastfmSecret: boolean };
  editable: boolean;
  isLocalhost: boolean;
};

function CopyField({ value }: { value: string }) {
  const [ok, setOk] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-lg border border-line bg-bg px-3 py-2 font-mono text-[13px]">
      <span className="min-w-0 flex-1 truncate text-emerald-300">{value}</span>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(value);
          setOk(true);
          setTimeout(() => setOk(false), 1500);
        }}
        className="shrink-0 text-fg-2 hover:text-fg"
        title="Copier"
      >
        {ok ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );
}

/** Configuration sans fichier .env : Client ID Spotify + clé et secret Last.fm, saisis dans l'app. */
export default function SetupPage() {
  const [st, setSt] = useState<Status | null>(null);
  const [spotify, setSpotify] = useState("");
  const [lfKey, setLfKey] = useState("");
  const [lfSecret, setLfSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (location.hostname === "localhost") {
      // Spotify refuse localhost : on travaille sur 127.0.0.1 pour que l'adresse de retour corresponde.
      location.replace(location.href.replace("//localhost", "//127.0.0.1"));
      return;
    }
    fetch("/api/setup")
      .then((r) => r.json())
      .then((s: Status) => {
        setSt(s);
        setSpotify(s.spotifyClientId || "");
        setLfKey(s.lastfmApiKey || "");
      });
  }, []);

  const save = async (then: "spotify" | "lastfm" | "stay") => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(st?.locked.spotifyClientId ? {} : { spotifyClientId: spotify }),
          ...(st?.locked.lastfmApiKey ? {} : { lastfmApiKey: lfKey }),
          ...(st?.locked.lastfmSecret || !lfSecret ? {} : { lastfmSecret: lfSecret }),
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Erreur");
      if (then === "spotify") location.href = "/api/auth/login";
      else if (then === "lastfm") location.href = "/api/lastfm/login";
      else location.reload();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };

  if (!st) return <div className="grid h-screen place-items-center"><Loader2 className="h-6 w-6 animate-spin text-fg-3" /></div>;

  const input = "h-11 w-full rounded-xl border border-line bg-bg px-3 font-mono text-sm outline-none focus:border-accent disabled:opacity-60";
  const step = "grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent text-xs font-bold text-white";

  return (
    <main className="h-screen overflow-y-auto bg-bg">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(124,92,255,0.2),transparent_60%)]" />
      <div className="relative mx-auto max-w-2xl space-y-6 px-4 py-10">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-accent text-white"><Disc3 className="h-6 w-6" /></div>
          <div>
            <h1 className="text-2xl font-bold">Configuration</h1>
            <p className="text-sm text-fg-2">À faire une seule fois · tout est enregistré dans l'app, pas besoin de fichier .env</p>
          </div>
        </div>

        {!st.editable && (
          <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-200">
            Déjà configuré. <a href="/login" className="underline">Connecte-toi</a> pour modifier ces réglages.
          </div>
        )}

        {/* Spotify */}
        <section className="space-y-4 rounded-2xl border border-line bg-bg-1/80 p-6 backdrop-blur">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold">Spotify</h2>
            {st.hasSpotify && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">configuré</span>}
          </div>
          <ol className="space-y-4 text-sm text-fg-2">
            <li className="flex gap-3">
              <span className={step}>1</span>
              <div className="flex-1">
                Ouvre le{" "}
                <a href="https://developer.spotify.com/dashboard/create" target="_blank" className="inline-flex items-center gap-1 text-accent-2 underline">
                  tableau de bord Spotify <ExternalLink className="h-3 w-3" />
                </a>{" "}
                et crée une app (nom libre). Coche <b className="text-fg">Web API</b> et <b className="text-fg">Web Playback SDK</b>.
              </div>
            </li>
            <li className="flex gap-3">
              <span className={step}>2</span>
              <div className="min-w-0 flex-1 space-y-2">
                <div>Dans <b className="text-fg">Redirect URIs</b>, colle exactement cette adresse :</div>
                <CopyField value={st.spotifyRedirectUri} />
              </div>
            </li>
            <li className="flex gap-3">
              <span className={step}>3</span>
              <div className="flex-1">
                Dans <b className="text-fg">Settings → User Management</b>, ajoute l'e-mail de ton compte Spotify (obligatoire en mode développement).
              </div>
            </li>
            <li className="flex gap-3">
              <span className={step}>4</span>
              <div className="flex-1 space-y-2">
                <div>Copie le <b className="text-fg">Client ID</b> de l'app ici :</div>
                <input
                  className={input}
                  value={st.locked.spotifyClientId ? "défini par variable d'environnement" : spotify}
                  disabled={st.locked.spotifyClientId || !st.editable}
                  onChange={(e) => setSpotify(e.target.value)}
                  placeholder="32 caractères, ex. 1a2b3c…"
                />
              </div>
            </li>
          </ol>
          <button
            disabled={busy || !st.editable || (!st.locked.spotifyClientId && !spotify.trim())}
            onClick={() => save("spotify")}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-[#1ed760] px-5 py-3 font-semibold text-black transition hover:bg-[#3be477] disabled:opacity-40"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Enregistrer et se connecter avec Spotify
          </button>
        </section>

        {/* Last.fm */}
        <section className="space-y-4 rounded-2xl border border-line bg-bg-1/80 p-6 backdrop-blur">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold">Last.fm</h2>
            <span className="text-xs text-fg-3">facultatif · mix bien meilleurs, scrobbling, import de tes titres aimés</span>
            {st.hasLastfm && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">configuré</span>}
          </div>
          <ol className="space-y-4 text-sm text-fg-2">
            <li className="flex gap-3">
              <span className={step}>1</span>
              <div className="min-w-0 flex-1 space-y-2">
                <div>
                  Crée une clé API gratuite sur{" "}
                  <a href="https://www.last.fm/api/account/create" target="_blank" className="inline-flex items-center gap-1 text-accent-2 underline">
                    last.fm/api/account/create <ExternalLink className="h-3 w-3" />
                  </a>
                  . Dans <b className="text-fg">Callback URL</b>, mets :
                </div>
                <CopyField value={st.lastfmCallback} />
              </div>
            </li>
            <li className="flex gap-3">
              <span className={step}>2</span>
              <div className="flex-1 space-y-2">
                <div>Copie la <b className="text-fg">API key</b> et le <b className="text-fg">Shared secret</b> :</div>
                <input
                  className={input}
                  value={st.locked.lastfmApiKey ? "défini par variable d'environnement" : lfKey}
                  disabled={st.locked.lastfmApiKey || !st.editable}
                  onChange={(e) => setLfKey(e.target.value)}
                  placeholder="API key"
                />
                <input
                  className={input}
                  type="password"
                  value={st.locked.lastfmSecret ? "défini par variable d'environnement" : lfSecret}
                  disabled={st.locked.lastfmSecret || !st.editable}
                  onChange={(e) => setLfSecret(e.target.value)}
                  placeholder={st.hasLastfmSecret ? "Shared secret (déjà enregistré — laisser vide pour le garder)" : "Shared secret"}
                />
              </div>
            </li>
          </ol>
          <div className="flex flex-wrap gap-2">
            <button
              disabled={busy || !st.editable || !st.hasSpotify && !spotify.trim()}
              onClick={() => save(st.hasSpotify ? "lastfm" : "spotify")}
              className="flex items-center gap-2 rounded-full bg-[#d51007] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#ee1d14] disabled:opacity-40"
            >
              {st.hasSpotify ? "Enregistrer et se connecter avec Last.fm" : "Enregistrer (connexion Last.fm après Spotify)"}
            </button>
            <button disabled={busy || !st.editable} onClick={() => save("stay")} className="rounded-full bg-bg-3 px-5 py-2.5 text-sm font-semibold hover:bg-bg-4 disabled:opacity-40">
              Enregistrer seulement
            </button>
          </div>
        </section>

        {err && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{err}</div>}
        <p className="text-center text-xs text-fg-3">
          Adresse de cette instance : {st.origin} · <a href="/" className="underline">retour à l'app</a>
        </p>
      </div>
    </main>
  );
}
