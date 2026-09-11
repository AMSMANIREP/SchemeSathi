import { ChatOpenAI } from '@langchain/openai';
import { conf, HttpError } from '../http';

/**
 * The chat model, wired through a fetch that keeps the protections the rest
 * of the product relies on.
 *
 * LangChain brings its own HTTP client, which would otherwise bypass
 * lib/http.ts entirely — and both of the bugs that made this product
 * non-functional earlier today lived in exactly that layer:
 *
 *   - workerd rejects `redirect: 'error'` outright, throwing on the option
 *     rather than on any redirect, which broke every outbound call.
 *   - the first request to a host after an idle period stalls until the abort
 *     fires, so the first thing a citizen does would always fail.
 *
 * Re-applying them here is deliberate, not defensive: a framework's client is
 * still our request.
 */
const COLD_ATTEMPT_MS = 6000;
const FULL_ATTEMPT_MS = 25000;

const hardenedFetch: typeof fetch = async (input, init = {}) => {
  const attempt = (timeoutMs: number) =>
    fetch(input, {
      ...init,
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    });

  // The body is a string for every call LangChain makes here, so a stalled
  // connection can safely be retried.
  try {
    return await attempt(COLD_ATTEMPT_MS);
  } catch {
    return attempt(FULL_ATTEMPT_MS);
  }
};

export function chatModel() {
  const baseUrl = conf('LLM_BASE_URL');
  const apiKey = conf('LLM_API_KEY');
  const model = conf('LLM_MODEL');
  if (!baseUrl || !apiKey || !model) return null;

  const base = baseUrl.replace(/\/+$/, '');
  return new ChatOpenAI({
    model,
    apiKey,
    temperature: 0,
    maxTokens: 700,
    configuration: {
      baseURL: /\/v\d+$/.test(base) ? base : `${base}/v1`,
      fetch: hardenedFetch,
    },
  });
}

export { HttpError };
