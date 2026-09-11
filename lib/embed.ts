import { conf, external } from './http';

/**
 * Turns text into a vector using the configured provider.
 *
 * Deliberately shares the chat provider's credentials and base URL: an
 * OpenAI-compatible endpoint serves both, so a single key configures the
 * whole product. Only the model differs, and it is named separately because
 * an embedding model must never change without re-embedding the corpus — a
 * query vector from one model and document vectors from another produce
 * confident nonsense.
 */
export type EmbeddingConfig = {
  url: string;
  headers: Record<string, string>;
  model: string;
};

export function embedding(): EmbeddingConfig | null {
  const baseUrl = conf('LLM_BASE_URL');
  const apiKey = conf('LLM_API_KEY');
  const model = conf('EMBEDDING_MODEL');
  if (!baseUrl || !apiKey || !model) return null;

  const base = baseUrl.replace(/\/+$/, '');
  return {
    url: /\/v\d+$/.test(base) ? `${base}/embeddings` : `${base}/v1/embeddings`,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    model,
  };
}

/** Embeds one query. Returns null when embeddings are not configured. */
export async function embed(text: string): Promise<number[] | null> {
  const config = embedding();
  if (!config) return null;
  const r = await external(config.url, {
    method: 'POST',
    headers: config.headers,
    body: JSON.stringify({ model: config.model, input: text }),
  });
  const body = (await r.json()) as { data: { embedding: number[] }[] };
  return body.data?.[0]?.embedding ?? null;
}
