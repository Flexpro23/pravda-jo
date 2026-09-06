import type { MetadataRoute } from 'next';
import { getWork } from '@/lib/store/content';
import { SITE } from '@/lib/data/company';

/* Moves with the domain — see SITE in lib/data/company.ts. */
const BASE = SITE;
/* `teardown/sample` is gone: it 308s to /specimen/[lang], which is listed
   below on its own because it lives outside the /[lang] tree. */
const PAGES = ['', 'work', 'cast', 'teardown', 'studio',
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
    // Invented pieces are never submitted to Google under our domain.
    for (const w of work.filter((x) => !x.placeholder)) {
      out.push({ url: `${BASE}/${lang}/work/${w.slug}`, changeFrequency: 'yearly', priority: 0.5 });
    }
    // The specimen is the proof the teardown page sends every cold visitor to,
    // so it ranks just under the teardown page itself.
    out.push({
      url: `${BASE}/specimen/${lang}`,
      changeFrequency: 'monthly',
      priority: 0.8,
      alternates: {
        languages: { ar: `${BASE}/specimen/ar`, en: `${BASE}/specimen/en` },
      },
    });
  }
  return out;
}
