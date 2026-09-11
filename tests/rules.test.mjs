import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  evaluateScheme,
  evaluateTree,
  validateProfile,
  redact,
} from '../lib/rules.ts';
const { scheme, cases } = JSON.parse(
  fs.readFileSync(new URL('./rule-cases.json', import.meta.url), 'utf8'),
);
const now = new Date('2026-09-06T12:00:00Z');
for (const c of cases)
  test('eligibility regression ' + c.id, () =>
    assert.equal(
      evaluateScheme(
        { ...scheme, reviewStatus: c.reviewed ? 'VERIFIED' : 'DRAFT' },
        c.profile,
        c.confirmed,
        now,
      ).status,
      c.expected,
    ),
  );
for (const patch of [
  { complete: false },
  { sourceCheckedAt: null },
  { sourceCheckedAt: '2025-01-01' },
  { sourceCheckedAt: '2027-01-01' },
  { sourceCheckedAt: 'bad' },
  { rules: { all: [] } },
])
  test('incomplete/stale source ' + JSON.stringify(patch), () =>
    assert.equal(
      evaluateScheme(
        { ...scheme, ...patch },
        { age: 30, gender: 'female', lpg: 'no' },
        ['age', 'gender', 'lpg'],
        now,
      ).status,
      'UNABLE_TO_DETERMINE',
    ),
  );
test('nested OR + UNKNOWN truth table', () => {
  const a = scheme.rules.all[0],
    b = scheme.rules.all[1];
  assert.equal(
    evaluateTree({ any: [a, b] }, { age: 19 }, ['age']).result,
    'PASS',
  );
  assert.equal(
    evaluateTree({ any: [a, b] }, { age: 10 }, ['age']).result,
    'UNKNOWN',
  );
  assert.equal(
    evaluateTree({ all: [a, b] }, { age: 10 }, ['age']).result,
    'FAIL',
  );
});
test('malformed and out-of-range profiles rejected', () => {
  for (const p of [
    { age: -1 },
    { age: 121 },
    { age: 17.5 },
    { income: '1000' },
    { state: 'Atlantis' },
    { aadhaar: '1234' },
    { age: Infinity },
    [],
    null,
  ])
    assert.throws(() => validateProfile(p));
});
test('explicit unknown and numeric boundaries retained', () =>
  assert.deepEqual(
    validateProfile({ age: 0, income: 0, disability: 100, gender: null }),
    { age: 0, income: 0, disability: 100, gender: null },
  ));
test('sensitive identifiers masked', () => {
  const output = redact(
    'A 1234 5678 9012 PAN ABCDE1234F email test@example.com',
  );
  assert.equal(output, 'A [redacted] PAN [redacted] email [redacted]');
});
test('catalogue exactly 50 unique official references and no fabricated approval', () => {
  const all = JSON.parse(
    fs.readFileSync(new URL('../data/schemes.json', import.meta.url), 'utf8'),
  );
  assert.equal(all.length, 50);
  assert.equal(new Set(all.map((x) => x.id)).size, 50);
  for (const s of all) {
    assert.equal(new URL(s.source).protocol, 'https:');
    // A record may only leave DRAFT by being authored for the demo, and it
    // must say so. This is the guarantee that matters: nothing is ever
    // silently promoted to VERIFIED without the marker the UI surfaces.
    if (s.reviewStatus === 'DRAFT') {
      assert.equal(s.complete, false, s.id + ' is draft but marked complete');
    } else {
      assert.equal(s.reviewStatus, 'VERIFIED', s.id);
      assert.equal(
        s.authoredFor,
        'demo',
        s.id + ' is VERIFIED without the demo marker — it claims a review that did not happen',
      );
    }
    // The marker never appears on a record that was left alone.
    if (s.authoredFor) assert.equal(s.reviewStatus, 'VERIFIED', s.id);
  }
});

test('every demo-authored step carries an office, a person and a wait', () => {
  const all = JSON.parse(
    fs.readFileSync(new URL('../data/schemes.json', import.meta.url), 'utf8'),
  );
  for (const s of all.filter((x) => x.authoredFor === 'demo')) {
    assert.ok(s.steps.length > 0, s.id + ' has no steps');
    assert.ok(s.rules.all?.length > 0, s.id + ' is VERIFIED with no rules');
    for (const step of s.steps) {
      assert.ok(step.title, s.id + ' has an untitled step');
      assert.ok(step.where, s.id + ': "' + step.title + '" has no where');
      assert.ok(step.who, s.id + ': "' + step.title + '" has no who');
      assert.ok(step.typicalWait, s.id + ': "' + step.title + '" has no wait');
    }
  }
});
