import { settings } from './http';

/**
 * Resolves whichever chat provider is configured.
 *
 * The product does not depend on a particular vendor: the model extracts
 * fields, calls tools, and writes two short prose slots that are validated
 * afterwards, while every eligibility verdict comes from the deterministic
 * rules engine. So the provider is a setting, not an architectural choice,
 * and swapping one costs a base URL and a model name.
 *
 * `LLM_*` is the provider-neutral form and wins when present. The
 * `AZURE_OPENAI_*` names still work so existing deployments keep running.
 */
export type LlmConfig = {
  /** Fully-resolved chat-completions endpoint. */
  url: string;
  headers: Record<string, string>;
  model: string;
  provider: 'openai-compatible' | 'azure';
};

export function llm(): LlmConfig | null {
  const e = settings();

  if (e.LLM_BASE_URL && e.LLM_API_KEY && e.LLM_MODEL) {
    const base = e.LLM_BASE_URL.replace(/\/+$/, '');
    // Accept a base given with or without the version segment, since
    // providers document it both ways.
    const url = /\/v\d+$/.test(base)
      ? `${base}/chat/completions`
      : `${base}/v1/chat/completions`;
    return {
      url,
      headers: {
        Authorization: `Bearer ${e.LLM_API_KEY}`,
        'Content-Type': 'application/json',
      },
      model: e.LLM_MODEL,
      provider: 'openai-compatible',
    };
  }

  if (
    e.AZURE_OPENAI_ENDPOINT &&
    e.AZURE_OPENAI_API_KEY &&
    e.AZURE_OPENAI_CHAT_DEPLOYMENT
  ) {
    return {
      url: `${e.AZURE_OPENAI_ENDPOINT.replace(/\/+$/, '')}/openai/v1/chat/completions`,
      headers: {
        'api-key': e.AZURE_OPENAI_API_KEY,
        'Content-Type': 'application/json',
      },
      model: e.AZURE_OPENAI_CHAT_DEPLOYMENT,
      provider: 'azure',
    };
  }

  return null;
}
