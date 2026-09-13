import type { TalentDiscipline } from '@/lib/data/deals';

/**
 * What an operator records about a person, by discipline.
 *
 * A casting director asks a model for different things than a videographer:
 * height and shoe size for one, the camera body and whether they cut their own
 * footage for the other. These are the comp-card fields of each trade, written
 * as data so the console form, the API validation and anything that later
 * reads them all come from one list — adding a field is one entry here and
 * nothing else.
 *
 * Fields carry a `group`, and the console lays the card out by group in the
 * order a real comp card reads: measurements, then sizes, then the look, then
 * what they are good for. The first card that arrived here listed height,
 * weight, back, bust, waist, hips, size — that order is the trade's, and the
 * form follows it rather than the order somebody typed the schema in.
 *
 * Every field is optional. Real comp cards are incomplete: they arrive with
 * height and shoe size filled in and bust, waist and hips left blank. A form
 * that required them would get a made-up number typed into it, and a made-up
 * measurement on a casting record is worse than an empty one.
 *
 * **Operator-only.** Nothing here is rendered on a client's page or on the
 * public site. Body measurements in particular are the kind of personal data
 * PDPL treats with the most care, and a client choosing between two models
 * does not need either one's weight to do it.
 */

type B = { ar: string; en: string };

export type FieldKind =
  /** A measured quantity. Stored as a number, shown with its unit. */
  | { kind: 'number'; unit?: B; min: number; max: number; step?: number }
  /** A short line of free text. */
  | { kind: 'text'; max: number }
  /** A handful of words, each its own tag. */
  | { kind: 'list'; suggest?: string[] }
  /** One of a fixed set. */
  | { kind: 'choice'; options: { value: string; label: B }[] }
  /** Yes or no. */
  | { kind: 'flag' };

/** The rows of the card, in the order they are laid out. */
export type Group = 'measurements' | 'sizes' | 'look' | 'craft' | 'kit' | 'general';
export const GROUPS: Group[] = ['measurements', 'sizes', 'look', 'craft', 'kit', 'general'];

export const GROUP_LABEL: Record<Group, B> = {
  measurements: { ar: 'المقاسات', en: 'Measurements' },
  sizes:        { ar: 'الأحجام', en: 'Sizes' },
  look:         { ar: 'الشكل', en: 'Look' },
  craft:        { ar: 'بيصلح لـ', en: 'Works for' },
  kit:          { ar: 'المعدات', en: 'Kit' },
  general:      { ar: 'عام', en: 'General' },
};

export type Field = { key: string; label: B; hint?: B; group: Group } & FieldKind;

const CM: B = { ar: 'سم', en: 'cm' };
const KG: B = { ar: 'كغ', en: 'kg' };

/**
 * Single sizes and the in-between ranges. A card that says "XS–S" is saying
 * something true — the person sits between two rack sizes — and forcing it to
 * one letter would record a fact nobody stated.
 */
const SIZES = ['XS', 'XS–S', 'S', 'S–M', 'M', 'M–L', 'L', 'L–XL', 'XL', 'XXL']
  .map((s) => ({ value: s, label: { ar: s, en: s } }));

/** Asked of everybody, whatever they do. Laid out last. */
const COMMON: Field[] = [
  {
    key: 'area', kind: 'text', max: 60, group: 'general',
    label: { ar: 'المنطقة', en: 'Area' },
    hint: { ar: 'وين ساكن، عشان مواعيد التصوير', en: 'Where they are based, for call times' },
  },
  {
    key: 'languages', kind: 'list', group: 'general',
    suggest: ['Arabic', 'English', 'French', 'Russian'],
    label: { ar: 'اللغات', en: 'Languages' },
  },
];

