'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BOOKING_LABEL, DEAL_LABEL, AVAILABILITY_LABEL,
  type Deal, type Booking, type Talent, type DealStatus,
} from '@/lib/data/deals';
import type { CastSlot } from '@/lib/store/convert';
import { explain, OFFLINE } from '@/lib/ops/errors';
import { reauthAction, useToast } from '@/components/ops/Toast';
import SendByHand from '@/components/ops/SendByHand';

const FLOW: DealStatus[] = ['proposed', 'negotiating', 'signed', 'paid', 'delivered'];

const LOST_REASONS = [
  'No reply', 'Price', 'Doing it in-house', 'Went to someone else',
  'Timing', 'Other',
] as const;

/** A day that will not happen and has not been replaced. */
const NEEDS_REPLACING: Booking['status'][] = ['declined', 'cancelled', 'no_show'];

const today = () => new Date().toISOString().slice(0, 10);

export default function DealDetail({
  deal, bookings, talent, plan = [],
}: { deal: Deal; bookings: Booking[]; talent: Talent[]; plan?: CastSlot[] }) {
  const [busy, setBusy] = useState(false);
  const { push } = useToast();
  const [losing, setLosing] = useState(false);
  const [lost, setLost] = useState({ reason: LOST_REASONS[0] as string, text: '' });
  const [offer, setOffer] = useState({
    talentId: '', date: '', feeJOD: '', brief: '', location: '', callTime: '',
  });
  // A booking's status mark is pressed and expected to stick immediately —
  // waiting for the round trip on a slow connection reads as a dead button
  // and invites a second press. Applied locally, rolled back with a toast if
  // the request that should confirm it fails.
  const [statusOverride, setStatusOverride] = useState<Record<string, Booking['status']>>({});
  const statusOf = (b: Booking) => statusOverride[b.id] ?? b.status;
  const dateRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const post = async (
    url: string, body: Record<string, unknown>, ok: string, opts?: { rollback?: () => void },
  ) => {
    setBusy(true);
    try {
      const res = await fetch(url, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        opts?.rollback?.();
        push({
          kind: 'err', text: explain(j.error, j),
          action: j.error === 'unauthenticated' ? reauthAction() : { label: 'Retry', onClick: () => post(url, body, ok, opts) },
        });
        return null;
      }
      push({ kind: 'ok', text: ok });
      router.refresh();
      return j;
    } catch {
      opts?.rollback?.();
      push({ kind: 'err', text: OFFLINE, action: { label: 'Retry', onClick: () => post(url, body, ok, opts) } });
      return null;
    }
    finally { setBusy(false); }
  };

  /** A booking status mark, applied on the tap rather than on the response. */
  const markBooking = (b: Booking, status: Booking['status'], ok: string) => {
    const prev = statusOf(b);
    setStatusOverride((o) => ({ ...o, [b.id]: status }));
    post('/api/ops/booking', { action: 'mark', id: b.id, status }, ok,
      { rollback: () => setStatusOverride((o) => ({ ...o, [b.id]: prev })) });
  };

  const byId = (id: string) => talent.find((t) => t.id === id);
  // A placeholder is a worked example with no phone number. Offering one a day
  // produces a real booking nobody can be told about — the gate is here and
  // again inside `offerBooking`, because a future picker will forget this one.
  const bookable = talent.filter((t) => t.active && !t.placeholder);

  const paidOut = bookings.reduce((a, b) => a + b.feeJOD, 0);
  const spread = deal.clientTotalJOD - paidOut;
  const crewOwed = bookings.filter((b) => statusOf(b) === 'done').reduce((a, b) => a + b.feeJOD, 0);
  const crewPaid = bookings.filter((b) => statusOf(b) === 'paid').reduce((a, b) => a + b.feeJOD, 0);

  const at = FLOW.indexOf(deal.status);
  const next = deal.status === 'lost' ? -1 : at + 1;

  /**
   * A status move, with a confirm on anything backwards.
   *
   * Five equal buttons made "delivered" one mis-tap from "proposed", and a deal
   * walked backwards silently rewrites what the console then tells everybody
   * else about the job.
   */
  const move = (s: DealStatus, i: number) => {
    if (i < at && !window.confirm(
      `Move this deal back to ${DEAL_LABEL[s]}? It is currently ${DEAL_LABEL[deal.status]}.`,
    )) return;
    post('/api/ops/deal', { action: 'advance', id: deal.id, status: s },
      s === 'paid'
        ? 'Marked paid — every booking now carries the client name.'
        : `Moved to ${DEAL_LABEL[s]}.`);
  };

  /**
   * Offer a day, and treat a clash as a question rather than a failure.
   *
   * The route answers 409 with the booking that clashes; the only correct
   * response is to ask the human, because double-booking somebody deliberately
   * is a real thing a producer does and guessing either way is worse.
   */
  const offerDay = async (force = false) => {
    setBusy(true);
    try {
      const body = {
        action: 'offer', dealId: deal.id, ...offer,
        feeJOD: Number(offer.feeJOD) || 0, force,
      };
      const res = await fetch('/api/ops/booking', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));

      if (res.status === 409 && j.error === 'conflict') {
        setBusy(false);
        if (window.confirm(`${j.message} Offer it anyway?`)) return offerDay(true);
        push({ kind: 'err', text: `${j.message} Nothing was booked.` });
        return;
      }
      if (!res.ok) {
        push({
          kind: 'err', text: explain(j.error, j),
          action: j.error === 'unauthenticated' ? reauthAction() : { label: 'Retry', onClick: () => offerDay(force) },
        });
        return;
      }

      setOffer({ talentId: '', date: '', feeJOD: '', brief: '', location: '', callTime: '' });
      push({
        kind: 'ok',
        text: j.notified
          ? 'Offered, and they were told.'
          : `Offered. ${j.note ?? 'Nobody has been told yet — use “Tell them”.'}`,
      });
      router.refresh();
    } catch {
      push({ kind: 'err', text: OFFLINE, action: { label: 'Retry', onClick: () => offerDay(force) } });
    } finally { setBusy(false); }
  };

  const who = byId(offer.talentId);

  return (
    <div className="cols">
      <div>
        <section className="blk">
          <h2>Where it stands</h2>
          <p className="hint">
            Paying is what tells the crew who they are shooting for. Before it,
            a booking carries the brief and the date and no client at all.
          </p>
          <ol className="tline">
            {FLOW.map((s, i) => (
              <li key={s} data-done={i <= at && deal.status !== 'lost'}>
                <span className="tline-l">{DEAL_LABEL[s]}</span>
                <span className="tline-d mono">
                  {s === 'signed' && deal.signedAt ? deal.signedAt.slice(0, 10)
                    : s === 'paid' && deal.paidAt ? deal.paidAt.slice(0, 10)
                      : i <= at && deal.status !== 'lost' ? 'done' : '—'}
                </span>
                {i !== at && (
                  <button type="button" disabled={busy}
                          className={i === next ? 'go' : undefined}
                          onClick={() => move(s, i)}>
                    {i === next ? `Move to ${DEAL_LABEL[s]}` : i < at ? 'Back to this' : DEAL_LABEL[s]}
                  </button>
                )}
              </li>
            ))}
          </ol>

          <div className="row" style={{ marginTop: 14 }}>
            <button className="warn" disabled={busy || deal.status === 'lost'}
                    onClick={() => setLosing((v) => !v)}>
              {losing ? 'Cancel' : 'Lost'}
            </button>
            {deal.status === 'lost' && (
              <span className="hint todo">
                Lost{deal.lostReason ? ` — ${deal.lostReason}` : ', with no reason recorded'}.
              </span>
            )}
          </div>
          {losing && (
            <div className="sub">
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
                        const j = await post('/api/ops/deal', {
                          action: 'advance', id: deal.id, status: 'lost',
                          lostReason: [lost.reason, lost.text].filter(Boolean).join(' — '),
                        }, 'Marked lost, with the reason.');
                        if (j) setLosing(false);
                      }}>
                Mark it lost
              </button>
            </div>
          )}
        </section>

        <section className="blk">
          <h2>What was sold</h2>
          {deal.concepts.length === 0
            ? <p className="hint">No concepts recorded on this deal.</p>
            : deal.concepts.map((c, i) => (
              <div className="item" key={i}>
                <div className="itemhead">
                  <b className="mono">#{String(c.conceptN).padStart(2, '0')}</b>
                  <span style={{ fontWeight: 500 }} dir="auto">{c.name}</span>
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
            <div className="bookings">
              {bookings.map((b) => {
                const t = byId(b.talentId);
                const status = statusOf(b);
                const gone = NEEDS_REPLACING.includes(status);
                return (
                  <div className="bk" key={b.id} data-gone={gone}>
                    <div className="bk-head">
                      <b dir="auto">{t?.name.en ?? b.talentId}</b>
                      <span className="mono">{b.date}</span>
                      <span className="mono">{b.feeJOD} JOD</span>
                      <span className="pill" data-s={
                        status === 'paid' ? 'won'
                          : gone ? 'warn'
                            : status === 'done' || status === 'accepted' ? 'ready' : 'draft'
                      }>{BOOKING_LABEL[status].en}</span>
                      <span className="sp" />
                      {b.notifiedAt
                        ? <span className="mono" style={{ color: 'var(--go)' }}>told</span>
                        : <span className="mono" style={{ color: 'var(--warn)' }}>not told</span>}
                    </div>

                    {gone && (
                      <p className="hint todo" style={{ margin: '6px 0 0' }}>
                        <b>Needs a replacement.</b> {b.date} has nobody on it.
                        {b.declineReason && <> They said: <span dir="auto">{b.declineReason}</span></>}
                      </p>
                    )}
                    {/* Was a `title` tooltip, which does not exist on a phone —
                        which is where this console is read. */}
                    {b.notifyNote && !b.notifiedAt && (
                      <p className="hint" style={{ margin: '6px 0 0' }}>{b.notifyNote}</p>
                    )}
                    {b.conflictWith && (
                      <p className="hint todo" style={{ margin: '6px 0 0' }}>
                        Knowingly double-booked against another day.
                      </p>
                    )}
                    {b.remindedAt?.length ? (
                      <p className="hint" style={{ margin: '6px 0 0' }}>
                        Reminded {b.remindedAt.length} time{b.remindedAt.length === 1 ? '' : 's'},
                        last {b.remindedAt[b.remindedAt.length - 1].slice(0, 10)}.
                      </p>
                    ) : null}

                    <div className="card-acts">
                      {!b.notifiedAt && !gone && (
                        <SendByHand
                          label="Tell them" primary={false}
                          url="/api/ops/notify"
                          composeBody={{ dealId: deal.id, id: b.id }}
                          markBody={{ dealId: deal.id, id: b.id, action: 'mark-sent' }}
                          noNumberHint="That person has no usable number on file."
                          onSent={() => router.refresh()}
                        />
                      )}
                      {status === 'accepted' && (
                        <SendByHand
                          label="Send reminder" primary={false}
                          url="/api/ops/notify"
                          composeBody={{ dealId: deal.id, id: b.id, action: 'remind' }}
                          markBody={{ dealId: deal.id, id: b.id, action: 'mark-reminded' }}
                          noNumberHint="That person has no usable number on file."
                          onSent={() => router.refresh()}
                        />
                      )}
                      {status === 'accepted' && (
                        <button disabled={busy} onClick={() => markBooking(b, 'done', 'Marked done.')}>
                          Done
                        </button>
                      )}
                      {status === 'accepted' && b.date >= today() && (
                        <button className="warn" disabled={busy}
                                onClick={() => markBooking(b, 'cancelled', 'Cancelled.')}>
                          We cancelled it
                        </button>
                      )}
                      {status === 'done' && (
                        <button className="go" disabled={busy}
                                onClick={() => markBooking(b, 'paid', 'Marked paid.')}>
                          Pay {b.feeJOD} JOD
                        </button>
                      )}
                      <a className="btn" href={`/doc/invoice/${b.talentId}?m=${b.date.slice(0, 7)}`}
                         target="_blank" rel="noreferrer">Their invoice</a>
                    </div>
                  </div>
                );
              })}
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
                      <b dir="auto">{t?.name.en ?? slot.talentId}</b>
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
                      type="button" disabled={busy || !t || !!t?.placeholder}
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
                  className="sel" value={offer.talentId}
                  onChange={(e) => {
                    const t = byId(e.target.value);
                    setOffer({ ...offer, talentId: e.target.value, feeJOD: t ? String(t.dayRateJOD) : offer.feeJOD });
                  }}
                >
                  <option value="">—</option>
                  {bookable.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name.en} · {t.discipline} · {AVAILABILITY_LABEL[t.availability].en}
                    </option>
                  ))}
                </select>
                {who && who.availability !== 'available' && (
                  <p className="hint todo" style={{ marginTop: 6 }}>
                    They have marked themselves{' '}
                    {AVAILABILITY_LABEL[who.availability].en.toLowerCase()}
                    {who.availableFrom && <> until <span className="mono">{who.availableFrom}</span></>}.
                    {/* A "busy until March" read in September is not a fact
                        about today, and treating it as one loses a bookable
                        person for a fortnight nobody notices. */}
                    {who.availableFrom && who.availableFrom < today()
                      ? ' That date has passed — they may well be back. Ask.'
                      : ' You can still offer — they answer it themselves.'}
                  </p>
                )}
                {who?.availabilitySetAt && (
                  <p className="hint" style={{ marginTop: 4 }}>
                    Said so on {who.availabilitySetAt.slice(0, 10)}.
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
                <input value={offer.location} dir="auto"
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
                    onClick={() => offerDay(false)}>
              Offer the day
            </button>
          </div>
        </section>

      </div>

      <aside className="facts">
        {/* Two columns collapse into one below 900px, so this panel would
            otherwise land as a wall of numbers between the record and the
            action bar. `<details>` reduces it to the two figures that
            matter — client pays, PRAVDA keeps — until it is opened; on the
            two-column layout the wrapper is inert and everything shows as
            it always did. */}
        <details className="facts-mob">
          <summary>
            <span><b className="mono">{deal.clientTotalJOD} JOD</b> client pays</span>
            <span><b className="mono" style={{ color: spread >= 0 ? 'var(--go)' : 'var(--warn)' }}>{spread} JOD</b> kept</span>
          </summary>
          <div className="facts-body">
            <h2>The money</h2>
            <p className="muted" style={{ fontSize: 12.5, marginTop: -6 }}>
              This panel exists nowhere else. Neither side sees it.
            </p>
            <div className="fact"><b className="mono">{deal.clientTotalJOD} JOD</b><span>client pays</span></div>
            {deal.retainerJOD ? (
              <div className="fact"><b className="mono">{deal.retainerJOD} JOD</b><span>retainer / month</span></div>
            ) : null}
            <div className="fact"><b className="mono">{paidOut} JOD</b><span>crew cost, all days</span></div>
            <div className="fact">
              <b className="mono" style={{ color: crewOwed > 0 ? 'var(--warn)' : undefined }}>{crewOwed} JOD</b>
              <span>owed to crew now</span>
            </div>
            <div className="fact"><b className="mono">{crewPaid} JOD</b><span>paid to crew</span></div>
            <div className="fact">
              <b className="mono" style={{ color: spread >= 0 ? 'var(--go)' : 'var(--warn)' }}>{spread} JOD</b>
              <span>PRAVDA keeps</span>
            </div>
            {deal.clientTotalJOD > 0 && (
              <div className="fact">
                <b className="mono">{Math.round((spread / deal.clientTotalJOD) * 100)}%</b><span>margin</span>
              </div>
            )}
            {spread < 0 && (
              <p className="note" data-k="err" style={{ marginTop: 10 }}>
                The crew on this job costs more than the client is paying for it.
                Nothing stops you booking more days; the deal simply loses money.
              </p>
            )}

            <h2 style={{ marginTop: 18 }}>Client</h2>
            <div className="fact"><b dir="auto">{deal.clientName}</b><span>{deal.status}</span></div>
            {/* A proposal that came through the configurator carries the person
                who actually filled it in — which is who Khaled rings, not the
                business. */}
            {deal.source === 'configurator' && (
              <>
                <div className="fact"><b dir="auto">{deal.contactName}</b><span>submitted this</span></div>
                {deal.contactPhone && (
                  <div className="fact">
                    <a className="mono" href={`tel:${deal.contactPhone}`} dir="ltr">{deal.contactPhone}</a>
                    <span>their number</span>
                  </div>
                )}
                {deal.perMonth ? (
                  <div className="fact"><b className="mono">{deal.perMonth}/mo</b><span>videos wanted</span></div>
                ) : null}
              </>
            )}
            {deal.clientHandle && (
              <div className="fact">
                <a className="mono" dir="ltr" href={`https://instagram.com/${deal.clientHandle.replace('@', '')}`}
                   target="_blank" rel="noreferrer">@{deal.clientHandle.replace('@', '')} →</a>
              </div>
            )}
            {deal.clientPhone && (
              <div className="fact"><a className="mono" href={`tel:${deal.clientPhone}`} dir="ltr">{deal.clientPhone}</a></div>
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
          </div>
        </details>
      </aside>
    </div>
  );
}
