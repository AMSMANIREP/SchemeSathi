import fs from 'node:fs';
import crypto from 'node:crypto';
const file = process.argv[2] || 'data/schemes.json';
const schemes = JSON.parse(fs.readFileSync(file, 'utf8'));
let reviewed = 0;
for (const scheme of schemes) {
  if (scheme.reviewStatus !== 'VERIFIED') continue;
  const path = `data/reviews/${scheme.id}.${scheme.version}.json`;
  if (!fs.existsSync(path))
    throw new Error(`Missing independent review: ${scheme.id}`);
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
    throw new Error(`Review evidence incomplete: ${scheme.id}`);
  const age = (Date.now() - Date.parse(scheme.sourceCheckedAt)) / 86400000;
  if (!scheme.complete || !Number.isFinite(age) || age < 0 || age > 30)
    throw new Error(`Stale or incomplete rules: ${scheme.id}`);
  const visit = (t, depth = 0) => {
    if (depth > 8) throw new Error('Rule nesting too deep');
    if ('all' in t || 'any' in t) {
      if ('all' in t === 'any' in t) throw new Error('Invalid grouping');
      const children = t.all || t.any;
      if (!children.length) throw new Error('Empty rules');
      children.forEach((c) => visit(c, depth + 1));
    } else {
      const u = new URL(t.source);
      if (
        !t.id ||
        !t.label ||
        !['eq', 'neq', 'gte', 'lte', 'gt', 'lt', 'in'].includes(t.op) ||
        u.protocol !== 'https:' ||
        !/\.(gov|nic)\.in$/.test(u.hostname)
      )
        throw new Error('Invalid or uncited rule');
    }
  };
  visit(scheme.rules);
  reviewed++;
}
console.log(
  `${reviewed} independently reviewed manifests; ${schemes.length - reviewed} draft records remain disabled for eligibility.`,
);
