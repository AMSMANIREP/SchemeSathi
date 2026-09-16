import corpus from '../../data/chunks.json';
import { catalogueHash, search as lexical } from './bm25';
import { denseConfigured, denseSearch } from './dense';
import { fuse, type Ranked } from './fuse';
import type { Scheme } from '../types';

export type Chunk = {
  id: string;
  kind: 'identity' | 'eligibility' | 'benefit' | 'documents' | 'steps' | 'tags';
  text: string;
  schemeId: string;
  schemeVersion: string;
  reviewStatus: 'DRAFT' | 'VERIFIED';
  source: string;
  lang: string;
};

export type Candidate = {
  schemeId: string;
  score: number;
  chunks: { id: string; kind: Chunk['kind']; text: string }[];
};

export const chunks = corpus.chunks as Chunk[];

/** 'hybrid' once an embedding model and a vector index are both configured. */
export function retrievalMode(): 'lexical' | 'hybrid' {
  return denseConfigured() ? 'hybrid' : 'lexical';
}

/** True when the shipped index was built from the shipped catalogue. */
export function indexMatches(hash: string) {
  return catalogueHash === hash;
}

/**
 * Narrows the catalogue to a candidate set. This never decides eligibility —
 * callers pass the result through evaluateScheme(), and it is that status
 * which reaches the citizen.
 */
export async function retrieve(
  query: string,
  live: Scheme[],
  maxSchemes = 8,
): Promise<Candidate[]> {
  const lexicalRanked: Ranked[] = lexical(query, 20).map(({ doc, score }) => ({
    id: chunks[doc]?.id ?? String(doc),
    score,
  }));

  let ranked = lexicalRanked;

  if (denseConfigured()) {
    try {
      const dense = await denseSearch(query, 20);
      // A dense outage must never empty a citizen's results. Lexical alone is
      // a worse answer in Kannada, not a broken one, so degrade rather than
      // fail the turn.
      if (dense) ranked = fuse([lexicalRanked, dense]);
    } catch (error) {
      // Degrade, but never silently: a dense retriever that quietly stops
      // working looks exactly like a corpus that has nothing to say, and in
      // Hindi or Kannada the difference is every result versus none.
      console.log(
        JSON.stringify({
          event: 'dense_retrieval_failed',
          cause: error instanceof Error ? error.message : String(error),
        }),
      );
      ranked = lexicalRanked;
    }
  }

  return group(ranked, live, maxSchemes);
}

/**
 * Collapses ranked chunks into schemes, dropping anything that no longer
 * matches the live catalogue at the same version.
 */
function group(ranked: Ranked[], live: Scheme[], maxSchemes: number) {
  const byId = new Map(chunks.map((c) => [c.id, c]));
  const byScheme = new Map<string, Candidate>();

  for (const { id, score } of ranked) {
    const chunk = byId.get(id);
    if (!chunk) continue;

    // Every retrieval must match scheme_id + version against the live
    // catalogue. A vector written from a superseded record is dropped rather
    // than shown against current rules — the index can outlive a deploy.
    const scheme = live.find((s) => s.id === chunk.schemeId);
    if (!scheme || scheme.version !== chunk.schemeVersion) continue;

    const existing = byScheme.get(chunk.schemeId);
    if (existing) {
      // A scheme ranks on its best evidence, not on how many of its chunks
      // scraped into the top results. Summing rewards breadth over depth —
      // and with fused ranks, where every contribution is roughly 1/60, it
      // degenerates into counting chunks rather than measuring relevance.
      existing.score = Math.max(existing.score, score);
      if (existing.chunks.length < 5)
        existing.chunks.push({ id: chunk.id, kind: chunk.kind, text: chunk.text });
    } else {
      byScheme.set(chunk.schemeId, {
        schemeId: chunk.schemeId,
        score,
        chunks: [{ id: chunk.id, kind: chunk.kind, text: chunk.text }],
      });
    }
  }

  return [...byScheme.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSchemes);
}
