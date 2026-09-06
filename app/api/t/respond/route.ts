import { NextResponse } from 'next/server';
import { currentTalent } from '@/lib/talent/auth';
import { sameOrigin } from '@/lib/ops/auth';
import { respondToBooking } from '@/lib/store/deals';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'origin' }, { status: 403 });
  const me = await currentTalent();
  if (!me) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const b = await req.json().catch(() => null);
  const status = b?.status;
  if (status !== 'accepted' && status !== 'declined') {
    return NextResponse.json({ error: 'malformed' }, { status: 400 });
  }
  // Optional on purpose. A provider who taps "ما بقدر" and closes the phone has
  // still answered; the reason is a courtesy to whoever re-casts the day, not a
  // form standing between them and saying no.
  const reason = String(b?.reason ?? '').trim().slice(0, 200);

  // Scoped by the session's own id, not by anything the caller sent, so one
  // provider cannot answer another's offer by guessing a booking id.
  const ok = await respondToBooking(String(b?.id ?? ''), me.id, status, reason || undefined);
  return ok
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: 'not-yours-or-settled' }, { status: 409 });
}
