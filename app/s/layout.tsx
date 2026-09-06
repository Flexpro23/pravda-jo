import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { SITE } from '@/lib/data/company';
import './s.css';

/**
 * Deliberately generic, and it must stay that way.
 *
 * This card is what a group chat renders the instant the link is pasted, and
 * the person pasting it is not always the person it was written for. A client's
 * name, their engagement rate or their price in an `og:` tag would be handed to
 * WhatsApp's crawler and then to every member of whatever thread it is
 * forwarded into. So the preview says what the page is and nothing about whose
 * it is — and `noindex` stays, because a titled card is not an invitation to be
 * crawled.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: 'برافدا — تحقيق حسابكم',
  description: 'صفحة وحدة: كل الأرقام، تلات أفكار لحسابكم، وسعر مكتوب. '
    + 'PRAVDA — your account, read: every figure, three ideas, one published price.',
  robots: { index: false, follow: false, nocache: true },
  openGraph: {
    type: 'website',
    siteName: 'PRAVDA',
    title: 'برافدا — تحقيق حسابكم',
    description: 'صفحة وحدة: كل الأرقام، تلات أفكار لحسابكم، وسعر مكتوب.',
    // PNG, not the SVG it was drawn from: WhatsApp, Facebook and
    // Telegram all refuse to rasterise an SVG preview. Both files are
    // checked in — public/og-sheet.svg is the editable source.
    images: [{ url: '/og-sheet.png', width: 1200, height: 630, alt: 'PRAVDA' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'برافدا — تحقيق حسابكم',
    description: 'PRAVDA — your account, read.',
    images: ['/og-sheet.png'],
  },
};
export const viewport: Viewport = {
  themeColor: '#1A1A1A', width: 'device-width', initialScale: 1, viewportFit: 'cover',
};

/**
 * The sheet a client reads.
 *
 * It arrives as a WhatsApp link, which means it is opened on a phone, standing
 * up, by someone who did not ask for it. Everything about the layout below
 * assumes that first and treats the desktop reading as the second case.
 */
export default async function SheetLayout({ children }: { children: React.ReactNode }) {
  // The saved preference, resolved server-side so the document opens in the
  // right direction rather than flipping after paint. `?lang` still wins, and
  // the script below is what applies it — a layout cannot read a query string.
  const saved = (await cookies()).get('pravda_lang')?.value;
  const en = saved === 'en';

  return (
    <html lang={en ? 'en' : 'ar'} dir={en ? 'ltr' : 'rtl'} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html:
          "try{var q=new URLSearchParams(location.search).get('lang');"
          + "if(q==='en'||q==='ar'){var e=document.documentElement;"
          + "e.lang=q;e.dir=q==='en'?'ltr':'rtl';}}catch(_){}" }} />
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
