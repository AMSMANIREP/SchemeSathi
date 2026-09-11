import { HttpError, json, settings, type Route } from '../http';
import { storageMirror, storageMode } from '../storage';

/** Operator/cron endpoint; never exposed as an anonymous user-data endpoint. */
export const storageSync: Route = async ({ req, p, method }) => {
  if (p !== 'storage/sync' || method !== 'POST') return null;
  const key = settings().STORAGE_SYNC_KEY;
  if (!key || req.headers.get('authorization') !== 'Bearer ' + key)
    throw new HttpError(401, 'Service authentication required.');
  if (storageMode() !== 'dual')
    return json({ mode: 'd1', pending: 0, delivered: 0 });
  return json({ mode: 'dual', ...(await storageMirror().flush()) });
};
