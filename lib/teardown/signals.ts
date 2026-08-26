/**
 * What a hundred posts actually say, computed and nothing else.
 *
 * Every number here comes from fields the subject published. No benchmark, no
 * estimate, no model — a later pass writes the prose, but it may only write
 * from what this produces. Keeping the arithmetic in one pure module is what
 * makes that boundary enforceable rather than aspirational.
 *
 * Two deliberate choices worth knowing about:
 *
 * Engagement, not reach. `view_count` mixes paid with organic, so any
 * "out-reached by N×" claim built on it is simply false for a prospect who
 * boosts — and boosting is exactly what makes a prospect worth approaching.
 * Likes plus comments are unambiguous, so every comparison here rests on those.
 *
 * Median, not mean. Engagement is heavy-tailed: one post that travelled drags
 * the mean above nearly every post in the set, and "above average" then means
 * nothing. The typical post is the median post.
 */

import type { Media } from '@/lib/meta/discovery';

/** Jordan has been permanently UTC+3 since October 2022, but let the platform
 *  hold that fact rather than hard-coding an offset that could age badly. */
const AMMAN = 'Asia/Amman';

const hourIn = (iso: string, tz = AMMAN) =>
  Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: tz })
    .format(new Date(iso)));

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const pct = (n: number, d: number) => (d > 0 ? (n / d) * 100 : 0);

export type Format = 'REELS' | 'CAROUSEL_ALBUM' | 'IMAGE' | 'VIDEO';

export type FormatSignal = {
  format: Format;
  posts: number;
  sharePosts: number;        // % of the set
  shareEngagement: number;   // % of all engagement it carries
  medianEngagement: number;
};

export type Signals = {
  handle: string;
  followers: number;
  /** How many posts the read actually covered — never padded to the ceiling. */
  posts: number;
  /** True when the account has fewer posts than we asked for. */
  shallow: boolean;
  first: string;
  last: string;
  spanDays: number;
  postsPerWeek: number;

  /** Mean per-post engagement rate, as a percentage of followers. */
  engagementRate: number;
  medianEngagement: number;

  formats: FormatSignal[];
  /** The format carrying the most engagement per post, when one clearly leads. */
  strongest: FormatSignal | null;
  /** Where the effort goes, by count. */
  busiest: FormatSignal | null;

  /** Posting hours in Amman time, 0–23, counts. */
  byHour: number[];
  /** The two-hour window holding the largest share of posts. */
  peakWindow: { from: number; to: number; share: number };
  /** The two-hour window whose posts perform best, by median engagement. */
  bestWindow: { from: number; to: number; median: number } | null;

  /** The single strongest post, and how far above the typical one it sits. */
  best: { permalink: string; timestamp: string; engagement: number; multiple: number; format: Format } | null;

  captions: {
    withCaption: number;
    medianWords: number;
    /** Posts whose caption asks anything at all. */
    asking: number;
    askingShare: number;
  };
};

const formatOf = (m: Media): Format =>
  m.media_product_type === 'REELS' ? 'REELS' : (m.media_type as Format);

const engagementOf = (m: Media) => (m.like_count ?? 0) + (m.comments_count ?? 0);

/** A caption asks for something: a question mark in either script, or an imperative opener. */
const asks = (c?: string) => {
  if (!c) return false;
  if (/[?؟]/.test(c)) return true;
  return /\b(dm|order|book|call|visit|tag|comment|link in bio|swipe)\b/i.test(c)
    || /(احجز|اطلب|تواصل|رنّ|زورونا|زوروا|علّق|شارك|الرابط بالبايو|رسالة)/.test(c);
};

