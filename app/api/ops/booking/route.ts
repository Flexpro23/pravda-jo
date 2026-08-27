import { NextResponse } from 'next/server';
import { opsAuthed } from '@/lib/ops/auth';
import { offerBooking, markBooking } from '@/lib/store/deals';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!(await opsAuthed())) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  const b = await req.json().catch(() => null);

  if (b?.action === 'offer') {
    if (!b.dealId || !b.talentId || !b.date) {
      return NextResponse.json({ error: 'malformed' }, { status: 400 });
    }
    // Only the fields a booking may hold are passed on; there is deliberately
    // no route by which the client's price could travel with it.
    const booking = await offerBooking({
      dealId: String(b.dealId), talentId: String(b.talentId), date: String(b.date),
      feeJOD: Number(b.feeJOD) || 0, brief: String(b.brief ?? ''),
      location: b.location || undefined, callTime: b.callTime || undefined,
      origin: new URL(req.url).origin,
    });
    return NextResponse.json({
      ok: true, id: booking.id,
      notified: !!booking.notifiedAt, note: booking.notifyNote,
    });
  }

  if (b?.action === 'mark') {
    if (!b.id || !b.status) return NextResponse.json({ error: 'malformed' }, { status: 400 });
    await markBooking(String(b.id), b.status);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'unknown-action' }, { status: 400 });
}
