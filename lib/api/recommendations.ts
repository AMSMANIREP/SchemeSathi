import { external, HttpError, json, settings } from '../http';
import { evaluateScheme } from '../rules';
import { schemes } from '../schemes';
import type { SessionRoute } from '../session';

export const recommendations: SessionRoute = async ({ p, method, s, trace }) => {
  if (p !== 'recommendations' || method !== 'GET') return null;

  if (s.version === 0) throw new HttpError(409, 'Confirm your profile first.');
  const profile = JSON.parse(s.profile);
  const all = await schemes();
  let results = all.map((scheme) => ({
    scheme,
    decision: evaluateScheme(scheme, profile, JSON.parse(s.confirmed)),
  }));

  const e = settings();
  if (e.RULE_SERVICE_URL && e.RULE_SERVICE_API_KEY) {
    try {
      const r = await external(
        e.RULE_SERVICE_URL.replace(/\/$/, '') + '/v1/evaluate',
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + e.RULE_SERVICE_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId: s.id,
            profile,
            confirmed: JSON.parse(s.confirmed),
            profileVersion: s.version,
          }),
        },
      );
      const result = (await r.json()) as {
        profileVersion: number;
        results: (typeof results)[number]['decision'][];
      };
      if (result.profileVersion !== s.version)
        throw new Error('Version mismatch');
      results = results.map((x) => {
        const d = result.results.find(
          (d) => d.schemeId === x.scheme.id && d.version === x.scheme.version,
        );
        if (!d || d.status !== x.decision.status)
          throw new Error('Rule parity mismatch');
        return x;
      });
    } catch {
      results = results.map((x) => ({
        ...x,
        decision: {
          ...x.decision,
          status: 'UNABLE_TO_DETERMINE' as const,
          notice:
            'The rules service is unavailable or its release version differs. Please try again later.',
        },
      }));
    }
  }

  return json({ profileVersion: s.version, results, traceId: trace });
};
