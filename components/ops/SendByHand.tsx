'use client';

import { useState } from 'react';
import { explain, OFFLINE } from '@/lib/ops/errors';

/**
 * The two-step that every outgoing message in this console goes through.
 *
 * Fetch the exact text, show it, offer a link that opens WhatsApp with it
 * ready — and then wait for a separate, deliberate press before recording that
 * it went. Opening WhatsApp is not sending. `DealDetail` used to mark a booking
 * told inside the same handler that opened the window, so a shoot day nobody
 * actually confirmed looked, forever after, like a day somebody had agreed to.
 *
 * Three callers, one component: the client notices, the sheet's share message,
 * and every talent offer and reminder. They differ only in which route they
 * ask and what they send it.
 */

export type Composed = {
  text: string;
  /** null when there is no usable number. The reason is the caller's to give. */
  link: string | null;
  /** Some routes send it themselves when a channel is configured. */
  sent?: boolean;
  name?: string;
};

export default function SendByHand({
  label, url, composeBody, markBody, noNumberHint, onSent, primary = true,
  hint,
}: {
  label: string;
  url: string;
  composeBody: Record<string, unknown>;
  markBody: Record<string, unknown>;
  /** What to say instead of the link when there is no number to open. */
  noNumberHint?: string;
  onSent?: () => void;
  primary?: boolean;
  /** A line above the message, for the case where nothing sent itself. */
  hint?: string;
}) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<Composed | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    setBusy(true); setErr(null); setOpen(true); setMsg(null);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(composeBody),
      });
      const j = await res.json();
      if (!res.ok) { setErr(explain(j.error, j)); return; }
      setMsg({ text: j.text, link: j.link ?? null, sent: j.sent, name: j.name });
      if (j.sent) onSent?.();
    } catch { setErr(OFFLINE); } finally { setBusy(false); }
  };

  const mark = async () => {
    setBusy(true); setErr(null);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(markBody),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(explain(j.error, j)); return; }
      setOpen(false); setMsg(null);
      onSent?.();
    } catch { setErr(OFFLINE); } finally { setBusy(false); }
  };

  return (
    <span className="sbh">
      <button type="button" className={primary ? 'go' : undefined}
              onClick={open ? () => { setOpen(false); setMsg(null); setErr(null); } : load}
              disabled={busy}>
        {open ? 'Close' : label}
      </button>

      {open && (
        <div className="sbh-body">
          {err && <p className="note" data-k="err">{err}</p>}
          {busy && !msg && !err && <p className="muted">Composing…</p>}

          {msg && (msg.sent ? (
            <p className="note" data-k="ok">Sent, and recorded.</p>
          ) : (
            <>
              {hint && <p className="muted" style={{ marginBottom: 8 }}>{hint}</p>}
              {/* Arabic, almost always — but the brief inside it may be
                  English, so the direction comes from the text. */}
              <pre className="sbh-pre" dir="auto">{msg.text}</pre>
              <div className="sbh-acts">
                {msg.link ? (
                  <a className="btn go" href={msg.link} target="_blank" rel="noreferrer noopener">
                    Open in WhatsApp
                  </a>
                ) : (
                  <span className="note" data-k="err">
                    {noNumberHint ?? 'No usable number on file.'}
                  </span>
                )}
                <button type="button" onClick={mark} disabled={busy}>I sent it</button>
              </div>
            </>
          ))}
        </div>
      )}
    </span>
  );
}
