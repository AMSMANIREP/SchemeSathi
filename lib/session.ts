import { db, hash, HttpError, type Ctx } from './http';
import type { Language } from './types';

/** 30 days, refreshed on activity. See docs/agent-architecture-plan.md §10. */
export const SESSION_TTL = 30 * 24 * 60 * 60 * 1000;

/** Only rewrite the row once the window is more than half spent. */
const REFRESH_AFTER = SESSION_TTL / 2;

export function sessionCookie(token: string, req: Request) {
  const secure = new URL(req.url).protocol === 'https:' ? '; Secure' : '';
  return `sathi_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL / 1000}${secure}`;
}

export function readToken(req: Request) {
  return req.headers
    .get('cookie')
    ?.split(';')
    .map((x) => x.trim())
    .find((x) => x.startsWith('sathi_session='))
    ?.split('=')[1];
}

export type Session = {
  id: string;
  profile: string;
  confirmed: string;
  provenance: string;
  version: number;
  language: Language;
  language_selected: number;
  voice_profile?: string | null;
  consent: number;
  expires_at: number;
};

export type SessionCtx = Ctx & { s: Session };
export type SessionRoute = (c: SessionCtx) => Promise<Response | null>;

export async function session(req: Request) {
  const token = readToken(req);
  if (!token)
    throw new HttpError(401, 'Your session has expired. Start a new session.');
  const s = await db()
    .prepare('SELECT * FROM sessions WHERE token_hash=? AND expires_at>?')
    .bind(await hash(token), Date.now())
    .first<Session>();
  if (!s)
    throw new HttpError(401, 'Your session has expired. Start a new session.');
  return s;
}

/**
 * Rolling window: every authenticated request pushes the expiry back out, so
 * a citizen is never cut off mid-conversation. Writes only when the window is
 * more than half spent, to keep this off the hot path of every request.
 *
 * Returns the Set-Cookie to send, or null when no refresh was needed.
 */
export async function touch(s: Session, req: Request) {
  if (s.expires_at - Date.now() > REFRESH_AFTER) return null;
  const expires = Date.now() + SESSION_TTL;
  await db()
    .prepare('UPDATE sessions SET expires_at=? WHERE id=?')
    .bind(expires, s.id)
    .run();
  s.expires_at = expires;
  const token = readToken(req);
  return token ? sessionCookie(token, req) : null;
}

export function state(s: Session) {
  return {
    profile: JSON.parse(s.profile),
    confirmed: JSON.parse(s.confirmed),
    provenance: JSON.parse(s.provenance || '{}'),
    profileVersion: s.version,
    language: s.language,
    languageSelected: !!s.language_selected || s.language !== 'en',
    memoryConsent: !!s.consent,
    expiresAt: s.expires_at,
  };
}
