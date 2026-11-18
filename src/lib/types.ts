export type ArtistRef = { id: string | null; name: string };

/** Morceau tel qu'affiché partout dans l'app (identifié par son ID Spotify). */
export type TrackDTO = {
  id: string; // spotify id
  title: string;
  artists: ArtistRef[];
  album: string;
  albumId: string | null;
  cover: string | null;
  coverSmall: string | null;
  durationMs: number;
  isrc?: string | null;
  bpm?: number | null;
  key?: string | null;
  energy?: number | null;
  explicit?: boolean;
  releaseDate?: string | null;
  addedAt?: string | null; // date d'ajout bibliothèque / playlist
  note?: string | null; // note dans une playlist
  tagIds?: string[];
  status?: "inbox" | "sorted" | "dismissed";
  rating?: number | null; // 1-5, null = non noté
};

export type ArtistDTO = {
  id: string;
  name: string;
  image: string | null;
  genres: string[];
  followers?: number | null;
};

export type AlbumDTO = {
  id: string;
  name: string;
  artists: ArtistRef[];
  cover: string | null;
  coverSmall: string | null;
  releaseDate: string | null;
  totalTracks: number | null;
  albumType: string | null;
};

export type FolderDTO = {
  id: string;
  parentId: string | null;
  name: string;
  position: number;
  collapsed: boolean;
};

export type SmartRules = {
  tagIds?: string[]; // tous requis
  anyTagIds?: string[]; // au moins un
  bpmMin?: number | null;
  bpmMax?: number | null;
  keys?: string[];
  energyMin?: number | null;
  energyMax?: number | null;
  artist?: string | null;
  status?: "inbox" | "sorted" | null;
};

export type PlaylistDTO = {
  id: string;
  folderId: string | null;
  name: string;
  color: string;
  description: string | null;
  position: number;
  hotkey: number | null;
  rules: SmartRules | null;
  count: number;
  durationMs: number;
  spotifyExportId: string | null;
};

export type TagDTO = { id: string; name: string; category: string; color: string };

export type MeDTO = {
  id: string;
  name: string;
  image: string | null;
  product: string | null;
  authorizedAt: string;
  expiresSoon: boolean;
  lastSyncAt: string | null;
  lastfm: { user: string; scrobble: boolean } | null;
};

export type BootstrapDTO = {
  me: MeDTO;
  folders: FolderDTO[];
  playlists: PlaylistDTO[];
  membership: Record<string, string[]>; // spotifyId -> playlistIds
  library: string[]; // spotifyIds de la bibliothèque
  inboxCount: number;
  unratedCount: number;
  tags: TagDTO[];
  config: { lastfm: boolean };
};
