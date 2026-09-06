import { NextResponse } from 'next/server';
import { OPS_COOKIE, sameOrigin } from '@/lib/ops/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST, not DELETE: an HTML form can only ever send GET or POST. */
export async function POST(req: Request) {
  // Signing someone out is a small harm, but it is still a state change made on
  // their behalf, and every mutating ops route answers the same question the
  // same way rather than each one deciding for itself.
  if (!sameOrigin(req)) {
    return NextResponse.json({ error: 'origin' }, { status: 403 });
  }

  const res = NextResponse.redirect(new URL('/ops', req.url), 303);
  res.cookies.delete(OPS_COOKIE);
  return res;
}
