'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AVAILABILITY_LABEL, BOOKING_LABEL,
  type Availability, type Booking, type BookingStatus,
} from '@/lib/data/deals';
import { arNum } from '@/lib/format/num';
import { arDate as when, monthName } from '@/lib/format/date';

const ORDER: Availability[] = ['available', 'busy', 'abroad'];

/**
 * Whether a booked day is behind them, in Amman.
 *
 * The bare `new Date('2026-09-06T23:59:59')` is local to whatever machine
 * renders it — the browser's, on a provider who is abroad. A model in Dubai
 * lost the last hour of every shoot day and a model in London gained two, so
 * the offer they were meant to answer today was filed under "past". Jordan has
 * been permanently UTC+3 since October 2022, so the day ends at +03:00.
 */
const isPast = (iso: string) => new Date(`${iso}T23:59:59+03:00`) < new Date();

/**
 * What this screen needs to know about the person reading it, and no more.
 *
 * The page used to hand the whole `Talent` to a client component: the day rate
 * PRAVDA pays them, the hashed pass code, the session epoch, the operator's
 * notes — all of it serialised into the RSC payload of a page anybody signed in
 * can view source on. Four fields render, so four fields cross.
 */
export type PortalMe = {
  id: string;
  name: { ar: string; en: string };
  phone: string;
  availability: Availability;
  availableFrom?: string;
};

/**
 * Days that will never be paid for.
 *
 * Their fee still renders — a provider should be able to see what the day was
 * worth — but it must not read as money still coming, which is exactly what
 * the green does everywhere else on this screen.
 */
const UNPAYABLE: BookingStatus[] = ['declined', 'cancelled', 'no_show'];

/**
 * Why somebody said no, in the four shapes it actually takes.
 *
 * Chips rather than a free-text box first, because this is answered one-handed
 * on a phone: three of the four are a single tap, and the fourth opens the box
 * for the case the list did not anticipate. None of it is required.
 */
const REASONS = ['مشغول', 'مسافر', 'السعر', 'غير ذلك'] as const;

/**
 * One day, as a card.
 *
 * Declared at module scope rather than inside `Portal`, which is not a style
 * preference: a component defined in a render body is a new function on every
 * render, so React unmounts and remounts its whole subtree each keystroke — and
 * the free-text reason box below would lose focus after the first letter.
 */
