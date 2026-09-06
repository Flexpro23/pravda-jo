import { NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'node:crypto';
import {
  claimForRead, expiredLeases, forceClientStatus, getClient, markNotifyAttempt,
  queuedForRead, staleUnqueued,
} from '@/lib/store/clients';
import { readAndFile } from '@/lib/teardown/pipeline';
import { tellOperator } from '@/lib/notify/operator';
import { outOfAttempts, MAX_READ_ATTEMPTS } from '@/lib/data/clients';
import type { Client } from '@/lib/data/clients';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The thing that makes the read a promise rather than a hope.
 *
 * `after()` on the lead route runs once the response has flushed — which is the
 * exact moment Cloud Run throttles the instance's CPU to near zero under
 * request-based billing, and may reclaim it outright. It is a best-effort
 * callback, not a contract. Without something sweeping behind it, a lead can
 * sit in `reading` forever with no sheet, no failure and no notice: the exact
 * bug the intake form was built to fix, one layer deeper.
 *
 * This route is that something, and the reason it is a cron-polled queue rather
 * than Cloud Tasks or a Firestore-triggered function is that the work happens
 * *during a request*, so CPU is allocated by definition — with no new npm
 * dependency, no second deployable, and no queue to provision out of band.
 * Cloud Tasks remains the named upgrade path the day retries with backoff
 * matter more than one moving part.
 *
 * Owner action this file cannot perform — the job that calls it:
 *   gcloud scheduler jobs create http pravda-read-queue \
 *     --schedule="* * * * *" --uri="$SITE/api/cron/read" \
 *     --http-method=GET --headers="x-pravda-cron=<CRON_SECRET>"
 */

/** Three per invocation. A leaked secret must not be able to drain Meta. */
const MAX_READS = 3;

/**
 * How long before the missed-notice retry is tried again.
 *
 * The sweep runs every minute and the notice below is sent when the account
 * has no `notifiedNewAt`. But `notifiedNewAt` is only written on success, so an
 * account nothing can reach — a WhatsApp window that has closed, a Telegram
 * token that has expired — never gets one, and the whole cascade was therefore
 * re-run against it sixty times an hour, for as long as the account existed.
 * `notifyNewAttemptedAt` records the try rather than the delivery, and this is
 * the gap between tries. An hour, because the thing that usually fixes a dead
 * channel is a person noticing, and a person does not notice inside a minute.
 */
const NOTICE_RETRY_MS = 60 * 60_000;

/**
 * Constant-time comparison over digests rather than raw values, so neither the
 * secret's content nor its length is learnable from timing. An unset secret
 * means closed, never open — the same rule `OPERATOR_KEY` follows.
 */
const authed = (req: Request) => {
  const want = process.env.CRON_SECRET?.trim() ?? '';
  if (!want) return false;
  const got = req.headers.get('x-pravda-cron')?.trim() ?? '';
  if (!got) return false;
  const h = (v: string) => createHash('sha256').update(v).digest();
  return timingSafeEqual(h(got), h(want));
};

export async function GET(req: Request) {
  if (!authed(req)) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  // Query A serves the longest wait first; the backstop catches `new` accounts
  // written before `queuedAt` existed (see `staleUnqueued`); query B is the
  // stale-lease sweep — a read whose instance died. One list, de-duplicated,
  // because an account can legitimately appear in more than one of them.
  const [queued, unqueued, stale] = await Promise.all([
    queuedForRead(MAX_READS).catch(() => [] as Client[]),
    staleUnqueued(MAX_READS).catch(() => [] as Client[]),
    expiredLeases(MAX_READS).catch(() => [] as Client[]),
  ]);

  const seen = new Set<string>();
  const candidates = [...queued, ...unqueued, ...stale]
    .filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));

  const results: { id: string; outcome: string; reason?: string }[] = [];
  let reads = 0;

  for (const candidate of candidates) {
    if (reads >= MAX_READS) break;

    // Re-read: the list is a snapshot and the fast path may have finished this
    // one in the meantime.
    const c = await getClient(candidate.id).catch(() => null);
    if (!c) continue;

    // The notice that should have gone out on the response path and did not —
    // the instance was reclaimed, or every channel was down. Sent only when the
    // account has never had one (a sweep must never re-announce a lead Khaled
    // already answered) and only when the last attempt is an hour old, so a
    // cascade that cannot reach anybody is retried hourly rather than every
    // time this route runs. The attempt is stamped before the send, not after:
    // an instance reclaimed mid-cascade must still count as a try, or the
    // failure that is slowest to fail is the one that gets retried hardest.
    const tried = c.notifyNewAttemptedAt ? +new Date(c.notifyNewAttemptedAt) : 0;
    if (!c.notifiedNewAt && Date.now() - tried >= NOTICE_RETRY_MS) {
      await markNotifyAttempt(c.id);
      await tellOperator('new', c).catch(() => {});
    }

    // Out of attempts. Retired rather than retried, with the reason from the
    // last read still attached, and Khaled told — a lead whose read gave up
    // looks identical to a lead nobody has got to yet, and the most common
    // cause is a personal account, which one message fixes.
    if (outOfAttempts(c)) {
      await forceClientStatus(c.id, 'failed', c.readError ?? 'network');
      const failed = await getClient(c.id).catch(() => null);
      if (failed) await tellOperator('failed', failed).catch(() => {});
      console.log(JSON.stringify({
        msg: 'read.retired', handle: c.handle, clientId: c.id,
        attempts: c.readAttempts ?? 0, of: MAX_READ_ATTEMPTS,
        reason: c.readError ?? 'network',
      }));
      results.push({ id: c.id, outcome: 'retired', reason: c.readError ?? 'network' });
      continue;
    }

    // Somebody else has it, or the global Meta ceiling is spent — either way
    // the account keeps its place in the queue and this invocation moves on.
    const claimed = await claimForRead(c.id).catch(() => null);
    if (!claimed) {
      results.push({ id: c.id, outcome: 'skipped' });
      continue;
    }

    const filed = await readAndFile(claimed);
    reads++;
    results.push({
      id: c.id,
      outcome: filed.ok ? 'ready' : 'failed',
      reason: filed.ok ? undefined : filed.reason,
    });
  }

  const summary = {
    ok: true,
    scanned: candidates.length,
    reads,
    ready: results.filter((r) => r.outcome === 'ready').length,
    failed: results.filter((r) => r.outcome === 'failed').length,
    retired: results.filter((r) => r.outcome === 'retired').length,
    skipped: results.filter((r) => r.outcome === 'skipped').length,
    results,
  };
  console.log(JSON.stringify({ msg: 'cron.read', ...summary, results: undefined }));
  return NextResponse.json(summary);
}
