export function fmtDuration(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export function fmtLong(ms: number) {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`;
}

export function fmtDate(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export function plural(n: number, one: string, many = one + "s") {
  return `${n.toLocaleString("fr-FR")} ${n > 1 ? many : one}`;
}

export function normText(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export const PLAYLIST_COLORS = [
  "#7c5cff", "#a855f7", "#ec4899", "#ef4444", "#f97316", "#f59e0b",
  "#eab308", "#84cc16", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6",
];

/** Roue Camelot : compatibilité harmonique. */
export const CAMELOT = Array.from({ length: 12 }, (_, i) => [`${i + 1}A`, `${i + 1}B`]).flat();
export const CAMELOT_MUSICAL: Record<string, string> = {
  "1A": "La♭m", "1B": "Si", "2A": "Mi♭m", "2B": "Fa♯", "3A": "Si♭m", "3B": "Ré♭",
  "4A": "Fam", "4B": "La♭", "5A": "Dom", "5B": "Mi♭", "6A": "Solm", "6B": "Si♭",
  "7A": "Rém", "7B": "Fa", "8A": "Lam", "8B": "Do", "9A": "Mim", "9B": "Sol",
  "10A": "Sim", "10B": "Ré", "11A": "Fa♯m", "11B": "La", "12A": "Do♯m", "12B": "Mi",
};

export function camelotCompat(a?: string | null, b?: string | null): "perfect" | "good" | "bad" | null {
  if (!a || !b) return null;
  const pa = /^(\d+)([AB])$/.exec(a);
  const pb = /^(\d+)([AB])$/.exec(b);
  if (!pa || !pb) return null;
  const na = +pa[1], nb = +pb[1];
  if (a === b) return "perfect";
  const diff = Math.min((na - nb + 12) % 12, (nb - na + 12) % 12);
  if (pa[2] === pb[2] && diff === 1) return "good";
  if (na === nb) return "good";
  if (pa[2] === pb[2] && diff === 2) return "good"; // boost d'énergie (+2)
  return "bad";
}

export const TAG_CATEGORIES: { id: string; label: string }[] = [
  { id: "genre", label: "Genre" },
  { id: "subgenre", label: "Sous-genre" },
  { id: "mood", label: "Ambiance" },
  { id: "moment", label: "Moment du set" },
  { id: "vocal", label: "Vocal / instru" },
];
