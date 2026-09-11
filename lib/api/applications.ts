import { body, db, HttpError, json } from '../http';
import { catalogue } from '../catalogue';
import { redact } from '../rules';
import { schemes } from '../schemes';
import type { SessionRoute } from '../session';

const statuses = [
  'Interested',
  'Preparing documents',
  'Submitted',
  'Under review',
  'Action required',
  'Approved',
  'Closed',
];

export const applications: SessionRoute = async ({ req, p, path, method, s }) => {
  if (p === 'applications' && method === 'GET') {
    const r = await db()
      .prepare('SELECT * FROM applications WHERE owner=? ORDER BY updated_at DESC')
      .bind(s.id)
      .all<Record<string, unknown>>();
    return json({
      applications: r.results.map((a) => ({
        id: a.id,
        schemeId: a.scheme_id,
        status: a.status,
        reference: a.reference,
        notes: a.notes,
        checklist: JSON.parse(a.checklist as string),
        updatedAt: a.updated_at,
      })),
    });
  }

  if (p === 'applications' && method === 'POST') {
    const b = await body(req);
    if (!catalogue.some((x) => x.id === b.schemeId))
      throw new HttpError(400, 'Unknown scheme.');
    await db()
      .prepare(
        'INSERT INTO applications(id,owner,scheme_id,updated_at) VALUES(?,?,?,?) ON CONFLICT(owner,scheme_id) DO NOTHING',
      )
      .bind(crypto.randomUUID(), s.id, b.schemeId, new Date().toISOString())
      .run();
    return json({ saved: true }, 201);
  }

  if (p.startsWith('applications/') && ['PATCH', 'DELETE'].includes(method)) {
    const existing = await db()
      .prepare('SELECT id,scheme_id FROM applications WHERE id=? AND owner=?')
      .bind(path[1], s.id)
      .first<{ id: string; scheme_id: string }>();
    if (!existing) throw new HttpError(404, 'Application record not found.');

    if (method === 'DELETE') {
      await db()
        .prepare('DELETE FROM applications WHERE id=? AND owner=?')
        .bind(path[1], s.id)
        .run();
      return json({ deleted: true });
    }

    const b = await body(req);
    if (!statuses.includes(b.status)) throw new HttpError(400, 'Invalid status.');
    if (
      typeof b.notes !== 'string' ||
      b.notes.length > 600 ||
      typeof b.reference !== 'string' ||
      b.reference.length > 80 ||
      !Array.isArray(b.checklist) ||
      b.checklist.length > 20 ||
      b.checklist.some((v: unknown) => typeof v !== 'string' || v.length > 400)
    )
      throw new HttpError(400, 'Invalid record values.');
    // The checklist stores each document's `item` text, unchanged by the
    // structured-catalogue migration, so rows saved before it stay valid.
    const allowed = (
      (await schemes()).find((x) => x.id === existing.scheme_id)?.documents || []
    ).map((d) => d.item);
    if (
      b.checklist.some((x: string) => !allowed.includes(x)) ||
      new Set(b.checklist).size !== b.checklist.length
    )
      throw new HttpError(400, 'Choose checklist items from this scheme.');
    const reference = b.reference
      ? '•••• ' + b.reference.replace(/[^a-zA-Z0-9]/g, '').slice(-4)
      : '';
    await db()
      .prepare(
        'UPDATE applications SET status=?,reference=?,notes=?,checklist=?,updated_at=? WHERE id=? AND owner=?',
      )
      .bind(
        b.status,
        reference,
        redact(b.notes),
        JSON.stringify(b.checklist),
        new Date().toISOString(),
        path[1],
        s.id,
      )
      .run();
    return json({ saved: true });
  }

  return null;
};
