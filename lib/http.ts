import { env } from 'cloudflare:workers';

export type Settings = {
  HOSTING_PROVIDER?: string;
  DB: D1Database;
  RULE_SERVICE_URL?: string;
  RULE_SERVICE_API_KEY?: string;
  // Provider-neutral chat configuration; takes precedence over AZURE_OPENAI_*.
  LLM_BASE_URL?: string;
  LLM_API_KEY?: string;
  LLM_MODEL?: string;
  AZURE_OPENAI_ENDPOINT?: string;
  AZURE_OPENAI_API_KEY?: string;
  AZURE_OPENAI_CHAT_DEPLOYMENT?: string;
  ELEVENLABS_API_KEY?: string;
  ELEVENLABS_VOICE_ID?: string;
  EMBEDDING_MODEL?: string;
  PINECONE_API_KEY?: string;
  PINECONE_INDEX_HOST?: string;
  AZURE_OPENAI_EMBEDDING_DEPLOYMENT?: string;
  MEM0_API_KEY?: string;
  YOU_API_KEY?: string;
  REVIEWER_TOKEN?: string;
};

export const settings = () => env as unknown as Settings;

/**
 * Reads a string setting, trimmed, treating empty as absent.
 *
 * Secrets are pasted by hand and frequently arrive with a stray leading or
 * trailing space. Untrimmed, such a value is a valid-looking string that
 * passes every `if (key)` check and then makes an HTTP header value invalid,
 * so `fetch` throws before the request leaves and the citizen sees an opaque
 * "temporarily unavailable". Trimming at the single point of entry removes
 * that whole class of failure.
 */
export function conf<K extends keyof Settings>(key: K): string | undefined {
  const value = settings()[key];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}
export const db = () => settings().DB;

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Request context handed to every route module. */
export type Ctx = {
  req: Request;
  path: string[];
  p: string;
  method: string;
  trace: string;
};

/** A route returns null when the path is not its own, so the next one runs. */
export type Route = (c: Ctx) => Promise<Response | null>;

export const json = (
  data: unknown,
  status = 200,
  extra: Record<string, string> = {},
) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...extra,
    },
  });

export const hash = async (text: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)),
    ),
  )
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

export async function body(req: Request) {
  if (Number(req.headers.get('content-length') || 0) > 16000)
    throw new HttpError(413, 'Request too large.');
  const text = await req.text();
  if (text.length > 16000) throw new HttpError(413, 'Request too large.');
  try {
    const value = JSON.parse(text || '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new Error();
    return value;
  } catch {
    throw new HttpError(400, 'Invalid JSON.');
  }
}

export function origin(req: Request) {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const o = req.headers.get('origin');
    if (o && o !== new URL(req.url).origin)
      throw new HttpError(403, 'Origin not allowed.');
    if (req.headers.get('x-requested-with') !== 'SchemeSathi')
      throw new HttpError(403, 'Missing request verification.');
  }
}

export async function limit(key: string, max = 20) {
  const now = Date.now();
  await db()
    .prepare(
      'INSERT INTO request_limits(id,count,expires_at) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET count=CASE WHEN expires_at<? THEN 1 ELSE count+1 END,expires_at=CASE WHEN expires_at<? THEN ? ELSE expires_at END',
    )
    .bind(key, now + 60000, now, now, now + 60000)
    .run();
  const row = await db()
    .prepare('SELECT count FROM request_limits WHERE id=?')
    .bind(key)
    .first<{ count: number }>();
  if ((row?.count || 0) > max)
    throw new HttpError(429, 'Please wait a minute before trying again.');
}

/**
 * Calls a third-party service.
 *
 * The first outbound request to a host after an idle period hangs in this
 * runtime until the abort fires, while every call after it returns in under a
 * second — a cold connection, not a slow provider. Left alone that means the
 * first thing a citizen does always fails. So a request whose body can safely
 * be sent twice gets one short attempt and then a full-length retry; anything
 * with a streamed body is sent once, because its body cannot be replayed.
 */
const COLD_ATTEMPT_MS = 6000;
const FULL_ATTEMPT_MS = 45000;

export async function external(url: string, init: RequestInit) {
  const replayable =
    typeof init.body === 'string' || init.body === undefined || init.body === null;

  if (replayable) {
    try {
      return await attempt(url, init, COLD_ATTEMPT_MS);
    } catch (error) {
      // A real rejection from the service is final; only a stalled connection
      // is worth trying again.
      if (error instanceof HttpError) throw error;
    }
  }
  return attempt(url, init, replayable ? FULL_ATTEMPT_MS : FULL_ATTEMPT_MS);
}

async function attempt(url: string, init: RequestInit, timeoutMs: number) {
  const r = await fetch(url, {
    ...init,
    // Workers does not implement redirect: 'error' — it throws on the option
    // itself, which broke every outbound call. 'manual' keeps the intent: a
    // redirect is surfaced as a 3xx rather than silently followed to another
    // host, and the !r.ok check below rejects it.
    redirect: 'manual',
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (r.status >= 300 && r.status < 400)
    throw new HttpError(
      502,
      'The connected service redirected unexpectedly. Please try again later.',
    );
  if (!r.ok)
    throw new HttpError(
      503,
      'The connected service is unavailable. Please use the text form or try again later.',
    );
  return r;
}
