import test from 'node:test';
import assert from 'node:assert/strict';
import { personaliseSteps, personaliseDocuments } from '../lib/steps.ts';
import { evaluateScheme } from '../lib/rules.ts';

const rule = (id, field, op, value) => ({
  id,
  field,
  op,
  value,
  label: `${field} must be established`,
  source: 'https://example.gov.in/',
});

const step = (title, extra = {}) => ({
  title,
  detail: '',
  where: 'District office',
  who: 'Revenue clerk',
  typicalWait: '2 weeks',
  relatesTo: [],
  ...extra,
});

const scheme = {
  id: 'demo',
  name: 'Demo',
  shortName: 'Demo',
  category: 'Agriculture',
  ministry: 'Ministry',
  summary: 'A demo scheme',
  benefit: 'A benefit',
  source: 'https://example.gov.in/demo',
  sourceTitle: 'Official',
  sourceCheckedAt: new Date().toISOString(),
  reviewStatus: 'VERIFIED',
  version: 'v1',
  complete: true,
  fees: 'No fee',
  tags: [],
  rules: { all: [rule('r-land', 'land', 'gt', 0), rule('r-bank', 'bank', 'eq', 'yes')] },
  documents: [
    { item: 'Land record', note: 'RTC or equivalent', proves: 'r-land' },
    { item: 'Passbook', note: '', proves: 'r-bank' },
    { item: 'Photograph', note: '' },
  ],
  steps: [
    step('Confirm your landholding', { relatesTo: ['land'] }),
    step('Open a bank account', {
      relatesTo: ['bank'],
      onlyIf: { all: [rule('no-bank', 'bank', 'eq', 'no')] },
    }),
    step('Submit the form'),
  ],
};

const decide = (profile, confirmed) =>
  evaluateScheme(scheme, profile, confirmed);

test('a step gated by onlyIf is hidden when the rule fails for this citizen', () => {
  const profile = { land: 2, bank: 'yes' };
  const confirmed = ['land', 'bank'];
  const steps = personaliseSteps(scheme, profile, confirmed, decide(profile, confirmed));
  assert.ok(
    !steps.some((s) => s.title === 'Open a bank account'),
    'someone who has an account should not be told to open one',
  );
  assert.deepEqual(steps.map((s) => s.n), [1, 2], 'numbering closes the gap');
});

test('the same step is shown to a citizen who needs it', () => {
  const profile = { land: 2, bank: 'no' };
  const confirmed = ['land', 'bank'];
  const steps = personaliseSteps(scheme, profile, confirmed, decide(profile, confirmed));
  const opening = steps.find((s) => s.title === 'Open a bank account');
  assert.ok(opening, 'the step must appear');
  assert.equal(opening.relevance, 'for_you', 'a step gated on their situation is theirs');
  assert.equal(opening.becauseYou, 'bank must be established');
});

test('an unknown never hides a step — unknown does not mean no', () => {
  const profile = { land: 2 };
  const confirmed = ['land'];
  const steps = personaliseSteps(scheme, profile, confirmed, decide(profile, confirmed));
  assert.ok(steps.some((s) => s.title === 'Open a bank account'));
});

test('a satisfied fact does not mark its step done — a fact is not an action', () => {
  const profile = { land: 2, bank: 'yes' };
  const confirmed = ['land', 'bank'];
  const steps = personaliseSteps(scheme, profile, confirmed, decide(profile, confirmed));
  // Holding land does not mean you have confirmed the record carries your name.
  assert.equal(steps.find((s) => s.title === 'Confirm your landholding').relevance, 'standard');
  assert.ok(!steps.some((s) => s.relevance === 'already_done'));
});

test('a step relating to nothing stays standard', () => {
  const profile = { land: 2, bank: 'yes' };
  const confirmed = ['land', 'bank'];
  const steps = personaliseSteps(scheme, profile, confirmed, decide(profile, confirmed));
  const submit = steps.find((s) => s.title === 'Submit the form');
  assert.equal(submit.relevance, 'standard');
  assert.equal(submit.becauseYou, null);
});

test('becauseYou is always a rule label, never generated prose', () => {
  const profile = {};
  const steps = personaliseSteps(scheme, profile, [], decide(profile, []));
  const labels = scheme.rules.all.map((r) => r.label);
  for (const s of steps)
    if (s.becauseYou) assert.ok(labels.includes(s.becauseYou), s.becauseYou);
});

test('authored where/who/wait survive personalisation', () => {
  const profile = { land: 2, bank: 'yes' };
  const steps = personaliseSteps(scheme, profile, ['land', 'bank'], decide(profile, ['land', 'bank']));
  assert.equal(steps[0].where, 'District office');
  assert.equal(steps[0].who, 'Revenue clerk');
  assert.equal(steps[0].typicalWait, '2 weeks');
});

test('documents report what is held and what each one proves', () => {
  const profile = { land: 2 };
  const confirmed = ['land'];
  const docs = personaliseDocuments(scheme, ['Passbook'], decide(profile, confirmed));
  assert.deepEqual(
    docs.map((d) => [d.item, d.held, d.requiredBecause]),
    [
      ['Land record', false, 'land must be established'],
      ['Passbook', true, 'bank must be established'],
      ['Photograph', false, null],
    ],
  );
});

test('personalisation is pure', () => {
  const profile = { land: 2, bank: 'no' };
  const a = personaliseSteps(scheme, profile, ['land', 'bank'], decide(profile, ['land', 'bank']));
  const b = personaliseSteps(scheme, profile, ['land', 'bank'], decide(profile, ['land', 'bank']));
  assert.deepEqual(a, b);
});
