type B = { ar: string; en: string };

/** The three things a client casts for. The toggle on the Cast page is this list. */
export const DISCIPLINES = ['videographer', 'model', 'voiceover'] as const;
export type Discipline = (typeof DISCIPLINES)[number];

export const DISCIPLINE_LABEL: Record<Discipline | 'all', B> = {
  all:          { ar: 'الكل',        en: 'Everyone' },
  videographer: { ar: 'تصوير',       en: 'Videographers' },
  model:        { ar: 'أمام الكاميرا', en: 'Models' },
  voiceover:    { ar: 'تعليق صوتي',   en: 'Voiceover' },
};

/** Four full labels overrun a phone, and a filter you cannot see is not a filter. */
export const DISCIPLINE_SHORT: Record<Discipline | 'all', B> = {
  all:          { ar: 'الكل',   en: 'All' },
  videographer: { ar: 'تصوير',  en: 'Video' },
  model:        { ar: 'وجوه',   en: 'Model' },
  voiceover:    { ar: 'صوت',    en: 'Voice' },
};

export type CastMember = {
  key: string;
  name: B;
  /** their credit wording, as it appears on the work */
  role: B;
  discipline: Discipline;
  /** the piece they are reached through — the premise of the page */
  piece: string;
  /** how they work. Not achievements — the thing a producer needs to know. */
  line: B;
  /**
   * A portrait, once one exists. Until then the piece's plate stands in, which
   * is honest: the work is genuinely the only image of them the studio holds.
   * Drop a file in /public/cast and set this to switch a person over.
   */
  photo?: string;
  /** Invented. See the same field on Piece. */
  placeholder?: boolean;
};

/**
 * The roster is deliberately its own list rather than being derived from the
 * work credits. Everyone here is still reachable through a piece, but a new
 * face can be added before they have shot anything — which is the only way to
 * list a discipline the archive does not cover yet.
 */
export const ROSTER: CastMember[] = [
  {
    key: 'omar',
    name: { ar: 'عمر', en: 'Omar' },
    role: { ar: 'تصوير وتركيب', en: 'Shoot & edit' },
    discipline: 'videographer',
    placeholder: true,
    piece: 'bayt-al-akhdar',
    line: {
      ar: 'بيصوّر وبيركّب نفس الشغلة، فما بيضيع إشي بين الاتنين. إعداد واحد، ما بينتقل، وبيخلص بنص يوم.',
      en: 'Shoots and cuts the same piece, so nothing is lost in the handover. One setup, never moved, finished in half a day.',
    },
  },
  {
    key: 'rana',
    name: { ar: 'رنا', en: 'Rana' },
    role: { ar: 'تصوير', en: 'Camera' },
    discipline: 'videographer',
    placeholder: true,
    piece: 'nadi-sittin',
    line: {
      ar: 'بتفضّل الإضاءة الموجودة وعدسة طويلة. بتشتغل بعيد عن الناس لحد ما ينسوا إنها موجودة.',
      en: 'Prefers available light and a long lens. Works far enough back that people forget she is there.',
    },
  },
  {
    key: 'laith',
    name: { ar: 'ليث', en: 'Laith' },
    role: { ar: 'أمام الكاميرا', en: 'On camera' },
    discipline: 'model',
    placeholder: true,
    piece: 'nadi-sittin',
    line: {
      ar: 'بيوقف قدّام الكاميرا وبيدرّب غيره كمان — أصحاب المحلات اللي عمرهم ما انصوّروا، بيخلّيهم يبطّلوا يمثّلوا.',
      en: 'On camera, and coaches the people who have never been filmed — owners, staff — until they stop performing.',
    },
  },
  {
    key: 'dana',
    name: { ar: 'دانا', en: 'Dana' },
    role: { ar: 'أمام الكاميرا', en: 'On camera' },
    discipline: 'model',
    placeholder: true,
    piece: 'zeitouna-optics',
    line: {
      ar: 'بتقرأ النص مرّة وبعدها بتحكيه بطريقتها. بتشتغل أسبوعي، ونفس الوجه بيرجع كل خميس.',
      en: 'Reads a script once, then says it the way she would say it. Works weekly, so the same face returns every Thursday.',
    },
  },
  {
    key: 'yara',
    name: { ar: 'يارا', en: 'Yara' },
    role: { ar: 'تعليق صوتي', en: 'Voiceover' },
    discipline: 'voiceover',
    placeholder: true,
    piece: 'dar-hikma',
    line: {
      ar: 'بتسجّل بالعمّاني وبالفصحى، وبتعرف وين الفرق بينهم بيهم. بتبعت أول نسخة بنفس اليوم، وبتعيد أي سطر بدون نقاش.',
      en: 'Records in Ammani dialect and in MSA, and knows which one a line actually needs. First cut back the same day, and re-reads any line without a discussion.',
    },
  },
];

/** The image a member is shown with: their portrait, else the plate of their piece. */
export const shotFor = (m: CastMember) => m.photo ?? `/plates/${m.piece}.svg`;

/* pieceOf and countBy used to live here and reached into the archive module.
   Both are resolved in CastFlow now from the roster and archive it is handed,
   because neither list is a compile-time constant any more. */
