import { discover, normaliseHandle } from '@/lib/meta/discovery';
import { readSite, normaliseUrl } from '@/lib/meta/website';
import { computeSignals } from '@/lib/teardown/signals';
import { buildFindings } from '@/lib/teardown/findings';
import { recommend } from '@/lib/teardown/recommend';
import { listTalent } from '@/lib/store/deals';
import { saveSheet, mintToken, type Sheet } from '@/lib/store/sheets';
import { VIDEO_JOD_PER } from '@/lib/data/concepts';
import { RETAINER_JOD } from '@/lib/data/deals';
import type { Vertical } from '@/lib/data/concepts';
import type { ReadFailure } from '@/lib/data/clients';

/**
 * Read one business, end to end, and leave a sheet behind.
 *
 * Lifted out of the console's route so the public intake form and an operator
 * typing a handle run the same code. Two entry points computing a report two
 * slightly different ways is the failure this exists to prevent: the client
 * reads one of them and Khaled defends the other.
 *
 * It does not notify anybody and does not touch the client account. Those are
 * the caller's job, because the console wants neither and the intake path wants
 * both — and a function that reads Meta, writes a sheet, updates an account and
 * sends a message is a function nothing can retry safely.
 */

export type RunOk = {
  ok: true;
  sheet: Sheet;
  /** Whether the site read produced anything, and why not when it did not. */
  site: boolean;
  siteProblem?: string;
};
export type RunFail = { ok: false; reason: ReadFailure; status: number };

/** HTTP status for each failure, kept here so both callers answer alike. */
const STATUS: Record<ReadFailure, number> = {
  handle: 400, unreadable: 404, throttled: 429,
  unauthorised: 502, 'no-data': 502, network: 502, 'too-few-posts': 422,
};

export async function runRead(input: {
  handle: string;
  /** What they typed. Falls back to whatever their own bio points at. */
  website?: string;
  vertical?: Vertical | null;
}): Promise<RunOk | RunFail> {
  const handle = normaliseHandle(input.handle ?? '');
  if (!handle) return { ok: false, reason: 'handle', status: STATUS.handle };

  const read = await discover(handle);
  if (!read.ok) {
    const reason = read.reason as ReadFailure;
    return { ok: false, reason, status: STATUS[reason] ?? 502 };
  }

  const signals = computeSignals(handle, read.profile.followers_count, read.profile.media);
  if (!signals) {
    return { ok: false, reason: 'too-few-posts', status: STATUS['too-few-posts'] };
  }

  // The site they gave us, else the one their own bio points at.
  const wanted = (input.website ?? '').trim() || read.profile.website || '';
  const url = wanted ? normaliseUrl(wanted) : null;
  const siteRead = url ? await readSite(url) : null;
  const site = siteRead?.ok ? siteRead.site : null;

  const findings = buildFindings(signals, site, !!url);
  const vertical = input.vertical ?? null;
  // A roster we cannot read is an empty roster, which makes every concept
  // uncastable rather than taking the whole read down. The sheet says so.
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
    // A sensible starting offer he can change.
    offer: {
      videos: 6, pricePerVideo: VIDEO_JOD_PER, ads: true,
      adsMonthlyJOD: RETAINER_JOD, totalJOD: 6 * VIDEO_JOD_PER,
    },
    status: 'draft',
    createdAt: now, updatedAt: now,
  };
  await saveSheet(sheet);

  return {
    ok: true,
    sheet,
    site: !!site,
    siteProblem: siteRead && !siteRead.ok ? siteRead.reason : undefined,
  };
}
