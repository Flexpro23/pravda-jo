import { NextResponse } from 'next/server';
import {
  OPS_COOKIE, OPS_RETRY_COOKIE, OPS_TTL_MS,
  keyMatches, mintSession, opsNext, refreshedCookie, sameOrigin, verifySession,
} from '@/lib/ops/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The cookie the browser sent, without pulling in a request context for it. */
function held(req: Request, name: string): string {
  for (const part of (req.headers.get('cookie') ?? '').split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0 && part.slice(0, eq).trim() === name) {
      const value = part.slice(eq + 1).trim();
      // A cookie we did not write can be any bytes at all; a bad escape is a
      // value that does not verify, not a 500.
      try { return decodeURIComponent(value); } catch { return value; }
    }
  }
  return '';
}

const session = (res: NextResponse, value: string) => {
  res.cookies.set(OPS_COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    // Links tapped from WhatsApp are cross-site top-level navigations and
    // `strict` withholds the cookie on every one of them; `lax` still sends it
    // there while continuing to block a cross-site POST.
    sameSite: 'lax',
    path: '/',
    maxAge: Math.floor(OPS_TTL_MS / 1000),
  });
  return res;
};

/** Deleted by path, since that is how the browser matched it in the first place. */
const clearRetry = (res: NextResponse) =>
  res.cookies.set(OPS_RETRY_COOKIE, '', { path: '/ops', maxAge: 0 });

/**
 * Exchange the operator key for a session — and land on the page that was
 * actually being asked for.
 *
 * The gate used to drop the destination: signing in from a notification link to
 * one client dumped him on the queue, and the link had to be found again in the
 * thread. `next` is carried through the form and validated as a console path.
 */
export async function POST(req: Request) {
  if (!sameOrigin(req)) {
    return NextResponse.json({ error: 'origin' }, { status: 403 });
  }

  const form = await req.formData().catch(() => null);
  const next = opsNext(String(form?.get('next') ?? ''));

  // A form submitted from a tab that had already gone stale — he signed in
  // somewhere else meanwhile — should land him where he asked, not refuse him
  // over a key he no longer needed to type. The cookie he holds decides, and
  // this is the one place a response is being written, so it is also the one
  // place the rolling window can actually be extended.
  const current = held(req, OPS_COOKIE);
  if (verifySession(current)) {
    const res = NextResponse.redirect(new URL(next, req.url), 303);
    const rolled = refreshedCookie(current);
    if (rolled) session(res, rolled);
    clearRetry(res);
    return res;
  }

  if (!keyMatches(String(form?.get('key') ?? ''))) {
    // Back to the page he was trying to open, still gated. What the gate needs
    // to know — refused, and where he was going — cannot travel in a query
    // string a layout will never read, so it travels in a ten-second cookie.
    const res = NextResponse.redirect(new URL(next, req.url), 303);
    res.cookies.set(OPS_RETRY_COOKIE, next, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/ops',
      maxAge: 10,
    });
    return res;
  }

  const res = session(NextResponse.redirect(new URL(next, req.url), 303), mintSession());
  clearRetry(res);
  return res;
}
