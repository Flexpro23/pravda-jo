import type { MetadataRoute } from 'next';
import { getWork } from '@/lib/store/content';
import { SITE } from '@/lib/data/company';

/* Moves with the domain — see SITE in lib/data/company.ts. */
const BASE = SITE;
const PAGES = ['', 'work', 'cast', 'teardown', 'teardown/sample', 'studio',
               'pricing', 'privacy', 'terms', 'notice', 'data',
               'instagram-professional'];

/** /r and /p are per-recipient and deliberately absent — see robots.ts. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const work = await getWork();
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
    for (const w of work) {
      out.push({ url: `${BASE}/${lang}/work/${w.slug}`, changeFrequency: 'yearly', priority: 0.5 });
    }
  }
  return out;
}
