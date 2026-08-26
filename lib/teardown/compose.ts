/**
 * Signals become a report — but only the parts arithmetic can honestly write.
 *
 * Everything here is a restatement of a computed number. Nothing compares the
 * subject to a sector, because no benchmark has been gathered yet and an
 * invented one is the fastest way to lose a reader who knows their own trade.
 * Every comparison is therefore self-referential: this account against itself,
 * which is both provable and, for most owners, the more uncomfortable read.
 *
 * The judgement sections — verdict, what is working, the five fixes, the three
 * concepts, the plan — are deliberately left as placeholders. They need the
 * concept library and a writing pass. A report holding them is `draft`, and
 * `getTeardown` refuses to serve a draft, so an unfinished teardown cannot
 * reach a recipient even if the link leaks.
 */

import type { Report, Vital } from '@/lib/data/report';
import type { Signals, Format } from '@/lib/teardown/signals';

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
/**
 * Arabic-Indic digits, with the separators Arabic actually uses: ٫ for the
 * decimal and ٬ for thousands. A Latin full stop inside an Arabic figure is
 * the same class of tell as a Latin comma inside an Arabic address — only
 * swapped between digits, so nothing else in a string is touched.
 */
export const ar = (s: string | number) =>
  String(s)
    .replace(/(?<=\d)\.(?=\d)/g, '٫')
    .replace(/(?<=\d),(?=\d)/g, '٬')
    .replace(/[0-9]/g, (d) => AR_DIGITS[+d]);

const AR_MONTHS = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران',
  'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'];
const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const dayMonth = (iso: string, lang: 'ar' | 'en', withYear = false) => {
  const d = new Date(iso);
  const day = d.getUTCDate(), m = d.getUTCMonth(), y = d.getUTCFullYear();
  const base = lang === 'ar' ? `${ar(day)} ${AR_MONTHS[m]}` : `${day} ${EN_MONTHS[m]}`;
  return withYear ? `${base} ${lang === 'ar' ? ar(y) : y}` : base;
};

/** A window that crosses a new year reads as a few months unless it says so. */
const crossesYear = (a: string, b: string) =>
  new Date(a).getUTCFullYear() !== new Date(b).getUTCFullYear();

/** 14 → "2pm" / "٢ بعد الضهر". Hours are already Amman local. */
const dayPart = (h: number) =>
  h < 12 ? 'الصبح' : h < 16 ? 'بعد الضهر' : h < 19 ? 'العصر' : 'المسا';
const twelve = (h: number) => (h % 12 === 0 ? 12 : h % 12);

const clock = (h: number, lang: 'ar' | 'en') =>
  lang === 'en'
    ? `${twelve(h)}${h < 12 ? 'am' : 'pm'}`
    : `${ar(twelve(h))} ${dayPart(h)}`;

/**
 * A range, said once. "between 2 in the afternoon and 4 in the afternoon" is
 * how a machine writes it; a person names the half of the day at the end only,
 * and drops it entirely when the two hours sit either side of a boundary.
 */
const range = (from: number, to: number, lang: 'ar' | 'en') => {
  if (lang === 'en') return `${clock(from, 'en')} and ${clock(to, 'en')}`;
  return dayPart(from) === dayPart(to)
    ? `${ar(twelve(from))} و${ar(twelve(to))} ${dayPart(to)}`
    : `${clock(from, 'ar')} و${clock(to, 'ar')}`;
};

const FORMAT_NAME: Record<Format, { ar: string; en: string }> = {
  REELS: { ar: 'ريلز', en: 'Reels' },
  VIDEO: { ar: 'فيديو', en: 'video' },
  IMAGE: { ar: 'صور', en: 'single images' },
  CAROUSEL_ALBUM: { ar: 'ألبومات', en: 'carousels' },
};

const n1 = (x: number) => (Math.round(x * 10) / 10).toString();
const n0 = (x: number) => Math.round(x).toString();

/** Prose the engine may not write. Marked so a review screen can list it. */
const TODO = (what: string) => ({
  ar: `⟦يحتاج كتابة: ${what}⟧`,
  en: `⟦Needs writing: ${what}⟧`,
});

