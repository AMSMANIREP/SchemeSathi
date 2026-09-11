import test from 'node:test';
import assert from 'node:assert/strict';
import { planTurn, QUESTION_BUDGET } from '../lib/agent/turn.ts';
import { leverage, fieldsUsedBy, questionFor } from '../lib/questions.ts';

const scheme = (id, rules, extra = {}) => ({
  id,
  name: id,
  shortName: id,
  category: 'Agriculture',
  ministry: 'Ministry',
  summary: 'A summary for ' + id,
  benefit: 'A benefit',
  source: 'https://example.gov.in/' + id,
  sourceTitle: 'Official',
  sourceCheckedAt: new Date().toISOString(),
  reviewStatus: 'VERIFIED',
  version: 'v1',
  rules,
  complete: true,
  documents: [{ item: 'Doc A', note: '' }],
  steps: [
    {
      title: 'Step one',
      detail: '',
      where: '',
      who: '',
      typicalWait: '',
      relatesTo: [],
    },
  ],
  fees: '',
  tags: [id],
  ...extra,
});

const rule = (field, op, value) => ({
  id: field,
  field,
  op,
  value,
  label: field + ' condition',
  source: 'https://example.gov.in/',
});

const farming = scheme('farm-one', { all: [rule('land', 'gt', 0)] });
const cooking = scheme('gas-one', { all: [rule('lpg', 'eq', 'no')] });

const base = {
  schemes: [farming, cooking],
  candidates: ['farm-one'],
  profile: {},
  confirmed: [],
  changed: [],
  savedSchemeIds: [],
  questionsAsked: 0,
  language: 'en',
};

test('an unknown blocking field produces a question, not a card', () => {
  const plan = planTurn(base);
  assert.equal(plan.checkpoint, 'ASKED');
  assert.equal(plan.askedField, 'land');
  assert.equal(plan.questionsAsked, 1);
  assert.ok(plan.text.length > 0, 'the question is prose, not a block');
  assert.ok(!plan.blocks.some((b) => b.kind === 'scheme_card'));
});

test('the question follows what was retrieved, not the alphabet', () => {
  // 'lpg' sorts before 'land'; only the candidate set should decide.
  const plan = planTurn({ ...base, candidates: ['gas-one'] });
  assert.equal(plan.askedField, 'lpg');
  const chips = plan.blocks.find((b) => b.kind === 'answer_chips');
  assert.deepEqual(chips.options, ['yes', 'no'], 'chips carry raw values only');
});

test('a number field gets no chips', () => {
  assert.deepEqual(questionFor('land', 'en').options, []);
});

test('the question budget is spent, then something is shown', () => {
  const plan = planTurn({ ...base, questionsAsked: QUESTION_BUDGET });
  assert.equal(plan.checkpoint, 'PRESENTED');
  assert.equal(plan.askedField, null);
  assert.ok(plan.blocks.some((b) => b.kind === 'scheme_card'));
});

test('a decided scheme is presented rather than questioned', () => {
  const plan = planTurn({
    ...base,
    profile: { land: 2 },
    confirmed: ['land'],
  });
  assert.equal(plan.checkpoint, 'PRESENTED');
  const card = plan.blocks.find((b) => b.kind === 'scheme_card');
  assert.equal(card.schemeId, 'farm-one');
  assert.equal(card.status, 'LIKELY_ELIGIBLE');
});

test('sources come from the scheme record', () => {
  const plan = planTurn({ ...base, questionsAsked: QUESTION_BUDGET });
  const sources = plan.blocks.find((b) => b.kind === 'sources');
  assert.deepEqual(sources.items, [
    { schemeId: 'farm-one', url: 'https://example.gov.in/farm-one' },
  ]);
});

test('changed fields surface as a receipt with their provenance', () => {
  const plan = planTurn({
    ...base,
    changed: [{ field: 'land', provenance: 'answered' }],
    questionsAsked: QUESTION_BUDGET,
  });
  const receipt = plan.blocks.find((b) => b.kind === 'profile_updated');
  assert.deepEqual(receipt.fields, [{ field: 'land', provenance: 'answered' }]);
});

test('an inferred field is not treated as known, so it is still asked about', () => {
  // Present in the profile, absent from confirmed — exactly the inferred case.
  const plan = planTurn({ ...base, profile: { land: 2 }, confirmed: [] });
  assert.equal(plan.askedField, 'land');
});

test('no candidates yields no cards and no invented question', () => {
  const plan = planTurn({ ...base, candidates: [], questionsAsked: QUESTION_BUDGET });
  assert.equal(plan.checkpoint, 'GATHERING');
  assert.deepEqual(plan.blocks, []);
});

