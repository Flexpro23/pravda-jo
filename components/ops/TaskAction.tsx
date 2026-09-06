'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Task } from '@/lib/ops/today';
import { explain, OFFLINE } from '@/lib/ops/errors';
import SendByHand from '@/components/ops/SendByHand';

/**
 * The one thing that makes a task go away.
 *
 * Lives on its own so the Today card and the client page's "next action" line
 * cannot drift apart: they are the same rules from `lib/ops/today.ts` and they
 * must offer the same button, or the console teaches two different habits for
 * the same job.
 */
export default function TaskAction({ task, showLink = true }: { task: Task; showLink?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  const post = async (url: string, body: Record<string, unknown>) => {
    setBusy(true); setErr(null);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(explain(j.error, j)); return; }
      router.refresh();
    } catch { setErr(OFFLINE); } finally { setBusy(false); }
  };

  const t = task;
  return (
    <>
      <div className="card-acts">
        {(t.kind === 'tell-new' || t.kind === 'tell-ready') && t.clientId && (
          <SendByHand
            label={t.kind === 'tell-new' ? 'Tell him' : 'Tell him it is ready'}
            url="/api/ops/client"
            composeBody={{
              action: 'compose', id: t.clientId,
              event: t.kind === 'tell-new' ? 'new' : 'ready',
            }}
            markBody={{
              action: 'mark-sent', id: t.clientId,
              event: t.kind === 'tell-new' ? 'new' : 'ready',
            }}
            noNumberHint="No operator number set. Add OPERATOR_PHONE."
            hint="Nothing sent itself, so this goes by hand."
            onSent={() => router.refresh()}
          />
        )}

        {(t.kind === 'read-failed' || t.kind === 'read-stuck') && t.clientId && (
          <button type="button" className="go" disabled={busy}
                  onClick={() => post('/api/ops/client', { action: 'rerun', id: t.clientId })}>
            {busy ? 'Queued…' : 'Re-run the read'}
          </button>
        )}

        {t.kind === 'tell-booking' && t.bookingId && t.dealId && (
          <SendByHand
            label="Tell them"
            url="/api/ops/notify"
            composeBody={{ dealId: t.dealId, id: t.bookingId }}
            markBody={{ dealId: t.dealId, id: t.bookingId, action: 'mark-sent' }}
            noNumberHint="That person has no usable number on file."
            onSent={() => router.refresh()}
          />
        )}

        {t.kind === 'mark-done' && t.bookingId && (
          <button type="button" className="go" disabled={busy}
                  onClick={() => post('/api/ops/booking', { action: 'mark', id: t.bookingId, status: 'done' })}>
            It happened
          </button>
        )}

        {t.kind === 'pay-crew' && t.bookingId && (
          <button type="button" className="go" disabled={busy}
                  onClick={() => post('/api/ops/booking', { action: 'mark', id: t.bookingId, status: 'paid' })}>
            Paid
          </button>
        )}

        {showLink && (t.kind === 'review-sheet' || t.kind === 'send-sheet') && (
          <Link className="btn go" href={t.href}>
            {t.kind === 'review-sheet' ? 'Review it' : 'Send it'}
          </Link>
        )}

        {showLink && (t.kind === 'chase-sheet' || t.kind === 'collect') && (
          <Link className="btn" href={t.href}>Open</Link>
        )}
      </div>
      {err && <p className="note" data-k="err" style={{ marginTop: 8 }}>{err}</p>}
    </>
  );
}
