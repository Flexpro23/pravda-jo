import { NextResponse } from 'next/server';
import { OPS_COOKIE, digest, keyMatches } from '@/lib/ops/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Exchange the operator key for a session. */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const supplied = String(form?.get('key') ?? '');

  if (!keyMatches(supplied)) {
    return NextResponse.redirect(new URL('/ops?bad=1', req.url), 303);
  }

  const res = NextResponse.redirect(new URL('/ops', req.url), 303);
  res.cookies.set(OPS_COOKIE, digest(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 12,   // a working day; a console left open overnight is a liability
  });
  return res;
}
