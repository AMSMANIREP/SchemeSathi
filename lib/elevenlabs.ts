import type { Language } from './types';

export const defaultVoiceId = 'JBFqnCBsd6RMkjVDRZzb';
export const speechModel = 'eleven_v3';
export class VoiceProviderError extends Error {
  reason: 'quota' | 'unavailable';
  constructor(reason: 'quota' | 'unavailable') {
    super('Voice service unavailable');
    this.reason = reason;
  }
}
async function providerError(response: Response) {
  const payload = (await response.json().catch(() => null)) as {
    detail?: { status?: string };
  } | null;
  return new VoiceProviderError(
    payload?.detail?.status === 'quota_exceeded' ? 'quota' : 'unavailable',
  );
}
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
      // This Worker runtime rejects redirect: 'error'. Manual mode also prevents
      // forwarding the API key to another host; non-2xx responses fail below.
      redirect: 'manual',
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
  if (!response.ok) throw await providerError(response);
  if (!response.headers.get('content-type')?.startsWith('audio/'))
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
      redirect: 'manual',
      signal: AbortSignal.timeout(45000),
      headers: { 'xi-api-key': key },
      body: form,
    },
  );
  if (!response.ok) throw await providerError(response);
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