export const FIELDS: Record<TalentDiscipline, Field[]> = {
  model: [
    // ── measurements, in comp-card order ───────────────────────────────────
    {
      key: 'heightCm', kind: 'number', min: 120, max: 220, unit: CM, group: 'measurements',
      label: { ar: 'الطول', en: 'Height' },
    },
    {
      key: 'weightKg', kind: 'number', min: 30, max: 200, unit: KG, group: 'measurements',
      label: { ar: 'الوزن', en: 'Weight' },
      hint: {
        ar: 'اختياري. ما بيطلع لأي زبون ولا على الموقع.',
        en: 'Optional. Never shown to a client or on the website.',
      },
    },
    {
      key: 'bustCm', kind: 'number', min: 50, max: 160, unit: CM, group: 'measurements',
      label: { ar: 'الصدر', en: 'Bust' },
    },
    {
      key: 'waistCm', kind: 'number', min: 40, max: 160, unit: CM, group: 'measurements',
      label: { ar: 'الخصر', en: 'Waist' },
    },
    {
      key: 'hipsCm', kind: 'number', min: 50, max: 180, unit: CM, group: 'measurements',
      label: { ar: 'الورك', en: 'Hips' },
    },
    {
      // Shoulder-to-shoulder across the back. On every Jordanian agency card,
      // and the measurement a tailor asks for first.
      key: 'backCm', kind: 'number', min: 28, max: 70, unit: CM, group: 'measurements',
      label: { ar: 'عرض الظهر', en: 'Back' },
    },
    // ── sizes ──────────────────────────────────────────────────────────────
    {
      key: 'size', kind: 'choice', options: SIZES, group: 'sizes',
      label: { ar: 'مقاس الملابس', en: 'Clothing' },
    },
    {
      key: 'shoeEu', kind: 'number', min: 30, max: 50, step: 0.5, group: 'sizes',
      label: { ar: 'نمرة الحذاء', en: 'Shoes (EU)' },
    },
    // ── the look ───────────────────────────────────────────────────────────
    { key: 'hair', kind: 'text', max: 40, group: 'look', label: { ar: 'الشعر', en: 'Hair' } },
    { key: 'eyes', kind: 'text', max: 40, group: 'look', label: { ar: 'العيون', en: 'Eyes' } },
    {
      key: 'playingAge', kind: 'text', max: 12, group: 'look',
      label: { ar: 'العمر اللي بيمثّله', en: 'Playing age' },
      // The age range they read as on camera, not how old they are. It is what
      // a concept actually needs, and it avoids holding a date of birth.
      hint: { ar: 'مثلًا ٢٠–٢٨. مش العمر الحقيقي.', en: 'e.g. 20–28. Not their actual age.' },
    },
    // ── what they are good for ─────────────────────────────────────────────
    {
      key: 'looks', kind: 'list', group: 'craft',
      suggest: ['to-camera', 'hands', 'athletic', 'warm', 'clinical', 'fashion', 'eating', 'editorial'],
      label: { ar: 'نوع اللقطات', en: 'Shots' },
      hint: { ar: 'نوع اللقطات اللي بينجح فيها', en: 'The kinds of shot they are good in' },
    },
  ],
  photographer: [
    {
      key: 'specialties', kind: 'list', group: 'craft',
      suggest: ['product', 'portrait', 'food', 'interiors', 'event', 'fashion'],
      label: { ar: 'التخصص', en: 'Specialties' },
    },
    {
      key: 'kit', kind: 'text', max: 200, group: 'kit',
      label: { ar: 'المعدات', en: 'Kit' },
      hint: { ar: 'الكاميرا، العدسات، الإضاءة', en: 'Body, lenses, lighting' },
    },
    { key: 'retouches', kind: 'flag', group: 'kit', label: { ar: 'بيعدّل الصور بنفسه', en: 'Retouches their own work' } },
    { key: 'studio', kind: 'flag', group: 'kit', label: { ar: 'عنده ستوديو', en: 'Has a studio' } },
  ],
  videographer: [
    {
      key: 'specialties', kind: 'list', group: 'craft',
      suggest: ['product', 'interview', 'observational', 'event', 'table-top', 'walkthrough'],
      label: { ar: 'التخصص', en: 'Specialties' },
    },
    {
      key: 'kit', kind: 'text', max: 200, group: 'kit',
      label: { ar: 'المعدات', en: 'Kit' },
      hint: { ar: 'الكاميرا، جيمبال، درون، صوت', en: 'Camera, gimbal, drone, audio' },
    },
    {
      key: 'edits', kind: 'flag', group: 'kit',
      label: { ar: 'بيعمل المونتاج بنفسه', en: 'Edits their own footage' },
      hint: {
        ar: 'اللي بيصوّر وبيركّب بيخلّص اليوم بيوم',
        en: 'Somebody who shoots and cuts finishes a day in a day',
      },
    },
    { key: 'drone', kind: 'flag', group: 'kit', label: { ar: 'عنده درون مرخّص', en: 'Licensed drone' } },
  ],
  voiceover: [
    {
      key: 'dialects', kind: 'list', group: 'craft',
      suggest: ['Ammani', 'MSA', 'Gulf', 'Egyptian', 'Levantine', 'English (UK)', 'English (US)'],
      label: { ar: 'اللهجات', en: 'Dialects' },
    },
    {
      key: 'registers', kind: 'list', group: 'craft',
      suggest: ['warm', 'calm', 'energetic', 'authoritative', 'young', 'clinical'],
      label: { ar: 'نبرة الصوت', en: 'Registers' },
    },
    {
      key: 'homeStudio', kind: 'flag', group: 'kit',
      label: { ar: 'بيسجّل من البيت بجودة ستوديو', en: 'Records broadcast-quality at home' },
    },
  ],
};

