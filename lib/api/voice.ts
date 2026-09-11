import { body, external, HttpError, json, limit, settings } from '../http';
import { guidance } from '../guidance';
import { redact } from '../rules';
import { schemes } from '../schemes';
import type { SessionRoute } from '../session';

export const voice: SessionRoute = async ({ req, p, method, s }) => {
  if (p === 'voice/transcribe' && method === 'POST') {
    await limit('voice:' + s.id, 8);
    const e = settings();
    if (!e.ELEVENLABS_API_KEY)
      throw new HttpError(
        503,
        'Voice is not connected yet. Please type or use the profile form.',
      );
    if (Number(req.headers.get('content-length') || 0) > 5000000)
      throw new HttpError(413, 'Audio must be under 5 MB.');
    const f = await req.formData();
    const file = f.get('file');
    if (!(file instanceof File) || file.size > 5000000)
      throw new HttpError(400, 'Invalid audio.');
    const outbound = new FormData();
    outbound.append('file', file);
    outbound.append('model_id', 'scribe_v2');
    outbound.append(
      'language_code',
      s.language === 'kn' ? 'kan' : s.language === 'hi' ? 'hin' : 'eng',
    );
    const r = await external('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: { 'xi-api-key': e.ELEVENLABS_API_KEY },
      body: outbound,
    });
    const v = (await r.json()) as { text: string };
    // The citizen reads and edits this before it is ever sent as a turn.
    return json({ text: redact(v.text), confirmationRequired: true });
  }

  if (p === 'voice/synthesize' && method === 'POST') {
    await limit('tts:' + s.id, 8);
    const e = settings();
    if (!e.ELEVENLABS_API_KEY || !e.ELEVENLABS_VOICE_ID)
      throw new HttpError(
        503,
        'Speech is not connected yet. The guidance is available as text.',
      );
    const b = await body(req);
    const scheme = (await schemes()).find((x) => x.id === b.schemeId);
    if (!scheme) throw new HttpError(404, 'Scheme not found.');
    const text =
      scheme.name + '. ' + scheme.summary + '. ' + guidance[s.language];
    const r = await external(
      'https://api.elevenlabs.io/v1/text-to-speech/' +
        encodeURIComponent(e.ELEVENLABS_VOICE_ID),
      {
        method: 'POST',
        headers: {
          'xi-api-key': e.ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text, model_id: 'eleven_v3' }),
      },
    );
    return new Response(r.body, {
      headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' },
    });
  }

  return null;
};
