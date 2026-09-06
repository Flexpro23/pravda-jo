import { NextResponse } from 'next/server';
import { recordOpen } from '@/lib/store/sheets';
import { hit, ipKey, clientIp } from '@/lib/store/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * A sheet was opened by a person.
 *
 * Public and unauthenticated, because the only credential the client's page
 * holds is the share token itself — which is the same trust the page it is
 * stamping runs on. What that buys somebody who guesses one is a timestamp and
 * an increment on a record they could already read, so the blast radius is a
 * follow-up call made a day early, not a disclosure.
 *
 * Rate limited per address all the same, so nobody can sit on the endpoint and
 * turn an operator's one honest signal into noise. Thirty an hour is far above
 * a real reader re-opening a link and far below anything worth writing a script
 * for.
 *
 * Answers 204 whatever happens. This is a beacon: the page has already
 * rendered, the reader is already reading, and there is no failure here that is
 * theirs to see or ours to explain to them.
 */
export async function POST(req: Request) {
  const no = () => new NextResponse(null, { status: 204 });
  try {
    const gate = await hit(`${ipKey(clientIp(req))}:o`, 30, 3600_000);
    if (!gate.ok) return no();

    const body = await req.json().catch(() => null) as { t?: unknown } | null;
    const t = typeof body?.t === 'string' ? body.t : '';
    // The same shape `getShared` will accept. Checked here so a malformed
    // token never reaches a query at all.
    if (!/^[A-Za-z0-9_-]{10,64}$/.test(t)) return no();

    await recordOpen(t);
  } catch (e) {
    console.error(JSON.stringify({
      at: 's.opened', err: e instanceof Error ? e.message : String(e),
    }));
  }
  return no();
}
