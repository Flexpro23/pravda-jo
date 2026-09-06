import { NextResponse } from 'next/server';
import { currentTalent } from '@/lib/talent/auth';
import { sameOrigin } from '@/lib/ops/auth';
import { setAvailability } from '@/lib/store/deals';
import { AVAILABILITY_LABEL, type Availability } from '@/lib/data/deals';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'origin' }, { status: 403 });
  const me = await currentTalent();
  if (!me) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const b = await req.json().catch(() => null);
  const a = String(b?.availability ?? '') as Availability;
  // `hasOwnProperty`, not `in`: the value came off a JSON body, and
  // `'toString' in AVAILABILITY_LABEL` is true.
  if (!Object.prototype.hasOwnProperty.call(AVAILABILITY_LABEL, a)) {
    return NextResponse.json({ error: 'malformed' }, { status: 400 });
  }

  // When they are back, if they know. Empty clears it — coming back should not
  // leave a stale "away until the 3rd" hanging off an available person.
  const from = String(b?.availableFrom ?? '').trim();
  const ok = await setAvailability(me.id, a, from || undefined);
  if (!ok) return NextResponse.json({ error: 'bad-date' }, { status: 400 });

  return NextResponse.json({ ok: true, availability: a, availableFrom: from || null });
}
