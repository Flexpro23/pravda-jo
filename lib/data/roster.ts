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
  /**
   * What they are cast for. Verticals from the concept library plus craft
   * traits, seeded straight onto the bookable record as `Talent.tags` so the
   * recommender casts on fit rather than on whoever sorts first.
   *
   * It lives here and not only on the talent record because this list is the
   * one a person edits: adding somebody to the roster and forgetting to say
   * what they are for is how eight interchangeable models happen.
   */
  suits?: string[];
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
    suits: ['food', 'retail', 'edu', 'pro', 'one-setup', 'fast-turnaround'],
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
    suits: ['fitness', 'property', 'body', 'available-light', 'observational'],
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
    suits: ['fitness', 'edu', 'pro', 'coaching', 'unpolished'],
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
    suits: ['retail', 'food', 'edu', 'weekly', 'to-camera'],
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
    suits: ['edu', 'pro', 'food', 'ammani', 'msa'],
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
  {
    key: 'zaid',
    suits: ['pro', 'edu', 'auto', 'camera-shy', 'interview'],
    name: { ar: 'زيد', en: 'Zaid' },
    role: { ar: 'تصوير وتركيب', en: 'Shoot & edit' },
    discipline: 'videographer',
    placeholder: true,
    piece: 'qalam-legal',
    line: {
      ar: 'بيشتغل مع اللي ما بيحبّوا الكاميرا — محامين، دكاترة، محاسبين. بيحكي معهم عشر دقايق قبل ما يشغّل، وهاد اللي بيوفّر ساعتين بعدها.',
      en: 'Works with people who dislike being filmed — lawyers, doctors, accountants. Talks to them for ten minutes before rolling, which is what saves the two hours afterwards.',
    },
  },
  {
    key: 'majd',
    suits: ['food', 'retail', 'body', 'table-top', 'product'],
    name: { ar: 'مجد', en: 'Majd' },
    role: { ar: 'تصوير منتجات', en: 'Product & table-top' },
    discipline: 'videographer',
    placeholder: true,
    piece: 'sahn-wa-nus',
    line: {
      ar: 'طاولة وإضاءة وصبر. بيطلّع من طبق واحد ستة مقاطع مختلفة بدون ما يتحرّك من مكانه.',
      en: 'A table, a light, and patience. Gets six different clips out of one dish without moving from the spot.',
    },
  },
  {
    key: 'hala',
    suits: ['food', 'retail', 'eating', 'warm'],
    name: { ar: 'هلا', en: 'Hala' },
    role: { ar: 'أمام الكاميرا', en: 'On camera' },
    discipline: 'model',
    placeholder: true,
    piece: 'sahn-wa-nus',
    line: {
      ar: 'بتاكل قدّام الكاميرا بدون ما تمثّل إنها بتاكل، وهاي أصعب مما بتبيّن. بتشتغل مطاعم وكافيهات.',
      en: 'Eats on camera without performing eating, which is harder than it sounds. Works restaurants and cafés.',
    },
  },
  {
    key: 'tareq',
    suits: ['auto', 'retail', 'pro', 'hands', 'practical'],
    name: { ar: 'طارق', en: 'Tareq' },
    role: { ar: 'أمام الكاميرا', en: 'On camera' },
    discipline: 'model',
    placeholder: true,
    piece: 'mirage-detailing',
    line: {
      ar: 'بيشتغل بإيديه قدّام الكاميرا — سيارات، عدّة، أي إشي بيحتاج حدا يعرف يمسكه صح.',
      en: 'Works with his hands on camera — cars, tools, anything that needs somebody who knows how to hold it properly.',
    },
  },
  {
    key: 'lana',
    suits: ['body', 'retail', 'clinical', 'careful'],
    name: { ar: 'لانا', en: 'Lana' },
    role: { ar: 'أمام الكاميرا', en: 'On camera' },
    discipline: 'model',
    placeholder: true,
    piece: 'noor-clinic',
    line: {
      ar: 'بتشتغل عناية وتجميل، وبتعرف الخط اللي ما بينعدّى: ولا لقطة بتوحي إنها نتيجة علاج.',
      en: 'Works beauty and skin, and knows the line that is not crossed: not one frame that could read as a treatment result.',
    },
  },
  {
    key: 'sami',
    suits: ['fitness', 'body', 'athletic', 'demonstration'],
    name: { ar: 'سامي', en: 'Sami' },
    role: { ar: 'أمام الكاميرا', en: 'On camera' },
    discipline: 'model',
    placeholder: true,
    piece: 'nadi-sittin',
    line: {
      ar: 'رياضي فعلًا، مش ممثّل بيعمل حاله رياضي. بيعيد التمرين عشر مرّات بدون ما ينقطع نفَسه ولا يتغيّر شكل التمرين.',
      en: 'Actually trains, rather than an actor playing somebody who trains. Repeats a movement ten times without the form or his breathing changing.',
    },
  },
  {
    key: 'rasha',
    suits: ['retail', 'body', 'fashion', 'fast-changes'],
    name: { ar: 'رشا', en: 'Rasha' },
    role: { ar: 'أمام الكاميرا', en: 'On camera' },
    discipline: 'model',
    placeholder: true,
    piece: 'zeitouna-optics',
    line: {
      ar: 'بتشتغل تجزئة وأزياء. بتغيّر ستة إطلالات بساعتين بدون ما يضيع الوقت بين وحدة والتانية.',
      en: 'Works retail and fashion. Changes six looks in two hours with no time lost between them.',
    },
  },
  {
    key: 'fadi',
    suits: ['property', 'pro', 'auto', 'walkthrough', 'long-take'],
    name: { ar: 'فادي', en: 'Fadi' },
    role: { ar: 'أمام الكاميرا', en: 'On camera' },
    discipline: 'model',
    placeholder: true,
    piece: 'wadi-properties',
    line: {
      ar: 'بيمشي بالمكان زي ما بيمشي فيه اللي بيسكنه. بيشتغل عقارات ومعارض، ولقطة وحدة طويلة بترتاح معه.',
      en: 'Moves through a space the way somebody who lives in it moves. Works property and showrooms, and holds a long single take without it going stiff.',
    },
  },
  {
    key: 'sireen',
    suits: ['body', 'pro', 'edu', 'clinical', 'calm'],
    name: { ar: 'سيرين', en: 'Sireen' },
    role: { ar: 'تعليق صوتي', en: 'Voiceover' },
    discipline: 'voiceover',
    placeholder: true,
    piece: 'noor-clinic',
    line: {
      ar: 'صوت هادي بيمشي مع الطبي والعناية. بتقرأ النص وبتوقف عند أي جملة بتوعد بإشي — وهاي وقفة بتوفّر مشاكل.',
      en: 'A quiet read that suits clinical and skin work. Reads a script and stops at any line that promises an outcome — a pause that saves trouble later.',
    },
  },
];


/** The image a member is shown with: their portrait, else the plate of their piece. */
export const shotFor = (m: CastMember) => m.photo ?? `/plates/${m.piece}.svg`;

/* pieceOf and countBy used to live here and reached into the archive module.
   Both are resolved in CastFlow now from the roster and archive it is handed,
   because neither list is a compile-time constant any more. */
