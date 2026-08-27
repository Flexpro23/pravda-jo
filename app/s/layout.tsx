import type { Metadata, Viewport } from 'next';
import './s.css';

export const metadata: Metadata = {
  title: 'PRAVDA',
  // Written for one business and sent to one person. Never indexed.
  robots: { index: false, follow: false, nocache: true },
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
export default function SheetLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html:
          "try{if(new URLSearchParams(location.search).get('lang')==='en'){"
          + "var e=document.documentElement;e.lang='en';e.dir='ltr';}}catch(_){}" }} />
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
