import { body, db, hash, json, limit, type Route } from '../http';
import {
  SESSION_TTL,
  sessionCookie,
  state,
  type SessionRoute,
} from '../session';

export const createSession: Route = async ({ req, p, method }) => {
  if (p !== 'sessions' || method !== 'POST') return null;

  const b = await body(req);
  await limit(
    'session:' + (await hash(req.headers.get('cf-connecting-ip') || 'local')),
    30,
  );
  await db().batch([
    db()
      .prepare(
        'DELETE FROM feedback WHERE owner IN (SELECT id FROM sessions WHERE expires_at<?)',
      )
      .bind(Date.now()),
    db().prepare('DELETE FROM sessions WHERE expires_at<?').bind(Date.now()),
    db()
      .prepare('DELETE FROM request_limits WHERE expires_at<?')
      .bind(Date.now() - 60000),
  ]);
  const token = crypto.randomUUID() + crypto.randomUUID();
  const id = crypto.randomUUID();
  const language = ['en', 'hi', 'kn'].includes(b.language) ? b.language : 'en';
  await db()
    .prepare(
      'INSERT INTO sessions(id,token_hash,language,created_at,expires_at) VALUES(?,?,?,?,?)',
    )
    .bind(id, await hash(token), language, Date.now(), Date.now() + SESSION_TTL)
    .run();
  return json(
    {
      profile: {},
      confirmed: [],
      profileVersion: 0,
      language,
      memoryConsent: false,
    },
    201,
    { 'Set-Cookie': sessionCookie(token, req) },
  );
};

export const readSession: SessionRoute = async ({ p, method, s }) => {
  if (p === 'sessions' && method === 'GET') return json(state(s));
  return null;
};
