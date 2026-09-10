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

/**
 * "one piece", "two pieces", "eleven pieces" — counted correctly in both.
 *
 * A client's page read "1 pieces from one day" and, in Arabic, "١ مقاطع",
 * because both call sites interpolated a bare number in front of a plural
 * noun. English needs one rule. Arabic needs four, and getting them wrong is
 * the kind of thing that makes a page look machine-written to the only people
 * whose opinion of it matters:
 *
 *   1        مقطع واحد        — the noun alone, singular, no numeral
 *   2        مقطعين           — the dual, and never "٢ مقطع"
 *   3 to 10  ٣ مقاطع          — the numeral with the plural of paucity
 *   11 and up ١١ مقطع         — the numeral with the SINGULAR again
 *
 * `pieces` is the only noun this counts today. It is written as a table
 * rather than as a rule because the next noun (days, faces, posts) has its
 * own broken plural and cannot be derived from this one.
 */
const AR_PIECE = { one: 'مقطع', two: 'مقطعين', few: 'مقاطع' } as const;

export const arPieces = (n: number): string => {
  const k = Math.max(0, Math.round(n));
  if (k === 1) return `${AR_PIECE.one} واحد`;
  if (k === 2) return AR_PIECE.two;
  if (k >= 3 && k <= 10) return `${arNum(k)} ${AR_PIECE.few}`;
  return `${arNum(k)} ${AR_PIECE.one}`;
};

/** The English half. `noun` carries any adjective, e.g. `finished piece`. */
export const enPieces = (n: number, noun = 'piece'): string => {
  const k = Math.max(0, Math.round(n));
  return `${k} ${noun}${k === 1 ? '' : 's'}`;
};
