import type { Metadata, Viewport } from 'next';
import '../[lang]/globals.css';

export const metadata: Metadata = { title: 'PRAVDA', robots: { index: false, follow: false } };
export const viewport: Viewport = {
  themeColor: '#1A1A1A', width: 'device-width', initialScale: 1, viewportFit: 'cover',
};

/** See app/r/layout.tsx — the preview carries its language the same way. */
const LANG_BOOT =
  "try{if(new URLSearchParams(location.search).get('lang')==='en'){"
  + "var e=document.documentElement;e.lang='en';e.dir='ltr';}}catch(_){}";

export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: LANG_BOOT }} />
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
