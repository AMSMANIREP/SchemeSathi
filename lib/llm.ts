import { conf } from './http';

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
  const baseUrl = conf('LLM_BASE_URL');
  const apiKey = conf('LLM_API_KEY');
  const model = conf('LLM_MODEL');
  const azureEndpoint = conf('AZURE_OPENAI_ENDPOINT');
  const azureKey = conf('AZURE_OPENAI_API_KEY');
  const azureDeployment = conf('AZURE_OPENAI_CHAT_DEPLOYMENT');

  if (baseUrl && apiKey && model) {
    const base = baseUrl.replace(/\/+$/, '');
    // Accept a base given with or without the version segment, since
    // providers document it both ways.
    const url = /\/v\d+$/.test(base)
      ? `${base}/chat/completions`
      : `${base}/v1/chat/completions`;
    return {
      url,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      model,
      provider: 'openai-compatible',
    };
  }

  if (azureEndpoint && azureKey && azureDeployment) {
    return {
      url: `${azureEndpoint.replace(/\/+$/, '')}/openai/v1/chat/completions`,
      headers: {
        'api-key': azureKey,
        'Content-Type': 'application/json',
      },
      model: azureDeployment,
      provider: 'azure',
    };
  }

  return null;
}
