import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The same language toggle the sheet uses, for the documents.
 *
 * `?to=` sets the year-long `pravda_lang` shared with `/s`, so a reader who
 * chose English once is not asked again on the next thing we send them. `?next=`
 * is where to land, and it is validated to a `/doc/` path before it is used —
 * a redirect built from an unchecked query parameter is an open redirect, and
 * this one is reachable by anybody.
 *
 * The `?lang=` is carried through on the redirect as well as being stored,
 * because `app/doc/layout.tsx` resolves the document's direction from the query
 * string before paint.
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const to = q.get('to') === 'en' ? 'en' : 'ar';

  const raw = q.get('next') ?? '';
  const safe = /^\/doc\/[A-Za-z0-9._~\-/]*$/.test(raw) && !raw.startsWith('//')
    ? raw : '/doc';

  const dest = new URL(safe, req.url);
  dest.searchParams.set('lang', to);

  const res = NextResponse.redirect(dest, 303);
  res.cookies.set('pravda_lang', to, {
    path: '/', maxAge: 31_536_000, sameSite: 'lax', httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
  });
  return res;
}
