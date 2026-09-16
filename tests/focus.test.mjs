import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectFocus,
  shouldOfferSave,
  isDecline,
  isUnsure,
  DECLINE_COOLDOWN,
} from '../lib/agent/focus.ts';

const schemes = [
  { id: 'pm-kisan', shortName: 'PM-KISAN', name: 'PM-KISAN Samman Nidhi' },
  { id: 'pmuy', shortName: 'Ujjwala Yojana', name: 'Pradhan Mantri Ujjwala' },
];

const decision = (status) => ({
  schemeId: 'pm-kisan',
  status,
  reasons: [
    { id: 'r1', field: 'land', label: 'You farm land', result: 'PASS', source: 'x' },
  ],
  missingFields: [],
  notice: '',
  version: 'v1',
});

const base = {
  focus: 'pm-kisan',
  decision: decision('LIKELY_ELIGIBLE'),
  checkpoint: 'PRESENTED',
  savedSchemeIds: [],
  declinedSchemeId: null,
  declinedAtTurn: 0,
  turn: 5,
};

test('naming a scheme focuses it, and marks it as named', () => {
  const focus = detectFocus({
    schemes,
    lastPresented: ['pmuy'],
    previousFocus: null,
    text: 'tell me more about PM-KISAN',
  });
  assert.deepEqual(focus, { schemeId: 'pm-kisan', named: true });
});

test('a single presented card becomes the focus, but is not "named"', () => {
  assert.deepEqual(
    detectFocus({ schemes, lastPresented: ['pmuy'], previousFocus: null, text: 'go on' }),
    { schemeId: 'pmuy', named: false },
  );
});

test('four presented cards are not a focus — a choice was not made', () => {
  assert.deepEqual(
    detectFocus({
      schemes,
      lastPresented: ['pm-kisan', 'pmuy', 'a', 'b'],
      previousFocus: null,
      text: 'ok',
    }),
    { schemeId: null, named: false },
  );
});

test('focus carries forward when this turn names nothing, unnamed', () => {
  assert.deepEqual(
    detectFocus({ schemes, lastPresented: [], previousFocus: 'pmuy', text: 'and then?' }),
    { schemeId: 'pmuy', named: false },
  );
});

test('an eligible focused scheme is offered', () => {
  assert.equal(shouldOfferSave(base), true);
});

test('nothing is offered before anything has been presented', () => {
  assert.equal(shouldOfferSave({ ...base, checkpoint: 'GATHERING' }), false);
  assert.equal(shouldOfferSave({ ...base, checkpoint: 'ASKED' }), false);
});

test('an undetermined or ineligible scheme is never offered', () => {
  for (const s of ['UNABLE_TO_DETERMINE', 'LIKELY_NOT_ELIGIBLE'])
    assert.equal(shouldOfferSave({ ...base, decision: decision(s) }), false, s);
});

test('a possible scheme is still worth offering', () => {
  assert.equal(
    shouldOfferSave({ ...base, decision: decision('POSSIBLY_ELIGIBLE') }),
    true,
  );
});

test('an already saved scheme is not offered again', () => {
  assert.equal(shouldOfferSave({ ...base, savedSchemeIds: ['pm-kisan'] }), false);
});

test('declining suppresses the offer for the cooldown, then it returns', () => {
  const declined = { ...base, declinedSchemeId: 'pm-kisan', declinedAtTurn: 5 };
  assert.equal(shouldOfferSave({ ...declined, turn: 6 }), false);
  assert.equal(
    shouldOfferSave({ ...declined, turn: 5 + DECLINE_COOLDOWN - 1 }),
    false,
  );
  assert.equal(shouldOfferSave({ ...declined, turn: 5 + DECLINE_COOLDOWN }), true);
});

test('declining one scheme does not suppress another', () => {
  assert.equal(
    shouldOfferSave({
      ...base,
      focus: 'pmuy',
      declinedSchemeId: 'pm-kisan',
      declinedAtTurn: 5,
      turn: 6,
    }),
    true,
  );
});

test('no focus means no offer', () => {
  assert.equal(shouldOfferSave({ ...base, focus: null }), false);
});

test('refusals are recognised in all three languages', () => {
  for (const s of ['no', 'No thanks', 'not now', 'नहीं', 'ಇಲ್ಲ'])
    assert.ok(isDecline(s), s);
  for (const s of ['north karnataka', 'nothing else', '0.8'])
    assert.ok(!isDecline(s), s);
});

