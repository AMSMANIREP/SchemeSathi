import { personaliseDocuments, personaliseSteps, type PersonalStep } from '../steps.ts';
import type { Decision, Profile, Provenance, Scheme } from '../types';

export type Report = {
  scheme: {
    id: string;
    name: string;
    shortName: string;
    ministry: string;
    version: string;
    source: string;
    sourceCheckedAt: string | null;
    authoredForDemo: boolean;
  };
  generatedAt: string;
  mode: 'ai' | 'deterministic';
  status: Decision['status'];

  /** How this citizen arrived here. Opens the report. */
  yourSituation: {
    confirmed: { field: string; value: string; provenance: Provenance }[];
    recap: string | null;
    conversationId: string | null;
  };

  whatThisIs: string;
  whyYou: { id: string; label: string; source: string }[];
  stillUnknown: { field: string; ruleLabel: string; provingDocument: string | null }[];
  documents: {
    item: string;
    note: string;
    held: boolean;
    requiredBecause: string | null;
  }[];
  steps: PersonalStep[];
  fees: string;
  officialLinks: { title: string; url: string }[];
};

export type BuildInput = {
  scheme: Scheme;
  decision: Decision;
  profile: Profile;
  confirmed: string[];
  provenance: Record<string, Provenance>;
  checklist: string[];
  conversationId: string | null;
  recap: string | null;
  now: string;
};

/**
 * Assembles the report. Every structural fact comes from the scheme record or
 * the decision snapshot; the only slot a model may fill is `recap`, which is
 * passed in already written and is non-instructional by contract.
 *
 * Pure, so the whole document is testable without a database or a model.
 */
export function buildReport(input: BuildInput): Report {
  const { scheme, decision, profile, confirmed, provenance, checklist } = input;

  const documents = personaliseDocuments(scheme, checklist, decision);

  const stillUnknown = decision.reasons
    .filter((r) => r.result === 'UNKNOWN')
    .map((r) => ({
      field: r.field,
      ruleLabel: r.label,
      provingDocument:
        documents.find((d) => d.requiredBecause === r.label)?.item ?? null,
    }));

  return {
    scheme: {
      id: scheme.id,
      name: scheme.name,
      shortName: scheme.shortName,
      ministry: scheme.ministry,
      version: scheme.version,
      source: scheme.source,
      sourceCheckedAt: scheme.sourceCheckedAt,
      authoredForDemo: scheme.authoredFor === 'demo',
    },
    generatedAt: input.now,
    mode: input.recap ? 'ai' : 'deterministic',
    status: decision.status,

    yourSituation: {
      confirmed: confirmed
        .filter((field) => profile[field] != null)
        .map((field) => ({
          field,
          value: String(profile[field]),
          provenance: provenance[field] ?? 'entered',
        })),
      recap: input.recap,
      conversationId: input.conversationId,
    },

    whatThisIs: scheme.summary,
    whyYou: decision.reasons
      .filter((r) => r.result === 'PASS')
      .map((r) => ({ id: r.id, label: r.label, source: r.source })),
    stillUnknown,
    documents,
    steps: personaliseSteps(scheme, profile, confirmed, decision),
    fees: scheme.fees,
    // From the source registry, never from anything a model wrote.
    officialLinks: [{ title: scheme.sourceTitle, url: scheme.source }],
  };
}

/** Cheap change detector for cache invalidation. */
export function decisionHash(decision: Decision) {
  return [
    decision.status,
    ...decision.reasons.map((r) => r.id + ':' + r.result),
  ].join('|');
}
