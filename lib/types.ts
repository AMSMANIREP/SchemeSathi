export type Language = 'en' | 'hi' | 'kn';
export type Profile = Record<string, string | number | boolean | null>;
export type Rule = {
  id: string;
  field: string;
  op: 'eq' | 'neq' | 'gte' | 'lte' | 'gt' | 'lt' | 'in';
  value: string | number | boolean | (string | number)[];
  label: string;
  source: string;
};
export type RuleTree =
  | { all: (Rule | RuleTree)[] }
  | { any: (Rule | RuleTree)[] };
export type Scheme = {
  id: string;
  name: string;
  shortName: string;
  category: string;
  ministry: string;
  summary: string;
  benefit: string;
  source: string;
  sourceTitle: string;
  sourceCheckedAt: string | null;
  reviewStatus: 'DRAFT' | 'VERIFIED';
  version: string;
  rules: RuleTree;
  complete: boolean;
  documents: string[];
  steps: string[];
  tags: string[];
};
export type RuleOutcome = {
  id: string;
  field: string;
  label: string;
  result: 'PASS' | 'FAIL' | 'UNKNOWN';
  source: string;
};
export type Decision = {
  schemeId: string;
  status:
    | 'LIKELY_ELIGIBLE'
    | 'POSSIBLY_ELIGIBLE'
    | 'LIKELY_NOT_ELIGIBLE'
    | 'UNABLE_TO_DETERMINE';
  reasons: RuleOutcome[];
  missingFields: string[];
  notice: string;
  version: string;
};
export type ApplicationRecord = {
  id: string;
  schemeId: string;
  status: string;
  reference: string;
  notes: string;
  checklist: string[];
  updatedAt: string;
};
