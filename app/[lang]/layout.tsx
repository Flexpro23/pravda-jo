import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import './globals.css';
import type { Lang } from '@/lib/i18n';

const LANGS = ['ar', 'en'] as const;
export function generateStaticParams() { return LANGS.map((lang) => ({ lang })); }

export async function generateMetadata(
  { params }: { params: Promise<{ lang: string }> },
): Promise<Metadata> {
  const { lang } = await params;
  const ar = lang === 'ar';
  return {
    metadataBase: new URL('https://pravda.jo'),
    title: {
      default: ar ? 'برافدا — عمّان' : 'PRAVDA — Amman',
      template: ar ? '%s · برافدا' : '%s · PRAVDA',
    },
    description: ar
      ? 'برافدا — إنتاج بصري وإدارة إعلانات في عمّان. منقرأ حسابك قبل ما نحكيك.'
      : 'PRAVDA — production and advertising in Amman. We read your account before we call you.',
    alternates: {
      canonical: `/${lang}`,
      languages: { ar: '/ar', en: '/en', 'x-default': '/ar' },
    },
    openGraph: {
      type: 'website', siteName: 'PRAVDA',
      locale: ar ? 'ar_JO' : 'en_JO',
      alternateLocale: ar ? 'en_JO' : 'ar_JO',
    },
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = {
  themeColor: '#1A1A1A',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function RootLayout(
  { children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> },
) {
  const { lang } = await params;
  if (!LANGS.includes(lang as Lang)) notFound();
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  return (
    <html lang={lang} dir={dir}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Italiana&family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=Amiri:wght@400;700&family=Inter:wght@300;400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
