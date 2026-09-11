import { db, HttpError, json, limit } from '../http';
import { buildReport, decisionHash } from '../report/build.ts';
import { evaluateScheme } from '../rules';
import { schemes } from '../schemes';
import type { SessionRoute } from '../session';
import type { Decision, Profile, Provenance } from '../types';

type Row = Record<string, unknown>;

export const reports: SessionRoute = async ({ p, path, method, s }) => {
  if (!p.startsWith('applications/') || path[2] !== 'report') return null;
  if (method !== 'GET' && method !== 'POST') return null;

  const application = await db()
    .prepare('SELECT * FROM applications WHERE id=? AND owner=?')
    .bind(path[1], s.id)
    .first<Row>();
  if (!application) throw new HttpError(404, 'Application record not found.');

  const scheme = (await schemes()).find(
    (x) => x.id === application.scheme_id,
  );
  if (!scheme) throw new HttpError(404, 'Scheme not found.');

  const profile = JSON.parse(s.profile) as Profile;
  const confirmed = JSON.parse(s.confirmed) as string[];
  const provenance = JSON.parse(s.provenance) as Record<string, Provenance>;

  // The snapshot taken at save time is authoritative. Falling back to a live
  // evaluation only covers records saved before snapshots existed.
  const snapshot = JSON.parse(
    (application.decision_snapshot as string) || '{}',
  ) as Partial<Decision>;
  const decision: Decision = snapshot.schemeId
    ? (snapshot as Decision)
    : evaluateScheme(scheme, profile, confirmed);

  const hash = decisionHash(decision);
  const cached = await db()
    .prepare('SELECT * FROM application_reports WHERE application_id=?')
    .bind(application.id)
    .first<Row>();

  const stale =
    !!cached &&
    (cached.scheme_version !== scheme.version || cached.decision_hash !== hash);

  if (cached && !stale && method === 'GET')
    return json({
      report: JSON.parse(cached.payload as string),
      stale: false,
      generatedAt: cached.generated_at,
    });

  // A stale report is returned as-is with a flag, never swapped silently under
  // a document the citizen may already have printed. Regenerating is a POST.
  if (cached && stale && method === 'GET')
    return json({
      report: JSON.parse(cached.payload as string),
      stale: true,
      generatedAt: cached.generated_at,
    });

  if (method === 'POST') await limit('report:' + s.id, 12);

  const report = buildReport({
    scheme,
    decision,
    profile,
    confirmed,
    provenance,
    checklist: JSON.parse(application.checklist as string),
    conversationId: (application.conversation_id as string) || null,
    // The recap is the one model-written slot. Without a chat deployment the
    // report is deterministic and simply has no recap paragraph.
    recap: null,
    now: new Date().toISOString(),
  });

  const generatedAt = report.generatedAt;
  await db()
    .prepare(
      'INSERT INTO application_reports(id,application_id,payload,scheme_version,decision_hash,mode,generated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(application_id) DO UPDATE SET payload=excluded.payload,scheme_version=excluded.scheme_version,decision_hash=excluded.decision_hash,mode=excluded.mode,generated_at=excluded.generated_at',
    )
    .bind(
      crypto.randomUUID(),
      application.id,
      JSON.stringify(report),
      scheme.version,
      hash,
      report.mode,
      generatedAt,
    )
    .run();

  return json({ report, stale: false, generatedAt });
};
