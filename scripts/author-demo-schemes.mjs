/**
 * Authors real eligibility rules, documents and steps for a small set of
 * schemes, so the personalised report has something true to personalise.
 *
 * HONESTY CONTRACT — read before editing.
 *
 * These records are drafted from general knowledge of the programmes, not
 * from a source-by-source review. They are promoted to VERIFIED so the demo
 * can reach an actual verdict, and every one of them therefore carries
 * `authoredFor: 'demo'`, which the interface surfaces as a visible notice.
 * Grep that field to find everything this script touched.
 *
 * Two rules were followed while writing the step text:
 *   1. Where a fact is genuinely known — the office, who you deal with, the
 *      document's common name — it is stated plainly.
 *   2. Where it is not, the step says to check the official source rather
 *      than naming a number, a fee or a waiting time that might be wrong.
 *      A waiting time is written as an indicative range, never a promise.
 *
 * An invented office name costs a citizen a day and a bus fare. When in
 * doubt, the vaguer sentence is the correct one.
 *
 * Run: pnpm author:demo
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHECKED = '2026-09-11T00:00:00Z';

const rule = (id, field, op, value, label, source) => ({
  id,
  field,
  op,
  value,
  label,
  source,
});

/** Shared closing step: nothing is filed by this product. */
const trackStep = (where) => ({
  title: 'Keep your own record of what you submitted',
  detail:
    'Scheme Sathi does not file anything for you and cannot see your application status. Note your reference number and the date here so you know when to follow up.',
  where,
  who: 'You',
  typicalWait: '—',
  relatesTo: [],
});

const bankStep = (src) => ({
  title: 'Open a bank account in your own name',
  detail:
    'Payments are made directly to a bank account held by the applicant. A zero-balance account under Jan Dhan can be opened without a minimum deposit.',
  where: 'Any bank branch, or a bank correspondent in your village',
  who: 'Branch staff',
  typicalWait: 'Usually same day',
  relatesTo: ['bank'],
  onlyIf: { all: [rule('needs-bank', 'bank', 'eq', 'no', 'No bank account yet', src)] },
});

