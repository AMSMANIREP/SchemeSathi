import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const url = new URL(request.url);
  if (!url.hostname.endsWith('.workers.dev')) return NextResponse.next();

  if (url.protocol === 'http:') {
    url.protocol = 'https:';
    return NextResponse.redirect(url, 308);
  }

  const response = NextResponse.next();
  response.headers.set('Strict-Transport-Security', 'max-age=31536000');
  return response;
}
