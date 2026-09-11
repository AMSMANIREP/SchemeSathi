import test from 'node:test';
import assert from 'node:assert/strict';
import {
  languages,
  isLanguage,
  languageCommand,
  detectLanguage,
  transcriptionLanguage,
  voiceCopy,
  multilingualWelcome,
} from '../lib/languages.ts';
import {
  synthesizeSpeech,
  transcribeSpeech,
  defaultVoiceId,
} from '../lib/elevenlabs.ts';
import { tamil, malayalam } from '../lib/regional-copy.ts';

test('explicit language commands support all five languages', () => {
  for (const [message, expected] of [
    ['English', 'en'],
    ['हिन्दी', 'hi'],
    ['ಕನ್ನಡ', 'kn'],
    ['தமிழ்', 'ta'],
    ['மലയാളம்', undefined],
    ['മലയാളം', 'ml'],
    ['Please speak in Tamil', 'ta'],
    ['Malayalam please!', 'ml'],
    ['தமிழில் பேசுங்கள்', 'ta'],
    ['മലയാളത്തിൽ സംസാരിക്കൂ', 'ml'],
  ]) {
    assert.equal(languageCommand(message), expected, message);
  }
});
test('place names, multiple choices and ordinary Latin input do not silently switch language', () => {
  for (const message of [
    'I am from Tamil Nadu',
    'Tamil and Malayalam',
    'I do not speak Tamil',
    'Tamil Nadu',
    'I study Hindi',
  ])
    assert.equal(languageCommand(message), undefined);
  assert.equal(detectLanguage('I am from Tamil Nadu', 'ml'), 'ml');
  assert.equal(detectLanguage('I am 45 years old', 'ta'), 'ta');
});
test('native input chooses Tamil or Malayalam and rejects unsupported language codes', () => {
  assert.equal(detectLanguage('எனக்கு 62 வயது', 'en'), 'ta');
  assert.equal(detectLanguage('എനിക്ക് 62 വയസ്സുണ്ട്', 'en'), 'ml');
  assert.equal(detectLanguage('ನನ್ನ ವಯಸ್ಸು 62', 'ta'), 'kn');
  assert.equal(detectLanguage('', 'ml'), 'ml');
  assert.equal(isLanguage('te'), false);
  for (const language of languages) assert.ok(isLanguage(language));
});
test('STT language confidence, ISO variants and unknown results preserve a valid selection', () => {
  for (const [code, lang] of [
    ['tam', 'ta'],
    ['ta', 'ta'],
    ['mal', 'ml'],
    ['ml', 'ml'],
    ['eng', 'en'],
    ['hin', 'hi'],
    ['kan', 'kn'],
  ])
    assert.equal(transcriptionLanguage(code, 0.98, 'en'), lang);
  assert.equal(transcriptionLanguage('mal', 0.2, 'ta'), 'ta');
  assert.equal(transcriptionLanguage('tel', 0.99, 'ta'), 'ta');
  assert.equal(transcriptionLanguage('mal', undefined, 'ta'), 'ta');
});
test('every guided voice response is available in all languages', () => {
  for (const language of languages) {
    assert.deepEqual(
      Object.keys(voiceCopy[language]).sort(),
      Object.keys(voiceCopy.en).sort(),
    );
    for (const text of Object.values(voiceCopy[language]))
      assert.ok(text.length > 0);
  }
  assert.match(multilingualWelcome, /வணக்கம்/);
  assert.match(multilingualWelcome, /സ്വാഗതം/);
  assert.deepEqual(Object.keys(tamil).sort(), Object.keys(malayalam).sort());
});
test('TTS uses Eleven v3, server key header and requested Tamil/Malayalam language', async () => {
  for (const language of ['ta', 'ml']) {
    const response = await synthesizeSpeech(
      'test-key',
      defaultVoiceId,
      voiceCopy[language].selected,
      language,
      async (url, init) => {
        assert.ok(
          url.startsWith('https://api.elevenlabs.io/v1/text-to-speech/'),
        );
        assert.ok(!url.includes('test-key'));
        assert.equal(init.headers['xi-api-key'], 'test-key');
        const payload = JSON.parse(init.body);
        assert.equal(payload.model_id, 'eleven_v3');
        assert.equal(payload.language_code, language);
        assert.equal(payload.text, voiceCopy[language].selected);
        return new Response('synthetic audio', {
          headers: { 'Content-Type': 'audio/mpeg' },
        });
      },
    );
    assert.equal(response.status, 200);
  }
});
test('multilingual welcome leaves speech language unconstrained and provider failures are sanitized', async () => {
  await synthesizeSpeech(
    'test-key',
    defaultVoiceId,
    multilingualWelcome,
    undefined,
    async (_, init) => {
      assert.equal(JSON.parse(init.body).language_code, undefined);
      return new Response('synthetic audio', {
        headers: { 'Content-Type': 'audio/mpeg' },
      });
    },
  );
  await assert.rejects(
    synthesizeSpeech(
      'test-key',
      defaultVoiceId,
      'Hello',
      'en',
      async () => new Response('secret provider diagnostics', { status: 401 }),
    ),
    { message: 'Voice service unavailable' },
  );
});
test('STT automatically detects language and preserves transcript for user review', async () => {
  const file = new File(['synthetic recording'], 'sample.webm', {
    type: 'audio/webm',
  });
  const value = await transcribeSpeech('test-key', file, async (_, init) => {
    assert.equal(init.body.get('language_code'), null);
    assert.equal(init.body.get('model_id'), 'scribe_v2');
    assert.equal(init.body.get('file').name, 'sample.webm');
    return Response.json({
      text: 'മലയാളം',
      language_code: 'mal',
      language_probability: 0.99,
    });
  });
  assert.equal(value.text, 'മലയാളം');
  assert.equal(value.languageCode, 'mal');
});
