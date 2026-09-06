'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Client } from '@/lib/data/clients';
import { CLIENT_LABEL } from '@/lib/data/clients';
import { VERTICAL_LABEL, type Vertical } from '@/lib/data/concepts';
import type { VerticalGuess } from '@/lib/teardown/vertical';
import { msisdn, waLink } from '@/lib/notify/whatsapp';
import { explain, OFFLINE } from '@/lib/ops/errors';
import { reauthAction, useToast } from '@/components/ops/Toast';
import SendByHand from '@/components/ops/SendByHand';

/**
 * Everything a person can do to an account that the engine cannot.
 *
 * It began as the two halves of a notice and stayed there for a while, which
 * meant a lead that mistyped its own phone number was unfixable, a client who
 * said no had nowhere to say why, and "called him, he wants to think about it"
 * — the single most valuable thing either operator knows about a lead — lived
 * in one head.
 *
 * The compose/mark-sent discipline is kept everywhere it applies and is the
 * reason `SendByHand` exists: opening WhatsApp is not sending, and a console
 * that records a message on the tap that opened an app is a console that shows
 * work as handled which nobody did.
 */

const VERTICALS = Object.keys(VERTICAL_LABEL) as Vertical[];

const LOST_REASONS = [
  'No reply',
  'Price',
  'Doing it in-house',
  'Not a fit',
  'Other',
] as const;

