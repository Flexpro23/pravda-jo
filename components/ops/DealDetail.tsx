'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BOOKING_LABEL, DEAL_LABEL, AVAILABILITY_LABEL,
  type Deal, type Booking, type Talent, type DealStatus,
} from '@/lib/data/deals';
import type { CastSlot } from '@/lib/store/convert';

const FLOW: DealStatus[] = ['proposed', 'negotiating', 'signed', 'paid', 'delivered'];

export default function DealDetail({
  deal, bookings, talent, plan = [],
}: { deal: Deal; bookings: Booking[]; talent: Talent[]; plan?: CastSlot[] }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ k: 'ok' | 'err'; t: string } | null>(null);
  const [offer, setOffer] = useState({ talentId: '', date: '', feeJOD: '', brief: '', location: '', callTime: '' });
  const dateRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const post = async (url: string, body: Record<string, unknown>, ok: string) => {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(url, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) { setMsg({ k: 'err', t: `Failed: ${j.error}` }); return false; }
      setMsg({ k: 'ok', t: ok });
      router.refresh();
      return true;
    } catch { setMsg({ k: 'err', t: 'The request did not complete.' }); return false; }
    finally { setBusy(false); }
  };

  /**
   * Hand the operator the message and the link, then record that it went.
   * Opened before the await so the tap is what opens the window — a popup
   * opened after a network round trip is blocked by every browser.
   */
  const tell = async (id: string) => {
    const w = window.open('', '_blank');
    setBusy(true); setMsg(null);
    try {
      const res = await fetch('/api/ops/notify', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dealId: deal.id, id }),
      });
      const j = await res.json();
      if (!res.ok || !j.link) {
        w?.close();
        setMsg({ k: 'err', t: j.link === null ? 'That person has no usable phone number on file.' : `Could not build the message: ${j.error}` });
        return;
      }
      if (w) w.location.href = j.link; else window.open(j.link, '_blank');
      await fetch('/api/ops/notify', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dealId: deal.id, id, action: 'mark-sent' }),
      });
      setMsg({ k: 'ok', t: `WhatsApp opened for ${j.name}. Marked as told.` });
      router.refresh();
    } catch {
      w?.close();
      setMsg({ k: 'err', t: 'The request did not complete.' });
    } finally { setBusy(false); }
  };

  const paidOut = bookings.reduce((a, b) => a + b.feeJOD, 0);
  const spread = deal.clientTotalJOD - paidOut;
  const byId = (id: string) => talent.find((t) => t.id === id);
  const bookable = talent.filter((t) => t.active);

  return (
    <div className="cols">
      <div>
        <section className="blk">
          <h2>Where it stands</h2>
          <p className="hint">
            Paying is what tells the crew who they are shooting for. Before it,
            a booking carries the brief and the date and no client at all.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {FLOW.map((s) => (
              <button
                key={s} disabled={busy || deal.status === s}
                className={s === 'paid' && deal.status === 'signed' ? 'go' : undefined}
                onClick={() => post('/api/ops/deal', { action: 'advance', id: deal.id, status: s },
                  s === 'paid' ? 'Marked paid — every booking now carries the client name.' : `Moved to ${DEAL_LABEL[s]}.`)}
              >
                {DEAL_LABEL[s]}
              </button>
            ))}
            <button className="warn" disabled={busy || deal.status === 'lost'}
                    onClick={() => post('/api/ops/deal', { action: 'advance', id: deal.id, status: 'lost' }, 'Marked lost.')}>
              Lost
            </button>
          </div>
        </section>

        <section className="blk">
          <h2>What was sold</h2>
          {deal.concepts.length === 0
            ? <p className="hint">No concepts recorded on this deal.</p>
            : deal.concepts.map((c, i) => (
              <div className="item" key={i}>
                <div className="itemhead">
                  <b className="mono">#{String(c.conceptN).padStart(2, '0')}</b>
                  <span style={{ fontWeight: 500 }}>{c.name}</span>
                  <span className="sp" />
                  {/* A pack sold flat has no per-idea price, and writing one in
                      would be inventing a number the client never saw. */}
                  <span className="mono">
                    {c.priceJOD === undefined ? '—' : `${c.priceJOD} JOD`}
                  </span>
                </div>
              </div>
            ))}
        </section>

        <section className="blk">
          <h2>Crew</h2>
          <p className="hint">
            A booking holds a fee, a date and a brief. It has no field for what
            the client paid — not hidden, not empty. The number is on the deal,
            in a collection no provider session can read.
          </p>

          {bookings.length > 0 && (
            <div className="scroll-x" style={{ marginBottom: 18 }}>
            <table>
              <thead>
                <tr><th>Who</th><th>Date</th><th>Fee</th><th>Status</th><th>Notified</th><th /></tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <a href={`/doc/invoice/${b.talentId}?m=${b.date.slice(0, 7)}`}
                         target="_blank" rel="noreferrer">
                        {byId(b.talentId)?.name.en ?? b.talentId}
                      </a>
                    </td>
                    <td className="mono">{b.date}</td>
                    <td className="mono">{b.feeJOD} JOD</td>
                    <td><span className="pill">{BOOKING_LABEL[b.status].en}</span></td>
                    <td className="muted">
                      {b.notifiedAt
                        ? <span style={{ color: 'var(--go)' }}>told</span>
                        : <span style={{ color: 'var(--warn)' }} title={b.notifyNote}>not told</span>}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {/* Nobody has heard about this day yet. One tap fixes it. */}
                      {!b.notifiedAt && (
                        <button disabled={busy} style={{ marginInlineEnd: 8 }}
                                onClick={() => tell(b.id)}>Tell them</button>
                      )}
                      {b.status === 'accepted' && (
                        <button disabled={busy}
                                onClick={() => post('/api/ops/booking', { action: 'mark', id: b.id, status: 'done' }, 'Marked done.')}>
                          Done
                        </button>
                      )}
                      {b.status === 'done' && (
                        <button className="go" disabled={busy}
                                onClick={() => post('/api/ops/booking', { action: 'mark', id: b.id, status: 'paid' }, 'Marked paid.')}>
                          Pay
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}

          {plan.length > 0 && (
            <div className="item" style={{ marginBottom: 14 }}>
              <div className="itemhead"><b>Cast on the sheet</b></div>
              <p className="hint" style={{ margin: '0 0 10px' }}>
                Who was cast, on which idea, at their own published day rate. Take one and
                the form below is filled except the date — which is the one thing the
                sheet never knew.
              </p>
              {plan.map((slot, i) => {
                const t = byId(slot.talentId);
                const days = bookings.filter((b) => b.talentId === slot.talentId).length;
                return (
                  <div className="castrow" key={`${slot.conceptN}-${slot.talentId}-${i}`}>
                    <span className="castwho">
                      <b>{t?.name.en ?? slot.talentId}</b>
                      <span className="mono">
                        {t ? `${t.discipline} · ${t.dayRateJOD} JOD` : 'not on the roster'}
                      </span>
                    </span>
                    {/* Khaled may have written this name in Arabic. Direction
                        comes from the text itself, not from the console. */}
                    <span className="castfor" dir="auto">{slot.conceptName}</span>
                    {days > 0 && (
                      <span className="muted mono" style={{ fontSize: 12 }}>
                        {days} day{days === 1 ? '' : 's'} booked
                      </span>
                    )}
                    <button
                      type="button" disabled={busy || !t}
                      onClick={() => {
                        setOffer({
                          ...offer, talentId: slot.talentId,
                          feeJOD: t ? String(t.dayRateJOD) : '',
                          brief: slot.brief,
                        });
                        // Straight to the only field left to fill.
                        dateRef.current?.focus();
                      }}
                    >
                      Use this
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="item">
            <div className="itemhead"><b>Offer a day</b></div>
            <div className="pair">
              <div>
                <label>Who</label>
                <select
                  value={offer.talentId}
                  onChange={(e) => {
                    const t = byId(e.target.value);
                    setOffer({ ...offer, talentId: e.target.value, feeJOD: t ? String(t.dayRateJOD) : offer.feeJOD });
                  }}
                  style={{ width: '100%', background: '#191919', color: 'var(--ink)', border: '1px solid var(--line)', borderRadius: 6, padding: '9px 11px' }}
                >
                  <option value="">—</option>
                  {bookable.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name.en} · {t.discipline} · {AVAILABILITY_LABEL[t.availability].en}
                    </option>
                  ))}
                </select>
                {offer.talentId && byId(offer.talentId)?.availability !== 'available' && (
                  <p className="hint todo" style={{ marginTop: 6 }}>
                    They have marked themselves{' '}
                    {AVAILABILITY_LABEL[byId(offer.talentId)!.availability].en.toLowerCase()}.
                    You can still offer — they answer it themselves.
                  </p>
                )}
              </div>
              <div>
                <label>Date</label>
                <input ref={dateRef} type="date" value={offer.date}
                       onChange={(e) => setOffer({ ...offer, date: e.target.value })} />
              </div>
            </div>
            <div className="pair">
              <div>
                <label>Their fee — JOD</label>
                <input type="number" min={0} value={offer.feeJOD}
                       onChange={(e) => setOffer({ ...offer, feeJOD: e.target.value })} />
              </div>
              <div>
                <label>Call time</label>
                <input value={offer.callTime} placeholder="08:30"
                       onChange={(e) => setOffer({ ...offer, callTime: e.target.value })} />
              </div>
            </div>
            <div className="pair">
              <div>
                <label>Location</label>
                <input value={offer.location}
                       onChange={(e) => setOffer({ ...offer, location: e.target.value })} />
              </div>
            </div>
            <label>Brief — what they are turning up to do</label>
            {/* This goes into an otherwise entirely Arabic WhatsApp message, and
                arrives from the sheet in whichever language it was written. */}
            <textarea rows={2} value={offer.brief} dir="auto"
                      onChange={(e) => setOffer({ ...offer, brief: e.target.value })} />
            <button className="go" style={{ marginTop: 10 }}
                    disabled={busy || !offer.talentId || !offer.date}
                    onClick={async () => {
                      const done = await post('/api/ops/booking', {
                        action: 'offer', dealId: deal.id, ...offer, feeJOD: Number(offer.feeJOD) || 0,
                      }, 'Offered.');
                      if (done) setOffer({ talentId: '', date: '', feeJOD: '', brief: '', location: '', callTime: '' });
                    }}>
              Offer the day
            </button>
          </div>
        </section>

        {msg && <p className="note" data-k={msg.k}>{msg.t}</p>}
      </div>

      <aside className="facts">
        <h2>The money</h2>
        <p className="muted" style={{ fontSize: 12.5, marginTop: -6 }}>
          This panel exists nowhere else. Neither side sees it.
        </p>
        <div className="fact"><b>{deal.clientTotalJOD} JOD</b><span>client pays</span></div>
        {deal.retainerJOD ? (
          <div className="fact"><b>{deal.retainerJOD} JOD</b><span>retainer / month</span></div>
        ) : null}
        <div className="fact"><b>{paidOut} JOD</b><span>crew cost</span></div>
        <div className="fact">
          <b style={{ color: spread >= 0 ? 'var(--go)' : 'var(--warn)' }}>{spread} JOD</b>
          <span>PRAVDA keeps</span>
        </div>
        {deal.clientTotalJOD > 0 && (
          <div className="fact">
            <b>{Math.round((spread / deal.clientTotalJOD) * 100)}%</b><span>margin</span>
          </div>
        )}

        <h2 style={{ marginTop: 18 }}>Client</h2>
        <div className="fact"><b>{deal.clientName}</b><span>{deal.status}</span></div>
        {/* A proposal that came through the configurator carries the person who
            actually filled it in — which is who Khaled rings, not the business. */}
        {deal.source === 'configurator' && (
          <>
            <div className="fact"><b>{deal.contactName}</b><span>submitted this</span></div>
            {deal.contactPhone && (
              <div className="fact">
                <a className="mono" href={`tel:${deal.contactPhone}`}>{deal.contactPhone}</a>
                <span>their number</span>
              </div>
            )}
            {deal.perMonth ? (
              <div className="fact"><b>{deal.perMonth}/mo</b><span>videos wanted</span></div>
            ) : null}
          </>
        )}
        {deal.clientHandle && (
          <div className="fact">
            <a href={`https://instagram.com/${deal.clientHandle.replace('@', '')}`}
               target="_blank" rel="noreferrer">@{deal.clientHandle.replace('@', '')} →</a>
          </div>
        )}
        {deal.clientPhone && (
          <div className="fact"><a className="mono" href={`tel:${deal.clientPhone}`}>{deal.clientPhone}</a></div>
        )}
        {deal.teardownToken && (
          <div className="fact">
            <a href={`/ops/${deal.teardownToken}`}>The teardown →</a>
          </div>
        )}
        {deal.sheetToken && (
          <div className="fact">
            <a href={`/ops/sheet/${deal.sheetToken}`}>The sheet →</a>
            <span>what they agreed to</span>
          </div>
        )}
        <div className="fact">
          <a href={`/doc/proposal/${deal.id}`} target="_blank" rel="noreferrer">
            The proposal →
          </a>
          <span>to send</span>
        </div>
      </aside>
    </div>
  );
}
