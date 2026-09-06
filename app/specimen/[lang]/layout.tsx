import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { SITE } from '@/lib/data/company';
import '../../s/s.css';

const LANGS = ['ar', 'en'] as const;
export function generateStaticParams() { return LANGS.map((lang) => ({ lang })); }

/**
 * The public specimen.
 *
 * It cannot live under `app/[lang]/` — `s.css` and `globals.css` give `.wrap`,
 * `.u`, `.num`, `.btn` and `.foot` different meanings, and a nested `<html>` is
 * impossible — so this is its own root layout, with the direction resolved from
 * the segment on the server. No script, no flash, no JavaScript on the page at
 * all.
 *
 * Indexable and permanent, unlike everything else this stylesheet serves. Once
 * it is in the sitemap and linked from the teardown page its URL is a public
 * address; it does not get renamed later.
 */
export async function generateMetadata(
  { params }: { params: Promise<{ lang: string }> },
): Promise<Metadata> {
  const { lang } = await params;
  const ar = lang === 'ar';
  return {
    metadataBase: new URL(SITE),
    title: ar ? 'نموذج تحقيق' : 'A specimen teardown',
    description: ar
      ? 'هاي بالضبط الصفحة اللي بتوصلكم: كل الأرقام، تلات أفكار، وسعر مكتوب. منشأة النموذج مش حقيقية.'
      : 'Exactly the page you receive: every figure, three ideas, one published price. The business in it is fictional.',
    alternates: {
      canonical: `/specimen/${lang}`,
      languages: {
        ar: '/specimen/ar', en: '/specimen/en', 'x-default': '/specimen/ar',
      },
    },
    openGraph: {
      type: 'article', siteName: 'PRAVDA',
      locale: ar ? 'ar_JO' : 'en_JO',
      alternateLocale: ar ? 'en_JO' : 'ar_JO',
      images: [{ url: '/og-sheet.png', width: 1200, height: 630, alt: 'PRAVDA' }],
    },
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = {
  themeColor: '#1A1A1A', width: 'device-width', initialScale: 1, viewportFit: 'cover',
};

export default async function SpecimenLayout(
  { children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> },
) {
  const { lang } = await params;
  if (!LANGS.includes(lang as (typeof LANGS)[number])) notFound();

  return (
    <html lang={lang} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Italiana&family=Lora:wght@400;500;600&family=Amiri:wght@400;700&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
