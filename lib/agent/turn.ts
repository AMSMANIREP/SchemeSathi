import { evaluateScheme } from '../rules.ts';
import { hasQuestion, leverage, questionFor } from '../questions.ts';
import type {
  Block,
  Checkpoint,
  Decision,
  Language,
  Profile,
  Provenance,
  Scheme,
} from '../types';

/** Interrogation is not conversation. Two questions, then show something. */
export const QUESTION_BUDGET = 2;
const MAX_CARDS = 4;

export type TurnInput = {
  schemes: Scheme[];
  /** Retrieval's candidate ordering, most relevant first. */
  candidates: string[];
  profile: Profile;
  confirmed: string[];
  /** Fields written this turn, for the profile_updated receipt. */
  changed: { field: string; provenance: Provenance }[];
  savedSchemeIds: string[];
  /** The previous turn asked a question and this reply could not be read. */
  unreadAnswer?: boolean;
  questionsAsked: number;
  language: Language;
};

export type TurnPlan = {
  text: string;
  blocks: Block[];
  checkpoint: Checkpoint;
  questionsAsked: number;
  askedField: string | null;
};

const RANK: Record<Decision['status'], number> = {
  LIKELY_ELIGIBLE: 0,
  POSSIBLY_ELIGIBLE: 1,
  UNABLE_TO_DETERMINE: 2,
  LIKELY_NOT_ELIGIBLE: 3,
};

const li = (language: Language) =>
  language === 'en' ? 0 : language === 'hi' ? 1 : 2;

const said = {
  presenting: [
    'Here is what your details point to so far.',
    'आपके विवरण के आधार पर अभी यह दिख रहा है।',
    'ನಿಮ್ಮ ವಿವರಗಳ ಆಧಾರದ ಮೇಲೆ ಇಲ್ಲಿಯವರೆಗೆ ಇದು ಕಾಣಿಸುತ್ತಿದೆ.',
  ],
  didNotCatch: [
    'Sorry — I did not catch that.',
    'माफ़ कीजिए — मैं यह समझ नहीं पाया।',
    'ಕ್ಷಮಿಸಿ — ಅದು ನನಗೆ ಅರ್ಥವಾಗಲಿಲ್ಲ.',
  ],
  nothing: [
    'I could not match that to a programme yet. Tell me a little more about your situation — your work, your family, your land, your age.',
    'अभी इसे किसी योजना से नहीं जोड़ा जा सका। अपनी स्थिति के बारे में थोड़ा और बताइए — काम, परिवार, ज़मीन, उम्र।',
    'ಇದನ್ನು ಇನ್ನೂ ಯಾವುದೇ ಯೋಜನೆಗೆ ಹೊಂದಿಸಲಾಗಿಲ್ಲ. ನಿಮ್ಮ ಪರಿಸ್ಥಿತಿಯ ಬಗ್ಗೆ ಸ್ವಲ್ಪ ಹೆಚ್ಚು ತಿಳಿಸಿ — ಕೆಲಸ, ಕುಟುಂಬ, ಭೂಮಿ, ವಯಸ್ಸು.',
  ],
};

/**
 * Plans one assistant turn. Pure: no IO, no model, no clock — the caller does
 * extraction and persistence. This is the deterministic spine the agent will
 * later dress in generated prose, and it is what runs when no AI key is set.
 */
export function planTurn(input: TurnInput): TurnPlan {
  const {
    schemes,
    candidates,
    profile,
    confirmed,
    changed,
    savedSchemeIds,
    unreadAnswer,
    questionsAsked,
    language,
  } = input;
  const n = li(language);
  const blocks: Block[] = [];

  if (changed.length) blocks.push({ kind: 'profile_updated', fields: changed });

  const decisions = new Map<string, Decision>();
  for (const scheme of schemes)
    decisions.set(scheme.id, evaluateScheme(scheme, profile, confirmed));

  // Something conclusive is worth showing immediately. A merely possible
  // verdict still has an unknown behind it, and that is what a question is
  // for — so "possible" keeps the conversation going rather than ending it.
  const conclusive = candidates.some(
    (id) => decisions.get(id)?.status === 'LIKELY_ELIGIBLE',
  );

  // Ask only while an answer could still move something, and only within the
  // budget. Otherwise show what we have — a citizen who has answered twice
  // deserves to see something.
  if (!conclusive && questionsAsked < QUESTION_BUDGET) {
    // Ask about what the citizen just raised. Scoring the whole catalogue
    // first would ask a farmer their age simply because 'age' sorts earlier.
    const relevant = schemes.filter((s) => candidates.includes(s.id));
    const next =
      leverage(relevant, profile, confirmed).find((x) => hasQuestion(x.field)) ||
      leverage(schemes, profile, confirmed).find((x) => hasQuestion(x.field));
    if (next) {
      const q = questionFor(next.field, language);
      if (q.options.length)
        blocks.push({
          kind: 'answer_chips',
          field: q.field,
          options: q.options,
        });
      return {
        text: unreadAnswer ? said.didNotCatch[n] + ' ' + q.text : q.text,
        blocks,
        checkpoint: 'ASKED',
        questionsAsked: questionsAsked + 1,
        askedField: next.field,
      };
    }
  }

  const shown = [...candidates]
    .sort(
      (a, b) =>
        RANK[decisions.get(a)!.status] - RANK[decisions.get(b)!.status] ||
        candidates.indexOf(a) - candidates.indexOf(b),
    )
    .slice(0, MAX_CARDS);

  for (const id of shown) {
    const scheme = schemes.find((s) => s.id === id)!;
    const decision = decisions.get(id)!;
    blocks.push({
      kind: 'scheme_card',
      schemeId: id,
      status: decision.status,
      whyThis: scheme.summary,
      failing: decision.reasons.filter((r) => r.result === 'FAIL').slice(0, 2),
      missing: decision.missingFields,
      saved: savedSchemeIds.includes(id),
    });
  }

  if (shown.length)
    blocks.push({
      kind: 'sources',
      items: shown.map((id) => ({
        schemeId: id,
        // From the scheme record, never from anything a model wrote.
        url: schemes.find((s) => s.id === id)!.source,
      })),
    });

  return {
    text: shown.length ? said.presenting[n] : said.nothing[n],
    blocks,
    checkpoint: shown.length ? 'PRESENTED' : 'GATHERING',
    questionsAsked,
    askedField: null,
  };
}
