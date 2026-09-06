import { NextResponse } from 'next/server';
import { opsAuthed, sameOrigin } from '@/lib/ops/auth';
import { normaliseHandle } from '@/lib/meta/discovery';
import { runRead, rerecommend } from '@/lib/teardown/run';
import {
  openClient, attachToClient, setBusinessName, advanceClient, forceClientStatus,
  linkDeal, clientForSheet,
} from '@/lib/store/clients';
import { VIDEO_JOD_PER, VERTICAL_LABEL } from '@/lib/data/concepts';
import { RETAINER_JOD } from '@/lib/data/deals';
import { listTalent } from '@/lib/store/deals';
import {
  getSheet, approveSheet, unapproveSheet, setSheetVertical, setCastOverride,
  setChosen, setCopyFor, setOffer, setRecommendations, markShareSent,
  type Sheet,
} from '@/lib/store/sheets';
import { winSheet } from '@/lib/store/convert';
import { waLink } from '@/lib/notify/whatsapp';
import { SITE } from '@/lib/data/company';
import type { CastPick } from '@/lib/teardown/recommend';
import type { Vertical } from '@/lib/data/concepts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const str = (v: unknown, max = 200) => String(v ?? '').trim().slice(0, max);

/**
 * The reference a client quotes back down the phone.
 *
 * Six characters of the share token, which is the only identifier that exists
 * on both sides of the conversation — he has the sheet, they have the link.
 */
const refOf = (shareToken: string) =>
  shareToken.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase();

/**
 * An approved sheet is a page somebody is holding. Editing it is not allowed.
 *
 * Approval mints an address and Khaled sends it; from that moment the document
 * and the thing the client has open are the same object. Every edit below —
 * the shortlist, the Arabic, the price, the cast, the vertical — used to apply
 * to an approved sheet exactly as it applied to a draft, so a client reading
 * the page could watch three ideas become two and a price change underneath
 * them, with no record anywhere that it had happened.
 *
 * The way back is `unapprove`, which is a deliberate act that kills the link
 * first. So this refuses rather than silently unapproving: it is 422 with the
 * name of the state, and the console's answer is one more button press.
 */
const assertDraft = (sheet: Sheet) =>
  sheet.status === 'approved'
    ? NextResponse.json({
      error: 'approved-locked',
      detail: 'This sheet is approved and a client may be reading it. Unapprove it first.',
    }, { status: 422 })
    : null;

