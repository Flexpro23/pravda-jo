export type Lang = 'ar' | 'en';

export const isRTL = (l: Lang) => l === 'ar';
export const other = (l: Lang): Lang => (l === 'ar' ? 'en' : 'ar');
export const path = (l: Lang, p = '') => `/${l}${p ? `/${p}` : ''}`;

type Dict = Record<string, { ar: string; en: string }>;

export const t: Dict = {
  navWork:     { ar: 'الأعمال',        en: 'Work' },
  navCast:     { ar: 'الوجوه',         en: 'Cast' },
  navTeardown: { ar: 'التحقيق',        en: 'Teardown' },
  navContact:  { ar: 'تواصلوا',        en: 'Contact' },

  heroKicker:  { ar: 'عمّان · إنتاج وإعلانات', en: 'Amman · Production & Advertising' },
  heroLine1:   { ar: 'منشوف حسابك',    en: 'We read your account' },
  heroLine2:   { ar: 'قبل ما نحكيك.',  en: 'before we call you.' },
  heroBody: {
    ar: 'برافدا بتصوّر، بتركّب، وبتدير الإعلانات لأصحاب المشاريع في عمّان. وقبل ما نعرض عليكم إشي، منقرأ حسابكم كله ومنبعتلكم تحقيق — مجانًا.',
    en: 'PRAVDA shoots, cuts, and runs the advertising for business owners in Amman. Before we pitch you anything, we read your entire account and send you a teardown — free.',
  },
  heroCta:     { ar: 'اطلبوا تحقيقكم',  en: 'Get your teardown' },
  heroCta2:    { ar: 'شوفوا نموذج',     en: 'Read a specimen' },

  workEyebrow: { ar: 'الأرشيف',        en: 'The archive' },
  workTitle:   { ar: 'الفكرة، ومَن نفّذها، والنتيجة', en: 'The idea, the cast, the result' },
  workBody: {
    ar: 'كل عمل هون معروض بنفس الشكل اللي بيوصلكم فيه التحقيق. نفس الصفحة، نفس التركيبة — بس هدول اتنفّذوا فعلًا.',
    en: 'Every piece here is shown in the same layout your teardown arrives in. Same page, same structure — these ones already happened.',
  },

  castEyebrow: { ar: 'الوجوه والطاقم',  en: 'Cast & crew' },
  castTitle:   { ar: 'ما في دليل أسماء', en: 'There is no directory' },
  castBody: {
    ar: 'ما منعرض الناس بقائمة بتنتقى منها. كل شخص هون بتوصلوا إله من خلال شغل عمله. هيك بيشتغل الإنتاج فعلًا.',
    en: 'We do not present people as a list you pick from. Everyone here is reached through work they made. That is how production actually works.',
  },

  tdEyebrow:   { ar: 'التحقيق',        en: 'The teardown' },
  tdTitle:     { ar: 'شو منقرأ، وشو ما منقرأ', en: 'What we read, and what we do not' },
  tdBody: {
    ar: 'منقرأ اللي نشرتوه أنتم بشكل علني — لا أكثر. مية منشور، صيغها، توقيتها، والتعليقات الظاهرة. وإعلاناتكم وإعلانات جيرانكم من مكتبة ميتا العامة.',
    en: 'We read what you published publicly — nothing more. A hundred posts, their formats, their timing, and the visible comments. Plus your ads and your neighbours’ from Meta’s public library.',
  },
  tdCta:       { ar: 'ابعتوا الحساب',   en: 'Send the handle' },
  tdPlaceholder:{ ar: '@حسابكم',        en: '@yourbusiness' },
  tdNote: {
    ar: 'حسابات الأعمال العامة بس. منبعتلكم رابط على واتساب خلال يوم عمل.',
    en: 'Public business accounts only. We send a link on WhatsApp within one working day.',
  },

  scrollIn:    { ar: 'انزل لتبدأ',      en: 'Scroll to begin' },
  keepGoing:   { ar: 'كمّل',            en: 'Keep going' },
  keepGoingEnd:{ ar: 'خلصنا',           en: 'That is all of it' },
  from:        { ar: 'من',             en: 'from' },
  jod:         { ar: 'دينار',          en: 'JOD' },
  perMonth:    { ar: 'بالشهر',         en: 'per month' },
  cast:        { ar: 'الطاقم',         en: 'The cast' },
  idea:        { ar: 'الفكرة',         en: 'The idea' },
  result:      { ar: 'النتيجة',        en: 'The result' },
  readMore:    { ar: 'التفاصيل',       en: 'Read the piece' },
  allWork:     { ar: 'كل الأعمال',     en: 'All work' },
  backHome:    { ar: 'الرئيسية',       en: 'Home' },
  addr:        { ar: 'جبل عمّان، عمّان، الأردن', en: 'Jabal Amman, Amman, Jordan' },
  rights:      { ar: 'برافدا ٢٠٢٦',    en: 'PRAVDA 2026' },
  founders:    { ar: 'علي ع. · خالد ق.', en: 'Ali O. · Khaled Q.' },
};

export const tx = (k: string, l: Lang) => t[k]?.[l] ?? k;
