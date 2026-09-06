import type {
  Profile,
  Rule,
  RuleTree,
  RuleOutcome,
  Scheme,
  Decision,
} from './types';
export function evaluateTree(
  tree: Rule | RuleTree,
  profile: Profile,
  confirmed: string[],
): { result: RuleOutcome['result']; reasons: RuleOutcome[] } {
  if ('all' in tree || 'any' in tree) {
    const all = 'all' in tree;
    const children = all
      ? tree.all
      : (tree as { any: (Rule | RuleTree)[] }).any;
    if (!children.length) return { result: 'UNKNOWN', reasons: [] };
    const r = children.map((c) => evaluateTree(c, profile, confirmed));
    return {
      result: all
        ? r.some((x) => x.result === 'FAIL')
          ? 'FAIL'
          : r.every((x) => x.result === 'PASS')
            ? 'PASS'
            : 'UNKNOWN'
        : r.some((x) => x.result === 'PASS')
          ? 'PASS'
          : r.every((x) => x.result === 'FAIL')
            ? 'FAIL'
            : 'UNKNOWN',
      reasons: r.flatMap((x) => x.reasons),
    };
  }
  const value = profile[tree.field];
  let result: RuleOutcome['result'] = 'UNKNOWN';
  if (
    value !== null &&
    value !== undefined &&
    value !== '' &&
    confirmed.includes(tree.field)
  ) {
    let pass: boolean | undefined;
    if (tree.op === 'eq') pass = value === tree.value;
    if (tree.op === 'neq') pass = value !== tree.value;
    if (tree.op === 'in' && Array.isArray(tree.value))
      pass = tree.value.includes(value as string | number);
    if (typeof value === 'number' && typeof tree.value === 'number') {
      if (tree.op === 'gte') pass = value >= tree.value;
      if (tree.op === 'lte') pass = value <= tree.value;
      if (tree.op === 'gt') pass = value > tree.value;
      if (tree.op === 'lt') pass = value < tree.value;
    }
    if (pass !== undefined) result = pass ? 'PASS' : 'FAIL';
  }
  return {
    result,
    reasons: [
      {
        id: tree.id,
        field: tree.field,
        label: tree.label,
        result,
        source: tree.source,
      },
    ],
  };
}
export function evaluateScheme(
  scheme: Scheme,
  profile: Profile,
  confirmed: string[],
  now = new Date(),
): Decision {
  const r = evaluateTree(scheme.rules, profile, confirmed);
  const age = scheme.sourceCheckedAt
    ? (now.getTime() - Date.parse(scheme.sourceCheckedAt)) / 86400000
    : Infinity;
  const reviewed =
    scheme.reviewStatus === 'VERIFIED' &&
    scheme.complete &&
    r.reasons.length > 0 &&
    age >= 0 &&
    age <= 30;
  return {
    schemeId: scheme.id,
    status: !reviewed
      ? 'UNABLE_TO_DETERMINE'
      : r.result === 'PASS'
        ? 'LIKELY_ELIGIBLE'
        : r.result === 'FAIL'
          ? 'LIKELY_NOT_ELIGIBLE'
          : 'POSSIBLY_ELIGIBLE',
    reasons: r.reasons,
    missingFields: [
      ...new Set(
        r.reasons.filter((x) => x.result === 'UNKNOWN').map((x) => x.field),
      ),
    ],
    notice: !reviewed
      ? 'This record needs independent review of its complete, current rules. Check the official source before relying on eligibility.'
      : r.result === 'UNKNOWN'
        ? 'Some required information is missing. Unknown does not mean ineligible.'
        : 'This is a source-based estimate. The responsible authority makes the final decision.',
    version: scheme.version,
  };
}
export const fields: {
  key: string;
  type: 'number' | 'select';
  max?: number;
  values?: string[];
}[] = [
  { key: 'age', type: 'number', max: 120 },
  {
    key: 'state',
    type: 'select',
    values: [
      'Andhra Pradesh',
      'Arunachal Pradesh',
      'Assam',
      'Bihar',
      'Chhattisgarh',
      'Goa',
      'Gujarat',
      'Haryana',
      'Himachal Pradesh',
      'Jharkhand',
      'Karnataka',
      'Kerala',
      'Madhya Pradesh',
      'Maharashtra',
      'Manipur',
      'Meghalaya',
      'Mizoram',
      'Nagaland',
      'Odisha',
      'Punjab',
      'Rajasthan',
      'Sikkim',
      'Tamil Nadu',
      'Telangana',
      'Tripura',
      'Uttar Pradesh',
      'Uttarakhand',
      'West Bengal',
      'Andaman and Nicobar Islands',
      'Chandigarh',
      'Dadra and Nagar Haveli and Daman and Diu',
      'Delhi',
      'Jammu and Kashmir',
      'Ladakh',
      'Lakshadweep',
      'Puducherry',
    ],
  },
  {
    key: 'occupation',
    type: 'select',
    values: [
      'farmer',
      'student',
      'self_employed',
      'salaried',
      'unorganised_worker',
      'unemployed',
      'retired',
      'artisan',
    ],
  },
  { key: 'gender', type: 'select', values: ['female', 'male', 'other'] },
  { key: 'income', type: 'number', max: 1000000000 },
  {
    key: 'category',
    type: 'select',
    values: ['general', 'sc', 'st', 'obc', 'other'],
  },
  { key: 'residence', type: 'select', values: ['rural', 'urban'] },
  { key: 'land', type: 'number', max: 100000 },
  { key: 'bpl', type: 'select', values: ['yes', 'no'] },
  { key: 'lpg', type: 'select', values: ['yes', 'no'] },
  { key: 'bank', type: 'select', values: ['yes', 'no'] },
  { key: 'taxpayer', type: 'select', values: ['yes', 'no'] },
  { key: 'disability', type: 'number', max: 100 },
];
export function validateProfile(input: unknown): Profile {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('Profile must be an object.');
  const p: Profile = {};
  for (const [k, v] of Object.entries(input)) {
    const f = fields.find((x) => x.key === k);
    if (!f) throw new Error('Unsupported profile field.');
    if (v === null || v === '') {
      p[k] = null;
      continue;
    }
    if (f.type === 'number') {
      if (
        typeof v !== 'number' ||
        !Number.isFinite(v) ||
        v < 0 ||
        v > (f.max ?? 1e9) ||
        (k === 'age' && !Number.isInteger(v))
      )
        throw new Error('Enter a valid ' + k + '.');
    } else if (typeof v !== 'string' || !f.values?.includes(v))
      throw new Error('Choose a valid ' + k + '.');
    p[k] = v as Profile[string];
  }
  return p;
}
export function redact(text: string) {
  return text
    .replace(/\b\d[\d\s-]{8,}\d\b/g, '[redacted]')
    .replace(/\b[A-Z]{5}\d{4}[A-Z]\b/gi, '[redacted]')
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, '[redacted]');
}
