import { body, db, hash, HttpError, json, limit, type Route } from '../http';
import {
  readToken,
  SESSION_TTL,
  sessionCookie,
  state,
  type Session,
} from '../session';
import { storageMode } from '../storage';

const browserCookieName = 'sathi_demo_browser';
const randomToken = () => crypto.randomUUID() + crypto.randomUUID();

/**
 * Each demo identity gets an independent session owner. The namespace is a
 * random HttpOnly browser capability, never an email alone: using the same
 * email on another browser cannot open somebody else's profile.
 * This deliberately does not implement password/account authentication.
 */
export const demoLogin: Route = async ({ req, p, method }) => {
  if (p === 'demo/logout' && method === 'POST') {
    await body(req);
    const token = readToken(req);
    if (token)
      await db()
        .prepare('UPDATE sessions SET token_hash=? WHERE token_hash=?')
        .bind(await hash(randomToken()), await hash(token))
        .run();
    return json({ signedOut: true }, 200, {
      'Set-Cookie': 'sathi_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
    });
  }
  if (p !== 'demo/login' || method !== 'PUT') return null;
  const b = await body(req);
  if (typeof b.profileKey !== 'string' || !/^[a-f0-9]{64}$/.test(b.profileKey))
    throw new HttpError(400, 'Invalid demo profile.');
  await limit(
    'demo-login:' +
      (await hash(req.headers.get('cf-connecting-ip') || 'local')),
    30,
  );
  const existingBrowser = req.headers
    .get('cookie')
    ?.split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith(browserCookieName + '='))
    ?.slice(browserCookieName.length + 1);
  const browser =
    existingBrowser && /^[a-f0-9-]{72}$/.test(existingBrowser)
      ? existingBrowser
      : randomToken();
  const digest = await hash('demo-profile:' + browser + ':' + b.profileKey);
  // UUID-shaped (version 8) for compatibility with the PostgreSQL mirror.
  const id = `${digest.slice(0, 8)}-${digest.slice(8, 12)}-8${digest.slice(13, 16)}-a${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
  const currentToken = readToken(req);
  const currentHash = currentToken ? await hash(currentToken) : '';
  const existing = await db()
    .prepare('SELECT * FROM sessions WHERE id=? AND expires_at>?')
    .bind(id, Date.now())
    .first<Session & { token_hash: string }>();
  const token =
    existing?.token_hash === currentHash && currentToken
      ? currentToken
      : randomToken();
  const now = Date.now();
  const statements = [
    db()
      .prepare(
        'DELETE FROM feedback WHERE owner IN (SELECT id FROM sessions WHERE id=? AND expires_at<=?)',
      )
      .bind(id, now),
    db()
      .prepare('DELETE FROM sessions WHERE id=? AND expires_at<=?')
      .bind(id, now),
    db()
      .prepare(
        'INSERT INTO sessions(id,token_hash,created_at,expires_at) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET token_hash=excluded.token_hash,expires_at=excluded.expires_at',
      )
      .bind(id, await hash(token), now, now + SESSION_TTL),
  ];
  // Revoke the previous identity's active token when switching accounts.
  if (currentHash)
    statements.push(
      db()
        .prepare(
          'UPDATE sessions SET token_hash=? WHERE token_hash=? AND id<>?',
        )
        .bind(await hash(randomToken()), currentHash, id),
    );
  if (storageMode() === 'dual')
    statements.push(
      db()
        .prepare(
          'INSERT OR IGNORE INTO storage_legacy_imports(owner) VALUES(?)',
        )
        .bind(id),
    );
  await db().batch(statements);
  const selected = await db()
    .prepare('SELECT * FROM sessions WHERE id=?')
    .bind(id)
    .first<Session>();
  if (!selected) throw new HttpError(503, 'Unable to open the demo profile.');
  const response = json(state(selected));
  response.headers.append('Set-Cookie', sessionCookie(token, req));
  response.headers.append(
    'Set-Cookie',
    `${browserCookieName}=${browser}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL / 1000}${new URL(req.url).protocol === 'https:' ? '; Secure' : ''}`,
  );
  return response;
};
