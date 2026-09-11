import test from 'node:test';
import assert from 'node:assert/strict';
import { schemesMentioned } from '../lib/agent/validate.ts';

const scheme = (id, shortName) => ({
  id,
  shortName,
  name: shortName,
  category: 'x',
  ministry: 'Ministry',
  summary: 'A summary',
  benefit: 'A benefit',
  source: 'https://example.gov.in/',
  sourceTitle: 'Official',
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
  scheme('pmuy', 'Ujjwala Yojana'),
  scheme('smam', 'Farm Mechanization'),
];

test('only the programmes a reply names are sent for checking', () => {
  // Sending every scheme's text would bury the one being discussed and cost
  // tokens for nothing.
  assert.deepEqual(
    schemesMentioned('PM Vishwakarma supports artisans like you.', schemes),
    ['vishwakarma'],
  );
  assert.deepEqual(
    schemesMentioned('Both PM Vishwakarma and Ujjwala Yojana may apply.', schemes),
    ['vishwakarma', 'pmuy'],
  );
});

test('a reply naming nothing needs no check', () => {
  assert.deepEqual(schemesMentioned('How old are you?', schemes), []);
  assert.deepEqual(
    schemesMentioned('You stitch blouses at home. What state do you live in?', schemes),
    [],
  );
});

test('matching does not fire on ordinary words inside a name', () => {
  // "Farm Mechanization" contains "farm"; a citizen saying they farm is not
  // discussing that programme, and pulling its text in would invite the judge
  // to rule on a claim nobody made.
  assert.deepEqual(schemesMentioned('I farm two acres in Kolar', schemes), []);
});