test('a merely possible verdict with nothing established is not offered', () => {
  // Empty profile: every rule UNKNOWN, so the verdict is POSSIBLY_ELIGIBLE
  // for the whole catalogue. That is the default state, not a narrowing.
  const nothingKnown = {
    ...decision('POSSIBLY_ELIGIBLE'),
    reasons: [
      { id: 'r1', field: 'land', label: 'You farm land', result: 'UNKNOWN', source: 'x' },
    ],
  };
  assert.equal(shouldOfferSave({ ...base, decision: nothingKnown }), false);

  // One established fact is enough to make it a real narrowing.
  const somethingKnown = {
    ...nothingKnown,
    reasons: [
      { id: 'r1', field: 'land', label: 'You farm land', result: 'PASS', source: 'x' },
      { id: 'r2', field: 'bank', label: 'You have an account', result: 'UNKNOWN', source: 'x' },
    ],
  };
  assert.equal(shouldOfferSave({ ...base, decision: somethingKnown }), true);
});

test('a scheme is recognised by the name people actually say', () => {
  const catalogue = [
    { id: 'pmuy', shortName: 'Ujjwala Yojana', name: 'Pradhan Mantri Ujjwala Yojana' },
    { id: 'pmmvy', shortName: 'Matru Vandana Yojana', name: 'PM Matru Vandana Yojana' },
    { id: 'ignoaps', shortName: 'National Old Age Pension', name: 'National Old Age Pension' },
  ];
  const focus = (text) =>
    detectFocus({ schemes: catalogue, lastPresented: [], previousFocus: null, text });

  // Nobody says the full name.
  assert.deepEqual(focus('Tell me more about Ujjwala'), { schemeId: 'pmuy', named: true });
  assert.deepEqual(focus('what about matru vandana'), { schemeId: 'pmmvy', named: true });
});

test('a word shared across schemes identifies none of them', () => {
  const catalogue = [
    { id: 'pmuy', shortName: 'Ujjwala Yojana', name: 'Pradhan Mantri Ujjwala Yojana' },
    { id: 'pmmvy', shortName: 'Matru Vandana Yojana', name: 'Pradhan Mantri Matru Vandana Yojana' },
    { id: 'pmay', shortName: 'Awaas Yojana', name: 'Pradhan Mantri Awaas Yojana' },
  ];
  const focus = (text) =>
    detectFocus({ schemes: catalogue, lastPresented: [], previousFocus: null, text });

  // "yojana" and "pradhan" belong to several; matching on them would narrow
  // the answer to an arbitrary scheme the citizen never named.
  assert.equal(focus('I want a yojana').schemeId, null);
  assert.equal(focus('pradhan mantri something').schemeId, null);
});

test('an ordinary word is not a scheme name, even when only one scheme uses it', () => {
  // "Farm Mechanization" and "Soil Health Card" each own the words "farm" and
  // "health" uniquely, so uniqueness alone read "I farm two acres" as naming a
  // programme and narrowed the whole reply to it.
  const catalogue = [
    { id: 'smam', shortName: 'Farm Mechanization', name: 'Farm Mechanization' },
    { id: 'soil-health', shortName: 'Soil Health Card', name: 'Soil Health Card' },
    { id: 'pmuy', shortName: 'Ujjwala Yojana', name: 'Pradhan Mantri Ujjwala Yojana' },
  ];
  const focus = (text) =>
    detectFocus({ schemes: catalogue, lastPresented: [], previousFocus: null, text })
      .schemeId;

  assert.equal(focus('I farm two acres in Kolar'), null);
  assert.equal(focus('my health is bad these days'), null);
  // A real name still resolves.
  assert.equal(focus('tell me about Ujjwala'), 'pmuy');
});

test('not knowing what you need is recognised, in all three languages', () => {
  for (const s of ['I am not sure', "I don't know what I need", 'no idea', 'पता नहीं', 'ಗೊತ್ತಿಲ್ಲ'])
    assert.ok(isUnsure(s), s);
  // But a definite statement is not uncertainty.
  for (const s of ['I need a gas connection', 'I know I want PM-KISAN'])
    assert.ok(!isUnsure(s), s);
});