export default function ClientActions({
  client, guess,
}: { client: Client; guess?: VerticalGuess | null }) {
  const c = client;
  const { push } = useToast();
  const [busy, setBusy] = useState(false);
  const [panel, setPanel] = useState<'rerun' | 'contact' | 'lost' | 'note' | null>(null);
  const [rerun, setRerun] = useState({
    vertical: (c.vertical ?? '') as Vertical | '',
    website: c.website ?? '',
  });
  const [contact, setContact] = useState({
    contactName: c.contactName, contactPhone: c.contactPhone,
  });
  const [lost, setLost] = useState({ reason: LOST_REASONS[0] as string, text: '' });
  const [note, setNote] = useState({ by: 'khaled' as 'ali' | 'khaled', text: '' });
  const router = useRouter();

  const post = async (body: Record<string, unknown>, ok: string) => {
    setBusy(true);
    try {
      const res = await fetch('/api/ops/client', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: c.id, ...body }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        push({
          kind: 'err', text: explain(j.error, j),
          action: j.error === 'unauthenticated' ? reauthAction() : { label: 'Retry', onClick: () => post(body, ok) },
        });
        return null;
      }
      push({ kind: 'ok', text: j.note ?? ok });
      router.refresh();
      return j;
    } catch {
      push({ kind: 'err', text: OFFLINE, action: { label: 'Retry', onClick: () => post(body, ok) } });
      return null;
    } finally { setBusy(false); }
  };

  const copy = async (what: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      push({ kind: 'ok', text: `${what} copied.` });
    } catch {
      push({ kind: 'err', text: `Could not reach the clipboard. It is ${value}.` });
    }
  };

  // A number WhatsApp cannot dial is the commonest single defect on a lead, and
  // it is invisible until a message silently fails — so the button says so
  // instead of opening a contact picker.
  const dialable = msisdn(c.contactPhone);
  const opener = c.lang === 'en'
    ? `Hello${c.contactName ? ` ${c.contactName}` : ''} — this is PRAVDA.`
    : `مرحبا${c.contactName ? ` ${c.contactName}` : ''}، معكم برافدا.`;
  const chat = dialable ? waLink(c.contactPhone, opener) : null;

  const second: 'ready' | 'failed' = c.status === 'failed' ? 'failed' : 'ready';
  const secondReady = c.status === 'ready' || c.status === 'failed' || c.status === 'sent';
  const settled = c.status === 'won' || c.status === 'lost';

  return (
    <div className="acts">
      {/* ── reach them ───────────────────────────────────────────────────── */}
      <div className="panel">
        <p className="lab">Reach them</p>
        <div className="row">
          {c.contactPhone ? (
            <a className="btn" href={`tel:${c.contactPhone}`}>Call</a>
          ) : (
            <button type="button" disabled>Call — no number</button>
          )}
          {chat ? (
            <a className="btn go" href={chat} target="_blank" rel="noreferrer noopener">WhatsApp</a>
          ) : (
            <button type="button" disabled>
              WhatsApp — {c.contactPhone ? 'not dialable' : 'no number'}
            </button>
          )}
          <button type="button" disabled={!c.contactPhone}
                  onClick={() => copy('The number', c.contactPhone)}>
            Copy number
          </button>
          <button type="button" onClick={() => copy('The handle', `@${c.handle}`)}>
            Copy handle
          </button>
        </div>
        {!c.contactPhone && (
          <p className="hint todo" style={{ marginTop: 8 }}>
            No number on file. Fix the contact below.
          </p>
        )}
        {c.contactPhone && !dialable && (
          <p className="hint todo" style={{ marginTop: 8 }}>
            <span className="mono" dir="ltr">{c.contactPhone}</span> is not a number WhatsApp can
            reach. Nothing addressed to it will arrive.
          </p>
        )}
      </div>

      {/* ── the two notices ──────────────────────────────────────────────── */}
      <div className="panel">
        <p className="lab">Notices</p>
        <div className="row">
          <SendByHand
            label={c.notifiedNewAt ? 'Re-send: new lead' : 'Tell Khaled there is a new lead'}
            primary={!c.notifiedNewAt}
            url="/api/ops/client"
            composeBody={{ action: 'compose', id: c.id, event: 'new' }}
            markBody={{ action: 'mark-sent', id: c.id, event: 'new' }}
            noNumberHint="No operator number set. Add OPERATOR_PHONE."
            hint="Nothing sent itself, so this goes by hand."
            onSent={() => router.refresh()}
          />
          {secondReady ? (
            <SendByHand
              label={c.notifiedReadyAt
                ? `Re-send: ${second}`
                : second === 'failed' ? 'Tell Khaled the read failed' : 'Tell Khaled the sheet is ready'}
              primary={!c.notifiedReadyAt}
              url="/api/ops/client"
              composeBody={{ action: 'compose', id: c.id, event: second }}
              markBody={{ action: 'mark-sent', id: c.id, event: second }}
              noNumberHint="No operator number set. Add OPERATOR_PHONE."
              hint="Nothing sent itself, so this goes by hand."
              onSent={() => router.refresh()}
            />
          ) : (
            <button type="button" disabled>
              Tell Khaled the sheet is ready
            </button>
          )}
        </div>
        <p className="hint" style={{ marginTop: 8 }}>
          {!secondReady && 'Nothing to announce until the read finishes. '}
          {c.lastNotifyChannel
            ? `Last notice went by ${c.lastNotifyChannel}.`
            : 'No notice has carried yet.'}
        </p>
      </div>

      {/* ── the read ─────────────────────────────────────────────────────── */}
      <div className="panel">
        <p className="lab">The read</p>
        <p className="hint" style={{ marginTop: 8 }}>
          {c.readAttempts
            ? `${c.readAttempts} attempt${c.readAttempts === 1 ? '' : 's'} so far.`
            : 'Not yet attempted.'}
          {c.readError && <> Last failure: <span className="mono">{c.readError}</span>.</>}
        </p>
        <div className="row">
          <button type="button" onClick={() => setPanel(panel === 'rerun' ? null : 'rerun')}>
            {panel === 'rerun' ? 'Cancel' : 'Re-run the read'}
          </button>
        </div>
        {panel === 'rerun' && (
          <div className="sub">
            <p className="hint">
              The vertical is saved on the account and reused on every later read,
              so a correction made once does not have to be made again. Contact
              details are never touched by a re-run.
            </p>
            <div className="pair">
              <div>
                <label>What kind of business</label>
                <select className="sel" value={rerun.vertical}
                        onChange={(e) => setRerun({ ...rerun, vertical: e.target.value as Vertical | '' })}>
                  <option value="">let the engine guess</option>
                  {VERTICALS.map((v) => (
                    <option key={v} value={v}>{VERTICAL_LABEL[v].en}</option>
                  ))}
                </select>
              </div>
              <div>
                <label>Their website</label>
                <input value={rerun.website} dir="ltr" className="mono"
                       onChange={(e) => setRerun({ ...rerun, website: e.target.value })} />
              </div>
            </div>
            <button className="go" disabled={busy}
                    onClick={async () => {
                      const j = await post({
                        action: 'rerun',
                        vertical: rerun.vertical || undefined,
                        website: rerun.website || undefined,
                      }, 'Reading. Reload in a moment.');
                      if (j) setPanel(null);
                    }}>
              Read them again
            </button>
          </div>
        )}
      </div>

      {/* ── what they are ────────────────────────────────────────────────── */}
      <div className="panel">
        <p className="lab">What they are</p>
        <p className="hint" style={{ marginTop: 8 }}>
          {c.vertical
            ? <>Confirmed as <b>{VERTICAL_LABEL[c.vertical].en}</b>.</>
            : 'Nobody has said. The recommender is scoring without a trade bonus.'}
        </p>
        {guess?.guess && (
          <p className="hint" style={{ marginTop: 6 }}>
            The engine read it as <b>{VERTICAL_LABEL[guess.guess].en}</b> at{' '}
            {Math.round(guess.confidence * 100)}% confidence
            {guess.evidence?.length > 0 && (
              <> — from <span className="mono" dir="auto">
                {guess.evidence.slice(0, 4).map((e) => e.term).join(', ')}
              </span></>
            )}.
          </p>
        )}
        <div className="row">
          <select className="sel" value={c.vertical ?? ''} disabled={busy}
                  aria-label="Confirm what kind of business this is"
                  onChange={(e) => post(
                    { action: 'vertical', vertical: e.target.value || null },
                    e.target.value ? 'Confirmed.' : 'Cleared — back to no answer.',
                  )}>
            <option value="">— not confirmed —</option>
            {VERTICALS.map((v) => (
              <option key={v} value={v}>{VERTICAL_LABEL[v].en}</option>
            ))}
          </select>
          {guess?.guess && guess.guess !== c.vertical && (
            <button type="button" className="go" disabled={busy}
                    onClick={() => post({ action: 'vertical', vertical: guess.guess }, 'Confirmed.')}>
              Confirm the guess
            </button>
          )}
        </div>
      </div>

      {/* ── the record ───────────────────────────────────────────────────── */}
      <div className="panel">
        <p className="lab">The record</p>
        <div className="row">
          <button type="button" onClick={() => setPanel(panel === 'contact' ? null : 'contact')}>
            {panel === 'contact' ? 'Cancel' : 'Fix contact'}
          </button>
          <button type="button" onClick={() => setPanel(panel === 'note' ? null : 'note')}>
            {panel === 'note' ? 'Cancel' : 'Add a note'}
          </button>
          <span className="sp" />
          <button type="button" disabled={busy || c.status === 'won'}
                  onClick={() => post({ action: 'status', status: 'won' }, 'Marked won.')}>
            Mark won
          </button>
          <button type="button" className="warn" disabled={busy || c.status === 'lost'}
                  onClick={() => setPanel(panel === 'lost' ? null : 'lost')}>
            Mark lost
          </button>
        </div>
        {settled && (
          <p className="hint" style={{ marginTop: 8 }}>
            This account is <b>{CLIENT_LABEL[c.status]}</b>
            {c.lostReason && <> — {c.lostReason}</>}. It no longer appears in Today.
          </p>
        )}

        {panel === 'contact' && (
          <div className="sub">
            <p className="hint">
              A lead that mistyped its own number was, until this existed,
              unfixable. Blank fields are left alone rather than written.
            </p>
            <div className="pair">
              <div>
                <label>Name</label>
                <input value={contact.contactName} dir="auto"
                       onChange={(e) => setContact({ ...contact, contactName: e.target.value })} />
              </div>
              <div>
                <label>Phone</label>
                <input value={contact.contactPhone} dir="ltr" className="mono"
                       onChange={(e) => setContact({ ...contact, contactPhone: e.target.value })} />
              </div>
            </div>
            <button className="go" disabled={busy}
                    onClick={async () => {
                      const j = await post({ action: 'contact', ...contact }, 'Contact saved.');
                      if (j) setPanel(null);
                    }}>
              Save the contact
            </button>
          </div>
        )}

        {panel === 'lost' && (
          <div className="sub">
            <p className="hint">
              A reason is the whole value of recording a loss: five &ldquo;no
              reply&rdquo;s and five &ldquo;price&rdquo;s are two completely
              different businesses to run.
            </p>
            <div className="pair">
              <div>
                <label>Why</label>
                <select className="sel" value={lost.reason}
                        onChange={(e) => setLost({ ...lost, reason: e.target.value })}>
                  {LOST_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label>In your words</label>
                <input value={lost.text} dir="auto"
                       onChange={(e) => setLost({ ...lost, text: e.target.value })} />
              </div>
            </div>
            <button className="warn" disabled={busy}
                    onClick={async () => {
                      const j = await post({
                        action: 'status', status: 'lost',
                        lostReason: [lost.reason, lost.text].filter(Boolean).join(' — '),
                      }, 'Marked lost, with the reason.');
                      if (j) setPanel(null);
                    }}>
              Mark it lost
            </button>
          </div>
        )}

        {panel === 'note' && (
          <div className="sub">
            <div className="pair">
              <div>
                <label>Who is writing</label>
                <select className="sel" value={note.by}
                        onChange={(e) => setNote({ ...note, by: e.target.value as 'ali' | 'khaled' })}>
                  <option value="khaled">Khaled</option>
                  <option value="ali">Ali</option>
                </select>
              </div>
            </div>
            <label>What happened</label>
            <textarea rows={3} value={note.text} dir="auto"
                      onChange={(e) => setNote({ ...note, text: e.target.value })} />
            <button className="go" disabled={busy || !note.text.trim()}
                    style={{ marginTop: 10 }}
                    onClick={async () => {
                      const j = await post({ action: 'note', ...note }, 'Noted.');
                      if (j) { setNote({ ...note, text: '' }); setPanel(null); }
                    }}>
              Save the note
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
