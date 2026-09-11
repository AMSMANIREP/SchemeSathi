import { HttpError, json, type Route } from '../http';
import { schemes } from '../schemes';

export const schemeRoutes: Route = async ({ p, path, method }) => {
  if (p === 'schemes' && method === 'GET')
    return json({ schemes: await schemes() });

  if (p.startsWith('schemes/') && method === 'GET') {
    const s = (await schemes()).find((s) => s.id === path[1]);
    if (!s) throw new HttpError(404, 'Scheme not found.');
    return json(s);
  }

  return null;
};
