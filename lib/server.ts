import { HttpError, json, origin, type Ctx, type Route } from './http';
import { session, touch, type SessionRoute } from './session';
import { health } from './api/health';
import { schemeRoutes } from './api/schemes';
import { createSession, readSession } from './api/sessions';
import { profile, answer } from './api/profile';
import { recommendations } from './api/recommendations';
import { chat } from './api/chat';
import { conversations } from './api/conversations';
import { search } from './api/search';
import { applications } from './api/applications';
import { reports } from './api/reports';
import { privacy } from './api/privacy';
import { voice } from './api/voice';
import { voiceLogin } from './api/voice-login';
import { admin } from './api/admin';

/** Reachable without a session cookie. */
const publicRoutes: Route[] = [health, schemeRoutes, createSession];

/** Everything past this point runs against a live session. */
const sessionRoutes: SessionRoute[] = [
  readSession,
  profile,
  answer,
  recommendations,
  chat,
  conversations,
  search,
  applications,
  reports,
  privacy,
  voiceLogin,
  voice,
  admin,
];

export async function handle(req: Request, path: string[]) {
  const trace = crypto.randomUUID();
  try {
    origin(req);
    const ctx: Ctx = {
      req,
      path,
      p: path.join('/'),
      method: req.method,
      trace,
    };

    for (const route of publicRoutes) {
      const r = await route(ctx);
      if (r) return r;
    }

    const s = await session(req);
    const refreshed = await touch(s, req);
    for (const route of sessionRoutes) {
      const r = await route({ ...ctx, s });
      if (!r) continue;
      // A route that sets its own cookie wins — "delete my data" clears the
      // session, and must not be handed a fresh one on the way out.
      if (!refreshed || r.headers.has('Set-Cookie')) return r;
      const out = new Response(r.body, {
        status: r.status,
        statusText: r.statusText,
        headers: new Headers(r.headers),
      });
      out.headers.set('Set-Cookie', refreshed);
      return out;
    }

    throw new HttpError(404, 'Endpoint not found.');
  } catch (error) {
    const known = error instanceof HttpError;
    const validation =
      error instanceof Error &&
      /Profile|profile field|Enter a valid|Choose a valid/.test(error.message);
    const status = known ? error.status : validation ? 400 : 503;
    console.log(
      JSON.stringify({ traceId: trace, event: 'request_failed', status }),
    );
    return json(
      {
        error:
          known || validation
            ? (error as Error).message
            : 'The service is temporarily unavailable. Please try again.',
        traceId: trace,
      },
      status,
    );
  }
}
