import type { Vertical } from '@/lib/data/concepts';
import { normaliseAr } from '@/lib/teardown/arabic';

/**
 * What trade is this, read off the words the business already published.
 *
 * `Vertical` was declared, threaded through `runRead` and `recommend`, and
 * never once set: `app/api/lead/route.ts` calls `runRead({handle, website})`,
 * so the +18 vertical weight has never fired in production and a dental clinic
 * and a shawarma shop were offered the same five ideas chosen by the same
 * tie-breaks. Meanwhile the single best signal available — the profile
 * biography, which is a business describing itself in its own words — was
 * fetched by `discovery.ts` and thrown away.
 *
 * Pure, and deliberately dumb: a keyword lexicon, Arabic and English, scored
 * by weighted hits. It is not a classifier and does not pretend to be one. It
 * returns a confidence with the guess so the caller can decide what to do with
 * a weak one — `recommend` scales its bonus by it, and `run.ts` only promotes
 * a guess to `Sheet.vertical` above 0.7. A wrong guess must nudge a ranking,
 * never rename somebody's business on a page they read.
 */

/**
 * Fold the orthographic variation out of Arabic, then case, before matching.
 *
 * `normaliseAr` is the shared one from item 9 — tashkeel stripped, hamza
 * carriers unified, `ى→ي` and `ة→ه` — and the lexicon below is written in the
 * spelling it produces. Case folding is this module's own business, because
 * only this module matches Latin terms.
 */
const fold = (s: string): string => normaliseAr(s ?? '').toLowerCase();

/**
 * The lexicon, one list per vertical, Arabic and English together.
 *
 * Written as data rather than as a regex literal so it can be read, argued
 * with and extended by somebody who knows Amman better than the person who
 * typed it. Arabic terms are stored normalised and matched as substrings,
 * because Arabic glues its articles and pronouns onto the word (`مطعمنا`,
 * `للحجز`) and a word boundary would throw most real captions away. English
 * terms match on a leading boundary only, so `clinic` catches `clinics`.
 */
export const LEXICON: Record<Vertical, { ar: string[]; en: string[] }> = {
  food: {
    ar: ['مطعم', 'مطاعم', 'كافيه', 'قهوه', 'شاورما', 'حلويات', 'مشاوي', 'مناقيش', 'فطور', 'وجبه'],
    en: ['delivery', 'menu', 'restaurant', 'cafe', 'coffee', 'bakery'],
  },
  body: {
    ar: ['عياده', 'عيادات', 'تجميل', 'اسنان', 'ليزر', 'بشره', 'فيلر', 'بوتوكس', 'جلديه', 'تقويم'],
    en: ['clinic', 'dermatology', 'dental', 'aesthetic', 'skin', 'botox'],
  },
  fitness: {
    ar: ['جيم', 'نادي', 'اشتراك', 'تمرين', 'لياقه', 'كوتش', 'حديد'],
    en: ['coach', 'gym', 'fitness', 'workout', 'personal training'],
  },
  property: {
    ar: ['شقه', 'شقق', 'للبيع', 'للايجار', 'عقار', 'متر', 'فيلا', 'اراضي', 'اسكان'],
    en: ['apartment', 'real estate', 'property', 'villa'],
  },
  auto: {
    ar: ['سياره', 'سيارات', 'صيانه', 'تامين', 'كوشوك', 'مركبات', 'ورشه', 'زيت'],
    en: ['detailing', 'car', 'auto', 'garage', 'motors'],
  },
  edu: {
    ar: ['دوره', 'دورات', 'تدريب', 'كورس', 'تسجيل', 'شهاده', 'معهد', 'اكاديميه'],
    en: ['course', 'training', 'academy', 'institute', 'tutoring'],
  },
  retail: {
    ar: ['متجر', 'متاجر', 'توصيل', 'مقاسات', 'تشكيله', 'ملابس', 'ازياء', 'بوتيك', 'اكسسوارات'],
    en: ['collection', 'shop', 'store', 'boutique', 'sizes'],
  },
  pro: {
    ar: ['محاماه', 'محامي', 'محاسبه', 'استشارات', 'خدمات', 'ضريبه', 'تدقيق', 'ترجمه'],
    en: ['consulting', 'accounting', 'law firm', 'legal', 'audit'],
  },
};

