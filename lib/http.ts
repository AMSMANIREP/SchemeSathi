import { env } from 'cloudflare:workers';

export type Settings = {
  HOSTING_PROVIDER?: string;
  DB: D1Database;
  RULE_SERVICE_URL?: string;
  RULE_SERVICE_API_KEY?: string;
  AZURE_OPENAI_ENDPOINT?: string;
  AZURE_OPENAI_API_KEY?: string;
  AZURE_OPENAI_CHAT_DEPLOYMENT?: string;
  ELEVENLABS_API_KEY?: string;
  ELEVENLABS_VOICE_ID?: string;
  PINECONE_API_KEY?: string;
  PINECONE_INDEX_HOST?: string;
  AZURE_OPENAI_EMBEDDING_DEPLOYMENT?: string;
  MEM0_API_KEY?: string;
  YOU_API_KEY?: string;
  REVIEWER_TOKEN?: string;
};

export const settings = () => env as unknown as Settings;
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

export async function external(url: string, init: RequestInit) {
  const r = await fetch(url, {
    ...init,
    redirect: 'error',
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok)
    throw new HttpError(
      503,
      'The connected service is unavailable. Please use the text form or try again later.',
    );
  return r;
}
