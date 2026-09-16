import { evaluateScheme } from '../rules.ts';
import { hasQuestion, leverage, questionFor } from '../questions.ts';
import { shouldOfferSave } from './focus.ts';
import { copy, statusNames } from '../i18n.ts';
import { languageIndex } from '../languages.ts';
import type {
  Block,
  Checkpoint,
  Decision,
  Language,
  Profile,
  Provenance,
  Scheme,
} from '../types';

/**
 * The single most useful thing still unknown, phrased.
 *
 * Only ask when a relevant, reviewed scheme has an undecided verdict.
 * Missing catalogue coverage cannot be repaired by collecting more details.
 */
export function nextQuestion(
  schemes: Scheme[],
  profile: Profile,
  confirmed: string[],
  candidates: string[],
  language: Language,
) {
  const relevant = schemes.filter(
    (s) =>
      candidates.includes(s.id) &&
      evaluateScheme(s, profile, confirmed).status === 'POSSIBLY_ELIGIBLE',
  );
  const pick = leverage(relevant, profile, confirmed).find((x) =>
    hasQuestion(x.field),
  );
  return pick ? questionFor(pick.field, language) : null;
}

/** Interrogation is not conversation. Two questions, then show something. */
export const QUESTION_BUDGET = 2;
const MAX_CARDS = 4;
/** Fewer when nobody asked for a list: an answer, not a search result. */
const PROACTIVE_CARDS = 3;

export type TurnInput = {
  schemes: Scheme[];
  /** Retrieval's candidate ordering, most relevant first. */
  candidates: string[];
  profile: Profile;
  confirmed: string[];
  /** Fields written this turn, for the profile_updated receipt. */
  changed: { field: string; provenance: Provenance }[];
  savedSchemeIds: string[];
  /** The scheme this conversation is actually about, if one has emerged. */
  focus?: string | null;
  /** True when this message named that scheme, rather than inheriting it. */
  focusNamed?: boolean;
  /** The citizen asked to see the full list, so show it unfiltered. */
  showEverything?: boolean;
  declinedSchemeId?: string | null;
  declinedAtTurn?: number;
  turn?: number;
  /** The previous turn asked a question and this reply could not be read. */
  unreadAnswer?: boolean;
  questionsAsked: number;
  language: Language;
};

export type TurnPlan = {
  /** A terminal catalogue result; never append another profile question. */
  noSupportedSchemes: boolean;
  /** Matching records exist, but at least one eligibility verdict is unknown. */
  discoveryOnly: boolean;
  text: string;
  blocks: Block[];
  checkpoint: Checkpoint;
  questionsAsked: number;
  askedField: string | null;
  /** Set when this turn offered to save, so the server can record the offer. */
  offeredSchemeId: string | null;
  /** Verdicts this turn computed, so generated prose can be checked on them. */
  decisions: Map<string, Decision>;
};

/**
 * A sentence about one scheme, assembled from the decision rather than
 * written. It names the verdict in the citizen's language and the facts still
 * missing, so asking about a programme returns something about that programme
 * instead of a generic re-listing.
 */
function aboutScheme(scheme: Scheme, decision: Decision, language: Language) {
  const t = copy[language];
  const verdict = statusNames[decision.status][li(language)];
  const missing = decision.missingFields.map((f) =>
    String(t[f as keyof typeof t] ?? f),
  );
  const head = `${scheme.shortName} — ${verdict.toLowerCase()}. ${scheme.summary}`;
  return missing.length
    ? `${head} ${t.stillUnknown}: ${missing.join(', ')}.`
    : head;
}

const RANK: Record<Decision['status'], number> = {
  LIKELY_ELIGIBLE: 0,
  POSSIBLY_ELIGIBLE: 1,
  UNABLE_TO_DETERMINE: 2,
  LIKELY_NOT_ELIGIBLE: 3,
};

const li = languageIndex;

