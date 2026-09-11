// Independent retry worker: queued changes drain even without browser traffic.
import { setTimeout } from 'node:timers/promises';

const base = process.env.STORAGE_SYNC_URL || 'http://web:3000';
const key = process.env.STORAGE_SYNC_KEY;
if (!key) throw new Error('STORAGE_SYNC_KEY is required.');
for (;;) {
  try {
    const response = await fetch(base + '/api/v1/storage/sync', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + key,
        'X-Requested-With': 'SchemeSathi',
      },
      signal: AbortSignal.timeout(15000),
      redirect: 'manual',
    });
    if (!response.ok) throw new Error('Sync request failed.');
    const result = await response.json();
    if (result.delivered || result.pending) console.log(JSON.stringify(result));
    if (result.pending) continue;
  } catch {
    // Do not log credentials, URLs, request bodies or personal data.
    console.warn('PostgreSQL sync pending; will retry.');
  }
  await setTimeout(10000);
}