/** The fields for one discipline, in card order: the trade's own, then the general ones. */
export const fieldsFor = (d: TalentDiscipline): Field[] => [...(FIELDS[d] ?? []), ...COMMON];

/** The same fields, bucketed for layout. Empty groups are left out. */
export const groupsFor = (d: TalentDiscipline): { group: Group; fields: Field[] }[] =>
  GROUPS.map((group) => ({ group, fields: fieldsFor(d).filter((f) => f.group === group) }))
    .filter((g) => g.fields.length > 0);

export type Attributes = Record<string, number | string | string[] | boolean>;

/**
 * Keep what the schema recognises, in the type it declares, and nothing else.
 *
 * The form posts whatever is in it. A number field arriving as "160cm", a list
 * as one comma-separated string, a key from a different discipline after an
 * operator switched someone from model to voiceover — each is either coerced to
 * the declared shape or dropped, so the stored record never holds a value no
 * field would render. An out-of-range number is dropped rather than clamped: a
 * height of 16 is a typo for 160, and silently storing 120 is a worse answer
 * than asking again.
 */
export function cleanAttributes(d: TalentDiscipline, raw: unknown): Attributes {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out: Attributes = {};
  for (const f of fieldsFor(d)) {
    const v = src[f.key];
    if (v === undefined || v === null || v === '') continue;
    switch (f.kind) {
      case 'number': {
        const n = Number(String(v).replace(/[^\d.]/g, ''));
        if (Number.isFinite(n) && n >= f.min && n <= f.max) out[f.key] = n;
        break;
      }
      case 'text': {
        const s = String(v).trim().slice(0, f.max);
        if (s) out[f.key] = s;
        break;
      }
      case 'list': {
        const items = (Array.isArray(v) ? v : String(v).split(','))
          .map((x) => String(x).trim()).filter(Boolean);
        const uniq = [...new Set(items)].slice(0, 20);
        if (uniq.length) out[f.key] = uniq;
        break;
      }
      case 'choice': {
        // "xs-s", "XS - S" and "xs–s" all mean the same rack range.
        const s = String(v).trim().toUpperCase().replace(/\s*[-–—]\s*/g, '–');
        if (f.options.some((o) => o.value === s)) out[f.key] = s;
        break;
      }
      case 'flag':
        out[f.key] = v === true || v === 'true' || v === 'on';
        break;
    }
  }
  return out;
}
