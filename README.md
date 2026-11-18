# SortSong — surcouche Spotify pour DJ

Application web personnelle branchée sur Spotify : **écouter, ranger, retrouver et découvrir** des morceaux.
Spotify sert de catalogue et de lecteur ; les playlists, dossiers et tags vivent dans la base locale de l'app.
Rien n'est écrit dans Spotify, sauf l'export volontaire d'une playlist (bouton « Exporter vers Spotify »).

## Démarrage

Prérequis : Node 20+, un compte **Spotify Premium**.

```bash
npm install
npm run dev
```

Ouvre **http://127.0.0.1:3000** : l'écran **Configuration** te guide pas à pas (rien à éditer à la main).
1. **Spotify** : crée une app sur le tableau de bord développeur, colle l'adresse de retour affichée,
   ajoute ton compte dans *User Management*, colle le Client ID → « Enregistrer et se connecter avec Spotify ».
2. **Last.fm** (facultatif, conseillé) : crée une clé API, colle la *Callback URL* affichée, la clé et le shared secret
   → « Se connecter avec Last.fm ». Tu peux alors scrobbler tes écoutes et importer tes titres aimés (Réglages).

La base de données (SQLite) est créée et mise à jour automatiquement à chaque lancement.

## Mettre l'app en ligne

1. Crée une base Postgres gratuite (Neon, Supabase…) et récupère son URL `postgres://…`.
2. Déploie le dépôt sur Vercel (ou tout hébergeur Node) avec la variable `DATABASE_URL` = cette URL
   (le build bascule tout seul sur Postgres et crée les tables).
3. Ouvre `https://ton-app…/setup` : l'adresse de retour Spotify et la Callback URL Last.fm affichées sont celles du site en ligne ;
   déclare-les dans Spotify / Last.fm (tu peux garder aussi celles en 127.0.0.1 pour le local).

Sécurité : l'écran de configuration n'est modifiable que tant que Spotify n'est pas configuré, puis uniquement une fois connecté.
Note Vercel : l'import d'une très grosse bibliothèque peut dépasser la durée maximale d'une fonction sur l'offre gratuite ;
relance « Resynchroniser », l'import reprend là où il s'est arrêté.

## Importer et noter

- **Import par lien Spotify ou Deezer** : bouton « Importer un lien » (barre latérale). Colle un ou plusieurs liens de
  playlist, d'album ou de titre (un par ligne), y compris les liens courts de partage Deezer. Les titres Deezer sont retrouvés
  sur Spotify par ISRC, sinon par titre + artiste + durée ; les titres douteux sont ignorés et comptés « introuvables »
  (la playlist Deezer doit être publique). Les morceaux arrivent **non notés** ; tes likes et tes playlists Spotify ne sont
  jamais importés automatiquement. Option : créer aussi une playlist interne avec ces titres.
- **Noter** : un morceau à la fois en carrousel. Par défaut, **extraits de 30 s** (catalogue public Deezer) joués directement dans la page, sans l'appli Spotify, avec les 3 morceaux suivants préchargés : le passage au suivant est instantané. Sans extrait disponible, repli automatique sur Spotify. Mode « Morceau complet » : lecture Spotify à partir de 0:30 (ou du milieu avec « Démarrer au drop »).

  | Touche | Action |
  | --- | --- |
  | 1 … 5 (rangée du haut ou pavé numérique) | Noter et passer au suivant |
  | 0 | Ne m'intéresse pas : supprimer et passer au suivant |
  | ← | Revenir au morceau précédent (renoter ; une note sur un morceau supprimé le restaure) |
  | → | Passer sans noter |

- **Énergie** : notée en étoiles de 1 à 5 dans la fiche du morceau ; filtres « note » et « énergie » dans la Bibliothèque.
- **Retirer d'une playlist** : icône ⊖ au survol. **Supprimer de la bibliothèque** : corbeille au survol, menu ⋯ ou touche 0
  dans « Noter » (Ctrl+Z pour annuler). Un morceau supprimé n'est pas réimporté par un nouveau lien.

## Ce qui est livré

| Lot | Contenu |
| --- | --- |
| **V0** | Connexion OAuth PKCE, lecteur Web Playback SDK avec **repli automatique sur Spotify Connect** (pilotage de l'appli Spotify ouverte), diagnostic dans Réglages → « Tester la lecture » |
| **V1** | Import par lien Spotify (playlist, album, titre), boîte **À trier** avec compteur, mode liste et mode « un par un » (A5) ; lecteur fixe, file d'attente, drop / +30 s / −10 s, raccourcis (B1-B5) ; playlists, couleurs, dossiers imbriqués en glisser-déposer, menu « + » à cocher, touches 1-9, anti-doublon (C1-C6) ; badges partout + détail au survol + filtre « masquer les déjà rangés » (D1-D3) ; recherche Ctrl+K bibliothèque + catalogue avec « voir plus », pages artiste et album, filtres et tri de bibliothèque (E1, E2, E4, E5, E7) ; covers partout (G1) |
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
