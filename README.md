# SortSong — surcouche Spotify pour DJ

Application web personnelle branchée sur Spotify : **écouter, ranger, retrouver et découvrir** des morceaux.
Spotify sert de catalogue et de lecteur ; les playlists, dossiers et tags vivent dans la base locale de l'app.
Rien n'est écrit dans Spotify, sauf l'export volontaire d'une playlist (bouton « Exporter vers Spotify »).

## Démarrage

Prérequis : Node 20+, un compte **Spotify Premium**.

1. Crée une app sur <https://developer.spotify.com/dashboard> :
   - *Redirect URI* : `http://127.0.0.1:3000/api/auth/callback` (localhost est refusé par Spotify) ;
   - coche **Web API** et **Web Playback SDK** ;
   - dans *User Management*, ajoute ton compte (5 comptes max en mode développement).
2. Configure l'environnement :
   ```bash
   cp .env.example .env
   # remplis SPOTIFY_CLIENT_ID, APP_SECRET (openssl rand -hex 32) et, conseillé, LASTFM_API_KEY
   ```
3. Installe et lance :
   ```bash
   npm install
   npx prisma db push
   npm run dev
   ```
4. Ouvre **http://127.0.0.1:3000** (pas `localhost`, sinon le cookie de connexion ne suit pas) et connecte-toi.

La clé Last.fm (gratuite : <https://www.last.fm/api/account/create>) améliore beaucoup « Mix inspiré de » et les artistes proches.
Sans elle, l'app utilise uniquement le catalogue public Deezer.

## Ce qui est livré

| Lot | Contenu |
| --- | --- |
| **V0** | Connexion OAuth PKCE, lecteur Web Playback SDK avec **repli automatique sur Spotify Connect** (pilotage de l'appli Spotify ouverte), diagnostic dans Réglages → « Tester la lecture » |
| **V1** | Import likes + playlists (A2), import d'une playlist Spotify en playlist interne (A3), resynchronisation incrémentale (A4), boîte **À trier** avec compteur, mode liste et mode « un par un » (A5) ; lecteur fixe, file d'attente, drop / +30 s / −10 s, raccourcis (B1-B5) ; playlists, couleurs, dossiers imbriqués en glisser-déposer, menu « + » à cocher, touches 1-9, anti-doublon (C1-C6) ; badges partout + détail au survol + filtre « masquer les déjà rangés » (D1-D3) ; recherche Ctrl+K bibliothèque + catalogue avec « voir plus », pages artiste et album, filtres et tri de bibliothèque (E1, E2, E4, E5, E7) ; covers partout (G1) |
| **V2** | Mix inspiré de (Last.fm + radio Deezer + artistes proches, correspondance ISRC puis titre/artiste avec score), filtres BPM ±4 % et déjà rangés, sauvegarde en playlist (F1-F5) ; réordonner et annoter (C7) ; états « non rangé » vs « jamais vu » (D4) ; artistes proches (E3) ; filtres BPM / tonalité / énergie / tags (E6) ; BPM Deezer + saisie manuelle + tap tempo, tonalité Camelot, tags par catégorie (G2-G4) |
| **V3** | Playlists intelligentes à règles (C8), export vers Spotify (C9), constructeur de setlist (courbes BPM / énergie, qualité des transitions harmoniques, « Optimiser l'enchaînement »), interface responsive mobile |

Critères transverses : liste virtualisée (2 000+ titres fluides), toutes les actions de rangement annulables (Ctrl+Z ou bouton « Annuler »), aucune écriture Spotify sans clic explicite.

## Raccourcis

| Touche | Action |
| --- | --- |
| Espace | Lecture / pause |
| ← / → | Précédent / suivant |
| Maj+← / Maj+→ | −10 s / +30 s |
| M | Sauter au milieu (le drop) |
| 1 … 9 | Ajouter le morceau en cours à la playlist liée |
| Ctrl+K | Recherche |
| Ctrl+Z | Annuler le dernier rangement |

Autres gestes : double-clic sur une ligne = lire à partir de ce titre ; glisser une ligne sur une playlist de la barre latérale = l'y ajouter ;
double-clic sur une playlist/dossier de la barre latérale = renommer ; clic droit sur un titre = menu.

## Architecture

- Next.js 15 (App Router) + TypeScript + Tailwind CSS ; état client Zustand ; listes virtualisées (`@tanstack/react-virtual`).
- Routes API Next.js : échange de jetons Spotify (chiffrés AES-256-GCM en base), appels Last.fm / Deezer côté serveur.
- SQLite + Prisma (`prisma/schema.prisma`) — passage à Postgres en changeant `provider` et `DATABASE_URL`.
- Badges : au démarrage le client charge la table `spotify_id → playlists` ; chaque morceau affiché est comparé en mémoire (aucune requête).
- Statut « À trier » recalculé à chaque ajout / retrait (rangé dès qu'il entre dans une playlist, revient à trier s'il n'est plus dans aucune).
- Limites Spotify : recherche à 10 résultats (pagination « voir plus »), attente automatique sur 429, caches (mix 7 jours, artistes, morceaux).
  Les endpoints retirés en mode développement (titres populaires d'un artiste, recommandations…) sont compensés par Deezer / Last.fm.
