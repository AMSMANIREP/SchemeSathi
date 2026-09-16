import { db, HttpError, settings } from '../http';
import { StorageMirror } from './mirror';
import {
  D1ApplicationRepository,
  type ApplicationRepository,
} from './applications';
import { D1ProfileRepository, type ProfileRepository } from './profiles';

// Primary-adapter selection stays here; HTTP handlers use domain contracts.
export function applicationRepository(): ApplicationRepository {
  return new D1ApplicationRepository(db());
}

export function profileRepository(): ProfileRepository {
  return new D1ProfileRepository(db());
}

export function storageMode() {
  const mode = settings().DATA_STORAGE_MODE || 'd1';
  if (mode !== 'd1' && mode !== 'dual')
    throw new HttpError(503, 'Invalid data storage configuration.');
  return mode;
}

export function postgresConnection() {
  const config = settings();
  const url = config.POSTGRES_SERVICE_URL || config.RULE_SERVICE_URL;
  const key =
    config.POSTGRES_SERVICE_API_KEY ||
    config.RULE_SERVICE_API_KEY ||
    config.SERVICE_API_KEY;
  if (!url || !key)
    throw new HttpError(503, 'PostgreSQL synchronization is not configured.');
  return { url: url.replace(/\/$/, ''), key };
}

export function storageMirror() {
  const { url, key } = postgresConnection();
  return new StorageMirror(db(), async (batch) => {
    let response: Response;
    try {
      response = await fetch(url + '/v1/storage/sync', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + key,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(batch),
        // Workers supports manual redirects. Treat 3xx as a failed delivery
        // below so credentials and profile data never follow a redirect.
        redirect: 'manual',
        signal: AbortSignal.timeout(3000),
      });
    } catch (error) {
      const name = error instanceof Error ? error.name : 'UnknownError';
      throw new HttpError(
        503,
        'PostgreSQL synchronization transport failed (' + name + ').',
      );
    }
    if (!response.ok)
      throw new HttpError(
        503,
        'PostgreSQL synchronization returned HTTP ' + response.status + '.',
      );
    return response.json();
  });
}

export async function syncAfterRequest(response: Response) {
  try {
    const result = await storageMirror().flush();
    response.headers.set(
      'X-Storage-Sync',
      result.pending ? 'pending' : 'synced',
    );
  } catch {
    // D1 has already committed with its outbox entry. Do not claim the save
    // failed or drop the entry: the independent sync worker will retry it.
    response.headers.set('X-Storage-Sync', 'pending');
    console.warn(JSON.stringify({ event: 'postgres_sync_pending' }));
  }
  return response;
}
