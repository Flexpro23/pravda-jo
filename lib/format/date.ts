/**
 * One date formatter, used everywhere a date reaches an Arabic surface.
 *
 * Before this file existed `AR_MONTHS`/`EN_MONTHS` were pasted into four
 * places (`lib/teardown/compose.ts`, the proposal doc, the invoice doc,
 * `Portal.tsx`, `lib/notify/whatsapp.ts`) and each wrote its own thin
 * formatter around them. A grep for `كانون الثاني` outside this file is a
 * regression.
 */

import { arNum } from './num';

export const AR_MONTHS = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران',
  'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'];
export const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
export const AR_DAYS = ['الأحد', 'الاثنين', 'الثلاثا', 'الأربعا', 'الخميس', 'الجمعة', 'السبت'];

/**
 * "27 August 2026" / "٢٧ آب ٢٠٢٦" — a document a client or a provider keeps,
 * and keeps naming the year. `proposal`'s original always printed the year;
 * `withYear` defaults to `true` so that call site is unchanged, and a future
 * caller may opt out.
 */
export const fmtDate = (iso: string, ar: boolean, withYear = true) => {
  const d = new Date(iso);
  const day = d.getUTCDate(), m = d.getUTCMonth(), y = d.getUTCFullYear();
  if (!withYear) return ar ? `${arNum(day)} ${AR_MONTHS[m]}` : `${day} ${EN_MONTHS[m]}`;
  return ar ? `${arNum(day)} ${AR_MONTHS[m]} ${arNum(y)}` : `${day} ${EN_MONTHS[m]} ${y}`;
};

/**
 * `compose.ts`'s original: same shape, `lang` rather than a boolean, year
 * defaulted off — a read window is usually said without one.
 */
export const dayMonth = (iso: string, lang: 'ar' | 'en', withYear = false) => {
  const d = new Date(iso);
  const day = d.getUTCDate(), m = d.getUTCMonth(), y = d.getUTCFullYear();
  const base = lang === 'ar' ? `${arNum(day)} ${AR_MONTHS[m]}` : `${day} ${EN_MONTHS[m]}`;
  return withYear ? `${base} ${lang === 'ar' ? arNum(y) : y}` : base;
};

/** "الأحد ٣٠ آب" — a provider's own calendar, not an ISO string. */
export const arDate = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(+d)) return iso;
  return `${AR_DAYS[d.getDay()]} ${arNum(d.getDate())} ${AR_MONTHS[d.getMonth()]}`;
};

/** "27 August" / "٢٧ آب" — one line of an invoice table; the statement's own title carries the year. */
export const dayOf = (iso: string, ar: boolean) => {
  const d = new Date(`${iso}T00:00:00`);
  return ar
    ? `${arNum(d.getDate())} ${AR_MONTHS[d.getMonth()]}`
    : `${d.getDate()} ${EN_MONTHS[d.getMonth()]}`;
};

/** "آب ٢٠٢٦" from a "2026-08" key. */
export const monthName = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return `${AR_MONTHS[m - 1]} ${arNum(y)}`;
};

/**
 * Arabic counts in five shapes, not two. One is the noun alone, two has its own
 * dual form, three to ten takes the plural, and eleven up returns to an
 * accusative singular. "١ يوم" is none of them.
 */
export const days = (n: number, ar: boolean) => {
  if (!ar) return `${n} day${n === 1 ? '' : 's'}`;
  if (n === 1) return 'يوم واحد';
  if (n === 2) return 'يومين';
  if (n <= 10) return `${arNum(n)} أيام`;
  return `${arNum(n)} يومًا`;
};
