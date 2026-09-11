import { voiceCopy, languageIndex } from './languages.ts';
import { statusNames } from './i18n.ts';
import type { Block, Language, Scheme } from './types';
/** Read server-owned reply text and translated verdicts. Official scheme names
 * are proper nouns; untranslated evidence paragraphs are not read as translations. */
export function spokenReply(
  text: string,
  blocks: Block[],
  language: Language,
  schemes: Scheme[],
) {
  const cards = blocks.filter((b) => b.kind === 'scheme_card');
  const parts = [text];
  for (const card of cards) {
    const scheme = schemes.find((s) => s.id === card.schemeId);
    if (scheme)
      parts.push(
        `${scheme.shortName}. ${statusNames[card.status][languageIndex(language)]}.`,
      );
  }
  if (cards.length) parts.push(voiceCopy[language].scheme);
  return parts.join(' ').trim().slice(0, 4500);
}
