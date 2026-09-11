/**
 * Embeds the chunk corpus and upserts it to Pinecone.
 *
 * Run after any change to data/schemes.json, because a vector written from a
 * superseded record is worse than no vector: retrieval would rank a scheme by
 * text that no longer describes it. The Worker drops mismatched versions at
 * query time as a backstop, but a stale index silently narrows what a citizen
 * can find, so re-run this rather than relying on the backstop.
 *
 * Requires, in .dev.vars or .env:
 *   LLM_BASE_URL, LLM_API_KEY, EMBEDDING_MODEL   (any OpenAI-compatible)
 *   PINECONE_API_KEY, PINECONE_INDEX_HOST
 *
 * Run: pnpm build:vectors
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const NAMESPACE = 'schemes-v1';
const BATCH = 32;

const need = (name) => {
  const v = (process.env[name] ?? '').trim();
  if (!v) {
    console.error(`\nMissing ${name}. See .dev.vars.example.\n`);
    process.exit(1);
  }
  return v;
};

async function embedBatch(texts) {
  const base = need('LLM_BASE_URL').replace(/\/+$/, '');
  const url = /\/v\d+$/.test(base) ? `${base}/embeddings` : `${base}/v1/embeddings`;
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${need('LLM_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: need('EMBEDDING_MODEL'), input: texts }),
    signal: AbortSignal.timeout(120000),
  });
  if (!r.ok) throw new Error(`embeddings ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const body = await r.json();
  return body.data.map((d) => d.embedding);
}

async function upsert(vectors) {
  const host = need('PINECONE_INDEX_HOST').replace(/\/+$/, '');
  const r = await fetch(`${host}/vectors/upsert`, {
    method: 'POST',
    headers: {
      'Api-Key': need('PINECONE_API_KEY'),
      'Content-Type': 'application/json',
      'X-Pinecone-API-Version': '2025-04',
    },
    body: JSON.stringify({ namespace: NAMESPACE, vectors }),
    signal: AbortSignal.timeout(120000),
  });
  if (!r.ok) throw new Error(`upsert ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return (await r.json()).upsertedCount ?? vectors.length;
}

async function main() {
  const { chunks, catalogueHash } = JSON.parse(
    readFileSync(join(root, 'data/chunks.json'), 'utf8'),
  );
  console.log(`${chunks.length} chunks from catalogue ${catalogueHash}`);

  let sent = 0;
  let dimensions = 0;
  for (let i = 0; i < chunks.length; i += BATCH) {
    const slice = chunks.slice(i, i + BATCH);
    const vectors = await embedBatch(slice.map((c) => c.text));
    dimensions ||= vectors[0].length;

    sent += await upsert(
      slice.map((c, n) => ({
        id: c.id,
        values: vectors[n],
        // Carried so a query can be checked against the live catalogue, and
        // so a stale generation is identifiable without re-reading the index.
        metadata: {
          scheme_id: c.schemeId,
          version: c.schemeVersion,
          review_status: c.reviewStatus,
          kind: c.kind,
          catalogue: catalogueHash,
        },
      })),
    );
    process.stdout.write(`  upserted ${sent}/${chunks.length}\r`);
  }

  console.log(`\nDone: ${sent} vectors, ${dimensions} dimensions, namespace ${NAMESPACE}`);
  console.log(
    'The index must be created with the same dimension count and the cosine metric.',
  );
}

main().catch((e) => {
  console.error('\n' + e.message + '\n');
  process.exit(1);
});
