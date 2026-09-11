import { db } from '../http';
import { redact } from '../rules';
import { postgresConnection, storageMode } from './index';
import type { ApplicationRecord } from '../types';

/**
 * Older Docker releases wrote tracker records only to PostgreSQL. Import them
 * once per active owner before changing to D1 reads, without replacing D1 rows.
 */
export async function importLegacyApplications(owner: string) {
  if (storageMode() !== 'dual') return;
  if (
    await db()
      .prepare('SELECT owner FROM storage_legacy_imports WHERE owner=?')
      .bind(owner)
      .first()
  )
    return;
  const { url, key } = postgresConnection();
  const response = await fetch(
    url + '/v1/applications?sessionId=' + encodeURIComponent(owner),
    {
      headers: { Authorization: 'Bearer ' + key },
      redirect: 'manual',
      signal: AbortSignal.timeout(3000),
    },
  );
  if (!response.ok) throw new Error('Legacy tracker import unavailable.');
  const { applications } = (await response.json()) as {
    applications: ApplicationRecord[];
  };
  // The import and marker commit together. A concurrent second import or
  // deletion cannot resurrect an old remote row.
  await db().batch([
    ...applications.map((record) =>
      db()
        .prepare(
          'INSERT INTO applications(id,owner,scheme_id,status,reference,notes,checklist,updated_at) ' +
            'SELECT ?,?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM storage_legacy_imports WHERE owner=?) ' +
            "AND NOT EXISTS(SELECT 1 FROM storage_outbox WHERE entity='application' AND entity_id=? AND operation='delete') " +
            'ON CONFLICT(owner,scheme_id) DO NOTHING',
        )
        .bind(
          record.id,
          owner,
          record.schemeId,
          record.status,
          record.reference
            ? '•••• ' + record.reference.replace(/[^a-zA-Z0-9]/g, '').slice(-4)
            : '',
          redact(record.notes),
          JSON.stringify(record.checklist),
          record.updatedAt,
          owner,
          record.id,
        ),
    ),
    db()
      .prepare('INSERT OR IGNORE INTO storage_legacy_imports(owner) VALUES(?)')
      .bind(owner),
  ]);
}
