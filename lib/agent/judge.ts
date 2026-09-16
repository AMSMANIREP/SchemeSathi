import { external } from '../http';
import { llm } from '../llm';
import type { Scheme } from '../types';

/**
 * Checks a reply against the catalogue text it is supposed to be describing.
 *
 * The regex validator catches claims that are checkable — amounts, links,
 * programmes not on screen, entitlement language the rules did not support.
 * It cannot catch plausible elaboration, and that is the failure that matters
 * here: asked about PM Vishwakarma the model offered "recognition, training,
 * financial assistance, improved tools and an expanded customer base", and
 * about Ujjwala that it "aims to reduce dependence on traditional cooking
 * fuels". Both read as fact, neither is in the record, and traceability is the
 * product's actual promise.
 *
 * So a second call reads the reply beside the official text and answers one
 * question: does this assert anything the text does not support? It can only
 * reject. It cannot rewrite, add, or approve something the rules engine did
 * not produce — a rejection falls back to the deterministic sentence.
 */
export type Judgement = { ok: true } | { ok: false; reason: string };

/**
 * A first, looser instruction let "skills and enterprise support" become
 * "recognition, training, financial assistance, improved tools and an expanded
 * customer base" — the model judging that a reasonable unpacking. Naming the
 * expansion as the thing to look for is what made it strict enough.
 */
const SYSTEM = [
  'You check a reply against the only official text available for a government programme.',
  'The text is short on purpose and is the whole of what is known.',
  '',
  'Mark the reply unsupported if it names any specific benefit, activity, entitlement,',
  'purpose or effect of a programme that the text does not name — even when it is',
  'plausible, widely true, or a reasonable unpacking of a general phrase.',
  '"Support" does not become "training and tools". "Assistance" does not become "free".',
  'Expanding a general phrase into specifics is exactly what you are looking for.',
  '',
  "Ignore anything that is not a claim about a programme: questions, greetings,",
  "statements about the citizen's own situation, and eligibility verdicts are always supported.",
  '',
  'Reply with JSON only: {"supported": true} or {"supported": false, "unsupported": "<shortest offending phrase from the reply>"}.',
].join('\n');

export async function judgeProse(
  text: string,
  schemes: Scheme[],
  mentioned: string[],
): Promise<Judgement> {
  const config = llm();
  if (!config || !mentioned.length) return { ok: true };

  const sources = schemes
    .filter((s) => mentioned.includes(s.id))
    .map((s) =>
      [
        `${s.shortName} (${s.ministry})`,
        s.summary,
        s.benefit,
        s.fees ? `Cost: ${s.fees}` : '',
      ]
        .filter(Boolean)
        .join(' '),
    )
    .join('\n\n');
  if (!sources.trim()) return { ok: true };

  const r = await external(config.url, {
    method: 'POST',
    headers: config.headers,
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: SYSTEM },
        {
          role: 'user',
          content: `OFFICIAL TEXT:\n${sources}\n\nREPLY:\n${text}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
      max_tokens: 120,
    }),
  });

  const body = (await r.json()) as {
    choices: { message: { content: string } }[];
  };
  const parsed = JSON.parse(body.choices[0].message.content) as {
    supported?: boolean;
    unsupported?: string;
  };

  // Absent or malformed verdicts pass. A judge that cannot answer must not
  // become a second source of rejection — the regex checks already ran.
  if (parsed.supported === false)
    return {
      ok: false,
      reason: `not supported by the official text: ${String(parsed.unsupported ?? '').slice(0, 120)}`,
    };
  return { ok: true };
}
