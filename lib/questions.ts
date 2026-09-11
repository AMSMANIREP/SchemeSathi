import { fields } from './rules.ts';
import type { Language, Profile, Scheme } from './types';

/**
 * Which fields a scheme's rules depend on. Read from the rule tree rather
 * than hardcoded, so authoring a new rule immediately makes its field
 * askable without touching this file.
 */
export function fieldsUsedBy(scheme: Scheme): string[] {
  const found = new Set<string>();
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    const branch =
      (node as { all?: unknown[] }).all || (node as { any?: unknown[] }).any;
    if (Array.isArray(branch)) return branch.forEach(walk);
    const field = (node as { field?: string }).field;
    if (field) found.add(field);
  };
  walk(scheme.rules);
  return [...found];
}

/**
 * The highest-leverage unknown: the field blocking the most schemes. Asking
 * about this first is what keeps the two-question budget worth spending.
 */
export function leverage(
  schemes: Scheme[],
  profile: Profile,
  confirmed: string[],
): { field: string; blocks: number }[] {
  const counts = new Map<string, number>();
  for (const scheme of schemes) {
    for (const field of fieldsUsedBy(scheme)) {
      if (confirmed.includes(field) && profile[field] != null) continue;
      counts.set(field, (counts.get(field) || 0) + 1);
    }
  }
  return [...counts]
    .map(([field, blocks]) => ({ field, blocks }))
    .sort((a, b) => b.blocks - a.blocks || a.field.localeCompare(b.field));
}

/**
 * Question prose for the fields the catalogue's rules actually use today.
 * A field with no entry falls back to its profile label, so a newly authored
 * rule is askable before its bespoke copy is written.
 */
const asked: Record<string, [string, string, string]> = {
  occupation: [
    'What kind of work do you do?',
    'आप किस तरह का काम करते हैं?',
    'ನೀವು ಯಾವ ರೀತಿಯ ಕೆಲಸ ಮಾಡುತ್ತೀರಿ?',
  ],
  land: [
    'How much land do you farm, in hectares? One acre is about 0.4 hectares.',
    'आप कितनी ज़मीन पर खेती करते हैं (हेक्टेयर में)? एक एकड़ लगभग 0.4 हेक्टेयर होता है।',
    'ನೀವು ಎಷ್ಟು ಭೂಮಿಯಲ್ಲಿ ಕೃಷಿ ಮಾಡುತ್ತೀರಿ (ಹೆಕ್ಟೇರ್)? ಒಂದು ಎಕರೆ ಸುಮಾರು 0.4 ಹೆಕ್ಟೇರ್.',
  ],
  taxpayer: [
    'Did you pay income tax last assessment year?',
    'क्या आपने पिछले निर्धारण वर्ष में आयकर दिया था?',
    'ಹಿಂದಿನ ಮೌಲ್ಯಮಾಪನ ವರ್ಷದಲ್ಲಿ ನೀವು ಆದಾಯ ತೆರಿಗೆ ಪಾವತಿಸಿದ್ದೀರಾ?',
  ],
  age: [
    'How old are you, in completed years?',
    'आपकी पूरी उम्र कितने वर्ष है?',
    'ನಿಮ್ಮ ಪೂರ್ಣ ವಯಸ್ಸು ಎಷ್ಟು ವರ್ಷ?',
  ],
  gender: [
    'How do you describe your gender?',
    'आप अपना लिंग किस रूप में बताते हैं?',
    'ನಿಮ್ಮ ಲಿಂಗವನ್ನು ಹೇಗೆ ಸೂಚಿಸುತ್ತೀರಿ?',
  ],
  lpg: [
    'Does your household already have an LPG connection?',
    'क्या आपके घर में पहले से एलपीजी कनेक्शन है?',
    'ನಿಮ್ಮ ಮನೆಯಲ್ಲಿ ಈಗಾಗಲೇ ಎಲ್‌ಪಿಜಿ ಸಂಪರ್ಕ ಇದೆಯೇ?',
  ],
};

const li = (language: Language) =>
  language === 'en' ? 0 : language === 'hi' ? 1 : 2;

export function questionFor(field: string, language: Language) {
  const spec = fields.find((f) => f.key === field);
  return {
    field,
    text: asked[field]?.[li(language)] ?? '',
    // Raw values only. The client labels them from lib/i18n.ts, so a
    // transcript reads correctly in a language chosen after the turn.
    options: spec?.type === 'select' ? spec.values || [] : [],
  };
}

export function hasQuestion(field: string) {
  return field in asked;
}
