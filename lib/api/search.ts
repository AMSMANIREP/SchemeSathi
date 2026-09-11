import { body, HttpError, json, limit } from '../http';
import { retrieve, retrievalMode } from '../retrieval';
import { evaluateScheme, redact } from '../rules';
import { schemes } from '../schemes';
import type { SessionRoute } from '../session';
import type { Decision } from '../types';

const RANK: Record<Decision['status'], number> = {
  LIKELY_ELIGIBLE: 0,
  POSSIBLY_ELIGIBLE: 1,
  UNABLE_TO_DETERMINE: 2,
  LIKELY_NOT_ELIGIBLE: 3,
};

export const search: SessionRoute = async ({ req, p, method, s, trace }) => {
  if (p !== 'search' || method !== 'POST') return null;

  await limit('search:' + s.id);
  const b = await body(req);
  if (
    typeof b.query !== 'string' ||
    !b.query.trim() ||
    b.query.length > 400
  )
    throw new HttpError(400, 'Enter a search of up to 400 characters.');

  const live = await schemes();
  const candidates = retrieve(redact(b.query), live);
  const profile = JSON.parse(s.profile);
  const confirmed = JSON.parse(s.confirmed);
  const decided = s.version > 0;

  const results = candidates.map((c) => {
    const scheme = live.find((x) => x.id === c.schemeId)!;
    return {
      schemeId: c.schemeId,
      score: Number(c.score.toFixed(4)),
      // Chunk IDs travel with the excerpt so a later citation resolves through
      // the source registry rather than through anything a model wrote.
      chunks: c.chunks,
      source: scheme.source,
      // Retrieval narrows; the rules engine decides.
      decision: decided ? evaluateScheme(scheme, profile, confirmed) : null,
    };
  });

  if (decided)
    results.sort(
      (a, b) =>
        RANK[a.decision!.status] - RANK[b.decision!.status] ||
        b.score - a.score,
    );

  return json({
    mode: retrievalMode(),
    profileVersion: s.version,
    results,
    traceId: trace,
  });
};
