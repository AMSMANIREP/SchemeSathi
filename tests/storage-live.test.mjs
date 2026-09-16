// Run inside the web container. Uses only a new synthetic session and deletes it.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const base = process.env.TEST_BASE_URL || 'http://localhost:3000';
const postgres = process.env.POSTGRES_SERVICE_URL;
const key = process.env.POSTGRES_SERVICE_API_KEY;
if (!postgres || !key)
  throw new Error('Run inside the dual-storage web container.');
let cookie = '';
let database;
let databasePath;
let owner;

async function api(path, method = 'GET', payload, status = 200) {
  const response = await fetch(base + '/api/v1/' + path, {
    method,
    headers: {
      Cookie: cookie,
      'X-Requested-With': 'SchemeSathi',
      'Content-Type': 'application/json',
    },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  });
  assert.equal(response.status, status, method + ' ' + path);
  if (response.headers.has('set-cookie'))
    cookie = response.headers.get('set-cookie').split(';')[0];
  return response.json();
}

async function pg(path, expected = 200, method = 'GET', payload) {
  const response = await fetch(postgres + '/v1/' + path, {
    headers: { Authorization: 'Bearer ' + key },
    method,
    ...(payload === undefined
      ? {}
      : {
          headers: {
            Authorization: 'Bearer ' + key,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }),
  });
  assert.equal(response.status, expected, 'PostgreSQL ' + path);
  return response.json();
}

try {
  assert.equal((await api('capabilities')).storage, 'D1 + PostgreSQL');
  await api('sessions', 'POST', { language: 'en' }, 201);
  const tokenHash = createHash('sha256')
    .update(cookie.split('=')[1])
    .digest('hex');
  for (const relative of readdirSync('.wrangler/state', {
    recursive: true,
  }).filter((name) => name.endsWith('.sqlite'))) {
    const candidate = new DatabaseSync(join('.wrangler/state', relative), {
      readOnly: true,
    });
    if (
      candidate
        .prepare("SELECT 1 FROM sqlite_master WHERE name='sessions'")
        .get()
    ) {
      const session = candidate
        .prepare('SELECT id FROM sessions WHERE token_hash=?')
        .get(tokenHash);
      if (session) {
        database = candidate;
        databasePath = join('.wrangler/state', relative);
        owner = session.id;
        break;
      }
    }
    candidate.close();
  }
  assert.ok(database, 'Synthetic session exists in D1');
  await api('profile/confirm', 'PUT', {
    profile: { age: 45, occupation: 'farmer', state: 'Karnataka' },
    version: 0,
    confirmed: true,
  });
  let stored = await pg('profiles/' + owner);
  assert.equal(stored.profile.age, 45);
  assert.equal(stored.provenance.age, 'entered');
  assert.deepEqual(
    stored.profile,
    JSON.parse(
      database.prepare('SELECT profile FROM sessions WHERE id=?').get(owner)
        .profile,
    ),
  );
  await api('profile/answer', 'POST', { field: 'age', value: 46 });
  stored = await pg('profiles/' + owner);
  assert.equal(stored.profile.age, 46);
  assert.equal(stored.version, 2);
  assert.equal(stored.provenance.age, 'answered');

  const scheme = (await api('schemes')).schemes[0];
  await api('applications', 'POST', { schemeId: scheme.id }, 201);
  await api('applications', 'POST', { schemeId: scheme.id }, 201);
  const record = (await api('applications')).applications[0];
  let remote = (await pg('applications?sessionId=' + owner)).applications;
  assert.equal(remote.length, 1);
  assert.equal(remote[0].id, record.id);
  assert.ok(
    database
      .prepare('SELECT id FROM applications WHERE id=? AND owner=?')
      .get(record.id, owner),
  );
  await api('applications/' + record.id, 'PATCH', {
    status: 'Submitted',
    reference: '1234',
    notes: 'Synthetic persistence check',
    checklist: [scheme.documents[0].item],
  });
  remote = (await pg('applications?sessionId=' + owner)).applications;
  assert.equal(remote[0].status, 'Submitted');
  assert.equal(remote[0].reference, '•••• 1234');
  assert.deepEqual(remote[0].checklist, [scheme.documents[0].item]);
  const report = await api('applications/' + record.id + '/report');
  assert.ok(
    report.report,
    'Reports still read the D1 application and frozen decision',
  );
  await api('applications/' + record.id, 'DELETE');
  assert.equal(
    (await pg('applications?sessionId=' + owner)).applications.length,
    0,
  );
  assert.equal(
    database
      .prepare('SELECT count(*) AS n FROM applications WHERE owner=?')
      .get(owner).n,
    0,
  );
  // Simulate an old release's PostgreSQL-only tracker for this synthetic owner.
  const legacy = await pg('applications', 201, 'POST', {
    sessionId: owner,
    schemeId: scheme.id,
  });
  const setup = new DatabaseSync(databasePath);
  setup.prepare('DELETE FROM storage_legacy_imports WHERE owner=?').run(owner);
  setup.close();
  const imported = (await api('applications')).applications;
  assert.equal(imported.length, 1);
  assert.equal(imported[0].id, legacy.application.id);
  assert.ok(
    database
      .prepare('SELECT id FROM applications WHERE id=? AND owner=?')
      .get(legacy.application.id, owner),
  );
  await api('applications', 'POST', { schemeId: scheme.id }, 201);
  await api('me/data', 'DELETE');
  assert.equal(
    database.prepare('SELECT count(*) AS n FROM sessions WHERE id=?').get(owner)
      .n,
    0,
  );
  await pg('profiles/' + owner, 404);
  assert.equal(
    (await pg('applications?sessionId=' + owner)).applications.length,
    0,
  );
  console.log(
    'Dual-storage live checks passed: profile saves/answers, application CRUD, shared IDs, legacy import, reports, and privacy deletion.',
  );
} finally {
  if (cookie && cookie !== 'sathi_session=') await api('me/data', 'DELETE');
  database?.close();
}
