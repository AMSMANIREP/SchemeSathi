import type { Language } from './types';

export const defaultVoiceId = 'JBFqnCBsd6RMkjVDRZzb';
export const speechModel = 'eleven_v3';
export async function synthesizeSpeech(
  key: string,
  voiceId: string,
  text: string,
  language?: Language,
  request: typeof fetch = fetch,
) {
  const response = await request(
    'https://api.elevenlabs.io/v1/text-to-speech/' +
      encodeURIComponent(voiceId) +
      '?output_format=mp3_44100_128',
    {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(45000),
      headers: {
        'xi-api-key': key,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: speechModel,
        ...(language ? { language_code: language } : {}),
      }),
    },
  );
  if (
    !response.ok ||
    !response.headers.get('content-type')?.startsWith('audio/')
  )
    throw new Error('Voice service unavailable');
  return response;
}
export async function transcribeSpeech(
  key: string,
  file: File,
  request: typeof fetch = fetch,
) {
  const form = new FormData();
  form.append('file', file);
  form.append('model_id', 'scribe_v2');
  form.append('tag_audio_events', 'false');
  // Omit language_code so the user can switch languages through speech.
  const response = await request(
    'https://api.elevenlabs.io/v1/speech-to-text',
    {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(45000),
      headers: { 'xi-api-key': key },
      body: form,
    },
  );
  if (!response.ok) throw new Error('Voice service unavailable');
  const result = (await response.json()) as {
    text?: unknown;
    language_code?: unknown;
    language_probability?: unknown;
  };
  if (typeof result.text !== 'string') throw new Error('Invalid transcription');
  return {
    text: result.text,
    languageCode: result.language_code,
    probability: result.language_probability,
  };
}
