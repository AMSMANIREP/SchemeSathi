import { fields } from './rules.ts';
import { languageIndex } from './languages.ts';
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
const asked: Record<string, string[]> = {
  occupation: [
    'What kind of work do you do?',
    'आप किस तरह का काम करते हैं?',
    'ನೀವು ಯಾವ ರೀತಿಯ ಕೆಲಸ ಮಾಡುತ್ತೀರಿ?',
    'நீங்கள் என்ன வேலை செய்கிறீர்கள்?',
    'നിങ്ങൾ എന്ത് ജോലിയാണ് ചെയ്യുന്നത്?',
  ],
  land: [
    'How much land do you farm, in hectares? One acre is about 0.4 hectares.',
    'आप कितनी ज़मीन पर खेती करते हैं (हेक्टेयर में)? एक एकड़ लगभग 0.4 हेक्टेयर होता है।',
    'ನೀವು ಎಷ್ಟು ಭೂಮಿಯಲ್ಲಿ ಕೃಷಿ ಮಾಡುತ್ತೀರಿ (ಹೆಕ್ಟೇರ್)? ಒಂದು ಎಕರೆ ಸುಮಾರು 0.4 ಹೆಕ್ಟೇರ್.',
    'நீங்கள் எத்தனை ஹெக்டேர் நிலத்தில் விவசாயம் செய்கிறீர்கள்? ஒரு ஏக்கர் சுமார் 0.4 ஹெக்டேர்.',
    'നിങ്ങൾ എത്ര ഹെക്ടർ ഭൂമിയിൽ കൃഷി ചെയ്യുന്നു? ഒരു ഏക്കർ ഏകദേശം 0.4 ഹെക്ടറാണ്.',
  ],
  taxpayer: [
    'Did you pay income tax last assessment year?',
    'क्या आपने पिछले निर्धारण वर्ष में आयकर दिया था?',
    'ಹಿಂದಿನ ಮೌಲ್ಯಮಾಪನ ವರ್ಷದಲ್ಲಿ ನೀವು ಆದಾಯ ತೆರಿಗೆ ಪಾವತಿಸಿದ್ದೀರಾ?',
    'கடந்த மதிப்பீட்டு ஆண்டில் வருமான வரி செலுத்தினீர்களா?',
    'കഴിഞ്ഞ അസസ്മെന്റ് വർഷം നിങ്ങൾ ആദായനികുതി അടച്ചിട്ടുണ്ടോ?',
  ],
  age: [
    'How old are you, in completed years?',
    'आपकी पूरी उम्र कितने वर्ष है?',
    'ನಿಮ್ಮ ಪೂರ್ಣ ವಯಸ್ಸು ಎಷ್ಟು ವರ್ಷ?',
    'உங்கள் நிறைவடைந்த வயது என்ன?',
    'നിങ്ങൾക്ക് എത്ര വയസ്സ് പൂർത്തിയായി?',
  ],
  gender: [
    'How do you describe your gender?',
    'आप अपना लिंग किस रूप में बताते हैं?',
    'ನಿಮ್ಮ ಲಿಂಗವನ್ನು ಹೇಗೆ ಸೂಚಿಸುತ್ತೀರಿ?',
    'உங்கள் பாலினம் என்ன?',
    'നിങ്ങളുടെ ലിംഗം എന്താണ്?',
  ],
  lpg: [
    'Does your household already have an LPG connection?',
    'क्या आपके घर में पहले से एलपीजी कनेक्शन है?',
    'ನಿಮ್ಮ ಮನೆಯಲ್ಲಿ ಈಗಾಗಲೇ ಎಲ್‌ಪಿಜಿ ಸಂಪರ್ಕ ಇದೆಯೇ?',
    'உங்கள் வீட்டில் ஏற்கனவே சமையல் எரிவாயு இணைப்பு உள்ளதா?',
    'നിങ്ങളുടെ വീട്ടിൽ ഇതിനകം പാചകവാതക കണക്ഷൻ ഉണ്ടോ?',
  ],
};

const li = languageIndex;

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
