import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/data/company';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{
      userAgent: '*',
      allow: '/',
      // Everything written for one recipient, plus the two consoles. None of it
      // may surface in search. Each of these also carries a `noindex` meta tag —
      // this list is the second lock, not the only one.
      disallow: ['/r/', '/p/', '/s/', '/ops', '/t', '/doc/'],
    }],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