export function computeSignals(
  handle: string,
  followers: number,
  media: Media[],
  requested = 100,
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
  const spanDays = Math.max(1, (+new Date(last) - +new Date(first)) / 86_400_000);

  const engagements = posts.map(engagementOf);
  const totalEngagement = engagements.reduce((a, b) => a + b, 0);

  // ── formats ───────────────────────────────────────────────────────────────
  const groups = new Map<Format, Media[]>();
  for (const m of posts) {
    const f = formatOf(m);
    const bucket = groups.get(f);
    if (bucket) bucket.push(m); else groups.set(f, [m]);
  }
  const formats: FormatSignal[] = [...groups.entries()].map(([format, ms]) => ({
    format,
    posts: ms.length,
    sharePosts: pct(ms.length, posts.length),
    shareEngagement: pct(ms.reduce((a, m) => a + engagementOf(m), 0), totalEngagement),
    medianEngagement: median(ms.map(engagementOf)),
  })).sort((a, b) => b.medianEngagement - a.medianEngagement);

  // Only call a format strongest when it genuinely leads and is not a one-off.
  const lead = formats[0];
  const runnerUp = formats[1];
  const strongest =
    lead && lead.posts >= 3 && (!runnerUp || lead.medianEngagement >= runnerUp.medianEngagement * 1.5)
      ? lead : null;
  const busiest = [...formats].sort((a, b) => b.posts - a.posts)[0] ?? null;

  // ── hours, in Amman time ──────────────────────────────────────────────────
  const byHour = new Array(24).fill(0) as number[];
  const engByHour: number[][] = Array.from({ length: 24 }, () => []);
  for (const m of posts) {
    const h = hourIn(m.timestamp);
    byHour[h] += 1;
    engByHour[h].push(engagementOf(m));
  }

  // Two adjacent windows tie whenever the extra hour adds nothing: posts all at
  // 14:00 fill [13,15) and [14,16) equally. Taking the first would report "between
  // 1 and 3pm" for an account that posts at 2 o'clock every time, so a tie goes
  // to the window that actually starts where the posts are.
  let peakWindow = { from: 0, to: 2, share: 0 };
  let peakHead = -1;
  let bestWindow: Signals['bestWindow'] = null;
  let bestHead = -1;
  const TIE = 1e-9;

  for (let h = 0; h < 24; h++) {
    const to = (h + 2) % 24;
    const head = byHour[h];
    const count = head + byHour[(h + 1) % 24];
    const share = pct(count, posts.length);
    if (share > peakWindow.share + TIE
      || (Math.abs(share - peakWindow.share) <= TIE && head > peakHead)) {
      peakWindow = { from: h, to, share };
      peakHead = head;
    }

    const pool = [...engByHour[h], ...engByHour[(h + 1) % 24]];
    // A window needs enough posts in it to be a pattern rather than an accident.
    if (pool.length >= Math.max(3, posts.length * 0.06)) {
      const med = median(pool);
      if (!bestWindow || med > bestWindow.median + TIE
        || (Math.abs(med - bestWindow.median) <= TIE && head > bestHead)) {
        bestWindow = { from: h, to, median: med };
        bestHead = head;
      }
    }
  }

  // ── the standout ──────────────────────────────────────────────────────────
  const med = median(engagements);
  let best: Signals['best'] = null;
  const top = posts.reduce((a, b) => (engagementOf(b) > engagementOf(a) ? b : a));
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

  // ── captions ──────────────────────────────────────────────────────────────
  const withCaption = posts.filter((m) => (m.caption ?? '').trim().length > 0);
  const asking = posts.filter((m) => asks(m.caption)).length;

  return {
    handle,
    followers,
    posts: posts.length,
    shallow: posts.length < requested,
    first, last, spanDays,
    postsPerWeek: posts.length / (spanDays / 7),

    engagementRate: followers > 0
      ? engagements.reduce((a, e) => a + pct(e, followers), 0) / posts.length
      : 0,
    medianEngagement: med,

    formats, strongest, busiest,
    byHour, peakWindow, bestWindow,
    best,

    captions: {
      withCaption: withCaption.length,
      medianWords: median(withCaption.map((m) => (m.caption ?? '').trim().split(/\s+/).length)),
      asking,
      askingShare: pct(asking, posts.length),
    },
  };
}
