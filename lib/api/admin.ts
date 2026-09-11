import { HttpError, json, settings } from '../http';
import { schemes } from '../schemes';
import type { SessionRoute } from '../session';

export const admin: SessionRoute = async ({ req, p, method }) => {
  if (p !== 'admin/reviews' || method !== 'GET') return null;

  if (
    !settings().REVIEWER_TOKEN ||
    req.headers.get('authorization') !== 'Bearer ' + settings().REVIEWER_TOKEN
  )
    throw new HttpError(403, 'Reviewer access is required.');
  return json({
    schemes: await schemes(),
    note: 'Approve complete source and rule manifests through the signed release pipeline. Runtime self-approval is disabled.',
  });
};
