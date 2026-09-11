import { db, json, settings, type Route } from '../http';
import { retrievalMode } from '../retrieval';
import { llm } from '../llm';

export const health: Route = async ({ p, trace }) => {
  if (p === 'health/live')
    return json({ status: 'ok', service: 'scheme-sathi', traceId: trace });

  if (p === 'health/ready') {
    await db().prepare('SELECT 1').first();
    return json({ status: 'ok', database: 'connected' });
  }

  if (p === 'capabilities') {
    const e = settings();
    const mode = retrievalMode();
    return json({
      hosting: e.HOSTING_PROVIDER || 'Sites',
      storage: 'D1',
      ai: !!llm(),
      voice: !!e.ELEVENLABS_API_KEY,
      speechToText: !!e.ELEVENLABS_API_KEY,
      textToSpeech: !!e.ELEVENLABS_API_KEY,
      voiceLanguages: ['en', 'hi', 'kn', 'ta', 'ml'],
      // Lexical retrieval is a build artifact, so it is always present.
      // The dense layer is what a binding turns on.
      retrieval: true,
      retrievalMode: mode,
      memory: false,
      sourceSearch: false,
      catalogue: 50,
      independentReviewRequired: true,
    });
  }

  return null;
};
