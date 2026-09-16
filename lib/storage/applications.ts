import type { ApplicationRecord } from '../types';

export type SavedApplication = ApplicationRecord & {
  owner: string;
  decisionSnapshot: Record<string, unknown>;
  schemeVersion: string;
  conversationId: string | null;
};

/** Domain contract for a future PostgreSQL primary adapter. */
export interface ApplicationRepository {
  list(owner: string): Promise<SavedApplication[]>;
  find(owner: string, id: string): Promise<SavedApplication | null>;
  create(record: SavedApplication): Promise<void>;
  update(owner: string, record: ApplicationRecord): Promise<void>;
  delete(owner: string, id: string): Promise<void>;
}

function decode(row: Record<string, unknown>): SavedApplication {
  return {
    id: row.id as string,
    owner: row.owner as string,
    schemeId: row.scheme_id as string,
    status: row.status as string,
    reference: row.reference as string,
    notes: row.notes as string,
    checklist: JSON.parse(row.checklist as string),
    updatedAt: row.updated_at as string,
    decisionSnapshot: JSON.parse((row.decision_snapshot as string) || '{}'),
    schemeVersion: (row.scheme_version as string) || '',
    conversationId: (row.conversation_id as string) || null,
  };
}

export class D1ApplicationRepository implements ApplicationRepository {
  private database: D1Database;
  constructor(database: D1Database) {
    this.database = database;
  }

  async list(owner: string) {
    const result = await this.database
      .prepare(
        'SELECT * FROM applications WHERE owner=? ORDER BY updated_at DESC',
      )
      .bind(owner)
      .all<Record<string, unknown>>();
    return result.results.map(decode);
  }

  async find(owner: string, id: string) {
    const row = await this.database
      .prepare('SELECT * FROM applications WHERE id=? AND owner=?')
      .bind(id, owner)
      .first<Record<string, unknown>>();
    return row ? decode(row) : null;
  }

  async create(record: SavedApplication) {
    await this.database
      .prepare(
        'INSERT INTO applications(id,owner,scheme_id,status,reference,notes,checklist,decision_snapshot,scheme_version,conversation_id,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(owner,scheme_id) DO NOTHING',
      )
      .bind(
        record.id,
        record.owner,
        record.schemeId,
        record.status,
        record.reference,
        record.notes,
        JSON.stringify(record.checklist),
        JSON.stringify(record.decisionSnapshot),
        record.schemeVersion,
        record.conversationId,
        record.updatedAt,
      )
      .run();
  }

  async update(owner: string, record: ApplicationRecord) {
    await this.database
      .prepare(
        'UPDATE applications SET status=?,reference=?,notes=?,checklist=?,updated_at=? WHERE id=? AND owner=?',
      )
      .bind(
        record.status,
        record.reference,
        record.notes,
        JSON.stringify(record.checklist),
        record.updatedAt,
        record.id,
        owner,
      )
      .run();
  }

  async delete(owner: string, id: string) {
    await this.database
      .prepare('DELETE FROM applications WHERE id=? AND owner=?')
      .bind(id, owner)
      .run();
  }
}
