import { NextResponse } from 'next/server';
import { currentTalent } from '@/lib/talent/auth';
import { setAvailability } from '@/lib/store/deals';
import { AVAILABILITY_LABEL, type Availability } from '@/lib/data/deals';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const me = await currentTalent();
  if (!me) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const b = await req.json().catch(() => null);
  const a = String(b?.availability ?? '') as Availability;
  if (!(a in AVAILABILITY_LABEL)) return NextResponse.json({ error: 'malformed' }, { status: 400 });

  await setAvailability(me.id, a);
  return NextResponse.json({ ok: true, availability: a });
}
