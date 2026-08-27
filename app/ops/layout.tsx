import type { Metadata, Viewport } from 'next';
import './ops.css';

export const metadata: Metadata = {
  title: 'PRAVDA — operator',
  // The console lists every prospect we have read. It must never be indexed.
  robots: { index: false, follow: false, nocache: true },
};
export const viewport: Viewport = {
  themeColor: '#1A1A1A', width: 'device-width', initialScale: 1,
};

/**
 * The console is a tool, not a surface. It is deliberately plain: it carries
 * none of the site's typography or motion, because the thing being judged here
 * is the text, and a page that performs while you read it hides weak writing.
 * English-only and LTR — it is read by two people, both of whom work in it.
 */
export default function OpsLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr">
      <body>{children}</body>
    </html>
  );
}
