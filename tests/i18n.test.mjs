import test from 'node:test';
import assert from 'node:assert/strict';
import { copy, statusNames, categoryNames } from '../lib/i18n.ts';

const LANGS = ['en', 'hi', 'kn', 'ta', 'ml'];

/**
 * A missing key does not throw — it renders `undefined` or the raw key name
 * to a Hindi or Kannada speaker while English looks perfect. These tests are
 * the only thing standing between an added string and that happening.
 */

test('every language carries exactly the same keys', () => {
  const en = Object.keys(copy.en).sort();
  for (const lang of LANGS.slice(1)) {
    const other = Object.keys(copy[lang]).sort();
    const missing = en.filter((k) => !other.includes(k));
    const extra = other.filter((k) => !en.includes(k));
    assert.deepEqual(missing, [], `${lang} is missing: ${missing.join(', ')}`);
    assert.deepEqual(
      extra,
      [],
      `${lang} has keys English does not: ${extra.join(', ')}`,
    );
  }
});

test('no string is empty or whitespace in any language', () => {
  for (const lang of LANGS)
    for (const [k, v] of Object.entries(copy[lang]))
      assert.ok(
        typeof v === 'string' && v.trim().length > 0,
        `${lang}.${k} is empty`,
      );
});

test('translations are not English left in place', () => {
  // Proper nouns and codes legitimately repeat; prose must not.
  const allowed = new Set(['lang']);
  const untranslated = [];
  for (const lang of LANGS.slice(1))
    for (const [k, v] of Object.entries(copy[lang]))
      if (
        !allowed.has(k) &&
        v === copy.en[k] &&
        // A short token may legitimately be the same; a sentence never is.
        String(v).split(/\s+/).length > 2
      )
        untranslated.push(`${lang}.${k}`);
  assert.deepEqual(
    untranslated,
    [],
    'untranslated: ' + untranslated.join(', '),
  );
});

test('no string still contains a placeholder or TODO', () => {
  for (const lang of LANGS)
    for (const [k, v] of Object.entries(copy[lang]))
      assert.ok(
        !/TODO|FIXME|Lorem|xxx|\{\{/i.test(String(v)),
        `${lang}.${k} carries a placeholder: ${v}`,
      );
});

test('every verdict has a label in all five languages', () => {
  const statuses = [
    'LIKELY_ELIGIBLE',
    'POSSIBLY_ELIGIBLE',
    'LIKELY_NOT_ELIGIBLE',
    'UNABLE_TO_DETERMINE',
  ];
  for (const s of statuses) {
    assert.ok(statusNames[s], `no label for ${s}`);
    assert.equal(
      statusNames[s].length,
      LANGS.length,
      `${s} is missing a language`,
    );
    for (const v of statusNames[s]) assert.ok(v.trim().length > 0, s);
  }
});

test('UNABLE_TO_DETERMINE is worded as an answer, not an absence', () => {
  // An honest "we cannot determine this" is a first-class verdict per
  // PRODUCT.md. Wording it as nothing-here would undo that in the copy.
  for (const v of statusNames.UNABLE_TO_DETERMINE)
    assert.ok(!/^(-|—|n\/?a|none|null)$/i.test(v.trim()), v);
});

test('every category has both of its translations', () => {
  for (const [k, v] of Object.entries(categoryNames)) {
    assert.equal(v.length, 2, `${k} is missing a translation`);
    for (const s of v) assert.ok(s.trim().length > 0, k);
  }
});

test('profile field labels exist for every field the rules use', async () => {
  const { fields } = await import('../lib/rules.ts');
  for (const f of fields)
    for (const lang of LANGS)
      assert.ok(
        copy[lang][f.key],
        `${lang} has no label for the "${f.key}" field`,
      );
});
