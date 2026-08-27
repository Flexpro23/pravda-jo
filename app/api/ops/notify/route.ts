import { NextResponse } from 'next/server';
import { opsAuthed } from '@/lib/ops/auth';
import { store } from '@/lib/store/firebase';
import { bookingsForDeal, getTalent } from '@/lib/store/deals';
import { compose, waLink } from '@/lib/notify/whatsapp';

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
 */
export async function POST(req: Request) {
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

  const text = compose(booking, talent, new URL(req.url).origin);
  return NextResponse.json({ text, link: waLink(talent.phone, text), name: talent.name.en });
}
