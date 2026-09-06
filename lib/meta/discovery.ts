/**
 * Instagram Business Discovery — the whole cold-read surface.
 *
 * This is the only Meta endpoint that returns anything about a business that
 * has not authorised us, and it needs no App Review: `business_discovery` is a
 * field on our OWN Instagram User node, so the query always authenticates as
 * PRAVDA and the prospect is nothing but a string parameter. Business and
 * Consumer apps get Standard Access to their own app users automatically.
 *
 * What it will not give, at any access tier, so that nothing downstream waits
 * for it:
 *   · comment TEXT — the comments edge is Standard rather than Public.
 *     `comments_count` is public; the words are not.
 *   · audience composition — no demographics for a non-consenting account.
 *   · anything paid — the Ad Library API returns non-EU ads only when they
 *     concern social issues, elections or politics, which excludes all of Jordan.
 *
 * Permissions the token must carry: instagram_basic, instagram_manage_insights,
 * pages_read_engagement — plus ads_read or ads_management, because PRAVDA's
 * Page role came through Business Manager. Without that last one every call
 * 403s, and the error does not mention ads.
 *
 * Every network call goes through `io.fetch` rather than the global, so the
 * unit tests can hand this module a script of Graph responses and never open a
 * socket. Nothing else about the seam is clever: it is one indirection.
 */

const VERSION = process.env.META_API_VERSION || 'v21.0';
const GRAPH = 'https://graph.facebook.com';

/**
 * The one seam. Tests overwrite `io.fetch`; production never touches it.
 */
export const io = {
  fetch: (...a: Parameters<typeof globalThis.fetch>) => globalThis.fetch(...a),
};

/** Per-post fields, all of them public on the business_discovery edge. */
const MEDIA_FIELDS = [
  'id', 'caption', 'media_type', 'media_product_type', 'permalink',
  'timestamp', 'like_count', 'comments_count',
].join(',');

/**
 * Profile fields, all verified live against the endpoint on 27 Aug 2026.
 *
 * `follows_count`, `profile_picture_url`, `name` and `ig_id` are documented as
 * Standard rather than Public and were long assumed unavailable for a cold
 * prospect. They return. `name` in particular is what lets a teardown address a
 * business by its own name instead of its handle.
 */
const PROFILE_FIELDS = [
  'username', 'name', 'followers_count', 'follows_count', 'media_count',
  'biography', 'website', 'profile_picture_url', 'ig_id',
];

/**
 * Verified: the edge serves 100 media in a single call, not the 25 assumed
 * from the per-page default. At roughly 200 calls an hour that is the whole
 * difference between fifty prospects an hour and two hundred, so it is worth
 * asking for the ceiling rather than paging politely up to it.
 */
const PAGE = 100;

/**
 * Where a sweep stops, and where it starts telling somebody.
 *
 * The old ceiling was 95, which is close enough to the wall that one
 * unluckily-timed page takes the app over it — and past the wall Meta blocks
 * the whole app for an hour, not just this prospect. 90 leaves a page of
 * headroom. 75 is the number an operator wants to see on the console *before*
 * queueing thirty more reads, so it is reported rather than acted on.
 */
const HARD_STOP = 90;
const SOFT_WARN = 75;

/** One request never hangs longer than this. */
const REQUEST_MS = 15_000;
/** Nor does the whole retry ladder for one page. */
const RETRY_BUDGET_MS = 8_000;

export type Media = {
  id: string;
  caption?: string;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  /** FEED | REELS | STORY | AD — the honest format signal; media_type is not. */
  media_product_type?: 'FEED' | 'REELS' | 'STORY' | 'AD';
  permalink: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
};

export type Profile = {
  username: string;
  /** The business's own display name. Absent on a few accounts, so never assumed. */
  name?: string;
  followers_count: number;
  follows_count?: number;
  media_count: number;
  biography?: string;
  website?: string;
  profile_picture_url?: string;
  ig_id?: number;
  media: Media[];
};

