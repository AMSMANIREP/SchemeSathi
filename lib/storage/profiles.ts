import type { Profile, Provenance } from '../types';

export type ProfileUpdate = {
  profile: Profile;
  confirmed: string[];
  provenance: Record<string, Provenance>;
  checkpoint?: string;
};

export interface ProfileRepository {
  save(
    owner: string,
    expectedVersion: number,
    update: ProfileUpdate,
  ): Promise<boolean>;
}

export class D1ProfileRepository implements ProfileRepository {
  private database: D1Database;
  constructor(database: D1Database) {
    this.database = database;
  }

  async save(owner: string, expectedVersion: number, update: ProfileUpdate) {
    const result = await this.database
      .prepare(
        'UPDATE sessions SET profile=?,confirmed=?,provenance=?,version=version+1,checkpoint=COALESCE(?,checkpoint) WHERE id=? AND version=?',
      )
      .bind(
        JSON.stringify(update.profile),
        JSON.stringify(update.confirmed),
        JSON.stringify(update.provenance),
        update.checkpoint ?? null,
        owner,
        expectedVersion,
      )
      .run();
    return !!result.meta.changes;
  }
}
