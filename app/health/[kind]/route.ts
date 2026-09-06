import { handle } from '@/lib/server';
export async function GET(
  req: Request,
  context: { params: Promise<{ kind: string }> },
) {
  return handle(req, ['health', (await context.params).kind]);
}
