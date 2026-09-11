import test from 'node:test';
import assert from 'node:assert/strict';
import { UtteranceDetector } from '../lib/utterance.ts';

test('silence is discarded without a transcription request', () => {
  const detector = new UtteranceDetector(0);
  for (let t = 50; t < 8000; t += 50)
    assert.equal(detector.sample(0.001, t), null);
  assert.equal(detector.sample(0.001, 8000), 'discard');
});
test('brief noise does not become a spoken turn', () => {
  const detector = new UtteranceDetector(0);
  detector.sample(0.2, 50);
  for (let t = 100; t < 8000; t += 50)
    assert.equal(detector.sample(0.001, t), null);
  assert.equal(detector.sample(0.001, 8000), 'discard');
});
test('speech is sent automatically after a pause, not during a short pause', () => {
  const detector = new UtteranceDetector(0);
  for (let t = 50; t <= 600; t += 50)
    assert.equal(detector.sample(0.04, t), null);
  for (let t = 650; t < 1800; t += 50)
    assert.equal(detector.sample(0, t), null);
  assert.equal(detector.sample(0, 1800), 'send');
});
test('a long utterance is bounded to twenty seconds', () => {
  const detector = new UtteranceDetector(0);
  for (let t = 50; t < 20000; t += 50)
    assert.equal(detector.sample(0.04, t), null);
  assert.equal(detector.sample(0.04, 20000), 'send');
});
