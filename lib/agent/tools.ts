import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { evaluateScheme } from '../rules';
import { retrieve } from '../retrieval';
import { fields } from '../rules';
import type { Decision, Profile, Scheme } from '../types';

/**
 * What the model is allowed to do.
 *
 * Every tool is read-only. The model may look things up and form an opinion
 * about which schemes to discuss, but it writes nothing: no profile field, no
 * verdict, no saved application, no block. Those stay with code that owns
 * them, so the guarantees in tests/untrusted.test.mjs hold no matter what the
 * model returns — including nothing at all.
 */
export type ToolContext = {
  schemes: Scheme[];
  profile: Profile;
  confirmed: string[];
  /** Filled in as the model searches, so the caller can see what it saw. */
  seen: Set<string>;
};

export function buildTools(ctx: ToolContext) {
  const searchSchemes = tool(
    async ({ query }: { query: string }) => {
      const candidates = await retrieve(query, ctx.schemes, 6);
      for (const c of candidates) ctx.seen.add(c.schemeId);
      if (!candidates.length) return 'No programme matched that.';
      return candidates
        .map((c) => {
          const s = ctx.schemes.find((x) => x.id === c.schemeId)!;
          return `${c.schemeId} | ${s.shortName} | ${s.summary}`;
        })
        .join('\n');
    },
    {
      name: 'search_schemes',
      description:
        "Find Central Government programmes matching a description of someone's situation. Works in English, Hindi and Kannada. Returns scheme ids.",
      schema: z.object({
        query: z.string().describe("The citizen's situation, in their own words"),
      }),
    },
  );

  const checkEligibility = tool(
    async ({ schemeIds }: { schemeIds: string[] }) => {
      const lines = schemeIds.map((id) => {
        const scheme = ctx.schemes.find((x) => x.id === id);
        if (!scheme) return `${id} | unknown scheme`;
        ctx.seen.add(id);
        const d: Decision = evaluateScheme(scheme, ctx.profile, ctx.confirmed);
        const missing = d.missingFields.length
          ? ` | still unestablished: ${d.missingFields.join(', ')}`
          : '';
        return `${id} | ${d.status}${missing}`;
      });
      return lines.join('\n');
    },
    {
      name: 'check_eligibility',
      description:
        'Get the eligibility verdict for scheme ids. The verdict comes from a fixed rules engine — it is the only source of truth for eligibility, and you must never contradict it or state a verdict it did not produce.',
      schema: z.object({ schemeIds: z.array(z.string()) }),
    },
  );

  const whatIsKnown = tool(
    async () => {
      const known = ctx.confirmed
        .filter((f) => ctx.profile[f] != null)
        .map((f) => `${f}=${ctx.profile[f]}`);
      const askable = fields
        .map((f) => f.key)
        .filter((k) => !ctx.confirmed.includes(k));
      return `confirmed: ${known.join(', ') || '(nothing yet)'}\nnot yet established: ${askable.join(', ')}`;
    },
    {
      name: 'what_is_known',
      description:
        'What the citizen has confirmed about themselves, and which fields are still unestablished. Only confirmed facts count toward eligibility.',
      schema: z.object({}),
    },
  );

  return [searchSchemes, checkEligibility, whatIsKnown];
}