export type VerticalEvidence = { vertical: Vertical; term: string; hits: number };

export type VerticalGuess = {
  guess: Vertical | null;
  /** `top / (top + runnerUp)`. 1 when nothing else scored at all. */
  confidence: number;
  runnerUp: Vertical | null;
  /** Which words decided it, so an operator can disagree with the reason. */
  evidence: VerticalEvidence[];
};

/**
 * A bio is worth three captions.
 *
 * A biography is the business stating what it is; a caption is the business
 * talking about one afternoon. Both are evidence, and they are not equal
 * evidence — a restaurant that ran a hiring post is not a recruitment agency.
 */
const BIO_WEIGHT = 3;
const SITE_WEIGHT = 1;
const CAPTION_WEIGHT = 1;

/** Below either of these the guess is withheld rather than shown weakly. */
const MIN_CONFIDENCE = 0.6;
const MIN_HITS = 2;

const VERTICALS = Object.keys(LEXICON) as Vertical[];

/** Occurrences of `term` in already-normalised `text`. */
function count(text: string, term: string, latin: boolean): number {
  if (!term) return 0;
  if (latin) {
    const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');
    return (text.match(re) ?? []).length;
  }
  let n = 0;
  let i = text.indexOf(term);
  while (i !== -1) { n++; i = text.indexOf(term, i + term.length); }
  return n;
}

export function inferVertical(
  bio: string,
  captions: string[],
  siteText?: string,
): VerticalGuess {
  const sources: { text: string; weight: number }[] = [
    { text: fold(bio ?? ''), weight: BIO_WEIGHT },
    { text: fold((captions ?? []).join(' \n ')), weight: CAPTION_WEIGHT },
    { text: fold(siteText ?? ''), weight: SITE_WEIGHT },
  ];

  const score = new Map<Vertical, number>();
  /** Unweighted occurrences — the floor is about how much was said, not where. */
  const raw = new Map<Vertical, number>();
  const evidence: VerticalEvidence[] = [];

  for (const v of VERTICALS) {
    let weighted = 0;
    let plain = 0;
    for (const [terms, latin] of [[LEXICON[v].ar, false], [LEXICON[v].en, true]] as const) {
      for (const term of terms) {
        let hits = 0;
        for (const s of sources) {
          const n = count(s.text, latin ? term : fold(term), latin);
          if (!n) continue;
          hits += n;
          weighted += n * s.weight;
        }
        if (hits) { plain += hits; evidence.push({ vertical: v, term, hits }); }
      }
    }
    score.set(v, weighted);
    raw.set(v, plain);
  }

  // Ties break on the lexicon's own order, so the same bio always reads the
  // same way. A guess that moved because a Map iterated differently would be
  // unreproducible on the call where somebody disputes it.
  const ranked = VERTICALS
    .map((v) => ({ v, s: score.get(v) ?? 0 }))
    .sort((a, b) => b.s - a.s || VERTICALS.indexOf(a.v) - VERTICALS.indexOf(b.v));

  const top = ranked[0];
  const second = ranked[1];
  const runnerUp = second && second.s > 0 ? second.v : null;
  const confidence = top.s > 0 ? top.s / (top.s + (second?.s ?? 0)) : 0;

  evidence.sort((a, b) =>
    b.hits - a.hits
    || VERTICALS.indexOf(a.vertical) - VERTICALS.indexOf(b.vertical)
    || a.term.localeCompare(b.term));

  const enough = (raw.get(top.v) ?? 0) >= MIN_HITS && confidence >= MIN_CONFIDENCE;
  return {
    guess: enough ? top.v : null,
    confidence: top.s > 0 ? confidence : 0,
    runnerUp,
    evidence: evidence.slice(0, 12),
  };
}