export async function POST(req: Request) {
  // Checked before the session, because a cross-origin form post carrying a
  // valid cookie is precisely the request this refuses.
  if (!sameOrigin(req)) {
    return NextResponse.json({ error: 'origin' }, { status: 403 });
  }
  if (!(await opsAuthed())) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  const b = await req.json().catch(() => null);
  const action = str(b?.action, 20);

  // ── read a business, end to end ─────────────────────────────────────────
  if (action === 'run') {
    const handle = normaliseHandle(str(b?.handle, 40));
    if (!handle) return NextResponse.json({ error: 'handle' }, { status: 400 });

    // The same function the public form runs. One path reads Meta, computes and
    // stores, so a handle typed here and a handle submitted there can never
    // produce two different reports of the same business.
    const run = await runRead({
      handle,
      website: str(b?.website, 300),
      vertical: (str(b?.vertical, 12) || null) as Vertical | null,
    });
    if (!run.ok) return NextResponse.json({ error: run.reason }, { status: run.status });

    // A handle typed into the console is still a business somebody will be
    // talked to about, so it gets an account like any other — with no contact
    // details, because nobody gave us any. Khaled fills those in when he has
    // them, and until then the account is the place they will go. The contact
    // keys are omitted rather than sent as '' so a blank console field can
    // never be mistaken for a value worth writing.
    const contactName = str(b?.contactName, 120);
    const contactPhone = str(b?.contactPhone, 40);
    await openClient({
      handle,
      ...(contactName ? { contactName } : {}),
      ...(contactPhone ? { contactPhone } : {}),
      website: run.sheet.website,
      lang: 'ar',
      source: 'operator',
    }).catch(() => null);
    await attachToClient(handle, 'sheet', run.sheet.token).catch(() => {});
    if (run.sheet.clientName) await setBusinessName(handle, run.sheet.clientName).catch(() => {});

    // The new sheet is filed underneath whatever the account already is.
    // `advanceClient` is what makes that true: a client Khaled has already
    // sent, won or lost keeps that status, and only an account still waiting on
    // a first sheet is moved to `ready`. A console re-read can never drag a
    // `sent`/`won` client back into the queue as work to do.
    await advanceClient(handle, 'ready').catch(() => {});

    return NextResponse.json({
      ok: true, token: run.sheet.token,
      posts: run.sheet.signals.posts, site: run.site,
      siteProblem: run.siteProblem,
      findings: run.sheet.findings.findings.length,
      verticalGuess: run.sheet.verticalGuess,
      rosterState: run.sheet.rosterState,
      truncated: run.truncated,
    });
  }

  // ── everything else acts on an existing sheet ───────────────────────────
  const token = str(b?.token, 64);
  const sheet = await getSheet(token);
  if (!sheet) return NextResponse.json({ error: 'not-found' }, { status: 404 });

  if (action === 'choose') {
    const locked = assertDraft(sheet);
    if (locked) return locked;

    const offered = new Set(sheet.recommendations.map((r) => r.conceptN));
    const chosen: number[] = Array.isArray(b?.chosen)
      ? [...new Set<number>(b.chosen.map((x: unknown) => Number(x)))]
        .filter((n: number) => offered.has(n)).slice(0, 3)
      : [];
    await setChosen(token, chosen);
    return NextResponse.json({ ok: true, chosen });
  }

  /**
   * Casting, materialised.
   *
   * Every id is checked here and the answer is written down as names, because
   * the alternative — storing ids and resolving them at render time — means the
   * page a client is holding changes the day somebody edits a talent record,
   * and means four different readers each decide for themselves what a missing
   * person looks like. The whole patch is rejected on one bad id rather than
   * partially applied: a half-cast concept is a worse state than the one it
   * replaced.
   */
  if (action === 'cast') {
    const locked = assertDraft(sheet);
    if (locked) return locked;

    const n = Number(b?.conceptN);
    const rec = sheet.recommendations.find((r) => r.conceptN === n);
    if (!rec) return NextResponse.json({ error: 'bad-cast', detail: 'no such concept' }, { status: 400 });

    const ids = Array.isArray(b?.talentIds)
      ? [...new Set(b.talentIds.map((x: unknown) => str(x, 50)).filter(Boolean))] as string[]
      : [];

    // An empty list is "go back to what the engine picked", not "cast nobody".
    if (!ids.length) {
      await setCastOverride(token, n, []);
      return NextResponse.json({ ok: true, cast: [] });
    }

    const roster = await listTalent();
    const byId = new Map(roster.map((t) => [t.id, t]));

    // What this idea actually has room for. A videographer, the models the
    // concept names, and a voice when it needs one — anyone else is not a slot
    // on this day however bookable they are.
    const room: Record<string, number> = {
      videographer: Math.max(1, rec.cast.filter((c) => c.discipline === 'videographer').length),
      model: rec.models,
      voiceover: rec.needsVoice ? 1 : 0,
    };
    const used: Record<string, number> = { videographer: 0, model: 0, voiceover: 0 };

    const cast: CastPick[] = [];
    for (const id of ids) {
      const t = byId.get(id);
      if (!t) return NextResponse.json({ error: 'bad-cast', detail: `${id}: not on the roster` }, { status: 400 });
      if (!t.active) return NextResponse.json({ error: 'bad-cast', detail: `${t.name.en}: not active` }, { status: 400 });
      if (!(t.dayRateJOD > 0)) return NextResponse.json({ error: 'bad-cast', detail: `${t.name.en}: no day rate` }, { status: 400 });
      if (t.placeholder) return NextResponse.json({ error: 'bad-cast', detail: `${t.name.en}: a worked example, not a person` }, { status: 400 });

      const slot = room[t.discipline] ?? 0;
      if (used[t.discipline] >= slot) {
        return NextResponse.json({
          error: 'bad-cast',
          detail: `${t.name.en}: #${n} has no ${t.discipline} slot left`,
        }, { status: 400 });
      }
      used[t.discipline] += 1;
      cast.push({
        talentId: t.id,
        name: t.name,
        discipline: t.discipline,
        // The engine's `why` is its reasoning. This one is the truth: a person
        // decided, and the sheet should not pretend otherwise.
        why: { ar: 'اختيار المشغّل', en: 'chosen by the operator' },
      });
    }

    await setCastOverride(token, n, cast);
    return NextResponse.json({ ok: true, cast });
  }

  if (action === 'copy') {
    const locked = assertDraft(sheet);
    if (locked) return locked;

    // Checked against the five the sheet actually offers, like `cast` already
    // was. Without it the console could write Arabic under concept 97 — a key
    // no renderer ever reads, so the operator's work simply disappeared, and
    // a typo in a form field looked exactly like a successful save.
    const n = Number(b?.conceptN);
    if (!sheet.recommendations.some((r) => r.conceptN === n)) {
      return NextResponse.json({ error: 'bad-concept', detail: `no concept #${n} on this sheet` }, { status: 400 });
    }

    await setCopyFor(token, n, {
      name: str(b?.name, 120) || undefined,
      hook: str(b?.hook, 600) || undefined,
    });
    return NextResponse.json({ ok: true });
  }

  if (action === 'offer') {
    const locked = assertDraft(sheet);
    if (locked) return locked;

    const videos = Math.max(1, Math.min(60, Number(b?.videos) || 1));
    // He may discount, but not below cost and not into a negative.
    const pricePerVideo = Math.max(1, Math.min(2000, Number(b?.pricePerVideo) || VIDEO_JOD_PER));
    const ads = !!b?.ads;
    const adsMonthlyJOD = Math.max(0, Math.min(9999, Number(b?.adsMonthlyJOD) || RETAINER_JOD));
    await setOffer(token, {
      videos, pricePerVideo, ads, adsMonthlyJOD,
      // Computed here so the stored total can never disagree with its parts.
      totalJOD: videos * pricePerVideo,
      note: str(b?.note, 400) || undefined,
    });
    return NextResponse.json({ ok: true });
  }

  /**
   * The operator says what the business is, and the ideas follow.
   *
   * No Meta call: the findings are stored and they are what the recommender
   * reads. What does move is the shortlist, so anything he had already chosen
   * that is no longer on offer is dropped rather than left pointing at a
   * concept the sheet no longer contains.
   */
  if (action === 'vertical') {
    const locked = assertDraft(sheet);
    if (locked) return locked;

    const raw = str(b?.vertical, 12);
    const vertical = Object.prototype.hasOwnProperty.call(VERTICAL_LABEL, raw)
      ? (raw as Vertical) : null;
    if (raw && !vertical) {
      return NextResponse.json({ error: 'bad-vertical' }, { status: 400 });
    }

    await setSheetVertical(token, vertical);
    const roster = await listTalent().catch(() => []);
    const next = rerecommend({ ...sheet, vertical: vertical ?? undefined }, roster);
    const offered = new Set(next.recommendations.map((r) => r.conceptN));
    const chosen = sheet.chosen.filter((n) => offered.has(n));

    // Three fields, not the whole document: the Arabic he wrote and the offer
    // he composed are not part of this edit and must not be carried backwards
    // by a copy of the sheet read before either of them was saved.
    await setRecommendations(token, next.recommendations, chosen, next.rosterState);
    return NextResponse.json({
      ok: true, recommendations: next.recommendations, chosen,
    });
  }

  /**
   * Approve, and mint the address. That is all it does.
   *
   * It deliberately does not touch the client's status: approving is Khaled
   * making a page, not Khaled sending one, and a status of `sent` written by a
   * button nobody pressed is a lie the whole follow-up queue then rests on.
   */
  if (action === 'approve') {
    const r = await approveSheet(token);
    return r.ok
      ? NextResponse.json({ ok: true, shareToken: r.shareToken })
      : NextResponse.json({ error: r.why, detail: r.detail }, { status: 422 });
  }

  if (action === 'unapprove') {
    await unapproveSheet(token);
    // Back to something only Khaled can see, so the account says so again.
    // Forced rather than advanced: this is a person walking a client backwards
    // on purpose, which is exactly the case `advanceClient` refuses.
    await forceClientStatus(sheet.handle, 'ready').catch(() => {});
    return NextResponse.json({ ok: true });
  }

  /**
   * The message he will send, composed here rather than in the browser.
   *
   * Arabic, naming the business, carrying the link and the reference they will
   * quote back. `link` is null when there is no usable number on the account —
   * the console says so and points at the client page, which is where a phone
   * number is actually fixed.
   */
  if (action === 'compose-share') {
    if (!sheet.shareToken) {
      return NextResponse.json({ error: 'not-approved' }, { status: 422 });
    }
    const client = await clientForSheet(token).catch(() => null);
    const url = `${SITE}/s/${sheet.shareToken}`;
    const ref = refOf(sheet.shareToken);
    const name = client?.contactName ?? '';
    const phone = client?.contactPhone ?? '';

    const text = [
      `${name ? `مرحبا ${name}،` : 'مرحبا،'} معكم برافدا.`,
      '',
      `قرأنا حساب ${sheet.clientName} كله، وجهزنا صفحة فيها اللي لقيناه، وتلات أفكار، والسعر.`,
      url,
      '',
      `رقم المرجع: PRV-${ref}`,
    ].join('\n');

    return NextResponse.json({
      ok: true, text, link: phone ? waLink(phone, text) : null, phone, name,
    });
  }

  /**
   * He sent it. A separate press, because sending is a human act.
   *
   * The account moves to `sent` here and nowhere else, so the follow-up queue
   * counts messages that were actually sent rather than links that were minted.
   */
  if (action === 'mark-share-sent') {
    const sentAt = await markShareSent(token);
    if (!sentAt) return NextResponse.json({ error: 'not-found' }, { status: 404 });
    await advanceClient(sheet.handle, 'sent').catch(() => {});
    return NextResponse.json({ ok: true, sentAt });
  }

  // They said yes. The sheet becomes the job, carrying its own numbers with it
  // rather than being read off a screen and typed into another one.
  if (action === 'won') {
    const r = await winSheet(token);
    // The account is where the deal is found afterwards. Written after the deal
    // exists, so an account can never point at a job that was never created.
    if (r.ok) {
      const c = await clientForSheet(token).catch(() => null);
      await linkDeal(c?.id ?? sheet.handle, r.dealId).catch(() => {});
    }
    return r.ok
      ? NextResponse.json({ ok: true, dealId: r.dealId, created: r.created })
      : NextResponse.json({ error: r.why, detail: r.detail }, { status: 422 });
  }

  return NextResponse.json({ error: 'unknown-action' }, { status: 400 });
}
