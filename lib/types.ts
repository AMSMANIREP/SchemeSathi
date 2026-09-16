export type Language = 'en' | 'hi' | 'kn' | 'ta' | 'ml';
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
export type SchemeDocument = {
  item: string;
  note: string;
  /** id of the rule this document establishes, when it proves one. */
  proves?: string;
};
/**
 * An authored application step. `onlyIf` reuses the eligibility RuleTree, so
 * showing a step to the right citizen runs through the same evaluator and the
 * same test corpus as eligibility itself — there is no second rule language.
 */
export type Step = {
  title: string;
  detail: string;
  where: string;
  who: string;
  typicalWait: string;
  /** Profile fields this step addresses, used to mark it as theirs. */
  relatesTo: string[];
  onlyIf?: RuleTree;
};
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
  documents: SchemeDocument[];
  steps: Step[];
  /** What the citizen pays, if anything. Empty until authored. */
  fees: string;
  /**
   * Set when a record was drafted for a demonstration build rather than
   * independently reviewed. The interface shows a notice wherever it appears.
   */
  authoredFor?: 'demo';
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
export type Provenance = 'answered' | 'entered' | 'inferred';
export type Checkpoint =
  | 'GATHERING'
  | 'ASKED'
  | 'PRESENTED'
  | 'NARROWED'
  | 'SAVE_OFFERED'
  | 'SAVED'
  | 'REPORT_READY';
/**
 * What an assistant turn shows instead of dumping scheme data as prose.
 * Blocks carry ids and values, never rendered sentences.
 */
export type Block =
  | {
      kind: 'scheme_card';
      schemeId: string;
      status: Decision['status'];
      whyThis: string;
      failing: RuleOutcome[];
      missing: string[];
      saved: boolean;
    }
  | { kind: 'scheme_compare'; schemeIds: string[] }
  | { kind: 'answer_chips'; field: string; options: string[] }
  | {
      kind: 'profile_updated';
      fields: { field: string; provenance: Provenance }[];
    }
  | { kind: 'save_prompt'; schemeId: string; reason: string }
  | { kind: 'saved_receipt'; applicationId: string; schemeId: string }
  | { kind: 'report_ready'; applicationId: string }
  | { kind: 'sources'; items: { schemeId: string; url: string }[] }
  | { kind: 'notice'; tone: 'info' | 'error'; textKey: string };
export type MessageRecord = {
  id: string;
  language?: Language;
  role: 'user' | 'assistant';
  text: string;
  inputMode: 'text' | 'voice';
  blocks: Block[];
  createdAt: string;
};
export type ConversationRecord = {
  id: string;
  title: string;
  checkpoint: Checkpoint;
  focusSchemeId: string | null;
  updatedAt: string;
};
