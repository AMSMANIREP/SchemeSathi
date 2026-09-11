import corpus from '../../data/chunks.json';
import { catalogueHash, search as lexical } from './bm25';
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

/**
 * Lexical only for now. The dense path (Vectorize + Workers AI) lands in a
 * later phase; when it does, this reports 'hybrid' and the two rankers are
 * combined by reciprocal rank fusion.
 */
export function retrievalMode(): 'lexical' | 'hybrid' {
  return 'lexical';
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
export function retrieve(
  query: string,
  live: Scheme[],
  maxSchemes = 8,
): Candidate[] {
  const hits = lexical(query, 20);
  const byScheme = new Map<string, Candidate>();

  for (const { doc, score } of hits) {
    const chunk = chunks[doc];
    if (!chunk) continue;

    // Every retrieval must match scheme_id + version against the live
    // catalogue. A chunk built from a superseded record is dropped rather
    // than shown against current rules.
    const scheme = live.find((s) => s.id === chunk.schemeId);
    if (!scheme || scheme.version !== chunk.schemeVersion) continue;

    const existing = byScheme.get(chunk.schemeId);
    if (existing) {
      existing.score += score;
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
