import { NextResponse } from 'next/server';
import { talentByCode } from '@/lib/store/deals';
import { T_COOKIE, sessionValue } from '@/lib/talent/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const code = String(form?.get('code') ?? '').trim();

  const t = code ? await talentByCode(code) : null;
  if (!t) return NextResponse.redirect(new URL('/t?bad=1', req.url), 303);

  const res = NextResponse.redirect(new URL('/t', req.url), 303);
  res.cookies.set(T_COOKIE, sessionValue(t.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    // Long: this is a phone kept in a pocket, not a desk someone walks away
    // from, and a provider re-entering a code before every shoot would stop
    // using it.
    maxAge: 60 * 60 * 24 * 60,
  });
  return res;
}
