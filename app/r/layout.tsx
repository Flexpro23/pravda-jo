import type { Metadata, Viewport } from 'next';
import '../[lang]/globals.css';

export const metadata: Metadata = { title: 'PRAVDA', robots: { index: false, follow: false } };
export const viewport: Viewport = {
  themeColor: '#040A09', width: 'device-width', initialScale: 1, viewportFit: 'cover',
};

export default function ReportLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:opsz,wght@6..96,400;6..96,500&family=Amiri:wght@400;700&family=Inter:wght@300;400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
