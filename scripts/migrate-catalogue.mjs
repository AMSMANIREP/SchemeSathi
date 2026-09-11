/**
 * Converts data/schemes.json from flat strings to the structured shape the
 * personalised report needs:
 *
 *   documents: string[]  ->  { item, note, proves? }[]
 *   steps:     string[]  ->  { title, detail, where, who, typicalWait,
 *                              relatesTo, onlyIf? }[]
 *   + fees: string
 *
 * Idempotent: re-running on an already-converted catalogue changes nothing.
 *
 * The new per-step fields are left empty on purpose. They carry office names,
 * who the citizen deals with, and typical waits — facts that must be
 * researched per scheme and authored, never guessed here. The report renders
 * an empty field as "not yet recorded" rather than inventing one.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export function toDocument(value) {
  if (value && typeof value === 'object') return value;
  return { item: String(value), note: '' };
}

export function toStep(value) {
  if (value && typeof value === 'object') return value;
  return {
    title: String(value),
    detail: '',
    where: '',
    who: '',
    typicalWait: '',
    relatesTo: [],
  };
}

export function migrate(scheme) {
  return {
    ...scheme,
    documents: (scheme.documents || []).map(toDocument),
    steps: (scheme.steps || []).map(toStep),
    fees: typeof scheme.fees === 'string' ? scheme.fees : '',
  };
}

function main() {
  const path = join(root, 'data/schemes.json');
  const before = JSON.parse(readFileSync(path, 'utf8'));
  const after = before.map(migrate);

  const alreadyDone = JSON.stringify(before) === JSON.stringify(after);
  if (alreadyDone) {
    console.log('migrate-catalogue: already structured, nothing to do');
    return;
  }

  writeFileSync(path, JSON.stringify(after, null, 2) + '\n');
  const steps = after.reduce((n, s) => n + s.steps.length, 0);
  const docs = after.reduce((n, s) => n + s.documents.length, 0);
  const authored = after.reduce(
    (n, s) => n + s.steps.filter((x) => x.where || x.who || x.typicalWait).length,
    0,
  );
  console.log(
    `migrate-catalogue: ${after.length} schemes -> ${steps} steps, ${docs} documents`,
  );
  console.log(
    `migrate-catalogue: ${authored}/${steps} steps carry where/who/wait — the rest await authoring`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
