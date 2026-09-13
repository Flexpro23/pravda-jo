import { NextResponse } from 'next/server';
import { opsAuthed, sameOrigin } from '@/lib/ops/auth';
import { FieldValue } from 'firebase-admin/firestore';
import {
  saveTalent, patchTalent, getTalent, newPassCode, hashCode, listTalent,
  bumpSessionEpoch,
} from '@/lib/store/deals';
import type { Talent, TalentDiscipline } from '@/lib/data/deals';
import { DISCIPLINE_RATE } from '@/lib/data/deals';
import { cleanAttributes } from '@/lib/data/talentFields';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

/**
 * Tags arrive either as a real array or as the comma-separated line the console
 * types them on. Both land as the same thing here rather than at two call sites.
 */
const tagList = (v: unknown): string[] | undefined => {
  if (v === undefined || v === null) return undefined;
  const raw = Array.isArray(v) ? v.map(String) : String(v).split(',');
  return [...new Set(raw.map((s) => s.trim()).filter(Boolean))].slice(0, 20);
};

const isIsoDate = (s: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(+d) && d.toISOString().slice(0, 10) === s;
};

const text = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);

export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'origin' }, { status: 403 });
  if (!(await opsAuthed())) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  const b = await req.json().catch(() => null);

  if (b?.action === 'create') {
    const en = String(b.nameEn ?? '').trim();
    const ar = String(b.nameAr ?? '').trim();
    const discipline = String(b.discipline ?? '') as TalentDiscipline;
    // `hasOwnProperty`, not `in`: this arrives from a JSON body, and
    // `'constructor' in DISCIPLINE_RATE` is true — which would have let a
    // person onto the roster at a day rate of `undefined`.
    if (!en || !ar || !Object.prototype.hasOwnProperty.call(DISCIPLINE_RATE, discipline)) {
      return NextResponse.json({ error: 'malformed' }, { status: 400 });
    }
    const existing = await listTalent();
    const taken = new Set(existing.map((t) => t.id));
    // Two people can share a name; a document id cannot. The old suffix was
    // the roster length, which is not unique — add two Ahmads, delete one, add
    // a third, and `ahmad-3` collides with a person already on the roster.
    // `saveTalent` merges, so a collision would not error: it would silently
    // overwrite somebody's phone number, day rate and pass-code hash with
    // another person's. Count up until the id is actually free.
    const base = slug(en) || 'talent';
    let id = base;
    for (let i = 2; taken.has(id); i++) id = `${base}-${i}`;

    // The code is returned once, here, and never stored in the clear. If it is
    // lost it is reissued rather than recovered.
    const code = newPassCode();
    const t: Talent = {
      id, name: { ar, en }, discipline,
      dayRateJOD: Number(b.dayRateJOD) || DISCIPLINE_RATE[discipline],
      phone: String(b.phone ?? '').trim(),
      availability: 'available',
      tags: tagList(b.tags),
      portfolioUrl: text(b.portfolioUrl, 300) || undefined,
      legalName: text(b.legalName, 120) || undefined,
      idNumber: text(b.idNumber, 40) || undefined,
      note: text(b.note, 1000) || undefined,
      passCodeHash: hashCode(code),
      sessionEpoch: 0,
      active: true,
      ...(b.placeholder !== undefined ? { placeholder: !!b.placeholder } : {}),
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
    // A new code means the old one is gone, so the sessions it opened go with
    // it. This is a change from the old reissue, which left them signed in —
    // the console must say so, because "lost phone" is the reason people ask.
    const epoch = await bumpSessionEpoch(t.id);
    return NextResponse.json({ ok: true, code, signedOut: true, sessionEpoch: epoch });
  }

  if (b?.action === 'signout') {
    const t = await getTalent(String(b.id ?? ''));
    if (!t) return NextResponse.json({ error: 'not-found' }, { status: 404 });
    // Their code still works; every device already holding a cookie does not.
    const epoch = await bumpSessionEpoch(t.id);
    return NextResponse.json({ ok: true, sessionEpoch: epoch });
  }

  if (b?.action === 'update') {
    const t = await getTalent(String(b.id ?? ''));
    if (!t) return NextResponse.json({ error: 'not-found' }, { status: 404 });

    // A discipline that is not on the rate card is somebody who can be hired
    // for nothing a day, so it is refused rather than coerced.
    let discipline = t.discipline;
    if (b.discipline !== undefined) {
      const d = String(b.discipline) as TalentDiscipline;
      if (!Object.prototype.hasOwnProperty.call(DISCIPLINE_RATE, d)) {
        return NextResponse.json({ error: 'malformed', field: 'discipline' }, { status: 400 });
      }
      discipline = d;
    }

    if (b.availableFrom !== undefined) {
      const v = text(b.availableFrom, 10);
      if (v && !isIsoDate(v)) {
        return NextResponse.json({ error: 'malformed', field: 'availableFrom' }, { status: 400 });
      }
    }

    const en = b.nameEn !== undefined ? text(b.nameEn, 80) : t.name.en;
    const ar = b.nameAr !== undefined ? text(b.nameAr, 80) : t.name.ar;
    if (!en || !ar) return NextResponse.json({ error: 'malformed', field: 'name' }, { status: 400 });

    /**
     * A field the console cleared has to be deleted, not omitted.
     *
     * The store runs with `ignoreUndefinedProperties`, so `field: undefined`
     * inside a merging `set` is not "remove this" — it is "say nothing about
     * this", and the old value survives. So emptying the portfolio box, the
     * legal name or the ID number saved successfully and changed nothing, and
     * a provider who asked us to take their ID number off the record kept it.
     * Only `FieldValue.delete()` actually clears a key.
     */
    const optional = (v: unknown, max: number) => text(v, max) || FieldValue.delete();

    // A targeted update rather than a whole reconstructed person: a field this
    // request never mentioned is not written at all, so two operators editing
    // different halves of the same record cannot undo each other.
    const patch: Record<string, unknown> = {
      name: { ar, en },
      discipline,
      // A discipline change re-cleans the comp card against the new trade, so
      // somebody moved from model to voiceover does not keep a height and a
      // shoe size that no field would ever render or let anyone correct.
      ...(discipline !== t.discipline && t.attributes
        ? { attributes: cleanAttributes(discipline, t.attributes) } : {}),
      ...(b.dayRateJOD !== undefined ? { dayRateJOD: Number(b.dayRateJOD) } : {}),
      ...(b.phone !== undefined ? { phone: String(b.phone) } : {}),
      ...(b.active !== undefined ? { active: !!b.active } : {}),
      ...(b.placeholder !== undefined ? { placeholder: !!b.placeholder } : {}),
      ...(b.tags !== undefined ? { tags: tagList(b.tags) ?? FieldValue.delete() } : {}),
      ...(b.availableFrom !== undefined
        ? { availableFrom: text(b.availableFrom, 10) || FieldValue.delete() } : {}),
      ...(b.portfolioUrl !== undefined
        ? { portfolioUrl: optional(b.portfolioUrl, 300) } : {}),
      ...(b.legalName !== undefined
        ? { legalName: optional(b.legalName, 120) } : {}),
      ...(b.idNumber !== undefined ? { idNumber: optional(b.idNumber, 40) } : {}),
      ...(b.note !== undefined ? { note: optional(b.note, 1000) } : {}),
    };
    await patchTalent(t.id, patch);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'unknown-action' }, { status: 400 });
}
