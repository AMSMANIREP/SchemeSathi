/**
 * Measures profile extraction per language, so "can this provider read
 * Kannada?" is answered with numbers instead of an opinion.
 *
 * Two modes, chosen by whether a provider is configured:
 *
 *   no key   -> scores the deterministic pattern extractor (the baseline the
 *               product falls back to, and what ships today)
 *   with key -> scores the configured model
 *
 * Configure a provider with either set of variables:
 *   LLM_BASE_URL, LLM_API_KEY, LLM_MODEL                 (any OpenAI-compatible)
 *   AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_OPENAI_CHAT_DEPLOYMENT
 *
 * Run: pnpm eval:extraction
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  extractionRequest,
  parseExtraction,
  patternExtract,
} from '../lib/extract.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { cases } = JSON.parse(
  readFileSync(join(root, 'tests/extraction-cases.json'), 'utf8'),
);

const LANGS = { en: 'English', hi: 'Hindi', kn: 'Kannada' };

/** Mirrors lib/llm.ts, reading process.env instead of the Worker binding. */
function provider() {
  const e = process.env;
  if (e.LLM_BASE_URL && e.LLM_API_KEY && e.LLM_MODEL) {
    const base = e.LLM_BASE_URL.replace(/\/+$/, '');
    return {
      url: /\/v\d+$/.test(base)
        ? `${base}/chat/completions`
        : `${base}/v1/chat/completions`,
      headers: {
        Authorization: `Bearer ${e.LLM_API_KEY}`,
        'Content-Type': 'application/json',
      },
      model: e.LLM_MODEL,
      name: `${new URL(base).host} · ${e.LLM_MODEL}`,
    };
  }
  if (
    e.AZURE_OPENAI_ENDPOINT &&
    e.AZURE_OPENAI_API_KEY &&
    e.AZURE_OPENAI_CHAT_DEPLOYMENT
  )
    return {
      url: `${e.AZURE_OPENAI_ENDPOINT.replace(/\/+$/, '')}/openai/v1/chat/completions`,
      headers: {
        'api-key': e.AZURE_OPENAI_API_KEY,
        'Content-Type': 'application/json',
      },
      model: e.AZURE_OPENAI_CHAT_DEPLOYMENT,
      name: `azure · ${e.AZURE_OPENAI_CHAT_DEPLOYMENT}`,
    };
  return null;
}

async function runCase(config, c) {
  if (!config) return { profile: patternExtract(c.text) };
  const r = await fetch(config.url, {
    method: 'POST',
    headers: config.headers,
    body: JSON.stringify(extractionRequest(config.model, c.text, c.language)),
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) return { error: `${r.status} ${(await r.text()).slice(0, 120)}` };
  try {
    return { profile: parseExtraction(await r.json()) };
  } catch (e) {
    return { error: 'unparseable: ' + e.message };
  }
}

function score(expected, got) {
  const wanted = Object.entries(expected);
  const correct = wanted.filter(
    ([k, v]) => got[k] !== undefined && got[k] !== null && String(got[k]) === String(v),
  ).length;
  const stated = Object.entries(got).filter(([, v]) => v !== null && v !== undefined);
  return { wanted: wanted.length, correct, stated: stated.length };
}

async function main() {
  const config = provider();
  console.log(
    config
      ? `Evaluating: ${config.name}\n`
      : 'No provider configured — scoring the deterministic pattern extractor.\n' +
          'Set LLM_BASE_URL / LLM_API_KEY / LLM_MODEL to score a model.\n',
  );

  const byLang = {};
  const problems = [];

  for (const c of cases) {
    const lang = (byLang[c.language] ||= {
      wanted: 0,
      correct: 0,
      invented: 0,
      errors: 0,
    });
    const result = await runCase(config, c);
    if (result.error) {
      lang.errors++;
      problems.push(`  ${c.id}: ${result.error}`);
      continue;
    }
    const got = result.profile;
    const s = score(c.expect, got);
    lang.wanted += s.wanted;
    lang.correct += s.correct;

    // Inventing a fact is worse than missing one: a wrong fact becomes a
    // wrong verdict, while a missing one becomes an honest question.
    for (const field of c.mustNotInfer || [])
      if (got[field] !== undefined && got[field] !== null) {
        lang.invented++;
        problems.push(`  ${c.id}: invented ${field}=${JSON.stringify(got[field])}`);
      }
    for (const [k, v] of Object.entries(c.expect))
      if (got[k] === undefined || got[k] === null)
        problems.push(`  ${c.id}: missed ${k} (expected ${JSON.stringify(v)})`);
      else if (String(got[k]) !== String(v))
        problems.push(
          `  ${c.id}: wrong ${k}=${JSON.stringify(got[k])}, expected ${JSON.stringify(v)}`,
        );
  }

  console.log('language   recall      invented  errors');
  let totalWanted = 0;
  let totalCorrect = 0;
  let totalInvented = 0;
  for (const [code, name] of Object.entries(LANGS)) {
    const l = byLang[code];
    if (!l) continue;
    totalWanted += l.wanted;
    totalCorrect += l.correct;
    totalInvented += l.invented;
    const pct = l.wanted ? Math.round((l.correct / l.wanted) * 100) : 0;
    console.log(
      `${name.padEnd(10)} ${String(l.correct + '/' + l.wanted).padEnd(7)} ${String(pct + '%').padEnd(5)} ${String(l.invented).padEnd(9)} ${l.errors}`,
    );
  }
  const pct = totalWanted ? Math.round((totalCorrect / totalWanted) * 100) : 0;
  console.log(
    `${'OVERALL'.padEnd(10)} ${String(totalCorrect + '/' + totalWanted).padEnd(7)} ${String(pct + '%').padEnd(5)} ${totalInvented}`,
  );

  if (problems.length) {
    console.log('\nDetail:');
    for (const p of problems) console.log(p);
  }

  console.log(
    '\nRecall is how much of what a citizen actually said was captured.\n' +
      '"Invented" counts facts that were never stated — the number that matters most,\n' +
      'because a wrong fact becomes a wrong verdict while a missing one becomes a question.',
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
