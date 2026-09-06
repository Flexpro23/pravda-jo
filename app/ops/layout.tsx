import type { Metadata, Viewport } from 'next';
import { cookies, headers } from 'next/headers';
import { OPS_RETRY_COOKIE, opsAuthed, opsNext } from '@/lib/ops/auth';
import SignIn from '@/components/ops/SignIn';
import OpsShell from '@/components/ops/OpsShell';
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
 * Where the operator was trying to go.
 *
 * A layout is rendered without the search params of the request that reached
 * it, so the destination cannot be read off `?next=`. Two sources instead: the
 * ten-second cookie a refused attempt leaves behind, which is exact; and a
 * path header where the deployment sets one. Neither is guaranteed, and the
 * queue is a correct answer when both are absent — a lost deep link costs one
 * tap, and inventing a destination costs more than that.
 */
async function destination(): Promise<{ next: string; bad: boolean }> {
  const retry = (await cookies()).get(OPS_RETRY_COOKIE)?.value ?? '';
  if (retry) return { next: opsNext(retry), bad: true };

  const h = await headers();
  const path = h.get('x-pathname') ?? h.get('next-url') ?? '';
  return { next: opsNext(path), bad: false };
}

/**
 * The console is a tool, not a surface. It is deliberately plain: it carries
 * none of the site's typography or motion, because the thing being judged here
 * is the text, and a page that performs while you read it hides weak writing.
 * English-only and LTR — it is read by two people, both of whom work in it.
 *
 * The lock is here and nowhere else. Every page under it used to run its own
 * `opsAuthed()` check and render its own gate; seven copies of one decision is
 * seven chances for a new page to be added without one.
 */
export default async function OpsLayout({ children }: { children: React.ReactNode }) {
  const authed = await opsAuthed();
  const gate = authed ? null : await destination();

  return (
    <html lang="en" dir="ltr">
      <body>
        <OpsShell>{gate ? <SignIn next={gate.next} bad={gate.bad} /> : children}</OpsShell>
      </body>
    </html>
  );
}