test('leverage counts the schemes a field blocks', () => {
  const both = scheme('both', { all: [rule('land', 'gt', 0), rule('lpg', 'eq', 'no')] });
  const ranked = leverage([farming, cooking, both], {}, []);
  assert.equal(ranked[0].field, 'land');
  assert.equal(ranked[0].blocks, 2);
});

test('fieldsUsedBy walks nested rule trees', () => {
  const nested = scheme('nest', {
    all: [rule('age', 'gte', 60), { any: [rule('gender', 'eq', 'female')] }],
  });
  assert.deepEqual(fieldsUsedBy(nested).sort(), ['age', 'gender']);
});

test('planning is pure — the same input twice gives the same plan', () => {
  assert.deepEqual(planTurn(base), planTurn(base));
});

test('an unreadable answer is acknowledged, not silently repeated', () => {
  const plain = planTurn(base);
  const retry = planTurn({ ...base, unreadAnswer: true });
  assert.equal(retry.askedField, plain.askedField, 'it asks the same thing again');
  assert.notEqual(retry.text, plain.text);
  assert.ok(retry.text.startsWith('Sorry'), retry.text);
  assert.ok(retry.text.includes(plain.text), 'the question itself is still there');
});

test('naming a scheme leads with it, however retrieval ranked it', () => {
  // cooking sorts ahead on verdict; the citizen asked about farming.
  const plan = planTurn({
    ...base,
    candidates: ['gas-one', 'farm-one'],
    profile: { land: 2, lpg: 'no' },
    confirmed: ['land', 'lpg'],
    focus: 'farm-one',
    questionsAsked: QUESTION_BUDGET,
  });
  const cards = plan.blocks.filter((b) => b.kind === 'scheme_card');
  assert.equal(cards[0].schemeId, 'farm-one', 'the scheme they asked about leads');
});

test('a focused turn answers about that scheme, not in general', () => {
  const plan = planTurn({
    ...base,
    focus: 'farm-one',
    profile: { land: 2 },
    confirmed: ['land'],
    questionsAsked: QUESTION_BUDGET,
  });
  assert.ok(plan.text.startsWith('farm-one'), plan.text);
  assert.ok(/likely eligible/i.test(plan.text), plan.text);
  assert.ok(plan.text.includes('A summary for farm-one'), plan.text);
});

test('a focused turn names what is still missing', () => {
  const plan = planTurn({
    ...base,
    focus: 'farm-one',
    profile: {},
    confirmed: [],
    questionsAsked: QUESTION_BUDGET,
  });
  // 'land' is unknown, so the sentence must say so rather than imply a verdict.
  assert.ok(/still to establish/i.test(plan.text), plan.text);
  assert.ok(/landholding/i.test(plan.text), plan.text);
});

test('with no scheme named, the turn stays general', () => {
  const plan = planTurn({ ...base, questionsAsked: QUESTION_BUDGET });
  assert.ok(plan.text.startsWith('Here is what'), plan.text);
});

test('a scheme named this message is the whole answer', () => {
  const plan = planTurn({
    ...base,
    candidates: ['gas-one', 'farm-one'],
    profile: { land: 2, lpg: 'no' },
    confirmed: ['land', 'lpg'],
    focus: 'farm-one',
    focusNamed: true,
    questionsAsked: QUESTION_BUDGET,
  });
  const cards = plan.blocks.filter((b) => b.kind === 'scheme_card');
  assert.equal(cards.length, 1, 'one question deserves one answer');
  assert.equal(cards[0].schemeId, 'farm-one');
  // And the sources strip follows the cards, not the candidate list.
  const sources = plan.blocks.find((b) => b.kind === 'sources');
  assert.deepEqual(sources.items.map((i) => i.schemeId), ['farm-one']);
});

test('a focus merely carried over still shows the others', () => {
  const plan = planTurn({
    ...base,
    candidates: ['gas-one', 'farm-one'],
    profile: { land: 2, lpg: 'no' },
    confirmed: ['land', 'lpg'],
    focus: 'farm-one',
    focusNamed: false,
    questionsAsked: QUESTION_BUDGET,
  });
  const cards = plan.blocks.filter((b) => b.kind === 'scheme_card');
  assert.ok(cards.length > 1, 'they may have moved on; do not narrow for them');
  assert.equal(cards[0].schemeId, 'farm-one', 'but it still leads');
});

test('asking about a scheme is never deflected into a question', () => {
  const plan = planTurn({
    ...base,
    focus: 'farm-one',
    focusNamed: true,
    profile: {},
    confirmed: [],
    questionsAsked: 0, // budget available — it would otherwise ask
  });
  assert.equal(plan.askedField, null, 'their question is answered, not deflected');
  assert.ok(plan.text.startsWith('farm-one'), plan.text);
  // The gap is still communicated, just not as a deflection.
  assert.ok(/still to establish/i.test(plan.text), plan.text);
});
