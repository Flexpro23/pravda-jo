import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/data/company';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{
      userAgent: '*',
      allow: '/',
      // Everything written for one recipient, plus the two consoles. None of it
      // may surface in search. Each of these also carries a `noindex` meta tag —
      // this list is the second lock, not the only one. `/r/` and `/p/` are
      // gone with the long-form report; `/specimen` is deliberately absent,
      // because it is the one artefact meant to be found. `/api` joins them
      // because a crawler following a form action can spend a Meta call, and
      // a route handler has no `noindex` meta tag to be the second lock.
      disallow: ['/s/', '/ops', '/t', '/doc/', '/api'],
    }],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
