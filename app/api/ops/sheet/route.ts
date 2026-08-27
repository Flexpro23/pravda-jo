import { NextResponse } from 'next/server';
import { opsAuthed } from '@/lib/ops/auth';
import { discover, normaliseHandle } from '@/lib/meta/discovery';
import { readSite, normaliseUrl } from '@/lib/meta/website';
import { computeSignals } from '@/lib/teardown/signals';
import { buildFindings } from '@/lib/teardown/findings';
import { recommend } from '@/lib/teardown/recommend';
import { listTalent } from '@/lib/store/deals';
import { VIDEO_JOD_PER } from '@/lib/data/concepts';
import { RETAINER_JOD } from '@/lib/data/deals';
import {
  saveSheet, getSheet, approveSheet, unapproveSheet, mintToken, type Sheet,
} from '@/lib/store/sheets';
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

    const read = await discover(handle);
    if (!read.ok) {
      const status = read.reason === 'throttled' ? 429
        : read.reason === 'unauthorised' || read.reason === 'no-data' ? 502 : 404;
      return NextResponse.json({ error: read.reason }, { status });
    }
    const signals = computeSignals(handle, read.profile.followers_count, read.profile.media);
    if (!signals) return NextResponse.json({ error: 'too-few-posts' }, { status: 422 });

    // The site they gave us, else the one their own bio points at.
    const wanted = str(b?.website, 300) || read.profile.website || '';
    const url = wanted ? normaliseUrl(wanted) : null;
    const siteRead = url ? await readSite(url) : null;
    const site = siteRead?.ok ? siteRead.site : null;

    const findings = buildFindings(signals, site, !!url);
    const vertical = (str(b?.vertical, 12) || null) as Vertical | null;
    const roster = await listTalent().catch(() => []);

    const now = new Date().toISOString();
    const sheet: Sheet = {
      token: mintToken(),
      handle,
      clientName: read.profile.name || `@${handle}`,
      website: url ?? undefined,
      vertical: vertical ?? undefined,
      signals, site, findings,
      recommendations: recommend(findings, roster, vertical, 5),
      chosen: [],
      // A sensible starting offer he can change: the cheapest chosen idea's
      // worth of videos, at the published rate.
      offer: {
        videos: 6, pricePerVideo: VIDEO_JOD_PER, ads: true,
        adsMonthlyJOD: RETAINER_JOD, totalJOD: 6 * VIDEO_JOD_PER,
      },
      status: 'draft',
      createdAt: now, updatedAt: now,
    };
    await saveSheet(sheet);
    return NextResponse.json({
      ok: true, token: sheet.token,
      posts: signals.posts, site: !!site,
      siteProblem: siteRead && !siteRead.ok ? siteRead.reason : undefined,
      findings: findings.findings.length,
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
    return r.ok
      ? NextResponse.json({ ok: true, shareToken: r.shareToken })
      : NextResponse.json({ error: r.why }, { status: 422 });
  }

  if (action === 'unapprove') {
    await unapproveSheet(token);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'unknown-action' }, { status: 400 });
}
