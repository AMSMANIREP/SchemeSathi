import { body, db, hash, HttpError, json, limit, settings } from '../http';
import {
  defaultVoiceId,
  synthesizeSpeech,
  transcribeSpeech,
  VoiceProviderError,
} from '../elevenlabs';
import {
  isLanguage,
  languageCommand,
  transcriptionLanguage,
  voiceCopy,
  multilingualWelcome,
} from '../languages';
import { spokenReply } from '../speech';
import { redact } from '../rules';
import { schemes } from '../schemes';
import type { Block } from '../types';
import type { SessionRoute } from '../session';

async function audioForm(req: Request) {
  const type = req.headers.get('content-type') || '';
  if (!type.startsWith('multipart/form-data') || !req.body)
    throw new HttpError(400, 'Invalid audio upload.');
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 5065536) {
        await reader.cancel();
        throw new HttpError(413, 'Audio must be under 5 MB.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return new Response(bytes, { headers: { 'Content-Type': type } }).formData();
}

export const voice: SessionRoute = async ({ req, p, method, s }) => {
  if (
    !['voice/transcribe', 'voice/synthesize'].includes(p) ||
    method !== 'POST'
  )
    return null;
  await limit('voice:' + s.id, 20);
  await limit(
    'voice-ip:' + (await hash(req.headers.get('cf-connecting-ip') || 'local')),
    60,
  );
  const e = settings();
  if (!e.ELEVENLABS_API_KEY)
    throw new HttpError(503, voiceCopy[s.language].unavailable);

  if (p === 'voice/transcribe') {
    const form = await audioForm(req);
    const file = form.get('file');
    if (
      !(file instanceof File) ||
      !file.size ||
      file.size > 5000000 ||
      !/^(audio\/|video\/webm)/.test(file.type)
    )
      throw new HttpError(
        400,
        'Please upload a nonempty audio recording under 5 MB.',
      );
    try {
      const result = await transcribeSpeech(e.ELEVENLABS_API_KEY, file);
      const text = redact(result.text).trim().slice(0, 1800);
      if (!text) throw new HttpError(422, voiceCopy[s.language].empty);
      const selected = !!s.language_selected || s.language !== 'en';
      const language =
        languageCommand(text) ??
        (selected
          ? s.language
          : transcriptionLanguage(
              result.languageCode,
              result.probability,
              s.language,
            ));
      // Transcription alone does not submit profile facts or change preferences.
      return json({ text, language, confirmationRequired: true });
    } catch (error) {
      if (error instanceof HttpError) throw error;
      if (error instanceof VoiceProviderError && error.reason === 'quota')
        throw new HttpError(503, voiceCopy[s.language].quota);
      throw new HttpError(503, voiceCopy[s.language].unavailable);
    }
  }

  const b = await body(req);
  if (b.text !== undefined)
    throw new HttpError(400, 'Choose an existing reply or guided message.');
  if (
    b.language !== undefined &&
    (!isLanguage(b.language) || b.language !== s.language)
  )
    throw new HttpError(409, 'The session language changed. Please try again.');
  let text: string;
  let multilingual = false;
  if (b.kind === 'message') {
    if (typeof b.messageId !== 'string' || typeof b.conversationId !== 'string')
      throw new HttpError(400, 'Choose a reply.');
    const row = await db()
      .prepare(
        "SELECT m.text,m.blocks,m.language FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE m.id=? AND m.conversation_id=? AND c.owner=? AND m.role='assistant'",
      )
      .bind(b.messageId, b.conversationId, s.id)
      .first<{ text: string; blocks: string; language: string | null }>();
    if (!row) throw new HttpError(404, 'Reply not found.');
    if (row.language !== s.language)
      throw new HttpError(
        409,
        'This reply was written in another language. Send a new message to continue.',
      );
    text = spokenReply(
      row.text,
      JSON.parse(row.blocks) as Block[],
      s.language,
      await schemes(),
    );
  } else if (b.kind === 'scheme' || (!b.kind && b.schemeId)) {
    const scheme = (await schemes()).find((x) => x.id === b.schemeId);
    if (!scheme) throw new HttpError(404, 'Scheme not found.');
    text = scheme.shortName + '. ' + voiceCopy[s.language].scheme;
  } else if (
    ['welcome', 'selected', 'guidance', 'confirmed', 'transcript'].includes(
      b.kind,
    )
  ) {
    multilingual =
      b.kind === 'welcome' &&
      b.multilingual === true &&
      !s.language_selected &&
      s.language === 'en';
    text = multilingual
      ? multilingualWelcome
      : voiceCopy[s.language][b.kind as 'welcome'];
  } else throw new HttpError(400, 'Unknown speech request.');
  if (!text.trim()) throw new HttpError(400, 'No reply to speak.');
  try {
    const r = await synthesizeSpeech(
      e.ELEVENLABS_API_KEY,
      e.ELEVENLABS_VOICE_ID || defaultVoiceId,
      redact(text),
      multilingual ? undefined : s.language,
    );
    return new Response(r.body, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    if (error instanceof VoiceProviderError && error.reason === 'quota')
      throw new HttpError(503, voiceCopy[s.language].quota);
    throw new HttpError(503, voiceCopy[s.language].unavailable);
  }
};
