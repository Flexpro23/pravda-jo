import type { Signals } from '@/lib/teardown/signals';
import { windowsOverlap, RECENT_DAYS } from '@/lib/teardown/signals';
import type { SiteRead, SiteFailure } from '@/lib/meta/website';
import { arNum, num, n0, n1, hour } from '@/lib/format/num';
import { dayMonth, days } from '@/lib/format/date';
import { WA_ROUTE_RE } from '@/lib/teardown/arabic';

/**
 * Everything we can say, and the number each thing turns on.
 *
 * The master plan calls this a sealed fact ledger: every quantity is computed
 * here, in code, before any model runs — and a model may never emit a quantity
 * in any form outside a placeholder. That is the rule this file exists to make
 * enforceable. A finding is produced only when the arithmetic that justifies it
 * is present, so there is no path by which a plausible sentence reaches a
 * client without a measured number behind it.
 *
 * Severity is about the reader, not about us. `critical` is something costing
 * them money today; `notable` is something worth fixing; `good` is something
 * genuinely working, and there must always be some — a teardown that only takes
 * is read once and never answered. That last clause used to be a comment; it is
 * now an assertion at the bottom of `buildFindings`, because a real 10-post
 * account produced two criticals and nothing else.
 *
 * Three rules the copy in this file obeys:
 *
 * Never a benchmark. Every comparison is the account against itself. "Reaches a
 * fraction of its own followers" is a sentence about them; "below the 1% the
 * industry expects" is a sentence about a number we cannot show them.
 *
 * Never speak past the data. If Instagram did not return like counts, nothing
 * here says anything about reach — `ig-likes-hidden` says why, and the rest of
 * the sheet stands on what was returned.
 *
 * Never a half-written string. The `⟦…⟧` convention marks prose a human still
 * owes; a finding is either complete or absent.
 */

type B = { ar: string; en: string };

export type Severity = 'critical' | 'notable' | 'good';
export type Source = 'instagram' | 'website' | 'ads';

/** The four states a prospect's website can be in, which is one more than the
 *  code used to admit and two more than it acted on. */
export type WebState = 'no-url' | 'unreadable' | 'error-page' | 'read';
export type Web = { state: WebState; reason?: SiteFailure['reason']; status?: number };

export type Finding = {
  id: string;
  severity: Severity;
  source: Source;
  /**
   * The one number this turns on, already formatted — in both languages.
   *
   * It used to be a single string and the sheet ran it through `num()` at
   * render time, which converts digits and nothing else: "45d" became "٤٥d",
   * "2.4×" kept its Latin decimal point, and "3 months" reached an Arabic chip
   * in English. A figure is copy, so it is written here in both registers with
   * the rest of the copy — ٪ rather than %, Arabic unit words, Arabic-Indic
   * digits — and the renderer only picks one.
   */
  figure?: B;
  title: B;
  detail: B;
  /** Where it came from, so every claim can be checked. */
  provenance: B;
};

export type Chart =
  | {
    kind: 'bars'; id: string; title: B; note?: B;
    series: { label: B; value: number; caption?: string; hi?: boolean }[];
  }
  | {
    kind: 'hours'; id: string; title: B; note?: B;
    byHour: number[]; peak: [number, number]; best?: [number, number];
  };

export type Findings = {
  findings: Finding[];
  charts: Chart[];
  /** What the operator needs to know and the client must never read: why a
   *  read failed, what was skipped. Rendered by /ops, never by /s. */
  operatorNotes: { id: string; en: string }[];
  /** A count of what was read, for the provenance block. */
  read: { posts: number; site: boolean; adsChecked: boolean };
};

/**
 * Every threshold this file turns a severity on, with the basis for each.
 *
 * Set 6 Sep 2026. A magic number in a ternary is a claim wearing a lab coat:
 * these are the claims, written down where they can be argued with, and the
 * tests assert against this object rather than against a literal.
 */
export const THRESHOLDS = {
  /** Absolute floor on a typical post's engagement. Below ten reactions the
   *  account is not reaching a room, whatever the follower count says. Chosen
   *  as an absolute count, not a rate, because a rate against a bought
   *  follower base flatters exactly the accounts that need the sheet most. */
  ENGAGEMENT_MIN_MEDIAN: 10,
  /** The only comparison allowed: the account against its own 25th-percentile
   *  post. Needs a real recent sample before it may fire. */
  ENGAGEMENT_RECENT_MIN_POSTS: 8,
  /** …and the sample has to be a sample of *reactions*, not of posts. An
   *  account that hid its likes three months ago still has recent posts; the
   *  median of the nothing they carry is 0, and 0% is a defamatory sentence
   *  about a business that may be doing fine. Both an absolute floor and a
   *  share, so neither a tiny window nor a mostly-blank large one gets through. */
  ENGAGEMENT_RECENT_MIN_KNOWN: 5,
  ENGAGEMENT_RECENT_MIN_KNOWN_SHARE: 0.4,
  /** Share of captioned posts carrying a request. The 10/30 split is an
   *  editorial judgement about what a sheet should lead with — not a
   *  measurement, and it is never described to the client as one. */
  ASK_CRITICAL_SHARE: 10,
  ASK_NOTABLE_SHARE: 30,
  /** Share of posts with no caption at all before it is worth its own line. */
  NO_CAPTION_SHARE: 25,
  /** Days of silence before the account is described as dormant. Six weeks and
   *  a bit: past a month the audience has stopped expecting anything. */
  DORMANT_DAYS: 45,
  /** A cadence compliment may not be paid to an account that has stopped. */
  CADENCE_MAX_DAYS_SINCE: 21,
  CADENCE_MIN_PER_WEEK: 2,
  /** The habit must be a habit before a conflict with it is worth naming. */
  WINDOW_MIN_PEAK_SHARE: 20,
  /** A standout post is one that doubled the typical post, not one that beat it. */
  BEST_MULTIPLE: 2,
  /** They write. A fifteen-word median caption is prose, not a hashtag dump. */
  CAPTION_MIN_WORDS: 15,
  /** A month of publishing before "you have been at this a while" is true. */
  LONGEVITY_MIN_DAYS: 30,
  /** One format carrying half the engagement is an asset worth naming. */
  FORMAT_STRENGTH_SHARE: 50,
  /** A bar is a median, so a format needs enough known posts to have one.
   *  Below three it is an observation with a bar drawn round it. */
  FORMAT_CHART_MIN_KNOWN: 3,
  /** …and the chart is a ratio against the typical post, so there has to be a
   *  typical post. An account whose median is zero divides by zero, and the
   *  old floor of one quietly turned every bar into a raw reaction count
   *  wearing a "×" — "30×" for a format that got thirty likes. */
  FORMAT_CHART_MIN_MEDIAN: 1,
  /** Google's published Core Web Vitals boundaries (2.5s / 4.0s), used here as
   *  a conservative proxy: this is a document fetch, NOT Largest Contentful
   *  Paint, so a page that clears these has still not been shown to render
   *  fast. See the copy in `web-slow` for exactly what was measured. */
  SITE_MS_NOTABLE: 2500,
  SITE_MS_CRITICAL: 4000,
  /** …and the boundary below which the fetch is worth a compliment. */
  SITE_MS_FAST: 1500,
  /** More than three compliments and the sheet stops being a teardown. */
  GOOD_MAX: 3,
} as const;

