import { NextResponse } from 'next/server';
import { opsAuthed, sameOrigin } from '@/lib/ops/auth';
import { store } from '@/lib/store/firebase';
import { bookingsForDeal, getTalent, recordReminder } from '@/lib/store/deals';
import { compose, composeReminder, waLink } from '@/lib/notify/whatsapp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const P = process.env.FIRESTORE_COLLECTION_PREFIX ?? '';

/**
 * The by-hand path.
 *
 * Returns the exact message and a wa.me link for a booking nobody has been told
 * about, and marks it told once the operator confirms they sent it. Two people
 * running a studio this way is a working system; the automatic sender simply
 * removes the tap once a WhatsApp Business number exists.
 *
 * The reminder works the same way and for the same reason: there is no queue
 * behind it and this route should not pretend there is. "Send reminder" is an
 * operator deciding, the day before or the morning of, that this particular
 * person needs a nudge — and `mark-reminded` records that they did.
 */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'origin' }, { status: 403 });
  if (!(await opsAuthed())) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  const b = await req.json().catch(() => null);
  const dealId = String(b?.dealId ?? '');
  const id = String(b?.id ?? '');

  const booking = (await bookingsForDeal(dealId)).find((x) => x.id === id);
  if (!booking) return NextResponse.json({ error: 'not-found' }, { status: 404 });
  const talent = await getTalent(booking.talentId);
  if (!talent) return NextResponse.json({ error: 'no-talent' }, { status: 404 });

  if (b?.action === 'mark-sent') {
    await store().collection(`${P}bookings`).doc(id)
      .update({ notifiedAt: new Date().toISOString(), notifyNote: 'sent by hand' });
    return NextResponse.json({ ok: true });
  }

  if (b?.action === 'mark-reminded') {
    const ok = await recordReminder(id);
    return ok
      ? NextResponse.json({ ok: true })
      : NextResponse.json({ error: 'not-found' }, { status: 404 });
  }

  const origin = new URL(req.url).origin;
  const text = b?.action === 'remind'
    ? composeReminder(booking, talent, origin)
    : compose(booking, talent, origin);
  return NextResponse.json({ text, link: waLink(talent.phone, text), name: talent.name.en });
}
