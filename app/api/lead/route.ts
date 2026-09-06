import { NextResponse, after } from 'next/server';
import { normaliseHandle } from '@/lib/meta/discovery';
import { openClient, claimForRead, markNotifyAttempt } from '@/lib/store/clients';
import { getSheet } from '@/lib/store/sheets';
import { hit, ipKey, clientIp } from '@/lib/store/ratelimit';
import { readAndFile } from '@/lib/teardown/pipeline';
import { tellOperator } from '@/lib/notify/operator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Somebody handed over their handle.
 *
 * The only endpoint on this site a stranger is meant to reach, and the whole
 * front of the funnel. What it replaced was a form that ran a 900ms timer and
 * then told the visitor we would message them on WhatsApp — no request, no
 * record, no phone number, nobody told. Every prospect who did the one thing
 * the page asked was dropped.
 *
 * Four rules shape everything below.
 *
 * The lead is written before anything is read, and the response does not wait
 * for the read. A hundred-post Meta call plus a website fetch is anywhere from
 * three to fifteen seconds, which is far too long to hold a form on a phone —
 * and if Meta is throttled or their account turns out to be personal, the
 * person who just typed their number is still a lead. Losing one to an upstream
 * outage would be the same bug as before, with more code.
 *
 * Khaled is told *before* the response, not after it. That notice is the most
 * time-critical thing this system does — there is a person holding a phone
 * expecting a reply — and it used to sit inside `after()`, which on Cloud Run
 * is a best-effort callback whose CPU is throttled the instant the response
 * flushes. Every sender it reaches is bounded at four seconds, so a hung
 * upstream cannot hold the form open.
 *
 * The read is claimed, never just started. `claimForRead` is a transaction, so
 * the fast path here and the cron sweeper can both want the same account
 * without either double-spending a Meta call — and if this instance is reclaimed
 * mid-read, the lease expires and the sweeper finishes the job.
 *
 * And a stranger can only ask so often. A honeypot, a minimum time-on-form and
 * two Firestore-backed IP windows sit in front of a ~200-call/hour Meta budget,
 * with the real backstop — the global read ceiling — inside `claimForRead`,
 * where it sits on the spend rather than on the request.
 */

const clean = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);

/** A Jordanian mobile as anyone actually writes it, or nothing. */
const usablePhone = (raw: string) => {
  const digits = raw.replace(/[^\d+]/g, '');
  return /^(\+?962|0)?7\d{8}$/.test(digits) || /^\+?\d{9,15}$/.test(digits)
    ? raw : null;
};

/**
 * What a bot gets: a plain success, with nothing written.
 *
 * Silence teaches a script nothing. An error teaches it which field to leave
 * empty next time, so the honeypot and the too-fast submission both answer
 * exactly what a real submission answers.
 */
const SILENT_OK = { ok: true, handle: '', returning: false };

/** Shortest a human plausibly takes to fill three fields, in milliseconds. */
const MIN_FORM_MS = 1200;

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);

  // A field no human can see, filled in by anything that parses the form and
  // fills every input it finds. `Intake.tsx` renders it hidden, unlabelled and
  // out of the tab order.
  if (clean(body?.company, 200)) return NextResponse.json(SILENT_OK);

  // Time since the form mounted. Absent means an older client or a request that
  // did not come from our form at all — not itself proof of a bot, so it is
  // only ever a rejection when the number is present and impossibly small.
  const elapsedMs = Number(body?.elapsedMs);
  if (Number.isFinite(elapsedMs) && elapsedMs < MIN_FORM_MS) {
    return NextResponse.json(SILENT_OK);
  }

  const handle = normaliseHandle(clean(body?.handle, 40));
  if (!handle) return NextResponse.json({ error: 'handle' }, { status: 400 });

  const contactName = clean(body?.contactName, 120);
  const contactPhone = clean(body?.contactPhone, 40);
  if (!contactName) return NextResponse.json({ error: 'name' }, { status: 400 });
  if (!usablePhone(contactPhone)) {
    return NextResponse.json({ error: 'phone' }, { status: 400 });
  }

  // Counted after the field checks and before anything is written, so a visitor
  // fixing a typo in their own phone number does not spend their hour's budget
  // on a request that never reached the store. A malformed flood costs a 400
  // and nothing else.
  const key = ipKey(clientIp(req));
  const perHour = await hit(key, 5, 60 * 60_000);
  const perDay = perHour.ok ? await hit(`${key}:d`, 20, 24 * 60 * 60_000) : null;
  const limited = !perHour.ok ? perHour : (perDay && !perDay.ok ? perDay : null);
  if (limited) {
    return NextResponse.json({ error: 'too-many' }, {
      status: 429,
      headers: { 'retry-after': String(Math.max(1, limited.retryAfterSec)) },
    });
  }

  const lang = body?.lang === 'en' ? 'en' as const : 'ar' as const;
  const website = clean(body?.website, 300) || undefined;

  const opened = await openClient({
    handle, contactName, contactPhone, website, lang, source: 'intake',
  }).catch(() => null);
  // The store is the one dependency this endpoint cannot work around. Saying so
  // is better than a success message covering a lead that was never written.
  if (!opened) return NextResponse.json({ error: 'store' }, { status: 503 });

  const { client, created } = opened;

  // Before the response, deliberately. See the header. The attempt is stamped
  // whether or not the cascade lands, so the cron sweeper behind this knows a
  // try has just been made and waits an hour before making another — without
  // it, a lead whose channels are all down is re-announced every minute.
  if (created || !client.notifiedNewAt) {
    await markNotifyAttempt(client.id).catch(() => {});
    await tellOperator('new', client).catch(() => {});
  }

  // Somebody who came back to the site while their finished document sits at a
  // URL they cannot reach is the worst version of "we already have you on
  // file". If it is approved, hand it over.
  let sheetUrl: string | undefined;
  const newest = client.sheetTokens[0];
  if (!created && newest) {
    const sheet = await getSheet(newest).catch(() => null);
    if (sheet?.status === 'approved' && sheet.shareToken) {
      sheetUrl = `/s/${sheet.shareToken}`;
    }
  }

  after(async () => {
    // The fast path. It claims first, so an account that is already read, or
    // already being read by the sweeper, is left alone — and if this instance
    // is reclaimed before the read finishes, the lease expires and the sweeper
    // picks it up within the minute.
    const claimed = await claimForRead(client.id).catch(() => null);
    if (claimed) await readAndFile(claimed);
  });

  // What the person sees. Deliberately says only what is true at this instant:
  // we have it, and somebody will message them. It does not promise a report,
  // because the read has not run and may not succeed.
  return NextResponse.json({ ok: true, handle, returning: !created, sheetUrl });
}
