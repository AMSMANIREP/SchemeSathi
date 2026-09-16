/**
 * Reciprocal rank fusion.
 *
 * Combines two rankings by position rather than score, because a BM25 score
 * and a cosine similarity are not on the same scale and normalising them
 * invents a comparison that does not exist. Rank is the only thing the two
 * agree on.
 *
 * k damps the top of each list: without it a single first place dominates
 * everything, which makes fusion pointless. 60 is the value the original
 * paper uses and it behaves well on short lists.
 */
export const RRF_K = 60;

export type Ranked = { id: string; score: number };

export function fuse(lists: Ranked[][], k = RRF_K): Ranked[] {
  const totals = new Map<string, number>();
  for (const list of lists)
    list.forEach((entry, index) => {
      totals.set(entry.id, (totals.get(entry.id) ?? 0) + 1 / (k + index + 1));
    });

  return [...totals]
    .map(([id, score]) => ({ id, score }))
    // Ties resolve by id so fusion is deterministic — two runs of the same
    // query must not reorder cards under a citizen.
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}