export function composeDraft(s: Signals, token: string, name?: string): Report {
  const vitals: Vital[] = [];

  // ── engagement ────────────────────────────────────────────────────────────
  if (s.followers > 0) {
    vitals.push({
      fig: `${n1(s.engagementRate)}%`,
      low: s.engagementRate < 1,
      label: { ar: 'نسبة التفاعل', en: 'Engagement rate' },
      cmp: {
        ar: `يعني المنشور العادي عندكم بيوصل تفاعل من ${ar(n0(s.medianEngagement))} حساب، وعندكم ${ar(s.followers.toLocaleString('en-US'))} متابع.`,
        en: `A typical post draws ${Math.round(s.medianEngagement).toLocaleString('en-US')} reactions against ${s.followers.toLocaleString('en-US')} followers.`,
      },
      prov: {
        ar: `محسوب · ${ar(s.posts)} منشور`,
        en: `Computed · ${s.posts} posts`,
      },
    });
  }

  // ── cadence and timing ────────────────────────────────────────────────────
  vitals.push({
    fig: n1(s.postsPerWeek),
    label: { ar: 'منشورات بالأسبوع', en: 'Posts per week' },
    cmp: {
      ar: `${ar(n0(s.peakWindow.share))}٪ من المنشورات بتنزل بين ${range(s.peakWindow.from, s.peakWindow.to, 'ar')}.`,
      en: `${n0(s.peakWindow.share)}% of them land between ${range(s.peakWindow.from, s.peakWindow.to, 'en')}.`,
    },
    prov: { ar: 'محسوب · التوقيتات', en: 'Computed · timestamps' },
  });

  // ── the format split, which is usually the whole story ────────────────────
  if (s.strongest && s.busiest && s.strongest.format !== s.busiest.format) {
    const st = FORMAT_NAME[s.strongest.format], bu = FORMAT_NAME[s.busiest.format];
    vitals.push({
      fig: `${n0(s.strongest.sharePosts)}%`,
      label: { ar: `من المنشورات ${st.ar}`, en: `Of posts are ${st.en}` },
      cmp: {
        ar: `وهاي النسبة بتحمل ${ar(n0(s.strongest.shareEngagement))}٪ من كل التفاعل. و${ar(n0(s.busiest.sharePosts))}٪ من شغلكم ${bu.ar}.`,
        en: `Those carry ${n0(s.strongest.shareEngagement)}% of all engagement. Meanwhile ${n0(s.busiest.sharePosts)}% of your effort goes into ${bu.en}.`,
      },
      prov: { ar: `محسوب · ${ar(s.posts)} منشور`, en: `Computed · ${s.posts} posts` },
    });
  }

  // ── asking for anything at all ────────────────────────────────────────────
  // Only when captions were actually read. A read that returned none would
  // otherwise accuse a business of never asking for anything in a hundred
  // posts — the single most damaging thing this document could get wrong, and
  // indistinguishable to the reader from a finding we had earned.
  if (s.captions.withCaption > 0) vitals.push({
    fig: `${n0(s.captions.askingShare)}%`,
    low: s.captions.askingShare < 20,
    label: { ar: 'من الكابشنات بتطلب إشي', en: 'Of captions ask for anything' },
    cmp: {
      ar: `${ar(s.captions.asking)} من ${ar(s.posts)} منشور فيهم سؤال أو طلب. الباقي بيوصف بس.`,
      en: `${s.captions.asking} of ${s.posts} posts contain a question or a request. The rest describe.`,
    },
    prov: { ar: 'محسوب · الكابشنات', en: 'Computed · captions' },
  });

  // ── the pattern: where engagement actually sits ───────────────────────────
  // The bar reads as relative pulling power: each format against the weakest,
  // with the bar itself normalised to the leader. `x` sits in a numeric slot,
  // so it is a figure and never a sentence.
  const floor = Math.min(...s.formats.map((f) => f.medianEngagement)) || 1;
  const multiples = s.formats.map((f) => f.medianEngagement / floor);
  const top = Math.max(...multiples) || 1;
  const bars = s.formats.map((f, i) => ({
    label: FORMAT_NAME[f.format],
    v: Math.round((multiples[i] / top) * 100),
    x: `${multiples[i].toFixed(1)}×`,
    hi: f.format === s.strongest?.format,
  }));

  const best = s.best;
  const heroCap = best
    ? {
      ar: `${dayMonth(best.timestamp, 'ar')} · ${FORMAT_NAME[best.format].ar} · ${ar(best.engagement.toLocaleString('en-US'))} تفاعل`,
      en: `${dayMonth(best.timestamp, 'en')} · ${FORMAT_NAME[best.format].en} · ${best.engagement.toLocaleString('en-US')} reactions`,
    }
    : { ar: '', en: '' };

  return {
    token,
    // A business reads its own name; a handle reads like a database row. The
    // display name is verified available on this edge, but a few accounts leave
    // it empty, so the handle stays as the fallback.
    client: name?.trim()
      ? { ar: name.trim(), en: name.trim() }
      : { ar: `@${s.handle}`, en: `@${s.handle}` },
    sector: TODO('القطاع / sector'),
    date: new Date().toISOString().slice(0, 10),
    window: (() => {
      const y = crossesYear(s.first, s.last);
      return {
        ar: `${dayMonth(s.first, 'ar', y)} — ${dayMonth(s.last, 'ar', y)} · ${ar(s.posts)} منشور`,
        en: `${dayMonth(s.first, 'en', y)} — ${dayMonth(s.last, 'en', y)} · ${s.posts} posts`,
      };
    })(),
    hero: {
      cap: heroCap,
      head: best
        ? {
          ar: `أقوى منشور عندكم تفاعل بـ${ar(n1(best.multiple))} ضعف المنشور العادي.`,
          en: `Your strongest post drew ${n1(best.multiple)}× the engagement of a typical one.`,
        }
        : TODO('the opening observation'),
      body: TODO('what followed that post, and what did not'),
    },
    verdict: TODO('the verdict — one honest sentence'),
    vitals,
    working: [TODO('what is genuinely good here')],
    pattern: {
      head: s.strongest && s.busiest && s.strongest.format !== s.busiest.format
        ? {
          ar: `${FORMAT_NAME[s.strongest.format].ar} بتحمل ${ar(n0(s.strongest.shareEngagement))}٪ من التفاعل، وهي ${ar(n0(s.strongest.sharePosts))}٪ من المنشورات.`,
          en: `${FORMAT_NAME[s.strongest.format].en} carry ${n0(s.strongest.shareEngagement)}% of engagement from ${n0(s.strongest.sharePosts)}% of posts.`,
        }
        : TODO('the pattern across the set'),
      bars,
      tail: s.bestWindow
        ? {
          ar: `وأقوى منشوراتكم بتنزل بين ${range(s.bestWindow.from, s.bestWindow.to, 'ar')} — مش بوقت النشر المعتاد عندكم.`,
          en: `Your best-performing posts land between ${range(s.bestWindow.from, s.bestWindow.to, 'en')} — not in your habitual window.`,
        }
        : TODO('what the spread means'),
    },
    fixes: [{ h: TODO('fix 1'), p: TODO('why') }],
    concepts: [],
    plan: [{ m: TODO('month 1'), p: TODO('what happens') }],
    provenance: [
      {
        ar: `قرأنا ${ar(s.posts)} منشور عام من @${s.handle} بتاريخ ${dayMonth(new Date().toISOString(), 'ar')}، عن طريق Instagram Business Discovery — نفس المعلومات اللي أي حدا بيشوفها لما بيفتح حسابكم.`,
        en: `We read ${s.posts} public posts from @${s.handle} on ${dayMonth(new Date().toISOString(), 'en')} through Instagram Business Discovery — the same information anyone sees when they open your account.`,
      },
      {
        ar: 'كل الأرقام محسوبة من الإعجابات والتعليقات، مش من المشاهدات. عدّاد المشاهدات بيخلط المدفوع بالعضوي، فأي مقارنة مبنية عليه بتكون غلط لأي حساب بيموّل منشوراته.',
        en: 'Every figure is computed from likes and comments, not views. The view counter mixes paid with organic, so any comparison built on it is wrong for an account that boosts.',
      },
      ...(s.shallow
        ? [{
          ar: `هالحساب عنده ${ar(s.posts)} منشور بس ضمن الفترة — أقل من المية اللي منقرأها عادةً، فالقراءة أضيق.`,
          en: `This account had only ${s.posts} posts in the window — fewer than the hundred we normally read, so the read is narrower.`,
        }]
        : []),
    ],
  };
}

/** Does this report still contain prose the engine refused to invent? */
export const needsWriting = (r: Report): boolean =>
  JSON.stringify(r).includes('⟦');