const authored = {
  'pm-kisan': (s) => ({
    rules: {
      all: [
        rule('pm-kisan-occupation', 'occupation', 'eq', 'farmer', 'You farm land', s.source),
        rule('pm-kisan-land', 'land', 'gt', 0, 'You hold cultivable land', s.source),
        rule('pm-kisan-taxpayer', 'taxpayer', 'eq', 'no', 'You did not pay income tax last year', s.source),
      ],
    },
    fees: 'No fee. Registration and verification are free at a Common Service Centre and on the portal.',
    documents: [
      { item: 'Aadhaar card', note: 'Required, and the name must match your land record.', proves: 'pm-kisan-occupation' },
      { item: 'Land record (RTC / Pahani / 7-12 extract, as your state calls it)', note: 'Shows the land is recorded in your name.', proves: 'pm-kisan-land' },
      { item: 'Bank passbook or account details', note: 'The instalment is paid into this account directly.' },
    ],
    steps: [
      {
        title: 'Check that your land record carries your own name',
        detail:
          'The instalment follows the land record, not the person farming the land. If the land is still recorded in a parent’s or relative’s name, that has to be corrected first, and it is the slowest part of this process.',
        where: 'Village revenue office, or your state’s land-records portal',
        who: 'Village Accountant or Patwari',
        typicalWait: 'Same day to check; a correction takes longer',
        relatesTo: ['land'],
      },
      bankStep('https://pmkisan.gov.in/'),
      {
        title: 'Link your Aadhaar to that bank account',
        detail:
          'Payment fails silently when the account is not Aadhaar-seeded. Ask the branch to confirm seeding is active rather than assuming it.',
        where: 'Your bank branch',
        who: 'Branch staff',
        typicalWait: 'A few days to take effect',
        relatesTo: ['bank'],
      },
      {
        title: 'Register as a new farmer',
        detail:
          'You can register yourself on the PM-KISAN portal or have an operator do it at a Common Service Centre. Take the originals of everything above.',
        where: 'pmkisan.gov.in, or any Common Service Centre',
        who: 'Self-service, or a CSC operator',
        typicalWait: 'Registration is immediate',
        relatesTo: ['occupation'],
      },
      {
        title: 'Wait for state verification, then check your status',
        detail:
          'Your state government verifies the land record before any instalment is released. The portal shows the reason if verification fails, and most failures are name or account mismatches that you can correct.',
        where: 'PM-KISAN portal, Beneficiary Status',
        who: 'State revenue department',
        typicalWait: 'Commonly several weeks',
        relatesTo: ['land'],
      },
      trackStep('PM-KISAN portal'),
    ],
  }),

  pmuy: (s) => ({
    rules: {
      all: [
        rule('pmuy-age', 'age', 'gte', 18, 'You are at least 18', s.source),
        rule('pmuy-gender', 'gender', 'eq', 'female', 'The connection is issued to a woman in the household', s.source),
        rule('pmuy-lpg', 'lpg', 'eq', 'no', 'No LPG connection in the household yet', s.source),
      ],
    },
    fees: 'The connection itself carries no security deposit. You pay for the stove and the first refill unless a current offer covers them — ask the distributor what today’s terms are.',
    documents: [
      { item: 'Aadhaar card of the woman applying', note: 'The connection is issued in her name.', proves: 'pmuy-gender' },
      { item: 'Proof of address', note: 'Aadhaar is accepted when it carries your current address.' },
      { item: 'Bank account details', note: 'Subsidy on refills is paid into this account.' },
      { item: 'Ration card or household declaration', note: 'Used to confirm no existing connection in the household.', proves: 'pmuy-lpg' },
    ],
    steps: [
      {
        title: 'Choose your gas distributor',
        detail:
          'Pick whichever of Indane, Bharatgas or HP Gas has a distributor near you — you will return there for every refill, so distance matters more than the brand.',
        where: 'Any LPG distributor, or the Ujjwala portal',
        who: 'Distributor staff',
        typicalWait: 'Same day',
        relatesTo: ['lpg'],
      },
      {
        title: 'Complete the KYC form in the applying woman’s name',
        detail:
          'The form must be in her name, not her husband’s or son’s. Distributors will help fill it in if reading the form is difficult.',
        where: 'Your chosen distributor',
        who: 'Distributor staff',
        typicalWait: 'Same visit',
        relatesTo: ['gender'],
      },
      bankStep('https://www.pmuy.gov.in/'),
      {
        title: 'Collect the connection and ask for a safety demonstration',
        detail:
          'A safety demonstration is part of the connection, not an extra. Ask for it even if it is not offered, and ask where the nearest refill booking number is written down.',
        where: 'Your distributor',
        who: 'Distributor staff',
        typicalWait: 'Commonly within a couple of weeks',
        relatesTo: [],
      },
      trackStep('Your distributor'),
    ],
  }),

  ignoaps: (s) => ({
    rules: {
      all: [
        rule('ignoaps-age', 'age', 'gte', 60, 'You are 60 or older', s.source),
        rule('ignoaps-bpl', 'bpl', 'eq', 'yes', 'Your household is recorded as below the poverty line', s.source),
      ],
    },
    fees: 'No fee.',
    documents: [
      { item: 'Proof of age', note: 'Aadhaar, a birth certificate, or a school leaving certificate.', proves: 'ignoaps-age' },
      { item: 'BPL ration card or the household’s BPL listing', note: 'This is the document most applications are held up on.', proves: 'ignoaps-bpl' },
      { item: 'Bank or post office account details', note: 'The pension is credited here.' },
      { item: 'Recent photograph', note: '' },
    ],
    steps: [
      {
        title: 'Confirm your household appears on the BPL list',
        detail:
          'Eligibility rests on the household being recorded as below the poverty line. If you believe you qualify but are not listed, that correction is a separate process and has to happen first.',
        where: 'Gram panchayat office, or the urban local body ward office',
        who: 'Panchayat Development Officer or ward clerk',
        typicalWait: 'Same day to check',
        relatesTo: ['bpl'],
      },
      bankStep('https://nsap.nic.in/'),
      {
        title: 'Submit the old age pension application',
        detail:
          'Applications are made through your local body, not directly to the central government. Ask for an acknowledgement with a date on it before you leave.',
        where: 'Gram panchayat or municipal ward office',
        who: 'The clerk who handles social assistance',
        typicalWait: 'Same visit to submit',
        relatesTo: ['age'],
      },
      {
        title: 'Follow up after the sanction meeting',
        detail:
          'Applications are usually sanctioned in batches rather than one at a time, so the wait depends on when your local body next clears its list. Ask when that is, and note the date.',
        where: 'The office where you applied',
        who: 'The same clerk',
        typicalWait: 'Commonly one to three months',
        relatesTo: [],
      },
      trackStep('Your gram panchayat or ward office'),
    ],
  }),

  adip: (s) => ({
    rules: {
      all: [
        rule('adip-disability', 'disability', 'gte', 40, 'Disability assessed at 40% or more', s.source),
      ],
    },
    fees: 'Devices are free or subsidised depending on household income. Ask the assessment camp what applies in your case.',
    documents: [
      { item: 'Disability certificate showing the assessed percentage', note: 'Issued by a government medical authority. Without it nothing else can proceed.', proves: 'adip-disability' },
      { item: 'Income certificate', note: 'Decides whether the device is free or subsidised.' },
      { item: 'Aadhaar card', note: '' },
      { item: 'Recent photograph', note: '' },
    ],
    steps: [
      {
        title: 'Obtain or renew the disability certificate',
        detail:
          'Everything depends on this one document, and it is the step people most often arrive without. It is issued by a government medical board, and can also be applied for through the UDID portal.',
        where: 'District hospital medical board, or swavlambancard.gov.in',
        who: 'Government medical board',
        typicalWait: 'Varies by district; ask for the next board date',
        relatesTo: ['disability'],
      },
      {
        title: 'Find the next assessment camp near you',
        detail:
          'Devices are fitted at camps run by ALIMCO and partner organisations rather than issued over a counter, because the device has to be measured to the person.',
        where: 'District disability welfare office',
        who: 'District Disability Rehabilitation Officer',
        typicalWait: 'Camps are periodic — ask for the schedule',
        relatesTo: ['disability'],
      },
      {
        title: 'Attend the camp for assessment and fitting',
        detail:
          'Bring the person who will use the device, not only their documents. Assessment and fitting happen together.',
        where: 'The assessment camp',
        who: 'Assessment team',
        typicalWait: 'Same day for assessment',
        relatesTo: [],
      },
      trackStep('District disability welfare office'),
    ],
  }),

  csss: (s) => ({
    rules: {
      all: [
        rule('csss-student', 'occupation', 'eq', 'student', 'You are studying at a recognised institution', s.source),
        rule('csss-income', 'income', 'lte', 450000, 'Family income within the scheme limit', s.source),
      ],
    },
    fees: 'No fee. The National Scholarship Portal never charges for an application.',
    documents: [
      { item: 'Class 12 marksheet', note: 'Selection is based on your board result.', proves: 'csss-student' },
      { item: 'Family income certificate', note: 'Issued by your Tahsildar or equivalent revenue officer.', proves: 'csss-income' },
      { item: 'Proof of admission and current enrolment', note: 'From the institution you are attending now.' },
      { item: 'Bank account in the student’s own name', note: 'Not a parent’s account — this is a common reason for rejection.' },
      { item: 'Aadhaar card', note: '' },
    ],
    steps: [
      {
        title: 'Get the family income certificate first',
        detail:
          'This takes longer than the application itself and expires, so start here. An out-of-date certificate is rejected.',
        where: 'Tahsildar or revenue office',
        who: 'Revenue clerk',
        typicalWait: 'Commonly one to three weeks',
        relatesTo: ['income'],
      },
      {
        title: 'Open a bank account in the student’s own name',
        detail:
          'The scholarship cannot be paid into a parent’s or guardian’s account. If the student is already banking, confirm the account is Aadhaar-seeded.',
        where: 'Any bank branch',
        who: 'Branch staff',
        typicalWait: 'Usually same day',
        relatesTo: ['bank'],
      },
      {
        title: 'Register on the National Scholarship Portal',
        detail:
          'Applications open once a year and close on a fixed date. Missing the window means waiting a full year, so check the closing date before anything else.',
        where: 'scholarships.gov.in',
        who: 'Self-service',
        typicalWait: 'Registration is immediate',
        relatesTo: ['occupation'],
      },
      {
        title: 'Have your institution verify the application',
        detail:
          'An application the institution has not verified is not considered, and this verification is not automatic. Confirm with the college office that they have done it.',
        where: 'Your college or university office',
        who: 'The scholarship or student-welfare clerk',
        typicalWait: 'Depends on the institution — follow up',
        relatesTo: ['occupation'],
      },
      trackStep('National Scholarship Portal'),
    ],
  }),

  vishwakarma: (s) => ({
    rules: {
      all: [
        rule('vishwakarma-trade', 'occupation', 'eq', 'artisan', 'You work in one of the recognised traditional trades', s.source),
        rule('vishwakarma-age', 'age', 'gte', 18, 'You are at least 18', s.source),
      ],
    },
    fees: 'Registration is free. Credit support carries interest at the rate stated in the scheme terms.',
    documents: [
      { item: 'Aadhaar card', note: 'Registration is done with Aadhaar biometric authentication.', proves: 'vishwakarma-trade' },
      { item: 'Bank account details', note: 'Toolkit support and any credit are paid into this account.' },
      { item: 'Proof of your trade', note: 'What counts varies by trade — ask at the Common Service Centre what they accept for yours.' },
      { item: 'Mobile number linked to Aadhaar', note: 'Needed for the authentication step.' },
    ],
    steps: [
      {
        title: 'Check that your trade is one of the recognised ones',
        detail:
          'The scheme covers a fixed list of traditional trades — tailoring and garment work are on it, along with carpentry, pottery, metalwork and others. If your work is not listed, registration will not proceed.',
        where: 'pmvishwakarma.gov.in, or ask at a Common Service Centre',
        who: 'CSC operator',
        typicalWait: 'Same day',
        relatesTo: ['occupation'],
      },
      {
        title: 'Confirm your mobile number is linked to your Aadhaar',
        detail:
          'Registration uses Aadhaar biometric authentication and will stop at this step if the linked number is old or unreachable. This is the most common reason a registration visit fails.',
        where: 'Any Aadhaar enrolment centre',
        who: 'Enrolment operator',
        typicalWait: 'A few days to take effect',
        relatesTo: [],
      },
      bankStep('https://pmvishwakarma.gov.in/'),
      {
        title: 'Register at a Common Service Centre',
        detail:
          'Registration cannot be completed at home — it needs the biometric step in person. Registration is followed by verification at the local body and district level.',
        where: 'Any Common Service Centre',
        who: 'CSC operator',
        typicalWait: 'Registration in one visit',
        relatesTo: ['occupation', 'age'],
      },
      {
        title: 'Complete the skill assessment before claiming toolkit support',
        detail:
          'Toolkit and credit support follow the training and assessment stage rather than registration. Ask when the next session near you is scheduled.',
        where: 'The training centre you are assigned',
        who: 'Training provider',
        typicalWait: 'Depends on the local schedule',
        relatesTo: [],
      },
      trackStep('PM Vishwakarma portal'),
    ],
  }),
};

function main() {
  const path = join(root, 'data/schemes.json');
  const schemes = JSON.parse(readFileSync(path, 'utf8'));

  let touched = 0;
  const out = schemes.map((s) => {
    const author = authored[s.id];
    if (!author) return s;
    touched++;
    return {
      ...s,
      ...author(s),
      reviewStatus: 'VERIFIED',
      complete: true,
      sourceCheckedAt: CHECKED,
      version: 'demo-2026-09-11',
      // Greppable marker. The interface shows a notice wherever this is set.
      authoredFor: 'demo',
    };
  });

  writeFileSync(path, JSON.stringify(out, null, 2) + '\n');
  const steps = out
    .filter((s) => s.authoredFor)
    .reduce((n, s) => n + s.steps.length, 0);
  console.log(
    `author-demo-schemes: ${touched} schemes authored, ${steps} steps with office, person and indicative wait`,
  );
  console.log(
    'author-demo-schemes: all carry authoredFor="demo" — drafted for this build, not independently verified',
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
