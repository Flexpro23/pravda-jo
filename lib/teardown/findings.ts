import type { Signals } from '@/lib/teardown/signals';
import type { SiteRead } from '@/lib/meta/website';

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
 * is read once and never answered.
 */

type B = { ar: string; en: string };

export type Severity = 'critical' | 'notable' | 'good';
export type Source = 'instagram' | 'website' | 'ads';

export type Finding = {
  id: string;
  severity: Severity;
  source: Source;
  /** The one number this turns on, already formatted. */
  figure?: string;
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
  /** A count of what was read, for the provenance block. */
  read: { posts: number; site: boolean; adsChecked: boolean };
};

const n0 = (x: number) => Math.round(x).toString();
const n1 = (x: number) => (Math.round(x * 10) / 10).toString();
const ar = (s: string | number) => String(s)
  .replace(/(?<=\d)\.(?=\d)/g, '٫').replace(/(?<=\d),(?=\d)/g, '٬')
  .replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[+d]);

const hour = (h: number, arb: boolean) => {
  const t = h % 12 === 0 ? 12 : h % 12;
  if (!arb) return `${t}${h < 12 ? 'am' : 'pm'}`;
  const part = h < 12 ? 'الصبح' : h < 16 ? 'بعد الضهر' : h < 19 ? 'العصر' : 'المسا';
  return `${ar(t)} ${part}`;
};
const span = (a: number, b: number, arb: boolean) => `${hour(a, arb)}–${hour(b, arb)}`;

const FORMAT: Record<string, B> = {
  REELS: { ar: 'ريلز', en: 'Reels' },
  VIDEO: { ar: 'فيديو', en: 'video' },
  IMAGE: { ar: 'صور مفردة', en: 'single images' },
  CAROUSEL_ALBUM: { ar: 'ألبومات', en: 'carousels' },
};

/**
 * Build the ledger.
 *
 * `site` is optional because a prospect may not have one — and not having one
 * is itself the strongest finding in the set for a business running ads.
 */
