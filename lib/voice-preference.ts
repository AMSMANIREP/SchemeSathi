import { db } from './http';
import type { Session } from './session';
import type { Language } from './types';

/** The demo's preferences are scoped to its authenticated browser session. */
export function languageStatements(
  s: Session,
  language: Language,
  selected = true,
) {
  const statements = [
    db()
      .prepare('UPDATE sessions SET language=?,language_selected=? WHERE id=?')
      .bind(language, selected ? 1 : 0, s.id),
  ];
  if (s.voice_profile)
    statements.push(
      db()
        .prepare(
          'UPDATE voice_preferences SET language=?,selected=? WHERE id=? AND owner=?',
        )
        .bind(language, selected ? 1 : 0, s.voice_profile, s.id),
    );
  return statements;
}
