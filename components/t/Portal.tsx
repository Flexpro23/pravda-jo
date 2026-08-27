'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AVAILABILITY_LABEL, BOOKING_LABEL,
  type Availability, type Booking, type Talent,
} from '@/lib/data/deals';

const ORDER: Availability[] = ['available', 'busy', 'abroad'];

/** ٢٠٢٦-٠٨-٣٠ reads wrong; a provider wants "الأحد ٣٠ آب". */
const AR_MONTHS = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران',
  'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'];
const AR_DAYS = ['الأحد', 'الاثنين', 'الثلاثا', 'الأربعا', 'الخميس', 'الجمعة', 'السبت'];
const arNum = (s: string | number) => String(s).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[+d]);

const when = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(+d)) return iso;
  return `${AR_DAYS[d.getDay()]} ${arNum(d.getDate())} ${AR_MONTHS[d.getMonth()]}`;
};

const isPast = (iso: string) => new Date(`${iso}T23:59:59`) < new Date();

export default function Portal({
  me, bookings,
}: { me: Talent; bookings: Booking[] }) {
  const [avail, setAvail] = useState<Availability>(me.availability);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ k: 'ok' | 'err'; t: string } | null>(null);
  const router = useRouter();

  const setAvailability = async (a: Availability) => {
    const before = avail;
    setAvail(a); setBusy(true); setMsg(null);        // optimistic; a toggle should feel instant
    try {
      const res = await fetch('/api/t/availability', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ availability: a }),
      });
      if (!res.ok) { setAvail(before); setMsg({ k: 'err', t: 'ما ضبطت. جرّب كمان مرة.' }); }
    } catch { setAvail(before); setMsg({ k: 'err', t: 'ما ضبطت. جرّب كمان مرة.' }); }
    finally { setBusy(false); }
  };

  const respond = async (id: string, status: 'accepted' | 'declined') => {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch('/api/t/respond', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) { setMsg({ k: 'err', t: 'ما قدرنا نسجّل الرد.' }); return; }
      setMsg({ k: 'ok', t: status === 'accepted' ? 'قبلت اليوم. منشوفك هناك.' : 'رفضت اليوم.' });
      router.refresh();
    } catch { setMsg({ k: 'err', t: 'ما قدرنا نسجّل الرد.' }); }
    finally { setBusy(false); }
  };

  const offered = bookings.filter((b) => b.status === 'offered' && !isPast(b.date));
  const upcoming = bookings.filter((b) => b.status === 'accepted' && !isPast(b.date));
  const past = bookings.filter((b) => !offered.includes(b) && !upcoming.includes(b));
  const owed = past.filter((b) => b.status === 'done').reduce((a, b) => a + b.feeJOD, 0);

  const Card = ({ b, act }: { b: Booking; act?: boolean }) => (
    <div className="card" data-s={b.status}>
      <div className="when">
        <b>{when(b.date)}</b>
        {b.callTime && <span className="meta num">{b.callTime}</span>}
        <span className="fee">{arNum(b.feeJOD)} دينار</span>
      </div>
      {b.brief && <p>{b.brief}</p>}
      {b.location && <p className="meta">📍 {b.location}</p>}
      {/* Only present once the client has paid. Its absence is the rule. */}
      {b.clientName && <p className="meta">للزبون: {b.clientName}</p>}
      {!act && <span className="pill">{BOOKING_LABEL[b.status].ar}</span>}
      {act && (
        <div className="acts">
          <button className="go" disabled={busy} onClick={() => respond(b.id, 'accepted')}>
            بقبل
          </button>
          <button className="no" disabled={busy} onClick={() => respond(b.id, 'declined')}>
            ما بقدر
          </button>
        </div>
      )}
    </div>
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
      <div className="avail">
        {ORDER.map((a) => (
          <button key={a} aria-pressed={avail === a} disabled={busy}
                  onClick={() => setAvailability(a)}>
            {AVAILABILITY_LABEL[a].ar}
          </button>
        ))}
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