export function buildFindings(s: Signals, site?: SiteRead | null, siteAsked = false): Findings {
  const f: Finding[] = [];
  const charts: Chart[] = [];
  const push = (x: Finding) => f.push(x);

  // ── Instagram ─────────────────────────────────────────────────────────────
  if (s.followers > 0) {
    const rate = s.engagementRate;
    const med = Math.round(s.medianEngagement);
    push({
      id: 'ig-engagement',
      severity: rate < 1 ? 'critical' : 'notable',
      source: 'instagram',
      figure: `${n1(rate)}%`,
      title: {
        ar: rate < 1 ? 'حسابكم بيوصل لجزء صغير من متابعينه' : 'نسبة التفاعل',
        en: rate < 1 ? 'Your account reaches a fraction of its own followers'
          : 'Engagement rate',
      },
      detail: {
        ar: `المنشور العادي عندكم بياخد ${ar(med)} تفاعل، وعندكم ${ar(s.followers.toLocaleString('en-US'))} متابع. يعني ${ar(n1(rate))}٪.`,
        en: `A typical post draws ${med.toLocaleString('en-US')} reactions against ${s.followers.toLocaleString('en-US')} followers — ${n1(rate)}%.`,
      },
      provenance: {
        ar: `محسوب من ${ar(s.posts)} منشور`, en: `Computed from ${s.posts} posts`,
      },
    });
  }

  // The format split is usually the whole story: effort in one place, results
  // in another.
  if (s.strongest && s.busiest && s.strongest.format !== s.busiest.format) {
    const st = FORMAT[s.strongest.format] ?? { ar: s.strongest.format, en: s.strongest.format };
    const bu = FORMAT[s.busiest.format] ?? { ar: s.busiest.format, en: s.busiest.format };
    push({
      id: 'ig-format',
      severity: 'critical',
      source: 'instagram',
      figure: `${n0(s.strongest.shareEngagement)}%`,
      title: {
        ar: 'شغلكم رايح بمكان، والنتيجة بمكان تاني',
        en: 'Your effort and your results are in different places',
      },
      detail: {
        ar: `${st.ar} هي ${ar(n0(s.strongest.sharePosts))}٪ من المنشورات وبتحمل ${ar(n0(s.strongest.shareEngagement))}٪ من التفاعل. و${ar(n0(s.busiest.sharePosts))}٪ من شغلكم رايح على ${bu.ar}.`,
        en: `${st.en} are ${n0(s.strongest.sharePosts)}% of your posts and carry ${n0(s.strongest.shareEngagement)}% of all engagement. Meanwhile ${n0(s.busiest.sharePosts)}% of your effort goes into ${bu.en}.`,
      },
      provenance: { ar: `محسوب من ${ar(s.posts)} منشور`, en: `Computed from ${s.posts} posts` },
    });
  }

  // Posting at the wrong hour is the cheapest thing on this list to fix.
  if (s.bestWindow && (s.bestWindow.from !== s.peakWindow.from)) {
    push({
      id: 'ig-window',
      severity: 'notable',
      source: 'instagram',
      figure: `${n0(s.peakWindow.share)}%`,
      title: {
        ar: 'بتنشروا بوقت مش وقتكم',
        en: 'You post in the wrong window',
      },
      detail: {
        ar: `${ar(n0(s.peakWindow.share))}٪ من منشوراتكم بتنزل بين ${span(s.peakWindow.from, s.peakWindow.to, true)}. بس أقوى منشوراتكم بتنزل بين ${span(s.bestWindow.from, s.bestWindow.to, true)}.`,
        en: `${n0(s.peakWindow.share)}% of your posts go out between ${span(s.peakWindow.from, s.peakWindow.to, false)}. Your best-performing ones land between ${span(s.bestWindow.from, s.bestWindow.to, false)}.`,
      },
      provenance: { ar: 'محسوب من التوقيتات', en: 'Computed from post timestamps' },
    });
  }

  if (s.captions.withCaption > 0 && s.captions.askingShare < 25) {
    push({
      id: 'ig-ask',
      severity: 'critical',
      source: 'instagram',
      figure: `${n0(s.captions.askingShare)}%`,
      title: {
        ar: 'كابشناتكم بتوصف، وما بتطلب',
        en: 'Your captions describe, and never ask',
      },
      detail: {
        ar: `${ar(s.captions.asking)} من ${ar(s.posts)} منشور فيهم سؤال أو طلب. الباقي بيحكي عن المنتج وبيوقف هناك.`,
        en: `${s.captions.asking} of ${s.posts} posts contain a question or a request. The rest describe the product and stop there.`,
      },
      provenance: { ar: 'محسوب من الكابشنات', en: 'Computed from captions' },
    });
  }

  // Something that is genuinely working. There must always be one.
  if (s.best && s.best.multiple >= 2) {
    push({
      id: 'ig-best',
      severity: 'good',
      source: 'instagram',
      figure: `${n1(s.best.multiple)}×`,
      title: { ar: 'عندكم منشور اشتغل فعلًا', en: 'One post genuinely worked' },
      detail: {
        ar: `أقوى منشور عندكم أخذ ${ar(n1(s.best.multiple))} ضعف تفاعل المنشور العادي. الشكل اللي اشتغل معروف — المشكلة إنه ما تكرر.`,
        en: `Your strongest post drew ${n1(s.best.multiple)}× the engagement of a typical one. The shape that worked is known — it simply was not repeated.`,
      },
      provenance: { ar: 'محسوب · أعلى منشور', en: 'Computed · highest post' },
    });
  }

  if (s.postsPerWeek >= 2) {
    push({
      id: 'ig-cadence',
      severity: 'good',
      source: 'instagram',
      figure: n1(s.postsPerWeek),
      title: { ar: 'بتنشروا باستمرار', en: 'You publish consistently' },
      detail: {
        ar: `${ar(n1(s.postsPerWeek))} منشور بالأسبوع على مدى ${ar(n0(s.spanDays / 30))} شهر. الكمية مش مشكلتكم.`,
        en: `${n1(s.postsPerWeek)} posts a week across ${n0(s.spanDays / 30)} months. Volume is not your problem.`,
      },
      provenance: { ar: 'محسوب · التوقيتات', en: 'Computed · timestamps' },
    });
  }

  // ── the website ───────────────────────────────────────────────────────────
  if (siteAsked && !site) {
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
      provenance: { ar: 'محاولة قراءة الموقع', en: 'Attempted to read the site' },
    });
  }

  if (site) {
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
    if (site.ms > 3000) {
      push({
        id: 'web-slow',
        severity: 'notable',
        source: 'website',
        figure: `${n1(site.ms / 1000)}s`,
        title: { ar: 'الموقع بطيء', en: 'The site is slow' },
        detail: {
          ar: `الصفحة أخذت ${ar(n1(site.ms / 1000))} ثانية تحمّل من عندنا، على اتصال جيد. الزيارة الجاية من إعلان بتروح قبل هيك.`,
          en: `The page took ${n1(site.ms / 1000)} seconds to load for us, on a good connection. A visit arriving from a paid advert leaves before that.`,
        },
        provenance: { ar: 'مقاس وقت القراءة', en: 'Measured when we read it' },
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
  }

  // ── charts ────────────────────────────────────────────────────────────────
  if (s.formats.length > 1) {
    const floor = Math.min(...s.formats.map((x) => x.medianEngagement)) || 1;
    charts.push({
      kind: 'bars', id: 'formats',
      title: { ar: 'أي شكل بيشتغل', en: 'Which format works' },
      note: {
        ar: 'التفاعل النموذجي لكل شكل، منسوب لأضعفهم.',
        en: 'Typical engagement per format, against the weakest.',
      },
      series: s.formats.map((x) => ({
        label: FORMAT[x.format] ?? { ar: x.format, en: x.format },
        value: Math.round((x.medianEngagement / floor) * 10) / 10,
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
    best: s.bestWindow ? [s.bestWindow.from, s.bestWindow.to] : undefined,
  });

  // Critical first, then notable, then what is working — the order the plan
  // specifies: recognition, discomfort, then hope.
  const rank: Record<Severity, number> = { critical: 0, notable: 1, good: 2 };
  f.sort((a, b) => rank[a.severity] - rank[b.severity]);

  return {
    findings: f,
    charts,
    read: { posts: s.posts, site: !!site, adsChecked: false },
  };
}
