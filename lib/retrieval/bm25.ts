import index from '../../data/bm25.json';

export type Scored = { doc: number; score: number };

const STOP = new Set(
  'a an the of for to in on at by and or is are be been being as with from this that these those it its'.split(
    ' ',
  ),
);

/** Must stay identical to `tokenize` in scripts/build-index.mjs. */
export function tokenize(text: string): string[] {
  return String(text)
    .toLowerCase()
    .split(/[^a-z0-9₹]+/)
    .filter((t) => t.length > 1 && !STOP.has(t));
}

const postings = index.postings as unknown as Record<string, [number, number][]>;

/**
 * Okapi BM25 over the prebuilt postings. Nothing is computed at cold start
 * beyond the JSON parse the runtime does for the import.
 */
export function search(query: string, limit = 20): Scored[] {
  const terms = tokenize(query);
  if (!terms.length) return [];

  const scores = new Map<number, number>();
  for (const term of terms) {
    const posting = postings[term];
    if (!posting) continue;
    // Standard IDF with the +1 that keeps a term appearing in every document
    // from scoring negative.
    const idf = Math.log(
      1 + (index.total - posting.length + 0.5) / (posting.length + 0.5),
    );
    for (const [doc, tf] of posting) {
      const norm =
        tf * (index.k1 + 1) /
        (tf +
          index.k1 * (1 - index.b + (index.b * index.lengths[doc]) / index.avgdl));
      scores.set(doc, (scores.get(doc) || 0) + idf * norm);
    }
  }

  return [...scores]
    .map(([doc, score]) => ({ doc, score }))
    .sort((a, b) => b.score - a.score || a.doc - b.doc)
    .slice(0, limit);
}

export const catalogueHash = index.catalogueHash as string;
