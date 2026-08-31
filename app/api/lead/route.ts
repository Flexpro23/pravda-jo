import { NextResponse, after } from 'next/server';
import { normaliseHandle } from '@/lib/meta/discovery';
import {
  openClient, getClient, setClientStatus, attachToClient, setBusinessName,
} from '@/lib/store/clients';
import { runRead } from '@/lib/teardown/run';
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
 * Three rules shape everything below.
 *
 * The lead is written before anything is read, and the response does not wait
 * for the read. A hundred-post Meta call plus a website fetch is anywhere from
 * three to fifteen seconds, which is far too long to hold a form on a phone —
 * and if Meta is throttled or their account turns out to be personal, the
 * person who just typed their number is still a lead. Losing one to an upstream
 * outage would be the same bug as before, with more code.
 *
 * The read runs once per business. A second submission from the same shop
 * reuses the account and does not spend another Meta call, which is both the
 * correct behaviour and the thing standing between a public endpoint and our
 * ~200 reads an hour. Real rate limiting belongs here too and is the next pass.
 *
 * And Khaled is told twice, because the two events are different jobs: somebody
 * is waiting for a reply, and later, there is something to review.
 */

const clean = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);

/** A Jordanian mobile as anyone actually writes it, or nothing. */
const usablePhone = (raw: string) => {
  const digits = raw.replace(/[^\d+]/g, '');
  return /^(\+?962|0)?7\d{8}$/.test(digits) || /^\+?\d{9,15}$/.test(digits)
    ? raw : null;
};

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);

  const handle = normaliseHandle(clean(body?.handle, 40));
  if (!handle) return NextResponse.json({ error: 'handle' }, { status: 400 });

  const contactName = clean(body?.contactName, 120);
  const contactPhone = clean(body?.contactPhone, 40);
  if (!contactName) return NextResponse.json({ error: 'name' }, { status: 400 });
  if (!usablePhone(contactPhone)) {
    return NextResponse.json({ error: 'phone' }, { status: 400 });
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
  // Already read, and the sheet is still theirs. Nothing to spend a Meta call on.
  const alreadyRead = client.sheetTokens.length > 0;

  after(async () => {
    // Everything past this point happens after the response has been sent. It
    // must never throw into the runtime, so each step carries its own failure.
    try {
      if (created || !client.notifiedNewAt) {
        await tellOperator('new', client);
      }
      if (alreadyRead) return;

      await setClientStatus(client.id, 'reading');
      const run = await runRead({ handle, website });

      if (!run.ok) {
        await setClientStatus(client.id, 'failed', run.reason);
        const failed = await getClient(client.id);
        if (failed) await tellOperator('failed', failed);
        return;
      }

      await attachToClient(client.id, 'sheet', run.sheet.token);
      if (run.sheet.clientName) await setBusinessName(client.id, run.sheet.clientName);
      await setClientStatus(client.id, 'ready');

      // Re-read so the message carries the business name the run just learned
      // and the ready status, rather than the stale copy from before it.
      const ready = await getClient(client.id);
      if (ready) {
        await tellOperator('ready', ready, {
          sheetToken: run.sheet.token,
          findings: run.sheet.findings.findings.length,
        });
      }
    } catch {
      // A background failure must leave a mark rather than vanish. The console
      // reads `failed` as a queue to work, so the lead surfaces either way.
      await setClientStatus(client.id, 'failed', 'network').catch(() => {});
    }
  });

  // What the person sees. Deliberately says only what is true at this instant:
  // we have it, and somebody will message them. It does not promise a report,
  // because the read has not run and may not succeed.
  return NextResponse.json({ ok: true, handle, returning: !created });
}
