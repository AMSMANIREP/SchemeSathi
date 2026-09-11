import type { Decision, Scheme } from '../types';

/**
 * Checks what the model said before a citizen sees it.
 *
 * The product's promise is that every claim is traceable to a rule or an
 * official record. A model writing fluent prose will happily add benefits it
 * remembers from training — observed in testing: asked about PM Vishwakarma
 * it offered "recognition, training, financial assistance, improved tools and
 * an expanded customer base", none of which is in the catalogue entry.
 *
 * So prose is checked rather than trusted, and a failed check falls back to
 * the deterministic sentence. Losing fluency is a small cost; a citizen
 * acting on an invented benefit is not.
 */
export type Verdict = { ok: true } | { ok: false; reason: string };

/** Currency figures and percentages must come from the record, not memory. */
const AMOUNT = /(₹|rs\.?\s|rupees?\s)\s*[\d,]+|\b\d[\d,]*\s*(lakh|crore|rupees)\b|\b\d{1,3}(\.\d+)?\s*%/i;
const URL = /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:gov|nic)\.in\b/i;

export function validateProse(
  text: string,
  context: {
    onScreen: string[];
    /** Schemes the tools actually returned this turn. */
    seen?: string[];
    schemes: Scheme[];
    decisions: Map<string, Decision>;
  },
): Verdict {
  if (!text.trim()) return { ok: false, reason: 'empty' };

  if (AMOUNT.test(text))
    return { ok: false, reason: 'states an amount that did not come from the record' };

  // URLs belong to the sources strip, which renders them from the scheme
  // record. A model-written link is unverifiable by definition.
  if (URL.test(text)) return { ok: false, reason: 'contains a link' };

  // Naming a programme that is not on screen invites someone to act on a
  // scheme they cannot see, whose verdict they have not been shown.
  const lower = text.toLowerCase();
  // When cards are shown, talk about those. When none are — a turn that asks
  // a question — naming the programme being investigated is helpful, so long
  // as a tool actually returned it.
  const allowed = context.onScreen.length
    ? context.onScreen
    : (context.seen ?? []);
  const offScreen = context.schemes.find((s) => {
    if (allowed.includes(s.id)) return false;
    const name = s.shortName.toLowerCase();
    return name.length > 6 && lower.includes(name);
  });
  if (offScreen)
    return {
      ok: false,
      reason: `names ${offScreen.shortName}, which is not among the cards shown`,
    };

  // An undetermined scheme must not be described in the language of
  // entitlement. "You may be eligible for X" when the engine said it cannot
  // tell is precisely the confident wrong answer the product exists to avoid.
  // Checked for every scheme the reply names, not only the carded ones: a
  // scheme discussed without a card is no less misleading.
  for (const id of new Set([...context.onScreen, ...(context.seen ?? [])])) {
    if (context.decisions.get(id)?.status !== 'UNABLE_TO_DETERMINE') continue;
    const scheme = context.schemes.find((s) => s.id === id);
    if (!scheme) continue;
    const name = scheme.shortName.toLowerCase();
    if (name.length > 6 && lower.includes(name) && /\beligib|\bqualif|\bentitled/i.test(text))
      return {
        ok: false,
        reason: `implies eligibility for ${scheme.shortName}, which the rules could not determine`,
      };
  }

  return { ok: true };
}
