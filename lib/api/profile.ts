import { body, db, HttpError, json } from '../http';
import { fields, validateProfile } from '../rules';
import { state, type SessionRoute } from '../session';
import type { Profile } from '../types';

export type Provenance = 'answered' | 'entered' | 'inferred';

/**
 * The whole-profile save behind the /profile route. Everything the citizen
 * reviews and saves here counts as entered — they looked at it and kept it.
 */
export const profile: SessionRoute = async ({ req, p, method, s }) => {
  if (p !== 'profile/confirm' || method !== 'PUT') return null;

  const b = await body(req);
  const profile = validateProfile(b.profile);
  if (b.confirmed !== true)
    throw new HttpError(400, 'Please confirm the details before continuing.');
  if (b.version !== s.version)
    throw new HttpError(409, 'Your profile changed. Reload it before confirming.');

  const keys = Object.keys(profile).filter((k) => profile[k] !== null);
  const previous = JSON.parse(s.provenance) as Record<string, Provenance>;
  // A field the citizen kept on this screen is entered; one they answered in
  // conversation keeps that stronger provenance.
  const provenance = Object.fromEntries(
    keys.map((k) => [k, previous[k] === 'answered' ? 'answered' : 'entered']),
  );

  const updated = await db()
    .prepare(
      'UPDATE sessions SET profile=?,confirmed=?,provenance=?,version=version+1,checkpoint=? WHERE id=? AND version=?',
    )
    .bind(
      JSON.stringify(profile),
      JSON.stringify(keys),
      JSON.stringify(provenance),
      'PROFILE_CONFIRMED',
      s.id,
      s.version,
    )
    .run();
  if (!updated.meta.changes)
    throw new HttpError(409, 'Profile changed in another request.');
  return json({
    profile,
    confirmed: keys,
    provenance,
    profileVersion: s.version + 1,
  });
};

/**
 * One field from a direct answer to a direct question.
 *
 * This is the conversational counterpart to the confirm screen: the citizen
 * was asked, and they replied in their own words, which is a stronger
 * confirmation than keeping a pre-filled form field. It merges rather than
 * replaces, so answering never disturbs anything already known.
 */
export const answer: SessionRoute = async ({ req, p, method, s }) => {
  if (p !== 'profile/answer' || method !== 'POST') return null;

  const b = await body(req);
  const spec = fields.find((f) => f.key === b.field);
  if (!spec) throw new HttpError(400, 'Unknown profile field.');
  if (b.provenance !== undefined && !['answered', 'inferred'].includes(b.provenance))
    throw new HttpError(400, 'Invalid provenance.');
  const provenanceOf: Provenance = b.provenance === 'inferred' ? 'inferred' : 'answered';

  const current = JSON.parse(s.profile) as Profile;
  const merged = validateProfile({ ...current, [spec.key]: b.value });

  const previous = JSON.parse(s.provenance) as Record<string, Provenance>;
  const marks: Record<string, Provenance> = { ...previous, [spec.key]: provenanceOf };

  // Only what the citizen stated reaches the rules engine. An inference sits
  // in the profile unconfirmed until they accept it or answer a question.
  const confirmed = Object.keys(merged).filter(
    (k) => merged[k] !== null && marks[k] && marks[k] !== 'inferred',
  );

  await db()
    .prepare(
      'UPDATE sessions SET profile=?,confirmed=?,provenance=?,version=version+1 WHERE id=? AND version=?',
    )
    .bind(
      JSON.stringify(merged),
      JSON.stringify(confirmed),
      JSON.stringify(marks),
      s.id,
      s.version,
    )
    .run();

  return json({
    ...state({ ...s, profile: JSON.stringify(merged), confirmed: JSON.stringify(confirmed), version: s.version + 1 }),
    provenance: marks,
    field: spec.key,
  });
};