/**
 * What Meta says is left of our budget, on every answer including the failures.
 *
 * Computed and thrown away for years: nobody could see that the app was at 80%
 * until it was at 100%. `appPct` is the app-level percentage, `businessPct` the
 * per-business-use-case one, `regainSec` how long Meta says the block lasts
 * (their header reports minutes; this is seconds, because everything else here
 * that names a unit uses ms or s).
 */
export type Usage = { appPct: number; businessPct?: number; regainSec?: number };

type FailureReason =
  | { reason: 'unreadable' }   // personal, typo, renamed, deleted — indistinguishable
  | { reason: 'throttled' }
  | { reason: 'unauthorised' } // our token, not their account
  /**
   * The account says it has posts and the endpoint returned none.
   *
   * This is the shape of an expired data-access window: past
   * data_access_expires_at a token keeps reporting is_valid true and simply
   * returns nothing rather than erroring. Without this check the engine reads
   * an empty set, decides the account is too young to analyse, and sends
   * whoever is debugging it to look at the prospect instead of at our token.
   */
  | { reason: 'no-data' }
  | { reason: 'network'; detail: string };

/** Carried on both branches: a failed read still tells us what budget is left. */
type UsageCarrier = { usage: Usage; usageWarn: boolean };

export type DiscoveryFailure = FailureReason & { ok: false } & UsageCarrier;

export type DiscoverySuccess = {
  ok: true;
  profile: Profile;
  /**
   * We stopped early — budget, page cap or a repeating cursor — so `media` is
   * a real but shallow read. `readShare` downstream says so in the sheet
   * rather than presenting a partial month as a whole one.
   */
  truncated: boolean;
} & UsageCarrier;

export type DiscoveryResult = DiscoverySuccess | DiscoveryFailure;

/**
 * A handle as typed by a human: @name, a profile URL, or bare.
 *
 * The output is a Firestore document id (`clients/<handle>`), so this function
 * is frozen: change what it returns and every existing account is orphaned.
 */
export function normaliseHandle(input: string): string | null {
  const s = input.trim().replace(/^@/, '')
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/[/?#].*$/, '')
    .trim();
  // Instagram's own rule: letters, digits, period, underscore, max 30.
  return /^[A-Za-z0-9._]{1,30}$/.test(s) ? s.toLowerCase() : null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type GraphError = { code?: number; error_subcode?: number; message?: string };

type Attempt = {
  res: Response | null;
  // Graph hands back arbitrary JSON; the shape is checked field by field below.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any;
  usage: Usage;
  /** Set when the request never produced a response at all. */
  threw?: unknown;
};

/**
 * One page of the read. A hundred posts arrive in a single round trip; the
 * cursor is only needed for a deeper read than that.
 *
 * It never throws. A TCP reset used to escape here, out through `discover` and
 * `runRead`, and land in the intake route's catch-all as `failed/network` with
 * no detail and no retry — the lead survived and the read was simply lost. A
 * *hung* socket was worse: with no signal it held the request until the
 * platform killed the instance.
 */
async function page(
  igUserId: string, token: string, handle: string, after?: string, want = PAGE,
): Promise<Attempt> {
  const media = `media.limit(${want})${after ? `.after(${after})` : ''}{${MEDIA_FIELDS}}`;
  const fields = `business_discovery.username(${handle}){${PROFILE_FIELDS.join(',')},${media}}`;
  const url = `${GRAPH}/${VERSION}/${igUserId}`
    + `?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(token)}`;

  try {
    const res = await io.fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(REQUEST_MS) });
    const body = await res.json().catch(() => null);
    return { res, body, usage: readUsage(res) };
  } catch (e) {
    return { res: null, body: null, usage: { appPct: 0 }, threw: e };
  }
}

/** The worst of the three counters Meta publishes in one usage header. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function worst(o: any): number {
  if (!o || typeof o !== 'object') return 0;
  return Math.max(
    Number(o.call_count) || 0,
    Number(o.total_cputime) || 0,
    Number(o.total_time) || 0,
  );
}

/**
 * Meta publishes the remaining budget on every response, in percentages.
 * Waiting for a 429 to discover we are out is the expensive way to learn it,
 * and a sweep across a target list accumulates faster than a single read
 * suggests — so the ceiling is read as we go, and reported either way.
 */
