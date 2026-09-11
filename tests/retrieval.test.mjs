import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { chunksFor, buildIndex, dropBoilerplate, tokenize } from '../scripts/build-index.mjs';

const schemes = JSON.parse(readFileSync(new URL('../data/schemes.json', import.meta.url), 'utf8'));
const chunks = JSON.parse(readFileSync(new URL('../data/chunks.json', import.meta.url), 'utf8'));
const index = JSON.parse(readFileSync(new URL('../data/bm25.json', import.meta.url), 'utf8'));

const STOP = new Set(
  'a an the of for to in on at by and or is are be been being as with from this that these those it its'.split(' '),
);

/** Mirrors lib/retrieval/bm25.ts so ranking is testable without the Worker. */
function search(query, limit = 20) {
  const terms = String(query).toLowerCase().split(/[^a-z0-9₹]+/).filter((t) => t.length > 1 && !STOP.has(t));
  const scores = new Map();
  for (const term of terms) {
    const posting = index.postings[term];
    if (!posting) continue;
    const idf = Math.log(1 + (index.total - posting.length + 0.5) / (posting.length + 0.5));
    for (const [doc, tf] of posting) {
      const norm = (tf * (index.k1 + 1)) / (tf + index.k1 * (1 - index.b + (index.b * index.lengths[doc]) / index.avgdl));
      scores.set(doc, (scores.get(doc) || 0) + idf * norm);
    }
  }
  return [...scores]
    .map(([doc, score]) => ({ doc, score }))
    .sort((a, b) => b.score - a.score || a.doc - b.doc)
    .slice(0, limit);
}

const topSchemes = (query, n = 3) => {
  const seen = [];
  for (const { doc } of search(query)) {
    const id = chunks.chunks[doc].schemeId;
    if (!seen.includes(id)) seen.push(id);
    if (seen.length === n) break;
  }
  return seen;
};

test('index is built from the shipped catalogue', () => {
  assert.equal(chunks.catalogueHash, index.catalogueHash, 'chunks and postings disagree — rerun pnpm prebuild');
  assert.equal(index.total, chunks.chunks.length);
  assert.equal(index.lengths.length, chunks.chunks.length);
});

test('every chunk resolves to a live scheme at its own version', () => {
  for (const c of chunks.chunks) {
    const scheme = schemes.find((s) => s.id === c.schemeId);
    assert.ok(scheme, `chunk ${c.id} has no scheme`);
    assert.equal(c.schemeVersion, scheme.version, `chunk ${c.id} is a stale version`);
    assert.equal(c.source, scheme.source);
  }
});

test('boilerplate is dropped, but authored steps survive', () => {
  const all = schemes.flatMap(chunksFor);
  const { kept, dropped } = dropBoilerplate(all);
  assert.ok(dropped > 0, 'the placeholder steps and documents should be dropped');
  assert.equal(kept.length, chunks.chunks.length);

  // A scheme left on the placeholder text contributes no step chunk...
  const placeholder = schemes.find((x) => !x.authoredFor);
  assert.ok(
    !kept.some((c) => c.schemeId === placeholder.id && c.kind === 'steps'),
    'unauthored steps are identical across schemes and must not be indexed',
  );

  // ...while a scheme with real authored steps does.
  const authored = schemes.find((x) => x.authoredFor === 'demo');
  assert.ok(authored, 'expected at least one authored scheme');
  assert.ok(
    kept.some((c) => c.schemeId === authored.id && c.kind === 'steps'),
    'authored steps carry real content and must be retrievable',
  );
});

test('tokenizer drops stopwords and single characters', () => {
  assert.deepEqual(tokenize('I farm  two acres, in the Kolar!'), ['farm', 'two', 'acres', 'kolar']);
});

test('a farming query ranks the farmer schemes first', () => {
  const top = topSchemes('I farm two acres and need income support');
  assert.ok(top.includes('pm-kisan'), `expected pm-kisan in ${top.join(', ')}`);
});

test('a query naming a scheme retrieves that scheme', () => {
  for (const id of ['pm-kisan', 'pmfby']) {
    const scheme = schemes.find((s) => s.id === id);
    const top = topSchemes(scheme.shortName + ' ' + scheme.name, 1);
    assert.equal(top[0], id, `${scheme.shortName} did not retrieve itself`);
  }
});

test('an unrelated query returns nothing rather than everything', () => {
  assert.equal(search('zzzz qqqq').length, 0);
});

test('scoring is deterministic and ordered', () => {
  const a = search('farmer land income');
  const b = search('farmer land income');
  assert.deepEqual(a, b);
  for (let i = 1; i < a.length; i++) assert.ok(a[i - 1].score >= a[i].score);
});

test('rebuilding from the catalogue reproduces the shipped index', () => {
  const rebuilt = buildIndex(dropBoilerplate(schemes.flatMap(chunksFor)).kept);
  assert.equal(rebuilt.total, index.total);
  assert.deepEqual(Object.keys(rebuilt.postings).sort(), Object.keys(index.postings).sort());
});
