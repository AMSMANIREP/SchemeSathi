import { body, db, HttpError, json, limit } from '../http';
import { redact } from '../rules';
import { isLanguage } from '../languages';
import type { SessionRoute } from '../session';

export const privacy: SessionRoute = async ({ req, p, method, s }) => {
  if (p === 'privacy/consent' && method === 'PUT') {
    const b = await body(req);
    if (typeof b.enabled !== 'boolean' || !isLanguage(b.language))
      throw new HttpError(400, 'Invalid preference.');
    await db()
      .prepare(
        'UPDATE sessions SET consent=?,language=?,language_selected=1 WHERE id=?',
      )
      .bind(b.enabled ? 1 : 0, b.language, s.id)
      .run();
    return json({
      saved: true,
      memoryConsent: b.enabled,
      provider: 'session_only',
    });
  }

  if (p === 'me/data' && method === 'DELETE') {
    await db().batch([
      db().prepare('DELETE FROM applications WHERE owner=?').bind(s.id),
      db().prepare('DELETE FROM feedback WHERE owner=?').bind(s.id),
      db().prepare('DELETE FROM sessions WHERE id=?').bind(s.id),
    ]);
    return json({ deleted: true }, 200, {
      'Set-Cookie': 'sathi_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
    });
  }

  if (p === 'feedback' && method === 'POST') {
    await limit('feedback:' + s.id, 5);
    const b = await body(req);
    if (
      !Number.isInteger(b.rating) ||
      b.rating < 1 ||
      b.rating > 5 ||
      typeof b.comment !== 'string' ||
      b.comment.length > 600
    )
      throw new HttpError(
        400,
        'Choose a rating and a comment under 600 characters.',
      );
    await db()
      .prepare(
        'INSERT INTO feedback(id,owner,rating,comment,created_at) VALUES(?,?,?,?,?)',
      )
      .bind(
        crypto.randomUUID(),
        s.id,
        b.rating,
        redact(b.comment),
        new Date().toISOString(),
      )
      .run();
    return json({ saved: true }, 201);
  }

  return null;
};
