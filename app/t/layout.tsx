import type { Metadata, Viewport } from 'next';
import './t.css';

export const metadata: Metadata = {
  title: 'PRAVDA',
  robots: { index: false, follow: false, nocache: true },
};
export const viewport: Viewport = {
  themeColor: '#1A1A1A', width: 'device-width', initialScale: 1,
  viewportFit: 'cover', maximumScale: 5,
};

/**
 * The provider's portal. Arabic and right-to-left by default, because the
 * people who work here work in Arabic — the operator console is the surface
 * that gets to be English, not this one.
 *
 * Phone-shaped throughout: it is opened standing on a set, one-handed, to
 * answer one question.
 */
export default function TalentLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