function BookingCard({
  b, act, busy, declining, otherOpen, other,
  onDecline, onOther, onOtherText, onBack, respond,
}: {
  b: Booking; act?: boolean; busy: boolean;
  declining: string | null; otherOpen: boolean; other: string;
  onDecline: (id: string) => void;
  onOther: () => void;
  onOtherText: (v: string) => void;
  onBack: () => void;
  respond: (id: string, status: 'accepted' | 'declined', reason?: string) => void;
}) {
  return (
    <div className="card" data-s={b.status}>
      <div className="when">
        <b>{when(b.date)}</b>
        {b.callTime && <span className="meta num">{b.callTime}</span>}
        <span className={`fee${UNPAYABLE.includes(b.status) ? ' dead' : ''}`}>
          {arNum(b.feeJOD)} دينار
        </span>
      </div>
      {/* Operator-written, and an operator writes a brief in whichever language
          the job is in. Inside an RTL document an English brief renders with its
          full stop at the head of the line unless the browser is told to work
          the direction out from the text itself — `auto` does exactly that,
          per string, and costs nothing on the Arabic ones. */}
      {b.brief && <p dir="auto">{b.brief}</p>}
      {b.location && <p className="meta" dir="auto">📍 {b.location}</p>}
      {/* Only present once the client has paid. Its absence is the rule. */}
      {b.clientName && <p className="meta">للزبون: <span dir="auto">{b.clientName}</span></p>}
      {!act && <span className="pill">{BOOKING_LABEL[b.status].ar}</span>}

      {act && declining !== b.id && (
        <div className="acts">
          <button className="go" disabled={busy} onClick={() => respond(b.id, 'accepted')}>
            بقبل
          </button>
          <button className="no" disabled={busy} onClick={() => onDecline(b.id)}>
            ما بقدر
          </button>
        </div>
      )}

      {act && declining === b.id && (
        <div className="why">
          <p className="u">ليش؟ اختياري</p>
          <div className="chips">
            {REASONS.map((r) => (
              <button key={r} type="button" disabled={busy}
                      aria-pressed={r === 'غير ذلك' && otherOpen}
                      onClick={() => (r === 'غير ذلك' ? onOther() : respond(b.id, 'declined', r))}>
                {r}
              </button>
            ))}
          </div>
          {otherOpen && (
            <input className="free" type="text" maxLength={200} autoFocus
                   value={other} placeholder="اكتب السبب"
                   onChange={(e) => onOtherText(e.target.value)} />
          )}
          <div className="acts">
            <button className="no" disabled={busy}
                    onClick={() => respond(b.id, 'declined', other.trim() || undefined)}>
              أكّد الاعتذار
            </button>
            <button type="button" disabled={busy} onClick={onBack}>
              رجوع
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Portal({
  me, bookings,
}: { me: PortalMe; bookings: Booking[] }) {
  const [avail, setAvail] = useState<Availability>(me.availability);
  const [from, setFrom] = useState<string>(me.availableFrom ?? '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ k: 'ok' | 'err'; t: string } | null>(null);
  /** The booking whose decline is being explained, if any. */
  const [declining, setDeclining] = useState<string | null>(null);
  const [otherOpen, setOtherOpen] = useState(false);
  const [other, setOther] = useState('');
  const router = useRouter();

  const setAvailability = async (a: Availability, date: string) => {
    const before = { a: avail, d: from };
    setAvail(a); setFrom(date); setBusy(true); setMsg(null);   // a toggle should feel instant
    try {
      const res = await fetch('/api/t/availability', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ availability: a, availableFrom: a === 'available' ? '' : date }),
      });
      if (!res.ok) {
        setAvail(before.a); setFrom(before.d);
        setMsg({ k: 'err', t: 'ما ضبطت. جرّب كمان مرة.' });
      }
    } catch {
      setAvail(before.a); setFrom(before.d);
      setMsg({ k: 'err', t: 'ما ضبطت. جرّب كمان مرة.' });
    } finally { setBusy(false); }
  };

  const respond = async (id: string, status: 'accepted' | 'declined', reason?: string) => {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch('/api/t/respond', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, status, reason }),
      });
      if (!res.ok) { setMsg({ k: 'err', t: 'ما قدرنا نسجّل الرد.' }); return; }
      setMsg({ k: 'ok', t: status === 'accepted' ? 'قبلت اليوم. منشوفك هناك.' : 'رفضت اليوم.' });
      setDeclining(null); setOtherOpen(false); setOther('');
      router.refresh();
    } catch { setMsg({ k: 'err', t: 'ما قدرنا نسجّل الرد.' }); }
    finally { setBusy(false); }
  };

  const offered = bookings.filter((b) => b.status === 'offered' && !isPast(b.date));
  const upcoming = bookings.filter((b) => b.status === 'accepted' && !isPast(b.date));
  const past = bookings.filter((b) => !offered.includes(b) && !upcoming.includes(b));
  const owed = past.filter((b) => b.status === 'done').reduce((a, b) => a + b.feeJOD, 0);
  /* Months they actually worked, newest first — not a date picker over a year
     of empty statements. */
  const months = [...new Set(past
    .filter((b) => b.status === 'done' || b.status === 'paid')
    .map((b) => b.date.slice(0, 7)))].sort().reverse().slice(0, 6);
  /* Only days that are actually theirs to keep go in a calendar. An offer they
     have not answered is not a commitment, and putting it there answers for them. */
  const inCalendar = bookings.some(
    (b) => b.status === 'accepted' || b.status === 'done' || b.status === 'paid',
  );

  const Card = (props: { b: Booking; act?: boolean }) => (
    <BookingCard
      {...props} busy={busy}
      declining={declining} otherOpen={otherOpen} other={other}
      onDecline={(id) => { setDeclining(id); setOtherOpen(false); setOther(''); }}
      onOther={() => setOtherOpen(true)}
      onOtherText={setOther}
      onBack={() => { setDeclining(null); setOtherOpen(false); setOther(''); }}
      respond={respond}
    />
  );

  return (
    <div className="wrap">
      <header>
        <h1>PRAVDA</h1>
        <span className="sp" />
        <span className="u">{me.name.ar}</span>
        <form method="post" action="/api/t/logout">
          <button type="submit" style={{ padding: '8px 12px', minHeight: 0, fontSize: 13 }}>
            خروج
          </button>
        </form>
      </header>

      {!me.phone && (
        <p className="note" data-k="err" style={{ marginBottom: 18 }}>
          ما عنا رقمك. احكي مع برافدا ليضيفوه، وإلا رح تشوف الشغل هون بس.
        </p>
      )}

      <p className="u" style={{ marginBottom: 8 }}>وضعك</p>
      <div className="state">
        <div className="avail">
          {ORDER.map((a) => (
            <button key={a} aria-pressed={avail === a} disabled={busy}
                    onClick={() => setAvailability(a, from)}>
              {AVAILABILITY_LABEL[a].ar}
            </button>
          ))}
        </div>
        {/* Only asked once it means something. "Busy" with no end is how a stale
            status happens — a producer sees it months later and stops offering. */}
        {avail !== 'available' && (
          <label className="until">
            <span className="u">راجع من</span>
            <input type="date" value={from} disabled={busy}
                   onChange={(e) => setAvailability(avail, e.target.value)} />
          </label>
        )}
      </div>

      {msg && <p className="note" data-k={msg.k} style={{ marginBottom: 18 }}>{msg.t}</p>}

      {offered.length > 0 && (
        <>
          <p className="u" style={{ marginBottom: 8 }}>
            أيام معروضة عليك · {arNum(offered.length)}
          </p>
          {offered.map((b) => <Card key={b.id} b={b} act />)}
        </>
      )}

      {upcoming.length > 0 && (
        <>
          <p className="u" style={{ margin: '24px 0 8px' }}>جاي</p>
          {upcoming.map((b) => <Card key={b.id} b={b} />)}
        </>
      )}

      {past.length > 0 && (
        <>
          <p className="u" style={{ margin: '24px 0 8px' }}>
            سابق{owed > 0 ? ` · ${arNum(owed)} دينار مستحقة` : ''}
          </p>
          {past.map((b) => <Card key={b.id} b={b} />)}
        </>
      )}

      {(inCalendar || months.length > 0) && (
        <div className="tools">
          {/* Their own days, pulled into whatever calendar the phone already
              uses. The route takes no parameters, so there is nothing to edit
              into somebody else's. */}
          {inCalendar && (
            <a href="/api/t/ics" download={`pravda-${me.id}.ics`}>
              <button type="button">أضف للتقويم</button>
            </a>
          )}
          {/* Their own months, to print or send on. Only theirs — the page
              behind this refuses anyone but them and an operator. */}
          {months.map((m) => (
            <a key={m} href={`/doc/invoice/${me.id}?m=${m}`} target="_blank" rel="noreferrer">
              <button type="button">كشف {monthName(m)}</button>
            </a>
          ))}
        </div>
      )}

      {bookings.length === 0 && (
        <p className="empty">
          ما في أيام محجوزة لهلق.<br />
          لما يصير في شغل، بنبعتلك رسالة واتساب على{' '}
          <span className="num">{me.phone || '—'}</span>.
        </p>
      )}
    </div>
  );
}