/** A percentage as a chip, in both registers. `٪` is the Arabic percent sign;
 *  `%` inside Arabic is the same class of tell as a Latin comma in an address. */
const pctFig = (x: string): B => ({ ar: `${arNum(x)}٪`, en: `${x}%` });

/** A bare count as a chip. Nothing but the digits changes. */
const numFig = (x: string | number): B => ({ ar: arNum(x), en: String(x) });

/**
 * Which engagement figure the sheet is allowed to quote, and what it rests on.
 *
 * Exported because the header tile on the sheet quotes the same number as the
 * `ig-engagement` finding beneath it, and the two used to disagree: the tile
 * read the lifetime rate off the signals while the finding printed the recent
 * one. One function, two callers, one basis — and the basis is stated in the
 * provenance line so the reader can check which window it is.
 *
 * `fresh` needs both a recent *posting* sample and a recent *reactions* sample.
 * The second clause is finding 2: `median([])` is 0, so an account whose recent
 * posts carried no counts was told it engages 0% of its followers.
 */
export const engagementBasis = (s: Signals) => {
  const enoughKnown = s.coverage.recentEngagementKnown >= Math.max(
    THRESHOLDS.ENGAGEMENT_RECENT_MIN_KNOWN,
    s.recentPosts * THRESHOLDS.ENGAGEMENT_RECENT_MIN_KNOWN_SHARE,
  );
  const fresh = s.recentPosts >= THRESHOLDS.ENGAGEMENT_RECENT_MIN_POSTS && enoughKnown;
  return {
    fresh,
    rate: fresh ? s.recentEngagementRate : s.engagementRate,
    median: fresh ? s.recentMedianEngagement : s.medianEngagement,
    /** How many posts the figure was computed over, on whichever basis won. */
    known: fresh ? s.coverage.recentEngagementKnown : s.coverage.engagementKnown,
    /** True when there is any numerator at all. Nothing is printed without one. */
    sayable: (fresh ? s.coverage.recentEngagementKnown : s.coverage.engagementKnown) > 0,
  };
};

/**
 * The clock words. `hour()` in lib/format/num.ts renders every hour in the same
 * long register, which leaves midnight as "١٢ الصبح" and noon as "١٢ بعد الضهر"
 * — both of which an Amman reader would call wrong. The two hours that have
 * their own word get it; everything else goes through the shared formatter.
 */
export const clock = (h: number, ar: boolean) => {
  const x = ((h % 24) + 24) % 24;
  if (x === 0) return ar ? 'منتصف الليل' : 'midnight';
  if (x === 12) return ar ? 'الضهر' : 'noon';
  return hour(x, ar);
};

/** "10pm–midnight" / "١٠ المسا–منتصف الليل". */
export const span = (a: number, b: number, ar: boolean) => `${clock(a, ar)}–${clock(b, ar)}`;

/**
 * How long they have been publishing, said the way a person says it.
 *
 * `n0(spanDays / 30)` printed "across 0 months" for a two-week span and "across
 * 0 months" again for a 54-hour burst, in the present tense, on an account that
 * had not posted since 2024. Below two months this counts weeks; it never
 * prints zero of anything.
 */
export const months = (d: number, ar: boolean) => {
  if (d < 60) {
    const w = Math.max(1, Math.round(d / 7));
    if (!ar) return `${w} week${w === 1 ? '' : 's'}`;
    if (w === 1) return 'أسبوع';
    if (w === 2) return 'أسبوعين';
    return w <= 10 ? `${arNum(w)} أسابيع` : `${arNum(w)} أسبوع`;
  }
  const m = Math.max(2, Math.round(d / 30.44));
  if (!ar) return `${m} months`;
  if (m === 2) return 'شهرين';
  return m <= 10 ? `${arNum(m)} شهور` : `${arNum(m)} شهر`;
};

const FORMAT: Record<string, B> = {
  REELS: { ar: 'ريلز', en: 'Reels' },
  VIDEO: { ar: 'فيديو', en: 'video' },
  IMAGE: { ar: 'صور مفردة', en: 'single images' },
  CAROUSEL_ALBUM: { ar: 'ألبومات', en: 'carousels' },
};

