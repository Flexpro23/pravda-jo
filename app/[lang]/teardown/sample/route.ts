import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * The specimen moved to `/specimen/[lang]`.
 *
 * This address was in the sitemap and is `heroCta2` on the marketing site, so
 * it is redirected rather than removed — a real 308 from a route handler,
 * because a page under `app/[lang]` is prerendered and its `permanentRedirect`
 * only reaches a client that runs the router. A crawler asking for the old URL
 * must get the new one in a Location header, not in a script.
 */
export function GET(req: Request, ctx: { params: Promise<{ lang: string }> }) {
  return ctx.params.then(({ lang }) =>
    NextResponse.redirect(new URL(`/specimen/${lang === 'en' ? 'en' : 'ar'}`, req.url), 308));
}
