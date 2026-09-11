import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { StorageMirror } from '../lib/storage/mirror.ts';
import { D1ApplicationRepository } from '../lib/storage/applications.ts';
import { D1ProfileRepository } from '../lib/storage/profiles.ts';

const owner = '12345678-1234-4234-9234-123456789012';
const other = '12345678-1234-4234-9234-123456789013';

function database() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys=ON');
  for (const file of readdirSync(new URL('../drizzle/', import.meta.url))
    .filter((name) => name.endsWith('.sql'))
    .sort())
    sqlite.exec(
      readFileSync(new URL('../drizzle/' + file, import.meta.url), 'utf8'),
    );
  const adapter = {
    prepare(sql) {
      let values = [];
      const statement = {
        bind(...args) {
          values = args;
          return statement;
        },
        async run() {
          const r = sqlite.prepare(sql).run(...values);
          return { meta: { changes: r.changes } };
        },
        async first() {
          return sqlite.prepare(sql).get(...values) ?? null;
        },
        async all() {
          return { results: sqlite.prepare(sql).all(...values) };
        },
      };
      return statement;
    },
    async batch(statements) {
      sqlite.exec('BEGIN');
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sqlite.exec('COMMIT');
        return results;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  };
  function session(id = owner) {
    sqlite
      .prepare(
        'INSERT INTO sessions(id,token_hash,created_at,expires_at) VALUES(?,?,?,?)',
      )
      .run(id, id, 1, 9999999999999);
  }
  const events = () =>
    sqlite.prepare('SELECT * FROM storage_outbox ORDER BY sequence').all();
  return { sqlite, adapter, session, events };
}

function application(id = '12345678-1234-4234-9234-123456789020') {
  return {
    id,
    owner,
    schemeId: 'pm-kisan',
    status: 'Interested',
    reference: '',
    notes: '',
    checklist: [],
    updatedAt: '2026-09-12T00:00:00Z',
    decisionSnapshot: { status: 'UNABLE_TO_DETERMINE' },
    schemeVersion: 'v1',
    conversationId: null,
  };
}

test('D1-only writes stay unchanged; enabling mirroring backfills profiles and full applications once', async () => {
  const db = database();
  db.session();
  const repo = new D1ApplicationRepository(db.adapter);
  await repo.create(application());
  assert.equal(db.events().length, 0);
  const mirror = new StorageMirror(db.adapter, async () => {
    throw new Error('offline');
  });
  await mirror.enable();
  assert.equal(db.events().length, 2);
  const event = db.events().find((e) => e.entity === 'application');
  assert.equal(
    JSON.parse(event.payload).decision_snapshot.status,
    'UNABLE_TO_DETERMINE',
  );
  await mirror.enable();
  assert.equal(db.events().length, 2);
  db.sqlite.close();
});

test('profile saves use optimistic concurrency; chat SQL is mirrored by the same trigger', async () => {
  const db = database();
  db.session();
  await new StorageMirror(db.adapter, async () => {}).enable();
  const repo = new D1ProfileRepository(db.adapter);
  const update = {
    profile: { age: 45 },
    confirmed: ['age'],
    provenance: { age: 'entered' },
  };
  assert.equal(await repo.save(owner, 0, update), true);
  assert.equal(
    await repo.save(owner, 0, { ...update, profile: { age: 60 } }),
    false,
  );
  assert.equal(db.events().length, 1);
  assert.equal(JSON.parse(db.events()[0].payload).profile.age, 45);
  db.sqlite
    .prepare('UPDATE sessions SET profile=?,version=version+1 WHERE id=?')
    .run('{"age":46}', owner);
  assert.equal(JSON.parse(db.events()[0].payload).profile.age, 46);
  db.sqlite.close();
});

test('application CRUD is owner-scoped and mirrors changes without losing frozen metadata', async () => {
  const db = database();
  db.session();
  db.session(other);
  const mirror = new StorageMirror(db.adapter, async () => {});
  await mirror.enable();
  const repo = new D1ApplicationRepository(db.adapter);
  const record = application();
  await repo.create(record);
  await repo.create({ ...record, id: crypto.randomUUID() });
  assert.equal((await repo.list(owner)).length, 1);
  assert.equal(await repo.find(other, record.id), null);
  await repo.update(owner, {
    ...record,
    status: 'Submitted',
    reference: '•••• 1234',
  });
  assert.equal(
    (await repo.find(owner, record.id)).decisionSnapshot.status,
    'UNABLE_TO_DETERMINE',
  );
  await repo.delete(other, record.id);
  assert.ok(await repo.find(owner, record.id));
  await repo.delete(owner, record.id);
  assert.equal(await repo.find(owner, record.id), null);
  const deleted = db.events().find((e) => e.entity === 'application');
  assert.equal(deleted.operation, 'delete');
  assert.equal(deleted.payload, '{}');
  db.sqlite.close();
});

test('failed delivery retains the queue; acknowledgement cannot discard a concurrent newer edit', async () => {
  const db = database();
  db.session();
  const failing = new StorageMirror(db.adapter, async () => {
    throw new Error('offline');
  });
  await failing.enable();
  await assert.rejects(failing.flush(), /offline/);
  assert.equal(db.events().length, 1);
  const delivering = new StorageMirror(db.adapter, async (batch) => {
    db.sqlite
      .prepare('UPDATE sessions SET version=version+1 WHERE id=?')
      .run(owner);
    return { acknowledged: batch.events.map((e) => e.sequence) };
  });
  assert.equal((await delivering.flush()).pending, 1);
  const healthy = new StorageMirror(db.adapter, async (batch) => ({
    acknowledged: batch.events.map((e) => e.sequence),
  }));
  assert.equal((await healthy.flush()).pending, 0);
  db.sqlite.close();
});

test('rollback leaves no mirror event; deleting/expiring an owner removes queued personal data', async () => {
  const db = database();
  db.session();
  await new StorageMirror(db.adapter, async () => {}).enable();
  const before = db.events()[0].sequence;
  await assert.rejects(
    db.adapter.batch([
      db.adapter
        .prepare('UPDATE sessions SET profile=? WHERE id=?')
        .bind('{"age":50}', owner),
      db.adapter.prepare('INSERT INTO missing_table VALUES(1)'),
    ]),
  );
  assert.equal(db.events()[0].sequence, before);
  await new D1ApplicationRepository(db.adapter).create(application());
  db.sqlite.prepare('DELETE FROM sessions WHERE id=?').run(owner);
  assert.ok(
    db.events().some((e) => e.entity === 'profile' && e.operation === 'delete'),
  );
  assert.ok(
    db.events().every((e) => e.operation === 'delete' && e.payload === '{}'),
  );
  db.sqlite.close();
});
