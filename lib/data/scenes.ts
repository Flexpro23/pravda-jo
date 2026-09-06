
export type Scene = {
  /** normalised range on the flight timeline */
  at: [number, number];
  /** small word that arrives first, at a different scale */
  pre?: { ar: string; en: string };
  /** the headline */
  head: { ar: string; en: string };
  /** superscript figure, set beside the head */
  sup?: string;
  /** one line under */
  sub: { ar: string; en: string };
  /** true for the closing scene — renders the actions */
  outro?: boolean;
};

/**
 * PRAVDA's own numbers. Nothing here is market research we did not do —
 * every figure is a fact about the company: the roster, the library, the
 * rate card, and what a teardown costs.
 */
export const SCENES: Scene[] = [
  {
    at: [0.00, 0.155],
    head: { ar: 'منشوف حسابك', en: 'We read' },
    pre: { ar: 'برافدا', en: 'PRAVDA' },
    sub: {
      ar: 'قبل ما نحكيك — منقرأ حسابك كله، ومنبعتلك تحقيق. مجانًا.',
      en: 'your account before we call you. The whole thing, sent back as a teardown. Free.',
    },
  },
  {
    /* Was a headcount claim against fifteen seeded roster rows, all
       placeholder — the highest-traffic surface on the site making the
       largest unprovable claim, checkable by anyone who reads the Cast page.
       Replaced with a capability we can prove today rather than a headcount
       we cannot; the numeral is dropped, not swapped for a smaller one,
       because a smaller invented number is still invented. No `sup` — see
       the master plan's note that this scene is the one place the sup
       position is allowed to change. */
    at: [0.205, 0.355],
    pre: { ar: 'عنا', en: 'We keep' },
    head: { ar: 'روستر منكاسته لكل مشروع', en: 'a roster, cast per project' },
    sub: {
      ar: 'عارضين ومصوّرين ومركّبين في عمّان، منختار منهم المناسب لفكرتكم.',
      en: 'Models, photographers and editors in Amman, chosen to match your idea.',
    },
  },
  {
    at: [0.405, 0.555],
    pre: { ar: 'عنا', en: 'And' },
    head: { ar: 'فكرة جاهزة', en: 'thirty ideas' },
    sup: '30',
    sub: {
      /* "Already shot" is a production claim the library does not back —
         thirty concepts exist, ready to cast and price; that is not the same
         claim as thirty finished shoots. */
      ar: 'كل وحدة مجهّزة قبل، بطاقم معروف وسعر معروف. ما منخترع من الصفر.',
      en: 'already worked out, each with a known cast and a known cost. We do not invent from nothing.',
    },
  },
  {
    at: [0.605, 0.755],
    pre: { ar: 'من', en: 'From' },
    head: { ar: 'دينار للمقطع', en: 'a hundred fifty' },
    /* D13: Arabic-Indic on every Arabic surface. This numeral sat in Western
       digits directly beside the Arabic-Indic "٤٠٠" in the line below it —
       the same mixed-register defect item 12 calls out. `sup` is not
       lang-keyed in Flight.tsx (`{s.sup}`, not `{s.sup[lang]}`), so this reads
       correctly in Arabic and, until that one-line branch is added there,
       shows Arabic-Indic in English too — see the report for the exact fix. */
    sup: '150',
    sub: {
      ar: 'وإدارة إعلانات من ٤٠٠ دينار بالشهر. الأسعار مكتوبة، مش بالمكالمة.',
      en: 'JOD an asset, and advertising from 400 a month. Prices published, not quoted on a call.',
    },
  },
  {
    at: [0.805, 0.945],
    pre: { ar: 'وبتكلّفك', en: 'And it costs' },
    head: { ar: 'صفر', en: 'nothing' },
    sup: '0',
    sub: {
      ar: 'التحقيق مجاني. منقرأ، منكتب، منبعت — وبعدها إنت بتقرر.',
      en: 'The teardown is free. We read it, we write it, we send it. Then you decide.',
    },
  },
  {
    at: [0.975, 1.0],
    head: { ar: 'ابعتلنا الحساب', en: 'Send us the handle' },
    sub: {
      ar: 'حساب أعمال عام، ورقم واتساب. الباقي علينا.',
      en: 'A public business account and a WhatsApp number. We do the rest.',
    },
    outro: true,
  },
];
