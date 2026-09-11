import type { Decision, Scheme } from '../types';

/** Turns a save offer stays suppressed after the citizen declines it. */
export const DECLINE_COOLDOWN = 3;

export type FocusInput = {
  schemes: Scheme[];
  /** Scheme ids shown as cards on the previous assistant turn. */
  lastPresented: string[];
  /** The focus carried forward from the previous turn, if any. */
  previousFocus: string | null;
  /** The citizen's message this turn, already redacted. */
  text: string;
};

export type Focus = {
  schemeId: string | null;
  /**
   * True only when this message named the scheme. A focus that merely carried
   * over from an earlier turn is weaker: it keeps the thread, but it must not
   * narrow the answer, because the citizen may have moved on.
   */
  named: boolean;
};

/**
 * Which scheme the conversation is actually about.
 *
 * Deterministic and deliberately conservative: naming a scheme is the
 * strongest signal, a single presented card is the next, and otherwise the
 * previous focus carries forward. Presenting four cards is not a focus — the
 * citizen has not chosen anything yet, and manufacturing a choice they did
 * not make is how an advocate turns into a funnel.
 */
const wordsOf = (s: Scheme) =>
  [s.shortName, s.name, s.id.replace(/-/g, ' ')]
    .join(' ')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4);

/**
 * Words that identify exactly one scheme.
 *
 * Computed from the catalogue rather than a hand-kept stop list, so it stays
 * correct as schemes are added. "Ujjwala" names one programme; "yojana",
 * "pradhan" and "national" name many and are therefore ignored on their own.
 */
function distinctiveWords(schemes: Scheme[]) {
  const owners = new Map<string, Set<string>>();
  for (const s of schemes)
    for (const w of wordsOf(s)) {
      const set = owners.get(w) ?? new Set<string>();
      set.add(s.id);
      owners.set(w, set);
    }
  const unique = new Map<string, string>();
  for (const [word, ids] of owners)
    if (ids.size === 1) unique.set(word, [...ids][0]);
  return unique;
}

export function detectFocus(input: FocusInput): Focus {
  const text = input.text.toLowerCase();

  // A full name is the strongest signal.
  const named = input.schemes.find((s) => {
    const forms = [s.shortName, s.name, s.id.replace(/-/g, ' ')]
      .map((f) => f.toLowerCase())
      .filter((f) => f.length > 3);
    return forms.some((f) => text.includes(f));
  });
  if (named) return { schemeId: named.id, named: true };

  // Otherwise a word that belongs to only one scheme. People say "Ujjwala",
  // not "Ujjwala Yojana", and asking about a programme by the name they know
  // should narrow the answer just the same.
  const unique = distinctiveWords(input.schemes);
  for (const word of text.split(/[^a-z0-9]+/))
    if (word.length >= 4) {
      const id = unique.get(word);
      if (id) return { schemeId: id, named: true };
    }

  if (input.lastPresented.length === 1)
    return { schemeId: input.lastPresented[0], named: false };

  return { schemeId: input.previousFocus, named: false };
}

export type SaveSignalInput = {
  focus: string | null;
  decision: Decision | null;
  checkpoint: string;
  savedSchemeIds: string[];
  declinedSchemeId: string | null;
  declinedAtTurn: number;
  turn: number;
};

/**
 * Whether this turn should offer to save. Every condition is state the server
 * owns, so the model can influence the focus but never fire the offer — a
 * save prompt at the wrong moment is the difference between an advocate and
 * a funnel.
 */
export function shouldOfferSave(i: SaveSignalInput): boolean {
  if (!i.focus || !i.decision) return false;
  // Something has to have been presented before there is anything to save.
  if (i.checkpoint === 'GATHERING' || i.checkpoint === 'ASKED') return false;
  // Only a scheme they might actually get.
  if (
    i.decision.status !== 'LIKELY_ELIGIBLE' &&
    i.decision.status !== 'POSSIBLY_ELIGIBLE'
  )
    return false;
  // And only once something is actually established about this citizen.
  // With an empty profile every verified scheme is POSSIBLY_ELIGIBLE — that
  // is the default state of the catalogue, not a narrowing, and offering on
  // it would mean offering everything to someone who has told us nothing.
  if (
    i.decision.status === 'POSSIBLY_ELIGIBLE' &&
    !i.decision.reasons.some((r) => r.result === 'PASS')
  )
    return false;
  if (i.savedSchemeIds.includes(i.focus)) return false;
  // Declining is an answer. Respect it for a few turns rather than asking again.
  if (
    i.declinedSchemeId === i.focus &&
    i.turn - i.declinedAtTurn < DECLINE_COOLDOWN
  )
    return false;
  return true;
}

/**
 * Recognises a refusal, so "no thanks" is not parsed as a profile answer.
 *
 * The Latin forms need a word boundary — otherwise "north Karnataka" reads as
 * a refusal. Devanagari and Kannada must not use one: `\b` in JavaScript is
 * defined on ASCII word characters, so it never matches after "नहीं", and a
 * Hindi or Kannada speaker's refusal would go unrecognised.
 */
export function isDecline(text: string) {
  const t = text.trim();
  return (
    /^(?:no|no thanks|not now|later|nahi)\b/i.test(t) ||
    /^(?:नहीं|नही|अभी नहीं|ಇಲ್ಲ|ಈಗ ಬೇಡ|ಬೇಡ)/.test(t)
  );
}
