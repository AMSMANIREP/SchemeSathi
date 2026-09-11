import { catalogue } from './catalogue';
import { db } from './http';
import type { Scheme } from './types';

/** The catalogue with any reviewed overrides applied. */
export async function schemes() {
  const overrides = await db()
    .prepare('SELECT id,payload,created_at FROM scheme_reviews')
    .all<{ id: string; payload: string; created_at: string }>();
  return catalogue.map((s) => {
    const r = overrides.results.find((x) => x.id === s.id);
    return r ? ({ ...s, ...JSON.parse(r.payload) } as Scheme) : s;
  });
}
