import { NextResponse } from 'next/server';
import { T_COOKIE } from '@/lib/talent/auth';
import { sameOrigin } from '@/lib/ops/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!sameOrigin(req)) {
    return NextResponse.json({ error: 'origin' }, { status: 403 });
  }

  const res = NextResponse.redirect(new URL('/t', req.url), 303);
  res.cookies.delete(T_COOKIE);
  return res;
}
