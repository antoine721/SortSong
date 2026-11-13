import { Disc3, FolderTree, Search, Sparkles, Tags } from "lucide-react";

const ERRORS: Record<string, string> = {
  config: "SPOTIFY_CLIENT_ID est absent du fichier .env.",
  state: "La connexion a expiré, recommence.",
  access_denied: "Autorisation refusée sur Spotify.",
  not_allowed: "Ce compte n'est pas autorisé : ajoute-le dans le tableau de bord développeur Spotify (User Management).",
  token: "Échange du jeton refusé. Vérifie l'adresse de retour (http://127.0.0.1:3000/api/auth/callback).",
  profile: "Impossible de lire ton profil Spotify.",
  expired: "Ta session Spotify a expiré (6 mois) : reconnecte-toi, tes playlists et dossiers sont intacts.",
};

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-auto bg-bg p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(124,92,255,0.25),transparent_60%)]" />
      <div className="relative w-full max-w-md rounded-3xl border border-line bg-bg-1/80 p-8 shadow-soft backdrop-blur">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-accent text-white shadow-[0_0_30px_rgba(124,92,255,0.6)]">
            <Disc3 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">SortSong</h1>
            <p className="text-sm text-fg-2">Ton Spotify, rangé comme un DJ.</p>
          </div>
        </div>
        <ul className="mb-7 space-y-2.5 text-sm text-fg-2">
          <li className="flex gap-2.5"><FolderTree className="h-4 w-4 shrink-0 text-accent-2" /> Playlists et dossiers imbriqués, stockés dans l'app (rien n'est écrit dans Spotify).</li>
          <li className="flex gap-2.5"><Tags className="h-4 w-4 shrink-0 text-accent-2" /> Un badge sur chaque morceau : tu vois tout de suite s'il est déjà rangé.</li>
          <li className="flex gap-2.5"><Search className="h-4 w-4 shrink-0 text-accent-2" /> Recherche instantanée dans ta bibliothèque et le catalogue.</li>
          <li className="flex gap-2.5"><Sparkles className="h-4 w-4 shrink-0 text-accent-2" /> « Mix inspiré de » via Last.fm et Deezer, BPM et tonalité.</li>
        </ul>
        {error && <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{ERRORS[error] || `Erreur : ${error}`}</div>}
        <a
          href="/api/auth/login"
          className="flex w-full items-center justify-center gap-2 rounded-full bg-[#1ed760] px-5 py-3 font-semibold text-black transition hover:scale-[1.02] hover:bg-[#3be477]"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden><path d="M12 0a12 12 0 1 0 0 24 12 12 0 0 0 0-24Zm5.5 17.3a.75.75 0 0 1-1 .25c-2.86-1.75-6.46-2.14-10.7-1.17a.75.75 0 1 1-.33-1.46c4.64-1.06 8.62-.6 11.8 1.35.36.22.47.68.24 1.03Zm1.47-3.27a.94.94 0 0 1-1.29.31c-3.27-2-8.26-2.6-12.13-1.42a.94.94 0 1 1-.55-1.8c4.42-1.34 9.92-.69 13.66 1.61.44.27.58.85.31 1.3Zm.13-3.4C15.18 8.3 8.73 8.08 5 9.21a1.13 1.13 0 1 1-.65-2.16c4.28-1.3 11.4-1.05 15.9 1.62a1.13 1.13 0 0 1-1.15 1.95Z" /></svg>
          Se connecter avec Spotify
        </a>
        <p className="mt-4 text-center text-xs text-fg-3">Compte Premium requis · session conservée 6 mois</p>
      </div>
    </main>
  );
}