/** A link of any shape, and the aggregators that are a link without being a route. */
const URL_RE = /(https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(com|net|org|jo|co|io|me|shop|store|link|bio|ly|app)\b/i;
const AGGREGATOR_RE = /(linktr\.ee|linktree|beacons\.ai|linkin\.bio|lnk\.bio|bio\.link|taplink|milkshake|linkpop|solo\.to|campsite\.bio|allmylinks|shorby|snipfeed|hoo\.be|msha\.ke)/i;

/** The website reader takes several timing samples and reports the median.
 *  Read structurally so this module works either way: the copy must describe
 *  what was actually measured, and "one cold read" and "the median of three"
 *  are different sentences. */
type Timed = SiteRead & { msSamples?: number[] };

/**
 * Build the ledger.
 *
 * `site` is optional because a prospect may not have one — and not having one
 * is itself the strongest finding in the set for a business running ads. But
 * "no site" and "we could not read the site" are different sentences, and only
 * the first belongs to the client: `web.state` decides which, and a read that
 * failed leaves an operator note rather than an accusation.
 */
export function buildFindings(
  s: Signals,
  site?: SiteRead | null,
  // The default is inferred from `site` rather than fixed, so a caller that
  // forgets the third argument gets the harmless reading instead of telling a
  // prospect with a perfectly good website that they do not have one.
  web: Web = site ? { state: 'read' } : { state: 'no-url' },
): Findings {
  const f: Finding[] = [];
  const charts: Chart[] = [];
  const operatorNotes: { id: string; en: string }[] = [];
  const push = (x: Finding) => f.push(x);
  const T = THRESHOLDS;
  const readable = web.state === 'read' && !!site;

  // ── Instagram ─────────────────────────────────────────────────────────────

  // Nothing about reach may be said when the reactions were not returned.
  // Instagram omits `like_count` for an account that hides its like counts, and
  // the old code read that absence as zero.
  if (!s.engagementReliable) {
    // Which half went missing decides the sentence. Instagram omits
    // `like_count` for an account that hides its likes — but it also omits both
    // counts on some media types, and then the likes are not hidden at all.
    // Saying "you hide your like counts" to somebody who does not is a claim
    // about a setting we cannot see, so it is only made when the likes really
    // are the half that did not come back.
    const likesHidden = s.coverage.likesKnown < s.posts;
    const kn = s.coverage.engagementKnown;
    push({
      id: 'ig-likes-hidden',
      severity: 'notable',
      source: 'instagram',
      // Both counts, because both are what an engagement figure needs: the
      // likes alone came back for posts whose comments did not, and quoting
      // that as the coverage overstates what could be computed.
      figure: { ar: `${arNum(kn)}/${arNum(s.posts)}`, en: `${kn}/${s.posts}` },
      title: likesHidden
        ? { ar: 'حسابكم مخفي عدد الإعجابات', en: 'Your account hides its like counts' }
        : { ar: 'أرقام التفاعل ما رجعت كاملة', en: 'The reaction counts did not come back' },
      detail: {
        ar: `أرقام التفاعل رجعتلنا كاملة لـ ${num(kn, true)} من ${num(s.posts, true)} منشور بس، فما بنقدر نحسب من برا ولا رقم عن الوصول. اللي تحت مبني على التوقيتات والكابشنات — وهدول رجعوا كاملين.`,
        en: `Complete reaction counts came back for only ${num(kn, false)} of ${num(s.posts, false)} posts, so nothing about reach can be computed from outside. Everything below rests on timing and captions — which did come back in full.`,
      },
      provenance: {
        ar: 'من ردّ إنستغرام نفسه', en: 'From what Instagram returned',
      },
    });
  }

  // Prefer how they perform now, when "now" has a real sample of reactions
  // behind it — not merely a real sample of posts.
  const basis = engagementBasis(s);
  if (s.followers > 0 && s.engagementReliable && basis.sayable) {
    const rate = basis.rate;
    const med = Math.round(basis.median);
    // Self-referential on both branches: an absolute floor on reactions, or the
    // account performing worse now than three quarters of its own history.
    const low = med < T.ENGAGEMENT_MIN_MEDIAN
      || (basis.fresh && s.recentEngagementRate < s.selfP25Rate);
    push({
      id: 'ig-engagement',
      severity: low ? 'critical' : 'notable',
      source: 'instagram',
      figure: pctFig(n1(rate)),
      title: {
        ar: low ? 'حسابكم بيوصل لجزء صغير من متابعينه' : 'نسبة التفاعل',
        en: low ? 'Your account reaches a fraction of its own followers'
          : 'Engagement rate',
      },
      detail: {
        ar: `المنشور العادي عندكم بياخد ${num(med, true)} تفاعل، وعندكم ${num(s.followers, true)} متابع. يعني ${num(n1(rate), true)}٪.`,
        en: `A typical post draws ${num(med, false)} reactions against ${num(s.followers, false)} followers — ${n1(rate)}%.`,
      },
      provenance: basis.fresh
        ? {
          ar: `محسوب من ${num(basis.known, true)} منشور خلال آخر ${arNum(RECENT_DAYS)} يوم · وسيط`,
          en: `Computed from ${num(basis.known, false)} posts in the last ${RECENT_DAYS} days · median`,
        }
        : {
          ar: `محسوب من ${num(basis.known, true)} منشور · وسيط`,
          en: `Computed from ${num(basis.known, false)} posts · median`,
        },
    });
  }

  // The format split is usually the whole story: effort in one place, results
  // in another.
  const formatSplit = !!(s.engagementReliable && s.strongest && s.busiest
    && s.strongest.format !== s.busiest.format);
  if (formatSplit && s.strongest && s.busiest) {
    const st = FORMAT[s.strongest.format] ?? { ar: s.strongest.format, en: s.strongest.format };
    const bu = FORMAT[s.busiest.format] ?? { ar: s.busiest.format, en: s.busiest.format };
    push({
      id: 'ig-format',
      severity: 'critical',
      source: 'instagram',
      figure: pctFig(n0(s.strongest.shareEngagement)),
      title: {
        ar: 'شغلكم رايح بمكان، والنتيجة بمكان تاني',
        en: 'Your effort and your results are in different places',
      },
      // Both shares over the posts whose reactions came back. `shareEngagement`
      // has only ever had that denominator, and pairing it with a share of the
      // whole set put two denominators in one sentence that reads as one.
      detail: {
        ar: `${st.ar} هي ${num(n0(s.strongest.shareKnown), true)}٪ من المنشورات وبتحمل ${num(n0(s.strongest.shareEngagement), true)}٪ من التفاعل. و${num(n0(s.busiest.shareKnown), true)}٪ من شغلكم رايح على ${bu.ar}.`,
        en: `${st.en} are ${n0(s.strongest.shareKnown)}% of your posts and carry ${n0(s.strongest.shareEngagement)}% of all engagement. Meanwhile ${n0(s.busiest.shareKnown)}% of your effort goes into ${bu.en}.`,
      },
      provenance: {
        ar: `${num(s.strongest.known, true)} ${st.ar} مقابل ${num(s.busiest.known, true)} ${bu.ar}`,
        en: `${num(s.strongest.known, false)} ${st.en} against ${num(s.busiest.known, false)} ${bu.en}`,
      },
    });
  }

  // Posting at the wrong hour is the cheapest thing on this list to fix — but
  // only when the two windows are genuinely different windows, the habit is a
  // habit, and the better window beat the rest of the day by a margin.
  if (
    s.engagementReliable && s.bestWindow
    && s.peakWindow.share >= T.WINDOW_MIN_PEAK_SHARE
    && !windowsOverlap(s.peakWindow, s.bestWindow)
  ) {
    const bw = s.bestWindow;
    push({
      id: 'ig-window',
      severity: 'notable',
      source: 'instagram',
      figure: pctFig(n0(s.peakWindow.share)),
      title: {
        ar: 'بتنشروا بوقت مش وقتكم',
        en: 'You post in the wrong window',
      },
      detail: {
        ar: `${num(n0(s.peakWindow.share), true)}٪ من منشوراتكم بتنزل بين ${span(s.peakWindow.from, s.peakWindow.to, true)}. بس أقوى منشوراتكم بتنزل بين ${span(bw.from, bw.to, true)}.`,
        en: `${n0(s.peakWindow.share)}% of your posts go out between ${span(s.peakWindow.from, s.peakWindow.to, false)}. Your best-performing ones land between ${span(bw.from, bw.to, false)}.`,
      },
      provenance: {
        ar: `محسوب من ${num(bw.n, true)} منشور بهاي الساعة · ${num(n1(bw.vsRest), true)} ضعف باقي اليوم`,
        en: `Computed from ${num(bw.n, false)} posts in that window · ${n1(bw.vsRest)}× the rest of the day`,
      },
    });
  }

  // What the caption asks for. The denominator is the captioned posts, not
  // every post — a set where half carry no caption used to halve this share
  // for a reason the copy never mentioned.
  if (s.captions.withCaption > 0 && s.captions.askingShare < T.ASK_NOTABLE_SHARE) {
    push({
      id: 'ig-ask',
      severity: s.captions.askingShare < T.ASK_CRITICAL_SHARE ? 'critical' : 'notable',
      source: 'instagram',
      figure: pctFig(n0(s.captions.askingShare)),
      // "never ask" is only true when nobody asked. On a set where four
      // captions out of forty carry a request the headline was simply false,
      // and one refutable sentence discredits the twenty beside it.
      title: s.captions.asking === 0
        ? { ar: 'كابشناتكم بتوصف، وما بتطلب', en: 'Your captions describe, and never ask' }
        : { ar: 'كابشناتكم بتوصف، وقلّ ما بتطلب', en: 'Your captions describe, and rarely ask' },
      detail: {
        ar: `${num(s.captions.asking, true)} من ${num(s.captions.withCaption, true)} منشور فيهم طلب واضح. الباقي بيحكي عن المنتج وبيوقف هناك.`,
        en: `${num(s.captions.asking, false)} of ${num(s.captions.withCaption, false)} captioned posts carry a clear request. The rest describe the product and stop there.`,
      },
      provenance: {
        ar: `${num(s.captions.none, true)} منشور بدون كابشن أصلًا · ${num(s.captions.questioning, true)} فيهم سؤال بس`,
        en: `${num(s.captions.none, false)} posts carry no caption at all · ${num(s.captions.questioning, false)} ask a question but request nothing`,
      },
    });
  }

  if (s.posts > 0 && (s.captions.none / s.posts) * 100 >= T.NO_CAPTION_SHARE) {
    push({
      id: 'ig-no-caption',
      severity: 'notable',
      source: 'instagram',
      figure: pctFig(n0((s.captions.none / s.posts) * 100)),
      title: { ar: 'ربع منشوراتكم بدون كلام', en: 'A quarter of your posts say nothing' },
      detail: {
        ar: `${num(s.captions.none, true)} من ${num(s.posts, true)} منشور نزلوا بدون كابشن. الصورة لحالها ما بتحكي شو بتبيعوا ولا كيف حدا بيوصلكم.`,
        en: `${num(s.captions.none, false)} of ${num(s.posts, false)} posts went out with no caption at all. An image on its own says neither what you sell nor how to reach you.`,
      },
      provenance: { ar: 'محسوب من الكابشنات', en: 'Computed from captions' },
    });
  }

  // Silence is a finding. `daysSinceLast` is measured against the read, not
  // against the last post in the window, so a burst two years ago reads as one.
  if (s.daysSinceLast >= T.DORMANT_DAYS) {
    const d = Math.round(s.daysSinceLast);
    push({
      id: 'ig-dormant',
      severity: 'critical',
      source: 'instagram',
      figure: { ar: days(d, true), en: `${n0(d)}d` },
      title: { ar: 'الحساب واقف', en: 'The account has stopped' },
      detail: {
        ar: `آخر منشور كان من ${days(d, true)}، بتاريخ ${dayMonth(s.last, 'ar', true)}. أي إعلان بتشغّلوه بيوصّل زبون لصفحة شكلها مسكّرة.`,
        en: `The last post was ${days(d, false)} ago, on ${dayMonth(s.last, 'en', true)}. Any advert you run now sends a stranger to a profile that looks closed.`,
      },
      provenance: {
        ar: 'محسوب من تاريخ آخر منشور', en: 'Computed from the last post date',
      },
    });
  }

  // ── what is working ───────────────────────────────────────────────────────
  // Every candidate below is provable from a number already computed. The
  // invariant at the bottom guarantees at least one of them survives.

  if (s.engagementReliable && s.best && s.best.multiple >= T.BEST_MULTIPLE) {
    push({
      id: 'ig-best',
      severity: 'good',
      source: 'instagram',
      figure: { ar: `${arNum(n1(s.best.multiple))}×`, en: `${n1(s.best.multiple)}×` },
      title: { ar: 'عندكم منشور اشتغل فعلًا', en: 'One post genuinely worked' },
      detail: {
        ar: `أقوى منشور عندكم أخذ ${num(n1(s.best.multiple), true)} ضعف تفاعل المنشور العادي. الشكل اللي اشتغل معروف — المشكلة إنه ما تكرر.`,
        en: `Your strongest post drew ${n1(s.best.multiple)}× the engagement of a typical one. The shape that worked is known — it simply was not repeated.`,
      },
      provenance: { ar: 'محسوب · أعلى منشور', en: 'Computed · highest post' },
    });
  }

  if (s.postsPerWeek >= T.CADENCE_MIN_PER_WEEK && s.daysSinceLast <= T.CADENCE_MAX_DAYS_SINCE) {
    push({
      id: 'ig-cadence',
      severity: 'good',
      source: 'instagram',
      figure: numFig(n1(s.postsPerWeek)),
      title: { ar: 'بتنشروا باستمرار', en: 'You publish consistently' },
      detail: {
        ar: `${num(n1(s.postsPerWeek), true)} منشور بالأسبوع خلال آخر ${arNum(RECENT_DAYS)} يوم، وإنتو ناشرين من ${months(s.activeSpanDays, true)}. الكمية مش مشكلتكم.`,
        en: `${n1(s.postsPerWeek)} posts a week over the last ${RECENT_DAYS} days, and you have been publishing for ${months(s.activeSpanDays, false)}. Volume is not your problem.`,
      },
      provenance: {
        ar: `${num(s.recentPosts, true)} منشور خلال آخر ${arNum(RECENT_DAYS)} يوم`,
        en: `${num(s.recentPosts, false)} posts in the last ${RECENT_DAYS} days`,
      },
    });
  }

  // The leading format as an asset rather than an accusation — but only when
  // the accusation was not already made.
  const top = s.formats[0];
  if (
    !formatSplit && s.engagementReliable && s.formats.length > 1
    && top && top.shareEngagement >= T.FORMAT_STRENGTH_SHARE
  ) {
    const st = FORMAT[top.format] ?? { ar: top.format, en: top.format };
    push({
      id: 'ig-format-strength',
      severity: 'good',
      source: 'instagram',
      figure: pctFig(n0(top.shareEngagement)),
      title: { ar: 'عارفين أي شكل بيشتغل معكم', en: 'You already know which shape works' },
      detail: {
        ar: `${st.ar} بتحمل ${num(n0(top.shareEngagement), true)}٪ من التفاعل عندكم. هاد مش نقص — هاد شكل مثبت نقدر نبني عليه بدل ما نجرب من الصفر.`,
        en: `${st.en} carry ${n0(top.shareEngagement)}% of your engagement. That is not a gap — it is a proven shape to build on instead of starting from nothing.`,
      },
      provenance: {
        ar: `محسوب من ${num(top.known, true)} منشور`,
        en: `Computed from ${num(top.known, false)} posts`,
      },
    });
  }

  if (s.captions.medianWords >= T.CAPTION_MIN_WORDS) {
    push({
      id: 'ig-captions',
      severity: 'good',
      source: 'instagram',
      figure: numFig(n0(s.captions.medianWords)),
      title: { ar: 'بتكتبوا فعلًا', en: 'You actually write' },
      detail: {
        ar: `الكابشن العادي عندكم ${num(n0(s.captions.medianWords), true)} كلمة. يعني في حدا بيتعب على الكلام — بس ما بيطلب بآخره إشي.`,
        en: `Your typical caption runs ${n0(s.captions.medianWords)} words. Somebody is putting work into the writing — it simply never ends in a request.`,
      },
      provenance: {
        ar: `محسوب من ${num(s.captions.withCaption, true)} كابشن`,
        en: `Computed from ${num(s.captions.withCaption, false)} captions`,
      },
    });
  }

  if (s.activeSpanDays >= T.LONGEVITY_MIN_DAYS) {
    push({
      id: 'ig-longevity',
      severity: 'good',
      source: 'instagram',
      figure: { ar: months(s.activeSpanDays, true), en: months(s.activeSpanDays, false) },
      title: { ar: 'الحساب مش جديد', en: 'The account is not new' },
      detail: {
        ar: `إنتو ناشرين على هاد الحساب من ${months(s.activeSpanDays, true)}، و${num(s.posts, true)} منشور منهم قدامنا. اللي بينبنى على أرشيف موجود أرخص من اللي بيبدأ من صفر.`,
        en: `You have been publishing on this account for ${months(s.activeSpanDays, false)}, and ${num(s.posts, false)} of those posts are in front of us. Building on an archive costs less than starting from nothing.`,
      },
      provenance: {
        ar: `من ${dayMonth(s.first, 'ar', true)}`,
        en: `Since ${dayMonth(s.first, 'en', true)}`,
      },
    });
  }

  // ── the bio ───────────────────────────────────────────────────────────────
  // Only when a bio was read. Absent is not empty, and an empty bio is a
  // critical finding — so guessing between the two is not allowed.
  if (s.bio) {
    const text = (s.bio.biography ?? '').trim();
    const link = (s.bio.website ?? '').trim();
    const aggregator = AGGREGATOR_RE.test(text) || AGGREGATOR_RE.test(link);
    // An aggregator counts as a link even when its TLD is not one `URL_RE`
    // knows: `linktr.ee` is a link, and calling it "no link at all" would fire
    // the wrong finding at the wrong severity.
    const hasLink = !!link || aggregator || URL_RE.test(text);
    const hasRoute = WA_ROUTE_RE.test(text) || WA_ROUTE_RE.test(link);

    if (!hasLink && !hasRoute) {
      push({
        id: 'ig-bio-noroute',
        severity: 'critical',
        source: 'instagram',
        title: {
          ar: 'البايو ما بيوصّل لحدا على إشي',
          en: 'Your bio leads nowhere',
        },
        detail: {
          ar: 'ما في رابط ولا رقم ولا واتساب بالبايو. الغريب اللي فتح البروفايل بعد إعلان ما عنده وين يروح، فبيرجع.',
          en: 'There is no link, no number and no WhatsApp in the bio. A stranger who opens the profile after an advert has nowhere to go, so they leave.',
        },
        provenance: { ar: 'قراءة البايو', en: 'Read from the bio' },
      });
    } else if (hasLink && hasRoute) {
      push({
        id: 'ig-bio-good',
        severity: 'good',
        source: 'instagram',
        title: { ar: 'البايو فيه طريق', en: 'Your bio has a route out' },
        detail: {
          ar: 'في رابط وفي طريق واتساب بالبايو. يعني الزيارة الجاية من إعلان إلها وين تروح من أول يوم.',
          en: 'The bio carries both a link and a WhatsApp route. A visit arriving from an advert has somewhere to go on day one.',
        },
        provenance: { ar: 'قراءة البايو', en: 'Read from the bio' },
      });
    } else if (aggregator) {
      push({
        id: 'ig-bio-linktree',
        severity: 'notable',
        source: 'instagram',
        title: { ar: 'البايو بيوصّل لصفحة روابط', en: 'Your bio leads to a list of links' },
        detail: {
          ar: 'الرابط بالبايو صفحة روابط، مش طريق مباشر. كل ضغطة زيادة بتخسّر ناس، وصفحة الروابط ما بتقدروا تقيسوا عليها ولا تركّبوا عليها بكسل.',
          en: 'The bio link is a list of links rather than a direct route. Every extra tap loses people, and a link page is not something you can measure or put a pixel on.',
        },
        provenance: { ar: 'قراءة البايو', en: 'Read from the bio' },
      });
    }
  }

  // ── the website ───────────────────────────────────────────────────────────
  // Four states, three of which used to collapse into "no site". Only the first
  // is a sentence a client should ever read.
  if (web.state === 'no-url') {
    push({
      id: 'web-none',
      severity: 'critical',
      source: 'website',
      title: {
        ar: 'ما في موقع نوصل عليه',
        en: 'There is no site to send anyone to',
      },
      detail: {
        ar: 'كل إعلان بتدفعوا عليه بيوقف عند الإنستغرام. ما في صفحة تقيس، ولا مكان ترجعوا فيه لحدا زار وما اشترى.',
        en: 'Every dinar of advertising stops at Instagram. There is no page to measure, and nowhere to bring back somebody who looked and did not buy.',
      },
      provenance: { ar: 'ما في رابط بالبايو ولا انكتب إلنا', en: 'No link in the bio, and none given' },
    });
  } else if (web.state === 'unreadable') {
    operatorNotes.push({
      id: 'web-unreadable',
      en: `The website was given but could not be read (${web.reason ?? 'unknown'}). No website finding was emitted — the site may be fine and blocking our reader. Check it by hand before the call.`,
    });
  } else if (web.state === 'error-page') {
    operatorNotes.push({
      id: 'web-error-page',
      en: `The website answered HTTP ${web.status ?? 0}. Whatever we parsed is an error page, not their site, so every website finding was suppressed. Check the URL by hand.`,
    });
  }

  if (site && readable) {
    // For an agency that also runs the ads, this is the finding.
    if (!site.metaPixel) {
      push({
        id: 'web-pixel',
        severity: 'critical',
        source: 'website',
        title: {
          ar: 'موقعكم ما بيشوف مين بيزوره',
          en: 'Your site cannot see who visits it',
        },
        detail: {
          ar: 'ما في بكسل ميتا على الموقع. يعني ما بتقدروا تعرفوا أي إعلان جاب زبون، ولا ترجعوا لحدا زار الموقع وما اشترى — وهدول أرخص جمهورين ممكن تشتروهم.',
          en: 'There is no Meta pixel on the site. No advert can be traced to a sale, and nobody who visited and left can be reached again — and those are the two cheapest audiences money can buy.',
        },
        provenance: { ar: 'قراءة كود الصفحة', en: 'Read from the page source' },
      });
    }
    if (!site.mobileReady) {
      push({
        id: 'web-mobile',
        severity: 'critical',
        source: 'website',
        title: { ar: 'الموقع مش معمول للموبايل', en: 'The site was not made for a phone' },
        detail: {
          ar: 'ما في viewport بالصفحة. كل زيارة جاية من إنستغرام هي زيارة من موبايل.',
          en: 'The page carries no viewport tag. Every visit arriving from Instagram is a visit from a phone.',
        },
        provenance: { ar: 'قراءة كود الصفحة', en: 'Read from the page source' },
      });
    }
    if (!site.whatsapp) {
      push({
        id: 'web-whatsapp',
        severity: 'notable',
        source: 'website',
        title: { ar: 'ما في واتساب على الموقع', en: 'No WhatsApp on the site' },
        detail: {
          ar: 'بالأردن البيعة بتسكّر على الواتساب. الموقع فيه رقم بس بدون رابط واتساب، يعني الزبون لازم ينسخ الرقم بإيده.',
          en: 'In Jordan the sale closes on WhatsApp. The site gives a number but no WhatsApp link, so a buyer has to copy it out by hand.',
        },
        provenance: { ar: 'قراءة كود الصفحة', en: 'Read from the page source' },
      });
    }
    if (!site.showsPrice) {
      push({
        id: 'web-price',
        severity: 'notable',
        source: 'website',
        title: { ar: 'ما في سعر مكتوب', en: 'No price anywhere' },
        detail: {
          ar: 'الغريب ما بيعرف قدّيش بتكلّف. أول سؤال بيوصلكم على الواتساب هو «قدّيش؟» — وهاد سؤال ممكن الصفحة تجاوب عليه لحالها.',
          en: 'A stranger cannot tell what anything costs. The first question that reaches your WhatsApp is “how much?” — a question the page could answer by itself.',
        },
        provenance: { ar: 'قراءة نص الصفحة', en: 'Read from the page copy' },
      });
    }
    if (site.ms > T.SITE_MS_NOTABLE) {
      // Say exactly what was measured. `ms` is time-to-HTML from a machine
      // outside Jordan — not a page load, not LCP, and not a claim about the
      // reader's connection. D3 supplies `msSamples`; until it does, this is
      // honestly described as the single cold sample it is.
      const samples = (site as Timed).msSamples;
      const many = Array.isArray(samples) && samples.length >= 2;
      const secs = n1(site.ms / 1000);
      push({
        id: 'web-slow',
        severity: site.ms > T.SITE_MS_CRITICAL ? 'critical' : 'notable',
        source: 'website',
        figure: { ar: `${arNum(secs)} ثانية`, en: `${secs}s` },
        title: { ar: 'الموقع بطيء', en: 'The site is slow' },
        detail: many
          ? {
            ar: `الصفحة (HTML بس، بدون صور) وصلتنا بـ ${num(secs, true)} ثانية — وسيط ${num(samples.length, true)} قراءات، قبل ما تحمّل أي صورة.`,
            en: `Your HTML alone — before a single image — took ${secs} seconds to reach us, the median of ${samples.length} requests.`,
          }
          : {
            ar: `الصفحة (HTML بس، بدون صور) وصلتنا بـ ${num(secs, true)} ثانية بقراءة وحدة باردة، قبل ما تحمّل أي صورة.`,
            en: `Your HTML alone — before a single image — took ${secs} seconds to reach us on a single cold request.`,
          },
        provenance: many
          ? {
            ar: `مقاس من خارج الأردن · ${num(samples.length, true)} قراءات · وسيط`,
            en: `Measured from outside Jordan · ${samples.length} reads · median`,
          }
          : {
            ar: 'مقاس من خارج الأردن · قراءة وحدة باردة',
            en: 'Measured from outside Jordan · one cold read',
          },
      });
    }
    if (site.metaPixel) {
      push({
        id: 'web-pixel-good',
        severity: 'good',
        source: 'website',
        title: { ar: 'البكسل مركّب', en: 'The pixel is installed' },
        detail: {
          ar: 'في بكسل ميتا على الموقع، يعني في أساس نقدر نبني عليه من أول يوم.',
          en: 'A Meta pixel is on the site, which means there is something to build on from day one.',
        },
        provenance: { ar: 'قراءة كود الصفحة', en: 'Read from the page source' },
      });
    }
    if (site.lang?.startsWith('ar') || site.hasArabic) {
      push({
        id: 'web-arabic',
        severity: 'good',
        source: 'website',
        title: { ar: 'الموقع بيحكي عربي', en: 'The site speaks Arabic' },
        detail: {
          ar: 'في عربي على الصفحة. يعني الزيارة الجاية من إعلان عربي بتلاقي نفس اللغة اللي جابتها — وهاد نص الشغل.',
          en: 'There is Arabic on the page. A visit arriving from an Arabic advert meets the language that brought it, which is half the work.',
        },
        provenance: { ar: 'قراءة نص الصفحة', en: 'Read from the page copy' },
      });
    }
    if (site.whatsapp) {
      push({
        id: 'web-whatsapp-good',
        severity: 'good',
        source: 'website',
        title: { ar: 'في واتساب على الموقع', en: 'WhatsApp is on the site' },
        detail: {
          ar: 'في رابط واتساب على الصفحة، يعني الطريق من الزيارة للمحادثة مفتوح بضغطة وحدة.',
          en: 'A WhatsApp link is on the page, so the road from a visit to a conversation is one tap long.',
        },
        provenance: { ar: 'قراءة كود الصفحة', en: 'Read from the page source' },
      });
    }
    if (site.showsPrice) {
      push({
        id: 'web-price-good',
        severity: 'good',
        source: 'website',
        title: { ar: 'السعر مكتوب', en: 'The price is on the page' },
        detail: {
          ar: 'الصفحة بتحكي السعر. يعني اللي بيوصلكم على الواتساب وصل وهو عارف قدّيش — وهدول ناس أقرب للشرا.',
          en: 'The page states a price. Anyone who reaches your WhatsApp already knows what it costs, and those are people closer to buying.',
        },
        provenance: { ar: 'قراءة نص الصفحة', en: 'Read from the page copy' },
      });
    }
    if (site.mobileReady) {
      push({
        id: 'web-mobile-good',
        severity: 'good',
        source: 'website',
        title: { ar: 'الموقع معمول للموبايل', en: 'The site was built for a phone' },
        detail: {
          ar: 'في viewport بالصفحة، يعني الموقع معمول للشاشة اللي رح تفتحه — كل الزيارات الجاية من إنستغرام من موبايل.',
          en: 'The page carries a viewport tag, so it was built for the screen that will open it — every visit arriving from Instagram comes from a phone.',
        },
        provenance: { ar: 'قراءة كود الصفحة', en: 'Read from the page source' },
      });
    }
    if (site.ms < T.SITE_MS_FAST) {
      push({
        id: 'web-fast',
        severity: 'good',
        source: 'website',
        figure: { ar: `${arNum(n1(site.ms / 1000))} ثانية`, en: `${n1(site.ms / 1000)}s` },
        title: { ar: 'الموقع سريع', en: 'The site is quick' },
        detail: {
          ar: `الـ HTML وصلنا بـ ${num(n1(site.ms / 1000), true)} ثانية. الزيارة الجاية من إعلان بتلحق تشوف الصفحة قبل ما تزهق.`,
          en: `Your HTML reached us in ${n1(site.ms / 1000)} seconds. A visit arriving from an advert sees the page before it gives up.`,
        },
        provenance: {
          ar: 'مقاس من خارج الأردن · HTML بس', en: 'Measured from outside Jordan · HTML only',
        },
      });
    }
  }

  // ── the invariant ─────────────────────────────────────────────────────────
  // A teardown that only takes is read once and never answered. If nothing
  // above qualified, say the smallest true thing: they have been at this a
  // while, or — failing even that — they are still here.
  if (!f.some((x) => x.severity === 'good')) {
    push({
      id: 'ig-live',
      severity: 'good',
      source: 'instagram',
      figure: numFig(n0(s.posts)),
      title: { ar: 'الحساب شغّال', en: 'The account is live' },
      detail: {
        ar: `${num(s.posts, true)} منشور قدامنا، آخرهم ${dayMonth(s.last, 'ar', true)}. في حساب شغّال نبدأ منه — مش صفحة فاضية.`,
        en: `${num(s.posts, false)} posts are in front of us, the most recent on ${dayMonth(s.last, 'en', true)}. There is a working account to start from, not an empty page.`,
      },
      provenance: {
        ar: `قراءة ${num(s.posts, true)} منشور`, en: `Read from ${num(s.posts, false)} posts`,
      },
    });
  }

  // ── charts ────────────────────────────────────────────────────────────────
  // The format chart is an engagement claim, so it obeys the same coverage gate
  // as the findings that make it.
  //
  // Two rules the old chart broke. The bars were relative to the weakest
  // format, floored at one — so on an account whose weakest format had a median
  // of zero the floor became 1 and every bar was a raw reaction count with a
  // "×" after it: "30×" for thirty likes, read as thirty times something. The
  // denominator is now the account's own typical post, which is the comparison
  // the note has always claimed to be making. And a format with two known posts
  // has no median worth drawing, so it is left out rather than plotted.
  const shownFormats = s.formats.filter((x) => x.known >= T.FORMAT_CHART_MIN_KNOWN);
  if (
    s.engagementReliable && shownFormats.length > 1
    && s.medianEngagement >= T.FORMAT_CHART_MIN_MEDIAN
  ) {
    charts.push({
      kind: 'bars', id: 'formats',
      title: { ar: 'أي شكل بيشتغل', en: 'Which format works' },
      note: {
        ar: 'التفاعل النموذجي لكل شكل، منسوب للمنشور العادي عندكم.',
        en: 'Typical engagement per format, against your own typical post.',
      },
      series: shownFormats.map((x) => ({
        label: FORMAT[x.format] ?? { ar: x.format, en: x.format },
        value: Math.round((x.medianEngagement / s.medianEngagement) * 10) / 10,
        caption: `${Math.round(x.sharePosts)}%`,
        hi: x.format === s.strongest?.format,
      })),
    });
  }

  charts.push({
    kind: 'hours', id: 'hours',
    title: { ar: 'إمتى بتنشروا', en: 'When you publish' },
    note: {
      ar: 'كل منشور بساعته، بتوقيت عمّان.',
      en: 'Every post by the hour it went out, Amman time.',
    },
    byHour: s.byHour,
    peak: [s.peakWindow.from, s.peakWindow.to],
    // The habit band is a count of posts and always safe. The `best` band is an
    // engagement claim drawn on a chart, so it obeys the same coverage gate as
    // every sentence that makes one — a band over a partly-blank set is a claim
    // about the hours whose numbers happened to come back.
    best: s.engagementReliable && s.bestWindow
      ? [s.bestWindow.from, s.bestWindow.to] : undefined,
  });

  // Three compliments is the ceiling; past that the sheet stops being a
  // teardown. The earliest ones survive, which is the authored priority order.
  let good = 0;
  const kept = f.filter((x) => x.severity !== 'good' || ++good <= T.GOOD_MAX);

  // Critical first, then notable, then what is working — the order the plan
  // specifies: recognition, discomfort, then hope.
  const rank: Record<Severity, number> = { critical: 0, notable: 1, good: 2 };
  kept.sort((a, b) => rank[a.severity] - rank[b.severity]);

  return {
    findings: kept,
    charts,
    operatorNotes,
    read: { posts: s.posts, site: readable, adsChecked: false },
  };
}
