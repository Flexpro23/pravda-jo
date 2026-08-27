import type { Metadata, Viewport } from 'next';
import './doc.css';

export const metadata: Metadata = {
  title: 'PRAVDA',
  robots: { index: false, follow: false, nocache: true },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

/**
 * Documents that leave the building: a proposal a client keeps, a statement a
 * provider is paid against.
 *
 * There is no PDF library here and that is deliberate. Arabic needs contextual
 * letter shaping and bidi resolution, and the PDF libraries in this ecosystem
 * do both poorly — a proposal with broken Arabic ligatures is worse than no
 * proposal. The browser already carries a world-class text engine and a Save as
 * PDF that embeds fonts, so the document is a print stylesheet and the browser
 * makes the file. It also keeps a headless Chrome out of the container.
 *
 * Ink on paper, so these are the only light surfaces in the system.
 */
export default function DocLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        {/* ?lang=en has to land before paint, or an English document lays out
            right to left — every rule below keys off the root direction. */}
        <script dangerouslySetInnerHTML={{ __html:
          "try{if(new URLSearchParams(location.search).get('lang')==='en'){"
          + "var e=document.documentElement;e.lang='en';e.dir='ltr';}}catch(_){}" }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Lora:wght@400;500;600&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
