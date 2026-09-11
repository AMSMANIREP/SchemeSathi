import { evaluateTree } from './rules.ts';
import type { Decision, Profile, Scheme, Step } from './types';

export type StepRelevance = 'for_you' | 'standard' | 'already_done';

export type PersonalStep = Step & {
  n: number;
  relevance: StepRelevance;
  /** The rule label explaining why this step is theirs. Never model output. */
  becauseYou: string | null;
};

/**
 * Filters and marks a scheme's authored steps for one citizen.
 *
 * Nothing here is generated: `onlyIf` runs through the same rule evaluator as
 * eligibility, and `becauseYou` is a rule's own label. The model is not in
 * this path at all, which is the point — a step in a printed report must be
 * traceable to the catalogue, not to a sentence someone's assistant produced.
 */
export function personaliseSteps(
  scheme: Scheme,
  profile: Profile,
  confirmed: string[],
  decision: Decision,
): PersonalStep[] {
  const applicable = scheme.steps.filter((step) => {
    if (!step.onlyIf) return true;
    // UNKNOWN keeps the step: we would rather show a step someone may not
    // need than hide one they do. Unknown never means no.
    return evaluateTree(step.onlyIf, profile, confirmed).result !== 'FAIL';
  });

  return applicable.map((step, i) => {
    const related = decision.reasons.filter((r) =>
      step.relatesTo.includes(r.field),
    );
    const unresolved = related.find((r) => r.result !== 'PASS');

    const relevance: StepRelevance = unresolved
      ? 'for_you'
      : related.length
        ? 'already_done'
        : 'standard';

    return {
      ...step,
      n: i + 1,
      relevance,
      becauseYou: unresolved ? unresolved.label : null,
    };
  });
}

/** Documents, marked with what the citizen already holds and what each proves. */
export function personaliseDocuments(
  scheme: Scheme,
  checklist: string[],
  decision: Decision,
) {
  return scheme.documents.map((d) => ({
    item: d.item,
    note: d.note,
    held: checklist.includes(d.item),
    requiredBecause: d.proves
      ? (decision.reasons.find((r) => r.id === d.proves)?.label ?? null)
      : null,
  }));
}
