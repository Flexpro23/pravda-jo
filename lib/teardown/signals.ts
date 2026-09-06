/**
 * What a hundred posts actually say, computed and nothing else.
 *
 * Every number here comes from fields the subject published. No benchmark, no
 * estimate, no model — a later pass writes the prose, but it may only write
 * from what this produces. Keeping the arithmetic in one pure module is what
 * makes that boundary enforceable rather than aspirational.
 *
 * Four deliberate choices worth knowing about:
 *
 * Engagement, not reach. `view_count` mixes paid with organic, so any
 * "out-reached by N×" claim built on it is simply false for a prospect who
 * boosts — and boosting is exactly what makes a prospect worth approaching.
 * Likes plus comments are unambiguous, so every comparison here rests on those.
 *
 * Median, not mean. Engagement is heavy-tailed: one post that travelled drags
 * the mean above nearly every post in the set, and "above average" then means
 * nothing. The typical post is the median post. `engagementRate` is therefore
 * the median post's engagement over followers; the old mean-of-rates survives
 * as `meanEngagementRate` because it is occasionally useful internally, and it
 * is never allowed into copy — pairing it with a median count overstated a real
 * fixture by 11×, in the direction that flatters the prospect.
 *
 * Absent is not zero. Business Discovery omits `like_count` entirely for an
 * account that has hidden its like counts, and omits both counts on some media
 * types. Coercing that to zero produced a `critical` finding reading "0
 * reactions against 10,000 followers" — defamatory and unprovable. Every
 * engagement statistic here is computed over the posts where the numbers were
 * actually returned, and `coverage` records the denominator that was used so
 * the prose layer can refuse to speak when it is too thin.
 *
 * A clock is an argument. Nothing here reads `Date.now()` on its own: the
 * caller passes `now`, so a dormancy claim in a test is the same computation as
 * a dormancy claim in production, run against a stated instant.
 */

import type { Media } from '@/lib/meta/discovery';
import { hasCta, hasQuestion } from '@/lib/teardown/arabic';

/** Jordan has been permanently UTC+3 since October 2022, but let the platform
 *  hold that fact rather than hard-coding an offset that could age badly. */
const AMMAN = 'Asia/Amman';

const DAY_MS = 86_400_000;

/** The trailing window every "how they behave now" number is computed over. */
export const RECENT_DAYS = 90;

// ── format-strength constants, each stating what it protects against ────────
/** An absolute floor on the leading format's sample: below five posts a median
 *  is one or two observations wearing a statistic's clothes. */
export const FORMAT_MIN_POSTS = 5;
/** …and the same floor as a share of the read, so a 100-post account cannot
 *  have a whole format declared on five of them. */
export const FORMAT_MIN_SHARE = 0.10;
/** The runner-up needs a sample too. Without this a single zero-engagement
 *  post sets the bar at zero and anything non-zero "leads". */
export const FORMAT_RUNNERUP_MIN_POSTS = 3;
/** Nothing is declared on noise. Five reactions is the floor below which the
 *  difference between two formats is not worth a sentence. */
export const FORMAT_MIN_MEDIAN = 5;
/** The lead must beat the runner-up by half again… */
export const FORMAT_RATIO = 1.5;
/** …and beat the account's own overall median, so "strongest" is not merely
 *  "least bad". */
export const FORMAT_OVERALL_RATIO = 1.25;
/** Permutation test: how often a label shuffle reproduces the observed gap. */
export const FORMAT_SHUFFLES = 2000;
/** …and the level below which we are willing to say it in public. */
export const FORMAT_ALPHA = 0.05;

// ── best-window constants ───────────────────────────────────────────────────
/** A window is a pattern only if enough posts sit in it. The old rule allowed
 *  6 posts out of 100 to drive a recommendation. */
export const WINDOW_MIN_POSTS = 8;
export const WINDOW_MIN_SHARE = 0.10;
/** And it must actually be better, not merely the argmax of twelve medians. */
export const WINDOW_MIN_RATIO = 1.3;

