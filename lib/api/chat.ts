import { body, db, external, HttpError, json, limit } from '../http';
import { llm } from '../llm';
import {
  extractionRequest,
  parseExtraction,
  patternExtract,
} from '../extract.ts';
import { guidance } from '../guidance';
import { redact } from '../rules';
import type { SessionRoute } from '../session';
import { languageStatements } from '../voice-preference';
import type { Language, Profile } from '../types';
import { sessionLanguage, languageCommand, voiceCopy } from '../languages';

/**
 * Pulls explicitly stated profile facts out of free text. Falls back to a
 * deterministic pattern pass when no chat deployment is configured, so the
 * product keeps working without an AI key.
 */
export async function extract(
  text: string,
  language: Language,
): Promise<{ profile: Profile; mode: string }> {
  const config = llm();
  if (config) {
    try {
      const r = await external(config.url, {
        method: 'POST',
        headers: config.headers,
        body: JSON.stringify(extractionRequest(config.model, text, language)),
      });
      return {
        profile: parseExtraction(await r.json()),
        mode: config.provider,
      };
    } catch (error) {
      // A slow or unavailable provider must not end the turn. The citizen
      // still gets a reply, the deterministic extractor still reads what it
      // can, and nothing is invented to cover the gap — which is the whole
      // point of keeping that path alive.
      console.log(
        JSON.stringify({
          event: 'extraction_degraded',
          cause: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  return { profile: patternExtract(text), mode: 'guided_form' };
}

export const chat: SessionRoute = async ({ req, p, method, s, trace }) => {
  if (p !== 'chat' || method !== 'POST') return null;

  await limit('chat:' + s.id);
  const b = await body(req);
  if (
    typeof b.message !== 'string' ||
    b.message.length > 1800 ||
    !b.message.trim()
  )
    throw new HttpError(
      400,
      'Please enter a message of up to 1,800 characters.',
    );
  s.language = sessionLanguage(
    b.message,
    s.language,
    !!s.language_selected || s.language !== 'en',
  );
  await db().batch(languageStatements(s, s.language));
  const command = languageCommand(b.message);
  const result = command
    ? { profile: {}, mode: 'guided_form' }
    : await extract(redact(b.message), s.language);
  await db()
    .prepare('UPDATE sessions SET checkpoint=? WHERE id=?')
    .bind('AWAITING_CONFIRMATION', s.id)
    .run();
  return json({
    message: command ? voiceCopy[s.language].selected : guidance[s.language],
    language: s.language,
    proposedProfile: result.profile,
    mode: result.mode,
    needsConfirmation: true,
    traceId: trace,
  });
};