function readUsage(res: Response | null): Usage {
  const u: Usage = { appPct: 0 };
  if (!res) return u;
  try {
    const raw = res.headers.get('x-app-usage');
    if (raw) u.appPct = worst(JSON.parse(raw));
  } catch { /* a malformed header is not a reason to lose a read */ }
  try {
    const raw = res.headers.get('x-business-use-case-usage');
    if (raw) {
      // Keyed by business id, each value an array of per-use-case objects.
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      let pct = 0;
      let regainMin: number | undefined;
      for (const v of Object.values(parsed)) {
        for (const e of (Array.isArray(v) ? v : [v]) as Record<string, unknown>[]) {
          pct = Math.max(pct, worst(e));
          const r = Number(e?.estimated_time_to_regain_access) || 0;
          if (r > 0) regainMin = Math.max(regainMin ?? 0, r);
        }
      }
      u.businessPct = pct;
      // Meta reports that field in minutes. Everything we store is seconds.
      if (regainMin !== undefined) u.regainSec = regainMin * 60;
    }
  } catch { /* same */ }
  return u;
}

const spent = (u: Usage) => Math.max(u.appPct, u.businessPct ?? 0);

/**
 * Graph's transients, and only Graph's transients.
 *
 * 110/2207013 fires on accounts that are perfectly readable and its
 * `is_transient: false` is simply wrong. Codes 1 and 2 are the classic
 * "unknown"/"service" pair. A bare 500/502/503 usually carries no error body
 * at all, so it has to be matched on status. Everything else — a bad token, a
 * handle that does not exist — is a fact, and retrying it just delays the
 * answer by eight seconds.
 */
function transient(a: Attempt): boolean {
  if (a.threw) return true;
  const e: GraphError | undefined = a.body?.error;
  if (e?.code === 110 || e?.error_subcode === 2207013) return true;
  if (e?.code === 1 || e?.code === 2) return true;
  const s = a.res?.status ?? 0;
  return s === 429 || s === 500 || s === 502 || s === 503;
}

/**
 * Three attempts, 400ms doubling, jittered.
 *
 * The jitter matters more than the backoff: the read sweep fires from a cron
 * tick, so every client that got a 500 would otherwise retry in the same
 * millisecond and get another one. The total is capped so that a page which is
 * never going to work fails inside the request budget instead of at it.
 */
async function retry<T>(
  fn: () => Promise<T>,
  again: (v: T) => boolean,
  o: { attempts?: number; baseMs?: number; jitter?: boolean; totalMs?: number } = {},
): Promise<T> {
  const attempts = o.attempts ?? 3;
  const baseMs = o.baseMs ?? 400;
  const totalMs = o.totalMs ?? RETRY_BUDGET_MS;
  const t0 = Date.now();
  let last = await fn();
  for (let i = 1; i < attempts && again(last); i++) {
    const plain = baseMs * 2 ** (i - 1);
    const wait = o.jitter === false ? plain : Math.round(plain * (0.5 + Math.random() * 0.5));
    if (Date.now() - t0 + wait > totalMs) break;
    await sleep(wait);
    last = await fn();
  }
  return last;
}

/**
 * What a Graph error actually means for the person who typed the handle.
 *
 * 803 (alias not found) and 100 (object does not exist / no permission, often
 * with subcode 33) are the ordinary shapes of a typo'd or renamed handle. Both
 * used to fall through to `network`, so a mistyped handle was reported to the
 * operator as our infrastructure failing.
 */
function mapError(e: GraphError, status: number): FailureReason {
  if (e.code === 4 || e.code === 17 || e.code === 32 || e.code === 613) return { reason: 'throttled' };
  if (e.code === 190 || e.code === 10 || e.code === 200) return { reason: 'unauthorised' };
  if (e.code === 110 || e.error_subcode === 2207013) {
    // Still failing after the retries. Personal account, typo, renamed and
    // deleted are genuinely indistinguishable here, so we never guess which.
    return { reason: 'unreadable' };
  }
  if (e.code === 803 || e.code === 100) return { reason: 'unreadable' };
  return { reason: 'network', detail: e.message ?? `HTTP ${status}` };
}

