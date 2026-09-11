import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectFocus,
  shouldOfferSave,
  isDecline,
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

test('naming a scheme focuses it', () => {
  const focus = detectFocus({
    schemes,
    lastPresented: ['pmuy'],
    previousFocus: null,
    text: 'tell me more about PM-KISAN',
  });
  assert.equal(focus, 'pm-kisan');
});

test('a single presented card becomes the focus', () => {
  assert.equal(
    detectFocus({ schemes, lastPresented: ['pmuy'], previousFocus: null, text: 'go on' }),
    'pmuy',
  );
});

test('four presented cards are not a focus — a choice was not made', () => {
  assert.equal(
    detectFocus({
      schemes,
      lastPresented: ['pm-kisan', 'pmuy', 'a', 'b'],
      previousFocus: null,
      text: 'ok',
    }),
    null,
  );
});

test('focus carries forward when this turn names nothing', () => {
  assert.equal(
    detectFocus({ schemes, lastPresented: [], previousFocus: 'pmuy', text: 'and then?' }),
    'pmuy',
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
