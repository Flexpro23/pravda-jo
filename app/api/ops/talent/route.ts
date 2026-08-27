import { NextResponse } from 'next/server';
import { opsAuthed } from '@/lib/ops/auth';
import { saveTalent, getTalent, newPassCode, hashCode, listTalent } from '@/lib/store/deals';
import type { Talent, TalentDiscipline } from '@/lib/data/deals';
import { DISCIPLINE_RATE } from '@/lib/data/deals';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

export async function POST(req: Request) {
  if (!(await opsAuthed())) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  const b = await req.json().catch(() => null);

  if (b?.action === 'create') {
    const en = String(b.nameEn ?? '').trim();
    const ar = String(b.nameAr ?? '').trim();
    const discipline = String(b.discipline ?? '') as TalentDiscipline;
    if (!en || !ar || !(discipline in DISCIPLINE_RATE)) {
      return NextResponse.json({ error: 'malformed' }, { status: 400 });
    }
    const existing = await listTalent();
    let id = slug(en);
    // Two people can share a name; a document id cannot.
    if (existing.some((t) => t.id === id)) id = `${id}-${existing.length + 1}`;

    // The code is returned once, here, and never stored in the clear. If it is
    // lost it is reissued rather than recovered.
    const code = newPassCode();
    const t: Talent = {
      id, name: { ar, en }, discipline,
      dayRateJOD: Number(b.dayRateJOD) || DISCIPLINE_RATE[discipline],
      phone: String(b.phone ?? '').trim(),
      availability: 'available',
      passCodeHash: hashCode(code),
      active: true,
      createdAt: new Date().toISOString(),
    };
    await saveTalent(t);
    return NextResponse.json({ ok: true, id, code });
  }

  if (b?.action === 'reissue') {
    const t = await getTalent(String(b.id ?? ''));
    if (!t) return NextResponse.json({ error: 'not-found' }, { status: 404 });
    const code = newPassCode();
    await saveTalent({ ...t, passCodeHash: hashCode(code) });
    return NextResponse.json({ ok: true, code });
  }

  if (b?.action === 'update') {
    const t = await getTalent(String(b.id ?? ''));
    if (!t) return NextResponse.json({ error: 'not-found' }, { status: 404 });
    await saveTalent({
      ...t,
      dayRateJOD: b.dayRateJOD !== undefined ? Number(b.dayRateJOD) : t.dayRateJOD,
      phone: b.phone !== undefined ? String(b.phone) : t.phone,
      active: b.active !== undefined ? !!b.active : t.active,
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'unknown-action' }, { status: 400 });
}