const said = {
  presenting: [
    'I found these related schemes in our catalogue:',
    'हमारे संग्रह में ये संबंधित योजनाएँ मिली हैं:',
    'ನಮ್ಮ ಪಟ್ಟಿಯಲ್ಲಿ ಈ ಸಂಬಂಧಿತ ಯೋಜನೆಗಳು ಕಂಡುಬಂದಿವೆ:',
    'எங்கள் பட்டியலில் இந்த தொடர்புடைய திட்டங்கள் உள்ளன:',
    'ഞങ്ങളുടെ പട്ടികയിൽ ഈ ബന്ധപ്പെട്ട പദ്ധതികളുണ്ട്:',
  ],
  offerSave: [
    'Would you like to keep this one in My applications, so you have the next steps to hand?',
    'क्या आप इसे “मेरे आवेदन” में रखना चाहेंगे, ताकि अगले कदम आपके पास रहें?',
    'ಮುಂದಿನ ಹೆಜ್ಜೆಗಳು ನಿಮ್ಮ ಬಳಿ ಇರುವಂತೆ ಇದನ್ನು “ನನ್ನ ಅರ್ಜಿಗಳು” ನಲ್ಲಿ ಇರಿಸಬೇಕೆ?',
    'அடுத்த படிகளைப் பார்க்க இதை என் விண்ணப்பங்களில் சேமிக்க விரும்புகிறீர்களா?',
    'അടുത്ത ഘട്ടങ്ങൾ കാണാൻ ഇത് എന്റെ അപേക്ഷകളിൽ സൂക്ഷിക്കണോ?',
  ],
  didNotCatch: [
    'Sorry — I did not catch that.',
    'माफ़ कीजिए — मैं यह समझ नहीं पाया।',
    'ಕ್ಷಮಿಸಿ — ಅದು ನನಗೆ ಅರ್ಥವಾಗಲಿಲ್ಲ.',
    'மன்னிக்கவும், அது எனக்குப் புரியவில்லை.',
    'ക്ഷമിക്കണം, അത് മനസ്സിലായില്ല.',
  ],
  nothing: [
    'There are no supported schemes as of now. This applies to your request within our current catalogue, not to every government programme.',
    'फ़िलहाल कोई समर्थित योजना उपलब्ध नहीं है। यह हमारे वर्तमान संग्रह में आपके अनुरोध के लिए है, सभी सरकारी योजनाओं के लिए नहीं।',
    'ಸದ್ಯಕ್ಕೆ ಬೆಂಬಲಿತ ಯೋಜನೆಗಳು ಲಭ್ಯವಿಲ್ಲ. ಇದು ನಮ್ಮ ಪ್ರಸ್ತುತ ಪಟ್ಟಿಯಲ್ಲಿ ನಿಮ್ಮ ವಿನಂತಿಗೆ ಅನ್ವಯಿಸುತ್ತದೆ, ಎಲ್ಲಾ ಸರ್ಕಾರಿ ಯೋಜನೆಗಳಿಗಲ್ಲ.',
    'தற்போது ஆதரிக்கப்படும் திட்டங்கள் எதுவும் இல்லை. இது எங்கள் தற்போதைய பட்டியலில் உங்கள் கோரிக்கைக்கு மட்டுமே பொருந்தும்; அனைத்து அரசு திட்டங்களுக்கும் அல்ல.',
    'നിലവിൽ പിന്തുണയ്ക്കുന്ന പദ്ധതികളൊന്നുമില്ല. ഇത് ഞങ്ങളുടെ നിലവിലെ പട്ടികയിൽ നിങ്ങളുടെ ആവശ്യത്തിന് ബാധകമാണ്; എല്ലാ സർക്കാർ പദ്ധതികൾക്കും അല്ല.',
  ],
  unreviewed: [
    'These records are available to explore, but their eligibility rules still need verification. I cannot confirm whether you qualify. Please check the linked official sources.',
    'आप इन योजनाओं की जानकारी देख सकते हैं, लेकिन पात्रता नियमों का सत्यापन बाकी है। मैं आपकी पात्रता की पुष्टि नहीं कर सकता। दिए गए आधिकारिक स्रोत देखें।',
    'ಈ ಯೋಜನೆಗಳ ಮಾಹಿತಿಯನ್ನು ನೋಡಬಹುದು, ಆದರೆ ಅರ್ಹತಾ ನಿಯಮಗಳನ್ನು ಇನ್ನೂ ಪರಿಶೀಲಿಸಬೇಕು. ನಿಮ್ಮ ಅರ್ಹತೆಯನ್ನು ದೃಢೀಕರಿಸಲು ಸಾಧ್ಯವಿಲ್ಲ. ನೀಡಿರುವ ಅಧಿಕೃತ ಮೂಲಗಳನ್ನು ನೋಡಿ.',
    'இந்த திட்டங்களின் விவரங்களைப் பார்க்கலாம். ஆனால் தகுதி விதிகள் இன்னும் சரிபார்க்கப்பட வேண்டும். நீங்கள் தகுதியானவரா என்பதை என்னால் உறுதிப்படுத்த முடியாது. இணைக்கப்பட்ட அதிகாரப்பூர்வ ஆதாரங்களைப் பார்க்கவும்.',
    'ഈ പദ്ധതികളുടെ വിവരങ്ങൾ പരിശോധിക്കാം, പക്ഷേ യോഗ്യതാ ചട്ടങ്ങൾ ഇനിയും പരിശോധിക്കേണ്ടതുണ്ട്. നിങ്ങളുടെ യോഗ്യത ഉറപ്പാക്കാൻ കഴിയില്ല. നൽകിയ ഔദ്യോഗിക ഉറവിടങ്ങൾ പരിശോധിക്കുക.',
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
    focus,
    focusNamed,
    showEverything,
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
  //
  // A direct question about a named scheme is never answered with a question
  // of our own. What is missing is said in the reply instead, so they learn
  // the gap without having their question deflected.
  // Someone who has just said "show me" or "I don't know" is asking to be
  // shown. Answering that with another question is the one response certain
  // not to help, and it leaves prose naming schemes above a turn with no
  // cards beneath it.
  if (
    !showEverything &&
    !focusNamed &&
    !conclusive &&
    questionsAsked < QUESTION_BUDGET
  ) {
    const q = nextQuestion(schemes, profile, confirmed, candidates, language);
    if (q) {
      if (q.options.length)
        blocks.push({
          kind: 'answer_chips',
          field: q.field,
          options: q.options,
        });
      return {
        noSupportedSchemes: false,
        discoveryOnly: false,
        text: unreadAnswer ? said.didNotCatch[n] + ' ' + q.text : q.text,
        blocks,
        checkpoint: 'ASKED',
        questionsAsked: questionsAsked + 1,
        askedField: q.field,
        offeredSchemeId: null,
        decisions,
      };
    }
  }

  const ranked = [...candidates].sort(
    (a, b) =>
      RANK[decisions.get(a)!.status] - RANK[decisions.get(b)!.status] ||
      candidates.indexOf(a) - candidates.indexOf(b),
  );

  // A scheme the citizen named in this message is the whole answer. They
  // asked one question; surrounding it with three others is a re-listing, and
  // it muddies a save offer that refers to exactly one of them. A focus that
  // only carried over from an earlier turn leads but does not narrow, because
  // they may have moved on.
  const asked = focus && schemes.some((s) => s.id === focus) ? focus : null;
  // Discovery and eligibility are separate. Unreviewed records still exist
  // and may be useful to explore; their cards retain the unknown verdict.
  const offered = ranked;

  const shown = asked
    ? focusNamed
      ? [asked]
      : [asked, ...offered.filter((id) => id !== asked)].slice(0, MAX_CARDS)
    : offered.slice(0, showEverything ? MAX_CARDS : PROACTIVE_CARDS);

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

  let checkpoint: Checkpoint = shown.length ? 'PRESENTED' : 'GATHERING';
  let offeredSchemeId: string | null = null;

  // The jump point. Every condition is server-owned state, so the offer
  // arrives because the citizen narrowed to one scheme — not because a model
  // decided it was a good moment to ask.
  if (
    focus &&
    shouldOfferSave({
      focus,
      decision: decisions.get(focus) ?? null,
      checkpoint,
      savedSchemeIds,
      declinedSchemeId: input.declinedSchemeId ?? null,
      declinedAtTurn: input.declinedAtTurn ?? 0,
      turn: input.turn ?? 0,
    })
  ) {
    const scheme = schemes.find((s) => s.id === focus);
    const decision = decisions.get(focus)!;
    if (scheme) {
      blocks.push({
        kind: 'save_prompt',
        schemeId: focus,
        // From the rule engine, never written for the occasion.
        reason: decision.reasons.find((r) => r.result === 'PASS')?.label ?? '',
      });
      checkpoint = 'SAVE_OFFERED';
      offeredSchemeId = focus;
    }
  }

  const discoveryOnly = shown.some(
    (id) => decisions.get(id)?.status === 'UNABLE_TO_DETERMINE',
  );
  const opening = asked
    ? aboutScheme(
        schemes.find((s) => s.id === asked)!,
        decisions.get(asked)!,
        language,
      )
    : shown.length
      ? `${said.presenting[n]} ${shown.map((id) => schemes.find((s) => s.id === id)!.shortName).join('; ')}.`
      : said.nothing[n];
  const groundedOpening = discoveryOnly
    ? `${opening} ${said.unreviewed[n]}`
    : opening;

  return {
    noSupportedSchemes: !shown.length,
    discoveryOnly,
    text: offeredSchemeId
      ? groundedOpening + ' ' + said.offerSave[n]
      : groundedOpening,
    blocks,
    checkpoint,
    questionsAsked,
    askedField: null,
    offeredSchemeId,
    decisions,
  };
}