const hourIn = (iso: string, tz = AMMAN) =>
  Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: tz })
    .format(new Date(iso)));

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Nearest-rank percentile. Used only for the account's comparison with itself. */
const percentile = (xs: number[], p: number) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const i = Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1));
  return s[i];
};

const pct = (n: number, d: number) => (d > 0 ? (n / d) * 100 : 0);

/** Deterministic PRNG, so a permutation test gives the same p twice. */
const mulberry32 = (seed: number) => () => {
  seed = (seed + 0x6D2B79F5) | 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export type Format = 'REELS' | 'CAROUSEL_ALBUM' | 'IMAGE' | 'VIDEO';

export type FormatSignal = {
  format: Format;
  posts: number;
  /** Of those, how many carried engagement numbers we were actually given. */
  known: number;
  sharePosts: number;        // % of the set
  /** % of the *known* posts, so it can be said in one breath with
   *  `shareEngagement` — which has only ever counted known posts. A share of
   *  the whole set against a share of the known set is two denominators in one
   *  sentence, and the sentence reads as though they were one. */
  shareKnown: number;
  shareEngagement: number;   // % of all known engagement it carries
  medianEngagement: number;
};

/** Two two-hour windows share an hour. Exported because the finding that
 *  compares a habit with a result must be able to refuse a one-hour shift. */
export const windowsOverlap = (
  a: { from: number }, b: { from: number },
) => {
  const hours = (w: { from: number }) => [w.from % 24, (w.from + 1) % 24];
  const [a0, a1] = hours(a);
  return hours(b).some((h) => h === a0 || h === a1);
};

export type Signals = {
  handle: string;
  followers: number;
  /** How many posts the read actually covered — never padded to the ceiling. */
  posts: number;
  /** True when the account has fewer posts than we asked for. */
  shallow: boolean;
  /** posts ÷ the account's own media_count, when the profile told us. */
  readShare: number | null;
  first: string;
  last: string;
  /** First to last post *within the read window*. Not the account's age. */
  spanDays: number;
  /** Days from the last post to the read. The dormancy signal. */
  daysSinceLast: number;
  /** First post in the window to the read — what "publishing for N months" means. */
  activeSpanDays: number;
  /** Posts per week over the trailing window — but never over more window than
   *  the account has existed for. An account four weeks old that posts daily
   *  does 7 a week, not the 2.2 that dividing 28 posts by 90 days produces. */
  postsPerWeek: number;
  /** Posts per week across the read window. Provenance only — a burst account
   *  reads 124 a week here and has not posted since 2024. */
  postsPerWeekInWindow: number;
  /** Posts inside the trailing 90 days. */
  recentPosts: number;

  /**
   * How much of the engagement arithmetic rests on numbers we were given.
   *
   * `recentEngagementKnown` is the one the prose layer needs most: `recentPosts`
   * counts posts, so gating a *recent rate* on it says "eight posts" about a
   * number computed from however many of those eight carried reactions — which
   * was none, on a hidden-likes account, and printed as 0%.
   */
  coverage: {
    likesKnown: number; commentsKnown: number; engagementKnown: number;
    recentEngagementKnown: number;
  };
  /** ≥ 80% of posts carried both counts. Below this, nothing about reach is said. */
  engagementReliable: boolean;

  /** The median post's engagement as a percentage of followers. The one rate. */
  engagementRate: number;
  /** Mean of per-post rates. Kept for internal comparison; never in copy. */
  meanEngagementRate: number;
  /** The same median rate over the trailing window only. */
  recentEngagementRate: number;
  /** …and the count it is a rate of, so a sentence quoting both quotes one
   *  basis rather than a recent rate beside a lifetime median. */
  recentMedianEngagement: number;
  /** The account's own 25th-percentile post rate across the read window —
   *  the only benchmark this engine is allowed to use. */
  selfP25Rate: number;
  medianEngagement: number;

  formats: FormatSignal[];
  /** The format carrying the most engagement per post, when one clearly leads
   *  and a permutation test says the lead survives a label shuffle. */
  strongest: (FormatSignal & { p: number }) | null;
  /** Where the effort goes, by count. */
  busiest: FormatSignal | null;

  /** Posting hours in Amman time, 0–23, counts. */
  byHour: number[];
  /** The two-hour window holding the largest share of posts. Descriptive. */
  peakWindow: { from: number; to: number; share: number };
  /** The best of the twelve *disjoint* two-hour windows, when it beats the
   *  rest of the day by a margin and does not overlap the habit. */
  bestWindow: { from: number; to: number; median: number; n: number; vsRest: number } | null;

  /** The single strongest post, and how far above the typical one it sits. */
  best: { permalink: string; timestamp: string; engagement: number; multiple: number; format: Format } | null;

  captions: {
    withCaption: number;
    /** Posts with no caption at all. */
    none: number;
    medianWords: number;
    /** Posts whose caption asks the reader to do something. */
    asking: number;
    /** Share of *captioned* posts that ask. The denominator is not `posts`. */
    askingShare: number;
    /** Posts whose caption merely contains a question mark. Never a CTA. */
    questioning: number;
    questioningShare: number;
  };

  /** The profile text, carried through so the bio can be audited. */
  bio?: { biography?: string; website?: string };
};

const formatOf = (m: Media): Format =>
  m.media_product_type === 'REELS' ? 'REELS' : (m.media_type as Format);

const likesKnown = (m: Media) => typeof m.like_count === 'number';
const commentsKnown = (m: Media) => typeof m.comments_count === 'number';
/** Both halves, or the total is not a total. */
const engagementKnown = (m: Media) => likesKnown(m) && commentsKnown(m);
const engagementOf = (m: Media) => (m.like_count ?? 0) + (m.comments_count ?? 0);

/**
 * Two-sample permutation test on the difference of medians.
 *
 * Shuffle the format labels `FORMAT_SHUFFLES` times and count how often chance
 * alone reproduces the observed gap. The `+1`s are the standard bias correction
 * (an observed statistic is itself one of the arrangements), so `p` is never 0.
 *
 * The median is a coarse statistic and this test is deliberately conservative
 * with it: a set where every post in a format carries the *identical* number is
 * degenerate — a relabelled median lands on one of two values, so the gap is
 * reproduced by chance most of the time and no claim is made. Real engagement
 * has spread; a fixture that does not is a fixture, and refusing to speak about
 * it is the right failure.
 */
const permutationP = (lead: number[], rest: number[], shuffles = FORMAT_SHUFFLES) => {
  const pool = [...lead, ...rest];
  const n = lead.length;
  const observed = Math.abs(median(lead) - median(rest));
  // Seeded from the data so the same input gives the same p on any machine,
  // and two different inputs do not share a shuffle sequence by accident.
  const rand = mulberry32(pool.length * 2654435761 + Math.round(pool.reduce((a, b) => a + b, 0)));
  let atLeast = 0;
  const work = [...pool];
  for (let s = 0; s < shuffles; s++) {
    for (let i = work.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [work[i], work[j]] = [work[j], work[i]];
    }
    const diff = Math.abs(median(work.slice(0, n)) - median(work.slice(n)));
    if (diff >= observed) atLeast++;
  }
  return (atLeast + 1) / (shuffles + 1);
};

export function computeSignals(
  handle: string,
  followers: number,
  media: Media[],
  requested = 100,
  profile?: { biography?: string; website?: string; mediaCount?: number } | null,
  now: number = Date.now(),
): Signals | null {
  // Stories and ads are not the organic account, and STORY never appears on
  // this edge anyway. Anything without a timestamp cannot be placed in time.
  const posts = media
    .filter((m) => m.media_product_type !== 'STORY' && m.media_product_type !== 'AD')
    .filter((m) => !!m.timestamp)
    .sort((a, b) => +new Date(a.timestamp) - +new Date(b.timestamp));

  if (posts.length < 2) return null;      // nothing defensible to say

  const first = posts[0].timestamp;
  const last = posts[posts.length - 1].timestamp;
  const spanDays = Math.max(1, (+new Date(last) - +new Date(first)) / DAY_MS);
  const daysSinceLast = Math.max(0, (now - +new Date(last)) / DAY_MS);
  const activeSpanDays = Math.max(1, (now - +new Date(first)) / DAY_MS);

  const recentFrom = now - RECENT_DAYS * DAY_MS;
  const recent = posts.filter((m) => +new Date(m.timestamp) >= recentFrom);

  // ── coverage: what we were actually told ──────────────────────────────────
  const known = posts.filter(engagementKnown);
  const coverage = {
    likesKnown: posts.filter(likesKnown).length,
    commentsKnown: posts.filter(commentsKnown).length,
    engagementKnown: known.length,
    recentEngagementKnown: recent.filter(engagementKnown).length,
  };
  const engagementReliable = known.length / posts.length >= 0.8;

  const engagements = known.map(engagementOf);
  const totalEngagement = engagements.reduce((a, b) => a + b, 0);
  const med = median(engagements);
  const rates = followers > 0 ? engagements.map((e) => pct(e, followers)) : [];

  // ── formats ───────────────────────────────────────────────────────────────
  const groups = new Map<Format, Media[]>();
  for (const m of posts) {
    const f = formatOf(m);
    const bucket = groups.get(f);
    if (bucket) bucket.push(m); else groups.set(f, [m]);
  }
  const formats: FormatSignal[] = [...groups.entries()].map(([format, ms]) => {
    const seen = ms.filter(engagementKnown);
    return {
      format,
      posts: ms.length,
      known: seen.length,
      sharePosts: pct(ms.length, posts.length),
      shareKnown: pct(seen.length, known.length),
      shareEngagement: pct(seen.reduce((a, m) => a + engagementOf(m), 0), totalEngagement),
      medianEngagement: median(seen.map(engagementOf)),
    };
  }).sort((a, b) => b.medianEngagement - a.medianEngagement);

  // Only call a format strongest when it genuinely leads, is not a one-off, is
  // not resting on single-digit engagement, and survives a label shuffle. Each
  // clause here is a fixture that used to produce a false claim.
  const lead = formats[0];
  const runnerUp = formats[1];
  let strongest: Signals['strongest'] = null;
  if (
    engagementReliable
    && lead && runnerUp
    && lead.known >= Math.max(FORMAT_MIN_POSTS, known.length * FORMAT_MIN_SHARE)
    && runnerUp.known >= FORMAT_RUNNERUP_MIN_POSTS
    && lead.medianEngagement >= FORMAT_MIN_MEDIAN
    && lead.medianEngagement >= Math.max(
      runnerUp.medianEngagement * FORMAT_RATIO, med * FORMAT_OVERALL_RATIO)
  ) {
    const leadSet = (groups.get(lead.format) ?? []).filter(engagementKnown).map(engagementOf);
    const restSet = known.filter((m) => formatOf(m) !== lead.format).map(engagementOf);
    const p = permutationP(leadSet, restSet);
    if (p <= FORMAT_ALPHA) strongest = { ...lead, p };
  }
  const busiest = [...formats].sort((a, b) => b.posts - a.posts)[0] ?? null;

  // ── hours, in Amman time ──────────────────────────────────────────────────
  // The habit is counted over every post; the performance comparison only over
  // posts whose engagement we were given.
  const byHour = new Array(24).fill(0) as number[];
  const engByHour: number[][] = Array.from({ length: 24 }, () => []);
  for (const m of posts) {
    const h = hourIn(m.timestamp);
    byHour[h] += 1;
    if (engagementKnown(m)) engByHour[h].push(engagementOf(m));
  }

  // Two adjacent windows tie whenever the extra hour adds nothing: posts all at
  // 14:00 fill [13,15) and [14,16) equally. Taking the first would report "between
  // 1 and 3pm" for an account that posts at 2 o'clock every time, so a tie goes
  // to the window that actually starts where the posts are.
  let peakWindow = { from: 0, to: 2, share: 0 };
  let peakHead = -1;
  const TIE = 1e-9;

  for (let h = 0; h < 24; h++) {
    const head = byHour[h];
    const count = head + byHour[(h + 1) % 24];
    const share = pct(count, posts.length);
    if (share > peakWindow.share + TIE
      || (Math.abs(share - peakWindow.share) <= TIE && head > peakHead)) {
      peakWindow = { from: h, to: (h + 2) % 24, share };
      peakHead = head;
    }
  }

  // `bestWindow` compares, so its windows must be disjoint: sliding windows
  // share an hour, and a one-hour shift over the same posts was reported as a
  // conflict between where they post and where they succeed.
  let bestWindow: Signals['bestWindow'] = null;
  for (let h = 0; h < 24; h += 2) {
    const pool = [...engByHour[h], ...engByHour[h + 1]];
    if (pool.length < Math.max(WINDOW_MIN_POSTS, known.length * WINDOW_MIN_SHARE)) continue;
    const rest = known
      .filter((m) => { const x = hourIn(m.timestamp); return x !== h && x !== h + 1; })
      .map(engagementOf);
    const restMed = median(rest);
    // Nothing to compare against, or a rest median of zero which would make
    // every ratio infinite: say nothing rather than say it loudly.
    if (!rest.length || restMed <= 0) continue;
    const m2 = median(pool);
    if (!bestWindow || m2 > bestWindow.median + TIE) {
      bestWindow = { from: h, to: (h + 2) % 24, median: m2, n: pool.length, vsRest: m2 / restMed };
    }
  }
  if (bestWindow && (bestWindow.vsRest < WINDOW_MIN_RATIO || windowsOverlap(peakWindow, bestWindow))) {
    bestWindow = null;
  }

  // ── the standout ──────────────────────────────────────────────────────────
  let best: Signals['best'] = null;
  if (known.length) {
    const top = known.reduce((a, b) => (engagementOf(b) > engagementOf(a) ? b : a));
    const topEng = engagementOf(top);
    if (med > 0 && topEng > med) {
      best = {
        permalink: top.permalink,
        timestamp: top.timestamp,
        engagement: topEng,
        multiple: topEng / med,
        format: formatOf(top),
      };
    }
  }

  // ── captions ──────────────────────────────────────────────────────────────
  const withCaption = posts.filter((m) => (m.caption ?? '').trim().length > 0);
  const asking = withCaption.filter((m) => hasCta(m.caption)).length;
  const questioning = withCaption.filter((m) => hasQuestion(m.caption)).length;

  const recentKnown = recent.filter(engagementKnown).map(engagementOf);

  return {
    handle,
    followers,
    posts: posts.length,
    shallow: posts.length < requested,
    readShare: profile?.mediaCount ? posts.length / profile.mediaCount : null,
    first, last, spanDays, daysSinceLast, activeSpanDays,
    // Never divide by more window than the account has been alive for: a
    // three-week-old account posting daily read as 2.3 a week, and the sheet
    // then complimented a cadence it had just understated by three.
    postsPerWeek: recent.length / (Math.min(RECENT_DAYS, activeSpanDays) / 7),
    postsPerWeekInWindow: posts.length / (spanDays / 7),
    recentPosts: recent.length,

    coverage,
    engagementReliable,

    engagementRate: pct(med, followers),
    meanEngagementRate: rates.length ? rates.reduce((a, e) => a + e, 0) / rates.length : 0,
    recentEngagementRate: pct(median(recentKnown), followers),
    recentMedianEngagement: median(recentKnown),
    selfP25Rate: percentile(rates, 25),
    medianEngagement: med,

    formats, strongest, busiest,
    byHour, peakWindow, bestWindow,
    best,

    captions: {
      withCaption: withCaption.length,
      none: posts.length - withCaption.length,
      medianWords: median(withCaption.map((m) => (m.caption ?? '').trim().split(/\s+/).length)),
      asking,
      askingShare: pct(asking, withCaption.length),
      questioning,
      questioningShare: pct(questioning, withCaption.length),
    },

    bio: profile ? { biography: profile.biography, website: profile.website } : undefined,
  };
}
