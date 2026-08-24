import type { MetadataRoute } from 'next';
import { WORK } from '@/lib/data/work';

const BASE = 'https://pravda.jo';
const PAGES = ['', 'work', 'cast', 'teardown', 'teardown/sample', 'studio',
               'pricing', 'privacy', 'terms', 'notice', 'data',
               'instagram-professional'];

/** /r and /p are per-recipient and deliberately absent — see robots.ts. */
export default function sitemap(): MetadataRoute.Sitemap {
  const langs = ['ar', 'en'] as const;
  const out: MetadataRoute.Sitemap = [];

  for (const lang of langs) {
    for (const p of PAGES) {
      out.push({
        url: `${BASE}/${lang}${p ? `/${p}` : ''}`,
        changeFrequency: p === '' ? 'weekly' : 'monthly',
        priority: p === '' ? 1 : p === 'teardown' ? 0.9 : 0.6,
        alternates: {
          languages: {
            ar: `${BASE}/ar${p ? `/${p}` : ''}`,
            en: `${BASE}/en${p ? `/${p}` : ''}`,
          },
        },
      });
    }
    for (const w of WORK) {
      out.push({ url: `${BASE}/${lang}/work/${w.slug}`, changeFrequency: 'yearly', priority: 0.5 });
    }
  }
  return out;
}
