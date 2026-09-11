import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProse } from '../lib/agent/validate.ts';

const scheme = (id, shortName) => ({
  id,
  shortName,
  name: shortName,
  category: 'x',
  ministry: 'x',
  summary: 'x',
  benefit: 'x',
  source: 'https://example.gov.in/',
  sourceTitle: 'x',
  sourceCheckedAt: null,
  reviewStatus: 'VERIFIED',
  version: 'v1',
  rules: { all: [] },
  complete: true,
  documents: [],
  steps: [],
  fees: '',
  tags: [],
});

const schemes = [
  scheme('vishwakarma', 'PM Vishwakarma'),
  scheme('ignwps', 'National Widow Pension'),
  scheme('pmuy', 'Ujjwala Yojana'),
];

const decision = (status) => ({
  schemeId: 'x',
  status,
  reasons: [],
  missingFields: [],
  notice: '',
  version: 'v1',
});

const ctx = (onScreen, statuses = {}) => ({
  onScreen,
  schemes,
  decisions: new Map(Object.entries(statuses).map(([k, v]) => [k, decision(v)])),
});

test('ordinary prose about a shown scheme passes', () => {
  const v = validateProse(
    'PM Vishwakarma supports traditional artisans. The card below has the details.',
    ctx(['vishwakarma'], { vishwakarma: 'LIKELY_ELIGIBLE' }),
  );
  assert.equal(v.ok, true);
});

test('an invented rupee amount is rejected', () => {
  for (const text of [
    'You could receive ₹15,000 for tools.',
    'The scheme pays Rs 6000 a year.',
    'A grant of 2 lakh rupees is available.',
  ]) {
    const v = validateProse(text, ctx(['vishwakarma']));
    assert.equal(v.ok, false, text);
    assert.match(v.reason, /amount/);
  }
});

test('a percentage is rejected — it is a claim like any other', () => {
  const v = validateProse('Around 30% of applicants are approved.', ctx(['vishwakarma']));
  assert.equal(v.ok, false);
});

test('a link is rejected, because the sources strip owns links', () => {
  for (const text of [
    'Apply at https://pmvishwakarma.gov.in today.',
    'See www.example.com for details.',
    'Visit pmkisan.gov.in to register.',
  ]) {
    assert.equal(validateProse(text, ctx(['vishwakarma'])).ok, false, text);
  }
});

test('naming a scheme that is not on screen is rejected', () => {
  // Observed in testing: the model led with widow pension while the cards
  // showed something else entirely.
  const v = validateProse(
    'You may be eligible for the National Widow Pension.',
    ctx(['vishwakarma'], { vishwakarma: 'LIKELY_ELIGIBLE' }),
  );
  assert.equal(v.ok, false);
  assert.match(v.reason, /National Widow Pension/);
});

test('entitlement language about an undetermined scheme is rejected', () => {
  const v = validateProse(
    'You may be eligible for Ujjwala Yojana.',
    ctx(['pmuy'], { pmuy: 'UNABLE_TO_DETERMINE' }),
  );
  assert.equal(v.ok, false);
  assert.match(v.reason, /could not determine/);
});

test('the same scheme may be discussed once the rules decided it', () => {
  const v = validateProse(
    'You are likely eligible for Ujjwala Yojana.',
    ctx(['pmuy'], { pmuy: 'LIKELY_ELIGIBLE' }),
  );
  assert.equal(v.ok, true);
});

test('saying a scheme cannot be determined is allowed', () => {
  // The honest sentence must not be caught by the guard against the dishonest
  // one, or the model is pushed toward silence instead of candour.
  const v = validateProse(
    'Ujjwala Yojana cannot be determined yet — we still need your LPG status.',
    ctx(['pmuy'], { pmuy: 'UNABLE_TO_DETERMINE' }),
  );
  assert.equal(v.ok, true);
});

test('empty prose is rejected so the planner speaks instead', () => {
  assert.equal(validateProse('   ', ctx(['vishwakarma'])).ok, false);
});
