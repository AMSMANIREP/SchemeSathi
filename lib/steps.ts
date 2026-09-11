import { evaluateTree } from './rules.ts';
import type { Decision, Profile, Scheme, Step } from './types';

export type StepRelevance = 'for_you' | 'standard';

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
 *
 * There is deliberately no "already done" state. A rule passing establishes a
 * *fact*, not that the citizen has performed an *action*: being a farmer does
 * not mean you have registered. A step the citizen genuinely does not need is
 * removed by `onlyIf`, which is the honest way to say it — marking a step done
 * on a printed sheet could make someone skip work they still have to do.
 */
export function personaliseSteps(
  scheme: Scheme,
  profile: Profile,
  confirmed: string[],
  decision: Decision,
): PersonalStep[] {
  const out: PersonalStep[] = [];

  for (const step of scheme.steps) {
    let relevance: StepRelevance = 'standard';
    let becauseYou: string | null = null;

    if (step.onlyIf) {
      const gate = evaluateTree(step.onlyIf, profile, confirmed);
      // FAIL means this citizen does not need the step at all.
      if (gate.result === 'FAIL') continue;
      // PASS means the step exists *because* of their situation.
      if (gate.result === 'PASS') {
        relevance = 'for_you';
        becauseYou = gate.reasons.find((r) => r.result === 'PASS')?.label ?? null;
      }
      // UNKNOWN keeps the step at standard: we would rather show a step
      // someone may not need than hide one they do. Unknown never means no.
    }

    if (relevance === 'standard') {
      // Otherwise a step is theirs when it addresses something still blocking
      // or failing for them.
      const unresolved = decision.reasons.find(
        (r) => step.relatesTo.includes(r.field) && r.result !== 'PASS',
      );
      if (unresolved) {
        relevance = 'for_you';
        becauseYou = unresolved.label;
      }
    }

    out.push({ ...step, n: out.length + 1, relevance, becauseYou });
  }

  return out;
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
