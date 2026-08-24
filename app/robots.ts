import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{
      userAgent: '*',
      allow: '/',
      // A teardown is written for one recipient. It must never surface in search,
      // and neither must the preview that carries it.
      disallow: ['/r/', '/p/'],
    }],
    sitemap: 'https://pravda.jo/sitemap.xml',
    host: 'https://pravda.jo',
  };
}
