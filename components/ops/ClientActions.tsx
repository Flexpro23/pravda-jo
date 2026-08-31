'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ClientStatus } from '@/lib/data/clients';

/**
 * The two notices, and what to do when neither sent itself.
 *
 * With no WhatsApp number configured — which is the state today — nothing is
 * sent automatically, so this shows the exact message, a link that opens
 * WhatsApp with it ready, and a button that records it as sent. Two people
 * running a studio this way is a working system. What is not workable is a
 * dashboard that shows a lead as handled because a message it never sent was
 * assumed to have gone.
 *
 * The "sent" mark is a separate, deliberate press rather than something the
 * link does on click, because opening WhatsApp is not the same as sending.
 */

type Which = 'new' | 'ready' | 'failed';

const TITLE: Record<Which, string> = {
  new: 'Tell Khaled there is a new lead',
  ready: 'Tell Khaled the report is ready',
  failed: 'Tell Khaled the read failed',
};

export default function ClientActions({
  id, notifiedNew, notifiedReady, status,
}: {
  id: string; notifiedNew: boolean; notifiedReady: boolean; status: ClientStatus;
}) {
  const [open, setOpen] = useState<Which | null>(null);
  const [notice, setNotice] = useState<{ text: string; link: string | null; sent: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  // The second notice is about the outcome of the read, so which one is owed
  // depends on how the read went — a failed account needs the message that
  // names the cause, not one announcing a report that does not exist.
  const second: Which = status === 'failed' ? 'failed' : 'ready';
  const secondReady = status === 'ready' || status === 'failed' || status === 'sent';

  const load = async (which: Which) => {
    setBusy(true); setErr(null); setOpen(which); setNotice(null);
    try {
      const res = await fetch('/api/ops/client', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'compose', id, event: which }),
      });
      const j = await res.json();
      if (!res.ok) { setErr(j.error ?? 'Could not compose it.'); return; }
      setNotice({ text: j.text, link: j.link, sent: j.sent });
      if (j.sent) router.refresh();
    } catch {
      setErr('The request did not complete.');
    } finally { setBusy(false); }
  };

  const markSent = async () => {
    if (!open) return;
    setBusy(true);
    try {
      await fetch('/api/ops/client', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'mark-sent', id, event: open }),
      });
      setOpen(null); setNotice(null);
      router.refresh();
    } finally { setBusy(false); }
  };

  return (
    <div className="panel">
      <p className="lab">Notices</p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
        <button
          className={notifiedNew ? undefined : 'go'}
          onClick={() => load('new')} disabled={busy}
        >
          {notifiedNew ? 'Re-send: new lead' : TITLE.new}
        </button>
        <button
          className={notifiedReady || !secondReady ? undefined : 'go'}
          onClick={() => load(second)} disabled={busy || !secondReady}
          title={secondReady ? undefined : 'Nothing to announce until the read finishes'}
        >
          {notifiedReady ? `Re-send: ${second}` : TITLE[second]}
        </button>
      </div>

      {err && <p className="note" data-k="err">{err}</p>}

      {notice && (
        <div style={{ marginTop: 16 }}>
          {notice.sent ? (
            <p className="note" data-k="ok">Sent, and recorded.</p>
          ) : (
            <>
              <p className="muted" style={{ marginBottom: 8 }}>
                No WhatsApp number is configured, so this has to go by hand.
              </p>
              <pre style={{
                whiteSpace: 'pre-wrap', background: '#191919', border: '1px solid var(--line)',
                borderRadius: 6, padding: 14, margin: '0 0 12px', direction: 'rtl',
                textAlign: 'start', font: '400 14px/1.7 var(--sans)',
              }}>{notice.text}</pre>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {notice.link
                  ? <a className="btn go" href={notice.link} target="_blank" rel="noreferrer noopener">
                      Open in WhatsApp
                    </a>
                  : <span className="note" data-k="err">
                      No operator number set. Add OPERATOR_PHONE.
                    </span>}
                <button onClick={markSent} disabled={busy}>I sent it</button>
                <button onClick={() => { setOpen(null); setNotice(null); }} disabled={busy}>
                  Close
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
