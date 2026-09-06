import { NextResponse } from 'next/server';
import { opsAuthed, sameOrigin } from '@/lib/ops/auth';
import { discover } from '@/lib/meta/discovery';
import { configReport, configSummary } from '@/lib/config/check';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Is the Meta token still alive?
 *
 * A long-lived Page token expires, and `data_access_expires_at` passes sooner
 * than anyone remembers. Today the first sign of either is a prospect's read
 * failing — a real lead, spent on discovering our own expired credential. This
 * is one deliberate call so that fact is discoverable by pressing a button in
 * the console instead.
 *
 * One post, not a hundred: this is a liveness check, not a read, and it should
 * cost as close to nothing out of the ~200-call hourly budget as a call can.
 * The handle it asks about is ours by default — never a prospect's — so the
 * check cannot spend a read somebody is waiting for.
 *
 * `x-app-usage` comes back on the same response and is the only place Meta
 * publishes how much of the hour is gone; it is reported when discovery hands
 * it over and simply absent when it does not.
 */
export async function POST(req: Request) {
  // Every other console POST checks this and this one did not, which made it
  // the way in: a page anywhere could post here with the operator's cookie
  // riding along and spend a Meta call. One call is not much; being the only
  // unguarded operator endpoint is.
  if (!sameOrigin(req)) return NextResponse.json({ error: 'origin' }, { status: 403 });
  if (!(await opsAuthed())) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const handle = process.env.META_SELFCHECK_HANDLE?.trim() || 'instagram';
  const read = await discover(handle, 1).catch(() => null);

  // Read loosely on purpose: the usage field is being added to DiscoveryResult
  // in the same wave as this route, so this reports it when it is there and
  // stays correct while it is not.
  const usage = (read as unknown as { usage?: number } | null)?.usage ?? null;
  const rows = configReport();

  if (!read) {
    return NextResponse.json({
      ok: false, handle, reason: 'network', usage,
      config: configSummary(rows), rows,
    });
  }

  return NextResponse.json({
    ok: read.ok,
    handle,
    reason: read.ok ? undefined : read.reason,
    usage,
    config: configSummary(rows),
    rows,
  });
}
