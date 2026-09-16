import type { Language } from './types';

export const defaultVoiceId = 'JBFqnCBsd6RMkjVDRZzb';
export const speechModel = 'eleven_v3';
export type VoiceFailure =
  | 'quota'
  | 'authentication'
  | 'permission'
  | 'voice_not_found'
  | 'rate_limited'
  | 'invalid_request'
  | 'unavailable';
export class VoiceProviderError extends Error {
  reason: VoiceFailure;
  constructor(reason: VoiceFailure) {
    super('Voice service unavailable');
    this.reason = reason;
  }
}
async function providerError(response: Response) {
  const payload = (await response.json().catch(() => null)) as {
    detail?: { status?: string };
  } | null;
  const status = payload?.detail?.status;
  const reason: VoiceFailure =
    status === 'quota_exceeded'
      ? 'quota'
      : status === 'invalid_api_key' || status === 'not_authenticated'
        ? 'authentication'
        : status === 'missing_permissions' || response.status === 403
          ? 'permission'
          : status === 'voice_not_found' || response.status === 404
            ? 'voice_not_found'
            : response.status === 401
              ? 'authentication'
              : response.status === 429
                ? 'rate_limited'
                : response.status === 400 || response.status === 422
                  ? 'invalid_request'
                  : 'unavailable';
  // Only a fixed diagnostic enum escapes this adapter. Provider messages can
  // contain account details and must never reach the browser or application log.
  return new VoiceProviderError(reason);
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
