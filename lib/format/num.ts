/**
 * One number formatter, used everywhere a figure reaches an Arabic surface.
 *
 * Before this file existed the same `arNum` regex was pasted into five places
 * (`lib/teardown/compose.ts`, `findings.ts`, the sheet page, the proposal doc,
 * the invoice doc) plus two thinner variants in `Portal.tsx` and
 * `lib/notify/whatsapp.ts` that skipped the decimal/thousands separators
 * because nothing they format ever carried one. A grep for the Arabic-Indic
 * digit table (`٠١٢٣٤٥٦٧٨٩`) outside this file is a regression.
 *
 * D13 (master plan) settles the register: Arabic-Indic on every Arabic
 * surface — site, sheet, docs — Latin only for phone numbers, the CR, handles
 * and other Latin identifiers.
 */

export const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/**
 * Arabic-Indic digits, with the separators Arabic actually uses: ٫ for the
 * decimal and ٬ for thousands. A Latin full stop inside an Arabic figure is
 * the same class of tell as a Latin comma inside an Arabic address — only
 * swapped between digits, so nothing else in a string is touched.
 */
export const arNum = (s: string | number) =>
  String(s)
    .replace(/(?<=\d)\.(?=\d)/g, '٫')
    .replace(/(?<=\d),(?=\d)/g, '٬')
    .replace(/[0-9]/g, (d) => AR_DIGITS[+d]);

/** `compose.ts`'s original export name. Kept so its contract survives the move. */
export const ar = arNum;

/** A number, Western or Arabic-Indic depending on the reader. */
export const num = (n: number | string, ar: boolean) => {
  const s = typeof n === 'number' ? n.toLocaleString('en-US') : n;
  return ar ? arNum(s) : s;
};

export const n0 = (x: number) => Math.round(x).toString();
export const n1 = (x: number) => (Math.round(x * 10) / 10).toString();

/**
 * 14 → "2pm" / "٢ بعد الضهر". Hours are already Amman local.
 *
 * The long register, said once with the part of the day named — findings.ts's
 * original, and the one the client-facing sheet and docs read.
 */
export const hour = (h: number, ar: boolean) => {
  const t = h % 12 === 0 ? 12 : h % 12;
  if (!ar) return `${t}${h < 12 ? 'am' : 'pm'}`;
  const part = h < 12 ? 'الصبح' : h < 16 ? 'بعد الضهر' : h < 19 ? 'العصر' : 'المسا';
  return `${arNum(t)} ${part}`;
};

/**
 * The compact register: "٢ص" / "٢م", no day-part word. Used where an axis
 * label has no room for a full word — the sheet's own hours chart.
 */
export const hourShort = (h: number, ar: boolean) => {
  const t = h % 12 === 0 ? 12 : h % 12;
  if (!ar) return `${t}${h < 12 ? 'am' : 'pm'}`;
  const part = h < 12 ? 'ص' : 'م';
  return `${arNum(t)}${part}`;
};
