/**
 * Builds the retrieval artifacts from the scheme catalogue.
 *
 *   data/schemes.json  ->  data/chunks.json  +  data/bm25.json
 *
 * The corpus is ~50 schemes, so the whole index is small enough to ship in the
 * Worker bundle and query in memory. Precomputing it here keeps cold-start work
 * at zero and makes ranking reproducible under `node --test`.
 *
 * Run by `pnpm prebuild`; the outputs are committed so dev and typecheck work
 * without a build step.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const K1 = 1.2;
const B = 0.75;

// Deliberately short. An aggressive list hurts a corpus this small, where a
// term like "not" carries real meaning in an exclusion rule.
const STOP = new Set(
  'a an the of for to in on at by and or is are be been being as with from this that these those it its'.split(
    ' ',
  ),
);

export function tokenize(text) {
  return String(text)
    .toLowerCase()
    .split(/[^a-z0-9₹]+/)
    .filter((t) => t.length > 1 && !STOP.has(t));
}

/** Flattens a rule tree into readable text without losing a rule's qualifier. */
function ruleText(node, out = []) {
  if (!node || typeof node !== 'object') return out;
  const branch = node.all || node.any;
  if (Array.isArray(branch)) {
    for (const child of branch) ruleText(child, out);
    return out;
  }
  if (node.label) {
    const value = Array.isArray(node.value) ? node.value.join(', ') : node.value;
    out.push(`${node.label} (${node.field} ${node.op} ${value})`);
  }
  return out;
}

export function chunksFor(scheme) {
  const base = {
    schemeId: scheme.id,
    schemeVersion: scheme.version,
    reviewStatus: scheme.reviewStatus,
    source: scheme.source,
    lang: 'en',
  };
  const parts = [
    ['identity', [scheme.name, scheme.shortName, scheme.category, scheme.ministry, scheme.summary].join('. ')],
    ['eligibility', ruleText(scheme.rules).join(' ')],
    ['benefit', scheme.benefit],
    [
      'documents',
      (scheme.documents || []).map((d) => [d.item, d.note].filter(Boolean).join(' ')).join(' '),
    ],
    [
      'steps',
      (scheme.steps || [])
        .map((x) => [x.title, x.detail, x.where, x.who].filter(Boolean).join(' '))
        .join(' '),
    ],
    ['tags', (scheme.tags || []).join(' ')],
  ];
  return parts
    .filter(([, text]) => text && text.trim())
    .map(([kind, text]) => ({
      id: `${scheme.id}:${kind}:0`,
      kind,
      text: text.trim(),
      ...base,
    }));
}

export function buildIndex(chunks) {
  const postings = {};
  const lengths = [];
  chunks.forEach((chunk, i) => {
    const terms = tokenize(chunk.text);
    lengths.push(terms.length);
    const counts = new Map();
    for (const t of terms) counts.set(t, (counts.get(t) || 0) + 1);
    for (const [term, tf] of counts) {
      (postings[term] ||= []).push([i, tf]);
    }
  });
  return {
    k1: K1,
    b: B,
    total: chunks.length,
    avgdl: lengths.reduce((a, n) => a + n, 0) / (lengths.length || 1),
    lengths,
    postings,
  };
}

/**
 * A chunk whose text is repeated across many schemes describes none of them.
 * Today `steps` is identical for all 50 records and `documents` has two
 * variants — placeholder text, not scheme data. Indexing it dilutes IDF and
 * lets generic queries match everything. This drops those automatically, and
 * un-drops them the moment the catalogue carries real per-scheme text.
 */
export function dropBoilerplate(chunks, threshold = 5) {
  const seen = new Map();
  for (const c of chunks) seen.set(c.text, (seen.get(c.text) || 0) + 1);
  const kept = chunks.filter((c) => seen.get(c.text) <= threshold);
  const dropped = chunks.length - kept.length;
  return { kept, dropped };
}

function main() {
  const raw = readFileSync(join(root, 'data/schemes.json'), 'utf8');
  const schemes = JSON.parse(raw);
  const all = schemes.flatMap(chunksFor);
  const { kept: chunks, dropped } = dropBoilerplate(all);
  const index = buildIndex(chunks);
  const catalogueHash = createHash('sha256').update(raw).digest('hex').slice(0, 16);

  writeFileSync(
    join(root, 'data/chunks.json'),
    JSON.stringify({ catalogueHash, chunks }, null, 0) + '\n',
  );
  writeFileSync(
    join(root, 'data/bm25.json'),
    JSON.stringify({ catalogueHash, ...index }, null, 0) + '\n',
  );

  const terms = Object.keys(index.postings).length;
  console.log(
    `build-index: ${schemes.length} schemes -> ${chunks.length} chunks, ${terms} terms, avgdl ${index.avgdl.toFixed(1)} (catalogue ${catalogueHash})`,
  );
  if (dropped)
    console.log(
      `build-index: dropped ${dropped} boilerplate chunks repeated across schemes — see docs/agent-architecture-plan.md §14`,
    );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
