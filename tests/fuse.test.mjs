import test from 'node:test';
import assert from 'node:assert/strict';
import { fuse, RRF_K } from '../lib/retrieval/fuse.ts';

const ids = (r) => r.map((x) => x.id);

test('a document ranked by both lists beats one ranked by either', () => {
  const lexical = [{ id: 'a', score: 9 }, { id: 'b', score: 8 }];
  const dense = [{ id: 'c', score: 0.9 }, { id: 'b', score: 0.8 }];
  // b is second in both; a and c are first in one and absent from the other.
  assert.equal(ids(fuse([lexical, dense]))[0], 'b', 'agreement outranks a single win');
});

test('fusion ignores score scale, which is the point', () => {
  // BM25 scores in the tens, cosine in [0,1]. Normalising them would invent a
  // comparison; rank is the only thing the two rankers agree on.
  const lexical = [{ id: 'a', score: 42 }, { id: 'b', score: 41 }];
  const dense = [{ id: 'b', score: 0.4 }, { id: 'a', score: 0.39 }];
  const scaled = [{ id: 'b', score: 4000 }, { id: 'a', score: 3900 }];
  assert.deepEqual(ids(fuse([lexical, dense])), ids(fuse([lexical, scaled])));
});

test('one empty list leaves the other intact', () => {
  const lexical = [{ id: 'a', score: 9 }, { id: 'b', score: 8 }];
  // This is the Kannada case in reverse: lexical finds nothing, dense carries.
  assert.deepEqual(ids(fuse([[], lexical])), ['a', 'b']);
  assert.deepEqual(ids(fuse([lexical, []])), ['a', 'b']);
});

test('both empty yields nothing rather than throwing', () => {
  assert.deepEqual(fuse([[], []]), []);
});

test('fusion is deterministic, including ties', () => {
  const a = [{ id: 'x', score: 1 }];
  const b = [{ id: 'y', score: 1 }];
  // x and y each rank first in one list, so their scores tie exactly.
  const first = fuse([a, b]);
  const second = fuse([a, b]);
  assert.deepEqual(first, second);
  assert.deepEqual(ids(first), ['x', 'y'], 'ties resolve by id, never by chance');
});

test('k damps the top so one first place cannot dominate', () => {
  const dense = [{ id: 'top', score: 1 }];
  const lexical = [
    { id: 'a', score: 9 },
    { id: 'b', score: 8 },
    { id: 'top', score: 1 },
  ];
  const fused = fuse([lexical, dense]);
  assert.equal(fused[0].id, 'top', 'first in one list plus third in the other wins');
  // But not by an unbounded margin.
  assert.ok(fused[0].score < 2 / RRF_K, 'contributions stay bounded by k');
});

test('a single list passes through in order', () => {
  const only = [{ id: 'a', score: 3 }, { id: 'b', score: 2 }, { id: 'c', score: 1 }];
  assert.deepEqual(ids(fuse([only])), ['a', 'b', 'c']);
});
