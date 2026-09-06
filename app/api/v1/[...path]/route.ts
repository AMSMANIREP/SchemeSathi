import { handle } from '@/lib/server';
type Context = { params: Promise<{ path: string[] }> };
async function route(req: Request, context: Context) {
  return handle(req, (await context.params).path);
}
export const GET = route;
export const POST = route;
export const PUT = route;
export const PATCH = route;
export const DELETE = route;
