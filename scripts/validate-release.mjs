/**
 * Release gate. Run before any deploy.
 *
 * Three things it refuses to let past:
 *   1. A VERIFIED record without independent review evidence.
 *   2. Demo-authored records, unless the release explicitly opts in.
 *   3. A retrieval index built from a different catalogue than the one shipping.
 *
 * Usage: node scripts/validate-release.mjs [file] [--allow-demo]
 */
import fs from 'node:fs';
import crypto from 'node:crypto';

const args = process.argv.slice(2);
const allowDemo = args.includes('--allow-demo');
const file = args.find((a) => !a.startsWith('--')) || 'data/schemes.json';

const raw = fs.readFileSync(file, 'utf8');
const schemes = JSON.parse(raw);

const fail = (message) => {
  console.error('\nRelease blocked: ' + message + '\n');
  process.exit(1);
};

// ---- 1. Demo data must never ship by accident -----------------------------

const demo = schemes.filter((s) => s.authoredFor === 'demo');
if (demo.length && !allowDemo)
  fail(
    `${demo.length} scheme(s) are authored for demonstration and promoted to VERIFIED ` +
      `without independent review:\n  ${demo.map((s) => s.id).join(', ')}\n\n` +
      'These were drafted for a demo build, not checked source-by-source against\n' +
      'official portals. Shipping them as a production release would assert a review\n' +
      'that did not happen.\n\n' +
      'If this IS the demo build, re-run with --allow-demo.\n' +
      'If this is production, replace them with independently reviewed records.',
  );

// ---- 2. Independent review evidence for anything else claiming VERIFIED ----

let reviewed = 0;
for (const scheme of schemes) {
  if (scheme.reviewStatus !== 'VERIFIED') continue;
  if (scheme.authoredFor === 'demo') continue; // reported above

  const path = `data/reviews/${scheme.id}.${scheme.version}.json`;
  if (!fs.existsSync(path))
    fail(`Missing independent review evidence for ${scheme.id} (${path})`);
  const review = JSON.parse(fs.readFileSync(path, 'utf8'));
  const digest = crypto
    .createHash('sha256')
    .update(JSON.stringify(scheme))
    .digest('hex');
  if (
    !review.author ||
    !review.reviewer ||
    review.author === review.reviewer ||
    !review.sourceSnapshot ||
    !review.reviewNotes ||
    review.manifestSha256 !== digest
  )
    fail(`Review evidence incomplete for ${scheme.id}`);
  const age = (Date.now() - Date.parse(scheme.sourceCheckedAt)) / 86400000;
  if (!scheme.complete || !Number.isFinite(age) || age < 0 || age > 30)
    fail(`Stale or incomplete rules for ${scheme.id}`);
  reviewed++;
}

// ---- 3. Rules stay well-formed and cited, demo or not ---------------------

const visit = (t, id, depth = 0) => {
  if (depth > 8) fail(`Rule nesting too deep in ${id}`);
  if ('all' in t || 'any' in t) {
    if ('all' in t === 'any' in t) fail(`Invalid rule grouping in ${id}`);
    const children = t.all || t.any;
    // A VERIFIED record with no rules can never reach a verdict, so an empty
    // group there is a packaging mistake rather than a valid state.
    if (!children.length) fail(`Empty rules in ${id}`);
    children.forEach((c) => visit(c, id, depth + 1));
  } else {
    const u = new URL(t.source);
    if (
      !t.id ||
      !t.label ||
      !['eq', 'neq', 'gte', 'lte', 'gt', 'lt', 'in'].includes(t.op) ||
      u.protocol !== 'https:' ||
      !/\.(gov|nic)\.in$/.test(u.hostname)
    )
      fail(`Invalid or uncited rule in ${id}`);
  }
};
for (const scheme of schemes)
  if (scheme.reviewStatus === 'VERIFIED') visit(scheme.rules, scheme.id);

// ---- 4. Every step a citizen may carry into an office must be complete -----

for (const scheme of schemes.filter((s) => s.reviewStatus === 'VERIFIED'))
  for (const step of scheme.steps || [])
    if (!step.title || !step.where || !step.who || !step.typicalWait)
      fail(
        `${scheme.id}: step "${step.title || '(untitled)'}" is missing an office, ` +
          'a person or a wait. A printed report must not send someone to a blank address.',
      );

// ---- 5. The shipped retrieval index must match the shipped catalogue ------

const catalogueHash = crypto
  .createHash('sha256')
  .update(raw)
  .digest('hex')
  .slice(0, 16);

for (const artifact of ['data/chunks.json', 'data/bm25.json']) {
  if (!fs.existsSync(artifact)) fail(`Missing retrieval artifact: ${artifact}`);
  const { catalogueHash: built } = JSON.parse(fs.readFileSync(artifact, 'utf8'));
  if (built !== catalogueHash)
    fail(
      `${artifact} was built from a different catalogue (${built} vs ${catalogueHash}).\n` +
        'Run `pnpm build:index` and commit the result.',
    );
}

// ---- Report ---------------------------------------------------------------

const drafts = schemes.length - reviewed - demo.length;
console.log(
  `${reviewed} independently reviewed manifest(s); ${drafts} draft record(s) disabled for eligibility.`,
);
console.log(`Retrieval index matches the catalogue (${catalogueHash}).`);
if (demo.length)
  console.log(
    `\n  DEMONSTRATION BUILD: ${demo.length} record(s) authored for demo and not\n` +
      `  independently verified — ${demo.map((s) => s.id).join(', ')}.\n` +
      '  The interface shows this to the citizen. Do not present as production.\n',
  );
