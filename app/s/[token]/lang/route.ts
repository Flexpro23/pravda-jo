import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The language toggle, as a redirect that leaves something behind.
 *
 * `?lang=en` on its own is correct and shareable, and it stays — but it does
 * not survive closing the WhatsApp in-app browser and tapping the original link
 * again, which is exactly what a reader does. So the toggle goes through here:
 * set a year-long `pravda_lang`, then land back on the bare sheet URL, which
 * now reads that cookie. No client JavaScript, and the shared link is unchanged
 * for whoever it is forwarded to.
 *
 * `lax` because this is a navigation the reader themselves performed, and
 * because a preference for reading Arabic is not a credential.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const to = new URL(req.url).searchParams.get('to') === 'en' ? 'en' : 'ar';

  // Built from the validated token rather than from a header, so nothing a
  // caller sends can turn this into an open redirect.
  const safe = /^[A-Za-z0-9_-]{10,64}$/.test(token) ? token : '';
  const res = NextResponse.redirect(new URL(`/s/${safe}`, req.url), 303);
  res.cookies.set('pravda_lang', to, {
    path: '/', maxAge: 31_536_000, sameSite: 'lax', httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
  });
  return res;
}
