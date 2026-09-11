import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { sessionLanguage } from '../lib/languages.ts';
import { questionFor } from '../lib/questions.ts';

test('session language stays fixed through short or mixed-language replies', () => {
  assert.equal(sessionLanguage('தமிழில் பேசுங்கள்', 'en', false), 'ta');
  assert.equal(sessionLanguage('yes', 'ta', true), 'ta');
  assert.equal(sessionLanguage('मैं किसान हूँ', 'ta', true), 'ta');
  assert.equal(sessionLanguage('Malayalam', 'ta', true), 'ml');
  assert.equal(sessionLanguage('ഞാൻ ഒരു കർഷകനാണ്', 'en', false), 'ml');
  for (const field of [
    'occupation',
    'land',
    'taxpayer',
    'age',
    'gender',
    'lpg',
  ]) {
    assert.match(questionFor(field, 'ta').text, /[\u0b80-\u0bff]/);
    assert.match(questionFor(field, 'ml').text, /[\u0d00-\u0d7f]/);
  }
});

test('real routes preserve chat flow, ownership and selected voice language', async () => {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys=ON');
  const dir = new URL('../drizzle/', import.meta.url);
  for (const name of readdirSync(dir)
    .filter((n) => n.endsWith('.sql'))
    .sort())
    sqlite.exec(readFileSync(new URL(name, dir), 'utf8'));
  const db = {
    prepare(sql) {
      const stmt = sqlite.prepare(sql);
      const wrap = (args = []) => ({
        bind: (...values) => wrap(values),
        async first() {
          return stmt.get(...args) ?? null;
        },
        async all() {
          return { results: stmt.all(...args) };
        },
        async run() {
          return { success: true, meta: stmt.run(...args) };
        },
      });
      return wrap();
    },
    async batch(statements) {
      sqlite.exec('BEGIN');
      try {
        const result = await Promise.all(statements.map((s) => s.run()));
        sqlite.exec('COMMIT');
        return result;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  };
  globalThis.__voiceTestEnv = {
    DB: db,
    ELEVENLABS_API_KEY: 'test-only-not-a-real-key',
  };
  const hooks = registerHooks({
    load(url, context, next) {
      if (url.endsWith('.json'))
        return {
          format: 'module',
          shortCircuit: true,
          source: 'export default ' + readFileSync(new URL(url), 'utf8'),
        };
      if (url.endsWith('.ts'))
        return {
          format: 'module',
          shortCircuit: true,
          source: stripTypeScriptTypes(readFileSync(new URL(url), 'utf8'), {
            mode: 'transform',
          }),
        };
      return next(url, context);
    },
    resolve(specifier, context, next) {
      if (specifier === 'cloudflare:workers')
        return {
          url: 'data:text/javascript,export const env=globalThis.__voiceTestEnv',
          shortCircuit: true,
        };
      if (specifier.startsWith('.')) {
        const url = new URL(specifier, context.parentURL);
        if (!/\.(ts|mjs|js|json)$/.test(url.pathname)) {
          const candidate = [
            new URL(url.href + '.ts'),
            new URL(url.href + '/index.ts'),
          ].find((u) => existsSync(fileURLToPath(u)));
          if (candidate) return next(candidate.href, context);
        }
      }
      return next(specifier, context);
    },
  });
  const originalFetch = globalThis.fetch;
  const spoken = [];
  const transcript = {
    text: 'ഞാൻ കർഷകനാണ്',
    language_code: 'mal',
    language_probability: 0.99,
  };
  globalThis.fetch = async (url, init) => {
    const address =
      typeof url === 'string' ? url : url instanceof URL ? url.href : url.url;
    assert.equal(init.headers['xi-api-key'], 'test-only-not-a-real-key');
    if (address.includes('speech-to-text')) {
      assert.equal(init.body.get('model_id'), 'scribe_v2');
      assert.equal(init.body.get('language_code'), null);
      return Response.json(transcript);
    }
    assert.match(address, /^https:\/\/api.elevenlabs.io\/v1\/text-to-speech\//);
    spoken.push(JSON.parse(init.body));
    return new Response(new Uint8Array([73, 68, 51]), {
      headers: { 'Content-Type': 'audio/mpeg' },
    });
  };
  try {
    const { handle } = await import('../lib/server.ts');
    const client = () => {
      let cookie = '';
      return async (path, method = 'GET', data, expected = 200) => {
        const headers = {
          'X-Requested-With': 'SchemeSathi',
          Cookie: cookie,
          Origin: 'https://sathi.test',
        };
        if (!(data instanceof FormData))
          headers['Content-Type'] = 'application/json';
        const response = await handle(
          new Request('https://sathi.test/api/v1/' + path, {
            method,
            headers,
            ...(data === undefined
              ? {}
              : {
                  body: data instanceof FormData ? data : JSON.stringify(data),
                }),
          }),
          path.split('/'),
        );
        if (response.headers.has('set-cookie'))
          cookie = response.headers.get('set-cookie').split(';')[0];
        const result = response.headers
          .get('content-type')
          ?.startsWith('audio/')
          ? await response.arrayBuffer()
          : await response.json();
        assert.equal(
          response.status,
          expected,
          method + ' ' + path + ': ' + JSON.stringify(result),
        );
        return result;
      };
    };
    const a = client(),
      b = client();
    await a('voice/synthesize', 'POST', { kind: 'welcome' }, 401);
    await a('sessions', 'POST', {}, 201);
    await b('sessions', 'POST', { language: 'en' }, 201);
    const firstLogin = await a('voice/login', 'PUT', {
      profileKey: 'a'.repeat(64),
    });
    assert.equal(firstLogin.language, 'en');
    assert.equal(firstLogin.languageSelected, false);
    await a('voice/synthesize', 'POST', { kind: 'welcome', language: 'en' });
    assert.equal(spoken.at(-1).language_code, 'en');
    assert.doesNotMatch(spoken.at(-1).text, /[\u0900-\u0d7f]/);
    const conv = await a('conversations', 'POST', {}, 201);
    const preference = await a(
      'conversations/' + conv.id + '/messages',
      'POST',
      { message: 'Tamil' },
      201,
    );
    assert.equal(preference.message.language, 'ta');
    assert.equal(
      (await a('voice/login', 'PUT', { profileKey: 'b'.repeat(64) })).language,
      'en',
    );
    assert.equal(
      (await a('voice/login', 'PUT', { profileKey: 'a'.repeat(64) })).language,
      'ta',
    );
    assert.equal(
      (await b('voice/login', 'PUT', { profileKey: 'a'.repeat(64) })).language,
      'en',
      'preferences never cross browser sessions',
    );
    await a('voice/synthesize', 'POST', { kind: 'welcome', language: 'ta' });
    assert.equal(spoken.at(-1).language_code, 'ta');
    assert.match(spoken.at(-1).text, /[\u0b80-\u0bff]/);
    assert.equal(
      preference.profileVersion,
      0,
      'language choice does not confirm profile facts',
    );
    assert.equal(
      sqlite
        .prepare('SELECT questions_asked FROM conversations WHERE id=?')
        .get(conv.id).questions_asked,
      0,
    );
    const reply = await a(
      'conversations/' + conv.id + '/messages',
      'POST',
      { message: 'I am a farmer' },
      201,
    );
    assert.equal(reply.message.language, 'ta');
    assert.match(reply.message.text, /[\u0b80-\u0bff]/);
    const audio = {
      kind: 'message',
      language: 'ta',
      conversationId: conv.id,
      messageId: reply.message.id,
    };
    await a('voice/synthesize', 'POST', audio);
    assert.equal(spoken.at(-1).model_id, 'eleven_v3');
    assert.equal(spoken.at(-1).language_code, 'ta');
    assert.ok(spoken.at(-1).text.includes(reply.message.text));
    await b('voice/synthesize', 'POST', { ...audio, language: 'en' }, 404);
    await a(
      'voice/synthesize',
      'POST',
      { kind: 'welcome', text: 'arbitrary billable text' },
      400,
    );
    await a('voice/synthesize', 'POST', { ...audio, language: 'ml' }, 409);
    const form = new FormData();
    form.append(
      'file',
      new File(['fake audio'], 'clip.webm', { type: 'audio/webm' }),
    );
    const recording = await a('voice/transcribe', 'POST', form);
    assert.equal(
      recording.language,
      'ta',
      'automatic detection cannot override a selected language',
    );
    assert.equal(recording.confirmationRequired, true);
    const session = await a('sessions');
    assert.equal(session.language, 'ta');
    assert.equal(session.languageSelected, true);
    await a('privacy/consent', 'PUT', { enabled: false, language: 'ml' });
    assert.equal(
      (await a('voice/login', 'PUT', { profileKey: 'a'.repeat(64) })).language,
      'ml',
    );
    const next = await a(
      'conversations/' + conv.id + '/messages',
      'POST',
      { message: 'yes' },
      201,
    );
    assert.equal(next.message.language, 'ml');
    assert.match(next.message.text, /[\u0d00-\u0d7f]/);
    await a(
      'voice/synthesize',
      'POST',
      { ...audio, language: 'ml' },
      409,
      'old text is not spoken as another language',
    );
    const newcomer = client();
    await newcomer('sessions', 'POST', {}, 201);
    const detected = await newcomer('voice/transcribe', 'POST', form);
    assert.equal(detected.language, 'ml');
    assert.equal(
      (await newcomer('sessions')).language,
      'en',
      'transcription alone does not save preferences or profile facts',
    );
    const nc = await newcomer('conversations', 'POST', {}, 201);
    const sent = await newcomer(
      'conversations/' + nc.id + '/messages',
      'POST',
      {
        message: detected.text,
        inputMode: 'voice',
        language: detected.language,
      },
      201,
    );
    assert.equal(sent.message.language, 'ml');
    assert.equal(sent.userMessage.inputMode, 'voice');
    globalThis.__voiceTestEnv.ELEVENLABS_API_KEY = '';
    assert.equal((await a('capabilities')).voice, false);
    await a('voice/synthesize', 'POST', { kind: 'welcome' }, 503);
    assert.equal(
      (await a('sessions')).language,
      'ml',
      'missing voice does not break text/session',
    );
  } finally {
    globalThis.fetch = originalFetch;
    hooks.deregister();
    sqlite.close();
    delete globalThis.__voiceTestEnv;
  }
});
