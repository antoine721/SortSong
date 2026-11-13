/** Normalisation pour comparer des titres/artistes provenant de sources différentes. */
export function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s*[\(\[][^\)\]]*(feat|ft\.|with|remaster|version|edit|mix|radio)[^\)\]]*[\)\]]/g, (m) =>
      /remix|mix\)|dub|vip|extended|club/i.test(m) ? m : "",
    )
    .replace(/\s+-\s+(\d{4}\s+)?remaster(ed)?.*$/g, "")
    .replace(/\b(feat|ft)\.?\s.*$/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function bigrams(s: string): Map<string, number> {
  const m = new Map<string, number>();
  const t = ` ${s} `;
  for (let i = 0; i < t.length - 1; i++) {
    const g = t.slice(i, i + 2);
    m.set(g, (m.get(g) || 0) + 1);
  }
  return m;
}

/** Similarité de Dice sur bigrammes (0..1). */
export function similarity(a: string, b: string): number {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const A = bigrams(x);
  const B = bigrams(y);
  let inter = 0;
  let total = 0;
  for (const [g, c] of A) {
    total += c;
    inter += Math.min(c, B.get(g) || 0);
  }
  for (const c of B.values()) total += c;
  return (2 * inter) / total;
}
