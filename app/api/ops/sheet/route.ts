import { NextResponse } from 'next/server';
import { opsAuthed } from '@/lib/ops/auth';
import { normaliseHandle } from '@/lib/meta/discovery';
import { runRead } from '@/lib/teardown/run';
import {
  openClient, attachToClient, setBusinessName, setClientStatus, linkDeal,
  clientForSheet,
} from '@/lib/store/clients';
import { VIDEO_JOD_PER } from '@/lib/data/concepts';
import { RETAINER_JOD } from '@/lib/data/deals';
import { saveSheet, getSheet, approveSheet, unapproveSheet } from '@/lib/store/sheets';
import { winSheet } from '@/lib/store/convert';
import type { Vertical } from '@/lib/data/concepts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const str = (v: unknown, max = 200) => String(v ?? '').trim().slice(0, max);

export async function POST(req: Request) {
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
    // them, and until then the account is the place they will go.
    await openClient({
      handle,
      contactName: str(b?.contactName, 120),
      contactPhone: str(b?.contactPhone, 40),
      website: run.sheet.website,
      lang: 'ar',
      source: 'operator',
    }).catch(() => null);
    await attachToClient(handle, 'sheet', run.sheet.token).catch(() => {});
    if (run.sheet.clientName) await setBusinessName(handle, run.sheet.clientName).catch(() => {});
    await setClientStatus(handle, 'ready').catch(() => {});

    return NextResponse.json({
      ok: true, token: run.sheet.token,
      posts: run.sheet.signals.posts, site: run.site,
      siteProblem: run.siteProblem,
      findings: run.sheet.findings.findings.length,
    });
  }

  // ── everything else acts on an existing sheet ───────────────────────────
  const token = str(b?.token, 64);
  const sheet = await getSheet(token);
  if (!sheet) return NextResponse.json({ error: 'not-found' }, { status: 404 });

  if (action === 'choose') {
    const offered = new Set(sheet.recommendations.map((r) => r.conceptN));
    const chosen: number[] = Array.isArray(b?.chosen)
      ? [...new Set<number>(b.chosen.map((x: unknown) => Number(x)))]
        .filter((n: number) => offered.has(n)).slice(0, 3)
      : [];
    await saveSheet({ ...sheet, chosen });
    return NextResponse.json({ ok: true, chosen });
  }

  if (action === 'cast') {
    const n = Number(b?.conceptN);
    const ids = Array.isArray(b?.talentIds) ? b.talentIds.map((x: unknown) => str(x, 50)) : [];
    await saveSheet({
      ...sheet,
      castOverrides: { ...(sheet.castOverrides ?? {}), [String(n)]: ids },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === 'copy') {
    const n = String(Number(b?.conceptN));
    await saveSheet({
      ...sheet,
      copy: {
        ...(sheet.copy ?? {}),
        [n]: { name: str(b?.name, 120) || undefined, hook: str(b?.hook, 600) || undefined },
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === 'offer') {
    const videos = Math.max(1, Math.min(60, Number(b?.videos) || 1));
    // He may discount, but not below cost and not into a negative.
    const pricePerVideo = Math.max(1, Math.min(2000, Number(b?.pricePerVideo) || VIDEO_JOD_PER));
    const ads = !!b?.ads;
    const adsMonthlyJOD = Math.max(0, Math.min(9999, Number(b?.adsMonthlyJOD) || RETAINER_JOD));
    await saveSheet({
      ...sheet,
      offer: {
        videos, pricePerVideo, ads, adsMonthlyJOD,
        // Computed here so the stored total can never disagree with its parts.
        totalJOD: videos * pricePerVideo,
        note: str(b?.note, 400) || undefined,
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === 'approve') {
    const r = await approveSheet(token);
    // The account follows the sheet. Approving is the moment there is something
    // a client can read, so that is where `sent` belongs — the link is minted
    // here and nowhere else.
    if (r.ok) await setClientStatus(sheet.handle, 'sent').catch(() => {});
    return r.ok
      ? NextResponse.json({ ok: true, shareToken: r.shareToken })
      : NextResponse.json({ error: r.why }, { status: 422 });
  }

  if (action === 'unapprove') {
    await unapproveSheet(token);
    // Back to something only Khaled can see, so the account says so again.
    await setClientStatus(sheet.handle, 'ready').catch(() => {});
    return NextResponse.json({ ok: true });
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
      : NextResponse.json({ error: r.why }, { status: 422 });
  }

  return NextResponse.json({ error: 'unknown-action' }, { status: 400 });
}
