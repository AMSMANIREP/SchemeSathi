/** Durable delivery; this module depends on storage/transport contracts only. */
export type StorageEvent = {
  sequence: number;
  entity: 'profile' | 'application';
  entity_id: string;
  owner: string;
  operation: 'upsert' | 'delete';
  payload: string;
};

export type MirrorTransport = (batch: {
  source_id: string;
  events: Array<Omit<StorageEvent, 'payload'> & { payload: unknown }>;
}) => Promise<{ acknowledged: number[] }>;

export class StorageMirror {
  private database: D1Database;
  private deliver: MirrorTransport;
  constructor(database: D1Database, deliver: MirrorTransport) {
    this.database = database;
    this.deliver = deliver;
  }

  async enable() {
    // The backfill trigger and this flag update are one atomic transaction.
    await this.database
      .prepare(
        'UPDATE storage_sync_config SET enabled=1 WHERE id=1 AND enabled=0',
      )
      .run();
  }

  async flush() {
    const config = await this.database
      .prepare('SELECT source_id FROM storage_sync_config WHERE id=1')
      .first<{ source_id: string }>();
    if (!config) throw new Error('Storage migration is missing.');
    const { results } = await this.database
      .prepare('SELECT * FROM storage_outbox ORDER BY sequence LIMIT 100')
      .all<StorageEvent>();
    if (!results.length) return { pending: 0, delivered: 0 };
    const response = await this.deliver({
      source_id: config.source_id,
      events: results.map((event) => ({
        ...event,
        payload: JSON.parse(event.payload),
      })),
    });
    const sent = new Set(results.map((event) => event.sequence));
    if (
      !Array.isArray(response.acknowledged) ||
      response.acknowledged.some((id) => !sent.has(id))
    )
      throw new Error('Invalid storage acknowledgement.');
    // Match the exact sequence. A newer edit may have replaced this queued
    // event while the HTTP call was in flight; never acknowledge that edit.
    if (response.acknowledged.length) {
      await this.database.batch(
        response.acknowledged.map((sequence) =>
          this.database
            .prepare('DELETE FROM storage_outbox WHERE sequence=?')
            .bind(sequence),
        ),
      );
    }
    const remaining = await this.database
      .prepare('SELECT count(*) AS count FROM storage_outbox')
      .first<{ count: number }>();
    return {
      pending: remaining?.count ?? 0,
      delivered: response.acknowledged.length,
    };
  }
}
