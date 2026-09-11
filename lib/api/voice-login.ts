import { body, db, hash, HttpError, json, limit } from '../http';
import { state, type SessionRoute } from '../session';
import { isLanguage } from '../languages';

export const voiceLogin: SessionRoute = async ({ req, p, method, s }) => {
  if (p !== 'voice/login' || method !== 'PUT') return null;
  await limit('voice-login:' + s.id, 30);
  const b = await body(req);
  if (typeof b.profileKey !== 'string' || !/^[a-f0-9]{64}$/.test(b.profileKey))
    throw new HttpError(400, 'Invalid voice preference.');
  const id = await hash(s.id + ':' + b.profileKey);
  await db()
    .prepare(
      "INSERT INTO voice_preferences(id,owner,language,selected) VALUES(?,?,'en',0) ON CONFLICT(id) DO NOTHING",
    )
    .bind(id, s.id)
    .run();
  const pref = await db()
    .prepare(
      'SELECT language,selected FROM voice_preferences WHERE id=? AND owner=?',
    )
    .bind(id, s.id)
    .first<{ language: string; selected: number }>();
  const language = isLanguage(pref?.language) ? pref.language : 'en';
  await db()
    .prepare(
      'UPDATE sessions SET voice_profile=?,language=?,language_selected=? WHERE id=?',
    )
    .bind(id, language, pref?.selected ? 1 : 0, s.id)
    .run();
  s.voice_profile = id;
  s.language = language;
  s.language_selected = pref?.selected ? 1 : 0;
  return json(state(s));
};
