/**
 * What a Jordanian caption actually asks.
 *
 * The old detector was a single regex literal holding nine Arabic verbs, and
 * it missed the standard Amman booking caption outright: `للحجز والاستفسار`
 * contains neither `احجز` nor `اطلب`, so the account that asks on every post
 * was scored as an account that never asks. In the other direction a bare `؟`
 * counted as a call to action, so `مين بيحب القهوة؟` — engagement bait with
 * nothing to answer — was scored as a request. Errors in both directions on
 * the same number, and that number carries the heaviest recommendation weight
 * on the sheet.
 *
 * Two separations fix it:
 *
 * A CTA is not a question. `hasCta` looks for somebody being asked to do a
 * thing; `hasQuestion` looks for a question mark in either script. The sheet
 * reports both and only ever argues from the first.
 *
 * A lexicon is not a regex. The terms live in `CTA_AR` and `CTA_EN` as plain
 * arrays so a person who speaks the dialect can read the list, add to it, and
 * see it tested — rather than parsing an escaped alternation. The regexes are
 * built from the arrays at module load.
 *
 * Matching is done on a normalised string because Arabic is written several
 * ways for the same word: `رنّ` carries a shadda, `إطلب` and `أحجز` carry a
 * hamza, `ى` and `ي` are interchangeable in dialect typing, and `ة` is often
 * typed `ه`. Normalising once means the lexicon can be written in one
 * orthography instead of five.
 */

/** Tashkeel (fatha through sukun), the dagger alif, and tatweel — decoration. */
const DIACRITICS = /[ً-ْٰـ]/g;
/** The Arabic letter range, used for the word-boundary lookarounds `\b` cannot do. */
const AR_LETTER = '\\u0621-\\u064A';

/**
 * Fold an Arabic string to the one spelling the lexicon is written in.
 *
 * Idempotent by construction: every mapping is letter → letter with no target
 * that is itself a source, so a second pass finds nothing left to change.
 */
export const normaliseAr = (s: string): string =>
  (s ?? '')
    .replace(DIACRITICS, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * The Arabic call-to-action lexicon, in the spelling `normaliseAr` produces.
 *
 * Grouped by what the caption is actually asking for, because that is how a
 * reviewer checks it. Clitic prefixes (`و ف ب ل ال لل بال عال`) are handled by
 * the matcher, so `الحجز` also catches `بالحجز`; suffixed forms are listed
 * explicitly rather than guessed, because `شارك` + a guessed `نا` would turn
 * `شاركنا في المعرض` ("we took part in the fair") into a request.
 */
export const CTA_AR: string[] = [
  // booking — the single most common Amman business caption
  'احجز', 'احجزوا', 'احجزي', 'حجزك', 'الحجز', 'للحجز', 'حجوزات',
  // ordering
  'اطلب', 'اطلبوا', 'اطلبي', 'الطلب', 'للطلب', 'اطلبها',
  // asking about it
  'استفسار', 'الاستفسار', 'للاستفسار', 'استفسر', 'استفسروا',
  // phoning
  'اتصل', 'اتصلوا', 'اتصلي', 'كلمنا', 'كلمونا', 'رقمنا', 'رن', 'رنلنا',
  'تواصل', 'تواصلوا', 'التواصل', 'للتواصل',
  // messaging
  'راسلنا', 'راسلونا', 'ابعتلنا', 'بعتلنا', 'احكيلنا', 'رساله', 'رسايل',
  'واتساب', 'واتس', 'وتس', 'ع الخاص', 'عالخاص',
  // registering and subscribing — the whole edu and gym vertical
  'سجل', 'سجلوا', 'سجلي', 'التسجيل', 'للتسجيل', 'اشترك', 'اشتركوا', 'الاشتراك',
  // trying and visiting
  'جرب', 'جربوا', 'جربي', 'زورونا', 'زوروا', 'زورو', 'تعالوا', 'تفضلوا',
  // engaging
  'تابعنا', 'تابعونا', 'علق', 'علقوا', 'شارك', 'شاركوا', 'احفظ', 'احفظوا',
  // availability and urgency
  'متوفر', 'متوفره', 'متوفرين', 'بنستناكم', 'بانتظاركم', 'مننتظركم',
  'لا تفوت', 'لا تفوتوا', 'لا يفوتك', 'لفتره محدوده', 'عرض لفتره محدوده', 'سارع', 'سارعوا',
  // the link
  'الرابط بالبايو', 'الرابط في البايو', 'لينك بالبايو', 'اللينك بالبايو',
  'الرابط بالبروفايل', 'الرابط تحت',
];

/**
 * The English lexicon. Matched case-insensitively with an optional inflection
 * (`s|es|ing|ed`) so `orders`, `booking`, `visits` and `DMs` are not missed —
 * the `\b`-anchored original blocked all four.
 */
export const CTA_EN: string[] = [
  'dm', 'inbox', 'message', 'chat', 'whatsapp', 'call', 'text us', 'contact us',
  'order', 'book', 'booking', 'reserve', 'reservation', 'buy', 'shop', 'get yours',
  'sign up', 'signup', 'register', 'registration', 'subscribe', 'join',
  'visit', 'click', 'link in bio', 'swipe', 'tag', 'comment', 'save this',
  'try', 'available now', 'in stock', 'follow us', 'grab',
];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Arabic has no `\b` a JavaScript regex understands, so the boundary is written
 * out: no Arabic letter immediately before or after the term. The optional
 * prefix group carries the clitics that attach to a noun without a space.
 */
const AR_PREFIX = `(?:[وف]?(?:ال|لل|بال|عال|ب|ل|ع)?)`;
export const CTA_AR_RE = new RegExp(
  `(?<![${AR_LETTER}])${AR_PREFIX}(?:${CTA_AR.map(escape).join('|')})(?![${AR_LETTER}])`,
);

export const CTA_EN_RE = new RegExp(
  `\\b(?:${CTA_EN.map(escape).join('|')})(?:s|es|ing|ed)?\\b`,
  'i',
);

/**
 * A route a stranger can actually take: a WhatsApp link, a Jordanian mobile
 * number, or an international-form Jordanian number. Lives here because it is
 * the same market-specific reading problem as the lexicon, and the bio finding
 * and the caption finding must not drift apart on what counts as a route.
 */
export const WA_ROUTE_RE = /(wa\.me|api\.whatsapp|whatsapp|واتساب|وتساب|\+?962\s?7\d[\s-]?\d{3}[\s-]?\d{4}|\b07[789]\d{7}\b)/i;

/** Somebody is being asked to do something. */
export const hasCta = (caption?: string | null): boolean => {
  const raw = (caption ?? '').trim();
  if (!raw) return false;
  return CTA_AR_RE.test(normaliseAr(raw)) || CTA_EN_RE.test(raw);
};

/** A question is being asked. Not the same thing, and never counted as one. */
export const hasQuestion = (caption?: string | null): boolean => /[?؟]/.test(caption ?? '');
