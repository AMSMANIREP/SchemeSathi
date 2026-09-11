import { body, HttpError, json } from '../http';
import { evaluateScheme, redact } from '../rules';
import { schemes } from '../schemes';
import type { SessionRoute } from '../session';
import { applicationRepository } from '../storage';
import { importLegacyApplications } from '../storage/legacy';

const statuses = [
  'Interested',
  'Preparing documents',
  'Submitted',
  'Under review',
  'Action required',
  'Approved',
  'Closed',
];

export const applications: SessionRoute = async ({
  req,
  p,
  path,
  method,
  s,
}) => {
  if (
    p !== 'applications' &&
    !(path[0] === 'applications' && path.length === 2)
  )
    return null;
  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(method)) return null;
  // Preserve tracker rows written only to PostgreSQL by older Docker releases.
  await importLegacyApplications(s.id);
  const repository = applicationRepository();

  if (p === 'applications' && method === 'GET') {
    const records = await repository.list(s.id);
    return json({
      applications: records.map(
        ({ id, schemeId, status, reference, notes, checklist, updatedAt }) => ({
          id,
          schemeId,
          status,
          reference,
          notes,
          checklist,
          updatedAt,
        }),
      ),
    });
  }

  if (p === 'applications' && method === 'POST') {
    const b = await body(req);
    const scheme = (await schemes()).find((x) => x.id === b.schemeId);
    if (!scheme) throw new HttpError(400, 'Unknown scheme.');
    const decision = evaluateScheme(
      scheme,
      JSON.parse(s.profile),
      JSON.parse(s.confirmed),
    );
    await repository.create({
      id: crypto.randomUUID(),
      owner: s.id,
      schemeId: scheme.id,
      status: 'Interested',
      reference: '',
      notes: '',
      checklist: [],
      decisionSnapshot: decision,
      schemeVersion: scheme.version,
      conversationId:
        typeof b.conversationId === 'string' ? b.conversationId : null,
      updatedAt: new Date().toISOString(),
    });
    return json({ saved: true }, 201);
  }

  if (path.length === 2 && ['PATCH', 'DELETE'].includes(method)) {
    const existing = await repository.find(s.id, path[1]);
    if (!existing) throw new HttpError(404, 'Application record not found.');
    if (method === 'DELETE') {
      await repository.delete(s.id, path[1]);
      return json({ deleted: true });
    }
    const patch = await body(req);
    if (typeof patch.status !== 'string' || !statuses.includes(patch.status))
      throw new HttpError(400, 'Invalid status.');
    if (
      typeof patch.notes !== 'string' ||
      patch.notes.length > 600 ||
      typeof patch.reference !== 'string' ||
      patch.reference.length > 80 ||
      !Array.isArray(patch.checklist) ||
      patch.checklist.length > 20 ||
      patch.checklist.some(
        (v: unknown) => typeof v !== 'string' || v.length > 400,
      )
    )
      throw new HttpError(400, 'Invalid record values.');
    const allowed = (
      (await schemes()).find((x) => x.id === existing.schemeId)?.documents || []
    ).map((d) => d.item);
    if (
      patch.checklist.some((x: string) => !allowed.includes(x)) ||
      new Set(patch.checklist).size !== patch.checklist.length
    )
      throw new HttpError(400, 'Choose checklist items from this scheme.');
    await repository.update(s.id, {
      ...existing,
      status: patch.status,
      notes: redact(patch.notes),
      checklist: patch.checklist,
      reference: patch.reference
        ? '•••• ' + patch.reference.replace(/[^a-zA-Z0-9]/g, '').slice(-4)
        : '',
      updatedAt: new Date().toISOString(),
    });
    return json({ saved: true });
  }
  return null;
};
