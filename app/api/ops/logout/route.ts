import { NextResponse } from 'next/server';
import { OPS_COOKIE } from '@/lib/ops/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST, not DELETE: an HTML form can only ever send GET or POST. */
export async function POST(req: Request) {
  const res = NextResponse.redirect(new URL('/ops', req.url), 303);
  res.cookies.delete(OPS_COOKIE);
  return res;
}
