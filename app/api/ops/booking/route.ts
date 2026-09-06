import { NextResponse } from 'next/server';
import { opsAuthed, sameOrigin } from '@/lib/ops/auth';
import { offerBooking, markBooking } from '@/lib/store/deals';
import { BOOKING_LABEL, type BookingStatus } from '@/lib/data/deals';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Why an offer was refused, in words a console can put on screen unedited. */
const REFUSAL: Record<'placeholder' | 'inactive' | 'no-talent', string> = {
  placeholder: 'That is a placeholder person, not somebody who can be booked.',
  inactive: 'That person is not active on the roster.',
  'no-talent': 'No such person on the roster.',
};

export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'origin' }, { status: 403 });
  if (!(await opsAuthed())) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  const b = await req.json().catch(() => null);

  if (b?.action === 'offer') {
    if (!b.dealId || !b.talentId || !b.date) {
      return NextResponse.json({ error: 'malformed' }, { status: 400 });
    }
    // Only the fields a booking may hold are passed on; there is deliberately
    // no route by which the client's price could travel with it.
    const r = await offerBooking({
      dealId: String(b.dealId), talentId: String(b.talentId), date: String(b.date),
      feeJOD: Number(b.feeJOD) || 0, brief: String(b.brief ?? ''),
      location: b.location || undefined, callTime: b.callTime || undefined,
      rescheduledFrom: b.rescheduledFrom ? String(b.rescheduledFrom) : undefined,
      force: !!b.force,
      origin: new URL(req.url).origin,
    });

    if (!r.ok) {
      // A clash is a question, not a fault: the same POST with `force: true`
      // is the answer. Anything else is a refusal the operator cannot argue
      // with, so it comes back as a plain 400 with the sentence to show.
      if (r.reason === 'conflict') {
        return NextResponse.json({
          error: 'conflict', conflict: r.conflict,
          message: `They already hold an ${BOOKING_LABEL[r.conflict.status].en.toLowerCase()} day on ${b.date}.`,
        }, { status: 409 });
      }
      return NextResponse.json({ error: r.reason, message: REFUSAL[r.reason] }, { status: 400 });
    }

    return NextResponse.json({
      ok: true, id: r.booking.id,
      notified: !!r.booking.notifiedAt, note: r.booking.notifyNote,
      conflictWith: r.booking.conflictWith,
    });
  }

  if (b?.action === 'mark') {
    if (!b.id || !b.status) return NextResponse.json({ error: 'malformed' }, { status: 400 });
    const status = String(b.status) as BookingStatus;
    // `hasOwnProperty`, not `in`: this string came off a JSON body, and
    // `'toString' in BOOKING_LABEL` is true — which would put an inherited
    // Object.prototype key through as a booking status.
    if (!Object.prototype.hasOwnProperty.call(BOOKING_LABEL, status)) {
      return NextResponse.json({ error: 'malformed' }, { status: 400 });
    }
    // The transition table is the authority, not the button that was tapped.
    const ok = await markBooking(String(b.id), status);
    return ok
      ? NextResponse.json({ ok: true })
      : NextResponse.json({
        error: 'illegal-transition',
        message: `A booking cannot move to ${BOOKING_LABEL[status].en.toLowerCase()} from where it is.`,
      }, { status: 409 });
  }

  return NextResponse.json({ error: 'unknown-action' }, { status: 400 });
}
