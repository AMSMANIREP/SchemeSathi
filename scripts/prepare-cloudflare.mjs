import fs from 'node:fs';
// Preserve the existing public deployment policy without changing the source
// catalogue or claiming that demonstration data received independent review.
const file = 'lib/catalogue.ts';
const original = 'export const catalogue = rows as Scheme[];';
const prepared =
  'export const catalogue: Scheme[] = (rows as Scheme[]).map(s => s.authoredFor === "demo" ? {...s, reviewStatus: "DRAFT", complete: false} : s);';
const source = fs.readFileSync(file, 'utf8');
if (source.includes(prepared)) process.exit(0);
if (source.split(original).length !== 2)
  throw Error('Catalogue changed; review deployment draft policy.');
fs.writeFileSync(file, source.replace(original, prepared));
console.log(
  'Preserved public deployment policy: demo records remain unreviewed drafts.',
);
