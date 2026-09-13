import { NextResponse } from 'next/server';
import { opsAuthed, sameOrigin } from '@/lib/ops/auth';
import { getTalent, patchTalent } from '@/lib/store/deals';
import { StorageUnconfigured } from '@/lib/store/firebase';
import {
  addImage, removeImage, setImageFlags, grantConsent, withdrawConsent,
} from '@/lib/store/media';
import { cleanAttributes } from '@/lib/data/talentFields';
import {
  PURPOSES, CONSENT_DEFAULT_MONTHS, addMonths, consentLive, type Purpose,
} from '@/lib/data/media';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The library: a person's photographs, their comp-card fields, and what they
 * agreed their photographs may be used for.
 *
 * Operator-only, like everything under `/api/ops`. Uploads arrive as a
 * multipart form, because that is what a phone's photo picker produces; every
 * other action is JSON.
 *
 * One rule is enforced here rather than trusted to the console: a photograph
 * cannot be put on the website unless that person's website consent is live
 * at the moment of the request. The public route re-checks it on every read,
 * so this is the early refusal, not the only lock.
 */

const refusalStatus = { 'not-found': 404, 'too-many': 409, 'too-large': 413, 'wrong-type': 415, empty: 400, 'not-an-image': 415 } as const;

export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'origin' }, { status: 403 });
  if (!(await opsAuthed())) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  try {
    // ── upload ────────────────────────────────────────────────────────────
    if ((req.headers.get('content-type') ?? '').startsWith('multipart/form-data')) {
      const form = await req.formData().catch(() => null);
      const talentId = String(form?.get('talentId') ?? '');
      const files = (form?.getAll('file') ?? []).filter((f): f is File => f instanceof File);
      if (!talentId || !files.length) return NextResponse.json({ error: 'malformed' }, { status: 400 });

      // No agreement to hold their photos, no photos. The console disables the
      // upload control in this state, but a disabled button is a suggestion —
      // the refusal that counts is this one, before a byte reaches the bucket.
      const who = await getTalent(talentId);
      if (!who) return NextResponse.json({ error: 'not-found' }, { status: 404 });
      if (!consentLive(who.consents, 'roster')) {
        return NextResponse.json({
          error: 'no-consent',
          detail: 'Record their consent to keep photos on file before uploading any.',
        }, { status: 409 });
      }

      // Sequential on purpose: each upload is its own transaction against the
      // per-person ceiling, and firing them in parallel from one request would
      // only make them race each other for no speed a phone would notice.
      const results = [];
      for (const f of files) {
        const r = await addImage(talentId, Buffer.from(await f.arrayBuffer()), f.type);
        results.push(r.ok ? { name: f.name, ok: true, id: r.image.id } : { name: f.name, ok: false, why: r.why });
        if (!r.ok && r.why === 'not-found') {
          return NextResponse.json({ error: 'not-found' }, { status: refusalStatus['not-found'] });
        }
      }
      const failed = results.filter((r) => !r.ok);
      return NextResponse.json({ ok: failed.length === 0, results }, { status: failed.length === results.length ? 400 : 200 });
    }

    const b = await req.json().catch(() => null);
    const talentId = String(b?.talentId ?? '');
    const t = talentId ? await getTalent(talentId) : null;
    if (!t) return NextResponse.json({ error: 'not-found' }, { status: 404 });
    const imageId = String(b?.imageId ?? '');

    switch (b?.action) {
      case 'remove':
        return (await removeImage(t.id, imageId))
          ? NextResponse.json({ ok: true })
          : NextResponse.json({ error: 'not-found' }, { status: 404 });

      case 'cover':
        return (await setImageFlags(t.id, imageId, { cover: true }))
          ? NextResponse.json({ ok: true })
          : NextResponse.json({ error: 'not-found' }, { status: 404 });

      case 'website': {
        const on = !!b.on;
        // Refused at the source, not only at render: "on the website" with no
        // live consent behind it is a record claiming a use nobody agreed to.
        if (on && !(consentLive(t.consents, 'roster') && consentLive(t.consents, 'website'))) {
          return NextResponse.json({
            error: 'no-consent',
            detail: 'This person has no live consent for the website. Record it first.',
          }, { status: 409 });
        }
        return (await setImageFlags(t.id, imageId, { onWebsite: on }))
          ? NextResponse.json({ ok: true })
          : NextResponse.json({ error: 'not-found' }, { status: 404 });
      }

      case 'attributes': {
        const attributes = cleanAttributes(t.discipline, b.attributes);
        await patchTalent(t.id, { attributes });
        return NextResponse.json({ ok: true, attributes });
      }

      case 'consent': {
        const purpose = String(b.purpose ?? '') as Purpose;
        if (!PURPOSES.includes(purpose)) {
          return NextResponse.json({ error: 'malformed', field: 'purpose' }, { status: 400 });
        }
        const evidence = String(b.evidence ?? '').trim().slice(0, 300);
        // Documented consent means a trail somebody can go and find. A button
        // press with nothing written against it is refused, not recorded.
        if (evidence.length < 8) {
          return NextResponse.json({
            error: 'malformed', field: 'evidence',
            detail: 'Say how it was given — "signed release, 12 Sep" — so it can be found later.',
          }, { status: 400 });
        }
        // Clients and website both widen `roster`, so neither is recordable on
        // its own. Otherwise a person could be "on the website" while PRAVDA has
        // no agreement to hold their photos at all.
        if (purpose !== 'roster' && !consentLive(t.consents, 'roster')) {
          return NextResponse.json({
            error: 'needs-roster',
            detail: 'Record consent to keep their photos on file first.',
          }, { status: 409 });
        }
        const now = new Date();
        const months = Math.min(Math.max(Number(b.months) || CONSENT_DEFAULT_MONTHS, 1), 36);
        await grantConsent(t.id, {
          purpose, evidence,
          grantedAt: now.toISOString(),
          expiresAt: addMonths(now, months).toISOString(),
        });
        return NextResponse.json({ ok: true });
      }

      case 'withdraw': {
        const purpose = String(b.purpose ?? '') as Purpose;
        if (!PURPOSES.includes(purpose)) {
          return NextResponse.json({ error: 'malformed', field: 'purpose' }, { status: 400 });
        }
        await withdrawConsent(t.id, purpose);
        return NextResponse.json({ ok: true });
      }
    }
    return NextResponse.json({ error: 'unknown-action' }, { status: 400 });
  } catch (e) {
    if (e instanceof StorageUnconfigured) {
      return NextResponse.json({
        error: 'storage-unconfigured',
        detail: 'Photos are not set up on this deployment yet. STORAGE_BUCKET is unset.',
      }, { status: 503 });
    }
    throw e;
  }
}
