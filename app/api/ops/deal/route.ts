import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { opsAuthed } from '@/lib/ops/auth';
import { saveDeal, advanceDeal, getDeal } from '@/lib/store/deals';
import type { Deal, DealStatus } from '@/lib/data/deals';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!(await opsAuthed())) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  const b = await req.json().catch(() => null);

  if (b?.action === 'advance') {
    if (!b.id || !b.status) return NextResponse.json({ error: 'malformed' }, { status: 400 });
    await advanceDeal(String(b.id), b.status as DealStatus);
    return NextResponse.json({ ok: true });
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
