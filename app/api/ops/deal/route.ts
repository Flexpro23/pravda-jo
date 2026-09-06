import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { opsAuthed, sameOrigin } from '@/lib/ops/auth';
import { saveDeal, advanceDeal, getDeal } from '@/lib/store/deals';
import { DEAL_LABEL, DEAL_TRANSITIONS, type Deal, type DealStatus } from '@/lib/data/deals';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'origin' }, { status: 403 });
  if (!(await opsAuthed())) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  const b = await req.json().catch(() => null);

  if (b?.action === 'advance') {
    if (!b.id || !b.status) return NextResponse.json({ error: 'malformed' }, { status: 400 });

    // `hasOwnProperty`, not `in`: the status arrives from a JSON body, and
    // `'constructor' in DEAL_TRANSITIONS` is true.
    const status = String(b.status) as DealStatus;
    if (!Object.prototype.hasOwnProperty.call(DEAL_TRANSITIONS, status)) {
      return NextResponse.json({ error: 'malformed', field: 'status' }, { status: 400 });
    }

    const lostReason = typeof b.lostReason === 'string' ? b.lostReason.trim().slice(0, 200) : undefined;
    const moved = await advanceDeal(String(b.id), status, lostReason);
    if (moved) return NextResponse.json({ ok: true });

    // Either there is no such deal or the table refused the move. Told apart
    // here so the console can say which, rather than showing "did not work".
    const deal = await getDeal(String(b.id));
    if (!deal) return NextResponse.json({ error: 'not-found' }, { status: 404 });
    return NextResponse.json({
      error: 'illegal-transition',
      message: `A deal cannot move to ${DEAL_LABEL[status].toLowerCase()} from ${DEAL_LABEL[deal.status].toLowerCase()}.`,
    }, { status: 409 });
  }

  if (b?.action === 'create') {
    const now = new Date().toISOString();
    const deal: Deal = {
      id: randomBytes(9).toString('base64url'),
      teardownToken: b.teardownToken || undefined,
      clientName: String(b.clientName ?? '').trim(),
      clientHandle: b.clientHandle || undefined,
      clientPhone: b.clientPhone || undefined,
      concepts: Array.isArray(b.concepts) ? b.concepts : [],
      clientTotalJOD: Number(b.clientTotalJOD) || 0,
      retainerJOD: b.retainerJOD ? Number(b.retainerJOD) : undefined,
      status: 'proposed',
      createdAt: now, updatedAt: now,
    };
    if (!deal.clientName) return NextResponse.json({ error: 'client-name' }, { status: 400 });
    await saveDeal(deal);
    return NextResponse.json({ ok: true, id: deal.id });
  }

  if (b?.action === 'update') {
    const existing = await getDeal(String(b.id ?? ''));
    if (!existing) return NextResponse.json({ error: 'not-found' }, { status: 404 });
    await saveDeal({
      ...existing,
      clientTotalJOD: b.clientTotalJOD !== undefined ? Number(b.clientTotalJOD) : existing.clientTotalJOD,
      retainerJOD: b.retainerJOD !== undefined ? Number(b.retainerJOD) || undefined : existing.retainerJOD,
      note: b.note !== undefined ? String(b.note) : existing.note,
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'unknown-action' }, { status: 400 });
}
