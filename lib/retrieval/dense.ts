import { conf, external } from '../http';
import { embed, embedding } from '../embed';
import type { Ranked } from './fuse';

/**
 * Dense retrieval against Pinecone.
 *
 * This exists because lexical retrieval is blind outside Latin script: the
 * tokenizer keeps [a-z0-9], so a Hindi or Kannada query produces no terms and
 * matches nothing. BM25 remains the base for English, where it is strong and
 * costs no network call; the dense path is what makes the other two languages
 * work at all.
 */
export function denseConfigured() {
  return !!(conf('PINECONE_API_KEY') && conf('PINECONE_INDEX_HOST') && embedding());
}

type Match = {
  id: string;
  score: number;
  metadata?: Record<string, unknown>;
};

/**
 * Returns chunk ids ranked by similarity, or null when dense retrieval is
 * unavailable. Null rather than an empty list: "not configured" and "nothing
 * matched" are different, and only the second should narrow the results.
 */
export async function denseSearch(
  query: string,
  topK = 20,
): Promise<Ranked[] | null> {
  const apiKey = conf('PINECONE_API_KEY');
  const host = conf('PINECONE_INDEX_HOST');
  if (!apiKey || !host) return null;

  const vector = await embed(query);
  if (!vector) return null;

  const r = await external(`${host.replace(/\/+$/, '')}/query`, {
    method: 'POST',
    headers: {
      'Api-Key': apiKey,
      'Content-Type': 'application/json',
      'X-Pinecone-API-Version': '2025-04',
    },
    body: JSON.stringify({
      vector,
      topK,
      includeMetadata: true,
      namespace: NAMESPACE,
      // Tag chunks are bare keyword bags. They are a lexical affordance —
      // strong for BM25's exact matching, actively harmful here, because a
      // short list of keywords embeds into a generic region where every
      // scheme looks mildly similar. Measured: with tags included, the top
      // results for a Kannada query were six tag chunks scoring 0.45-0.50,
      // a band too narrow to rank anything.
      filter: { kind: { $ne: 'tags' } },
    }),
  });

  const body = (await r.json()) as { matches?: Match[] };
  return (body.matches ?? []).map((m) => ({ id: m.id, score: m.score }));
}

/** One namespace per corpus generation, so a re-embed cannot mix vectors. */
export const NAMESPACE = 'schemes-v1';