/**
 * Read a prospect. `posts` is a ceiling, not a promise — a young account simply
 * has fewer, and the analysis says so rather than padding.
 */
export async function discover(handle: string, posts = 100): Promise<DiscoveryResult> {
  let usage: Usage = { appPct: 0 };
  const fail = (f: FailureReason): DiscoveryFailure =>
    ({ ok: false, ...f, usage, usageWarn: spent(usage) >= SOFT_WARN });

  const igUserId = process.env.META_IG_USER_ID;
  const token = process.env.META_ACCESS_TOKEN;
  if (!igUserId || !token) return fail({ reason: 'unauthorised' });

  const clean = normaliseHandle(handle);
  if (!clean) return fail({ reason: 'unreadable' });

  let profile: Profile | null = null;
  let after: string | undefined;
  let truncated = false;
  let pages = 0;
  // One extra page over the arithmetic minimum, because the edge occasionally
  // serves a short page. Anything beyond that is a cursor that is not moving.
  const maxPages = Math.ceil(posts / PAGE) + 1;

  while (!profile || profile.media.length < posts) {
    if (++pages > maxPages) { truncated = true; break; }

    // Never ask for more than is still wanted; a 40-post read is one call.
    const want = Math.min(PAGE, posts - (profile?.media.length ?? 0));
    const attempt = await retry(
      () => page(igUserId, token, clean, after, want),
      transient,
      { attempts: 3, baseMs: 400, jitter: true },
    );

    if (attempt.res) usage = attempt.usage;

    if (!attempt.res) {
      const detail = attempt.threw instanceof Error ? attempt.threw.message : 'fetch failed';
      return fail({ reason: 'network', detail });
    }

    // Back off while there is still budget rather than after it is gone. But a
    // hundred posts already in hand are worth more than the tidiness of a
    // uniform failure: past the ceiling with something read, we keep it and
    // say it is short. Only a read that got nothing is a throttle.
    if (spent(usage) >= HARD_STOP) {
      if (profile && profile.media.length > 0) { truncated = true; break; }
      return fail({ reason: 'throttled' });
    }

    const { res, body } = attempt;
    // Graph answers 200 with an error body more often than it should; the old
    // code only looked at `body.error` when the status was already bad.
    const e: GraphError | undefined = body?.error;
    if (e) return fail(mapError(e, res.status));
    if (!res.ok) return fail({ reason: 'network', detail: `HTTP ${res.status}` });

    const bd = body?.business_discovery;
    if (!bd) return fail({ reason: 'unreadable' });

    const batch: Media[] = bd.media?.data ?? [];

    // An account that reports posts but hands back none is not a young account.
    if (!profile && batch.length === 0 && (bd.media_count ?? 0) > 0) {
      return fail({ reason: 'no-data' });
    }

    if (!profile) {
      profile = {
        username: bd.username,
        name: bd.name,
        followers_count: bd.followers_count ?? 0,
        follows_count: bd.follows_count,
        media_count: bd.media_count ?? 0,
        biography: bd.biography,
        website: bd.website,
        profile_picture_url: bd.profile_picture_url,
        ig_id: bd.ig_id,
        media: batch,
      };
    } else {
      profile.media.push(...batch);
    }

    const next: string | undefined = bd.media?.paging?.cursors?.after;
    // A cursor that hands back itself is the shape of an infinite loop; the
    // old loop's only exits were an absent cursor and an empty batch.
    if (!next || next === after || batch.length === 0) break;
    after = next;
  }

  if (!profile) return fail({ reason: 'unreadable' });

  // Trimming an over-serving page is not a short read, so it does not set
  // `truncated` — that flag means we stopped before we had what we asked for.
  if (profile.media.length > posts) profile.media = profile.media.slice(0, posts);
  return { ok: true, profile, truncated, usage, usageWarn: spent(usage) >= SOFT_WARN };
}
