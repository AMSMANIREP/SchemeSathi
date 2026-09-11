import { db, json, settings, type Route } from '../http';
import { retrievalMode } from '../retrieval';

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
      ai: !!(
        e.AZURE_OPENAI_ENDPOINT &&
        e.AZURE_OPENAI_API_KEY &&
        e.AZURE_OPENAI_CHAT_DEPLOYMENT
      ),
      voice: !!(e.ELEVENLABS_API_KEY && e.ELEVENLABS_VOICE_ID),
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
