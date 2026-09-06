import { NextResponse } from 'next/server';
import { absolute } from '@/lib/origin';
import { T_COOKIE } from '@/lib/talent/auth';
import { sameOrigin } from '@/lib/ops/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!sameOrigin(req)) {
    return NextResponse.json({ error: 'origin' }, { status: 403 });
  }

  const res = NextResponse.redirect(absolute(req, '/t'), 303);
  res.cookies.delete(T_COOKIE);
  return res;
}
