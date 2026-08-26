export type Lang = 'ar' | 'en';

export const isRTL = (l: Lang) => l === 'ar';
export const other = (l: Lang): Lang => (l === 'ar' ? 'en' : 'ar');
export const path = (l: Lang, p = '') => `/${l}${p ? `/${p}` : ''}`;

/** Reading direction decides which way "onward" and "back" point. */
export const fwd = (l: Lang) => (l === 'ar' ? '←' : '→');
export const back = (l: Lang) => (l === 'ar' ? '→' : '←');
/** List separator. An Arabic comma inside an English address is a tell. */
export const sep = (l: Lang) => (l === 'ar' ? '، ' : ', ');

type Dict = Record<string, { ar: string; en: string }>;

export const t: Dict = {
  navWork:     { ar: 'الأعمال',        en: 'Work' },
  navCast:     { ar: 'الوجوه',         en: 'Cast' },
  navTeardown: { ar: 'التحقيق',        en: 'Teardown' },
  navContact:  { ar: 'تواصلوا',        en: 'Contact' },
  navStudio:   { ar: 'الاستوديو',      en: 'Studio' },
  navPricing:  { ar: 'الأسعار',        en: 'Pricing' },
  navPrivacy:  { ar: 'الخصوصية',       en: 'Privacy' },
  navNotice:   { ar: 'إشعار المعالجة', en: 'Processing notice' },
  navTerms:    { ar: 'الشروط',         en: 'Terms' },
  navData:     { ar: 'بياناتك',        en: 'Your data' },
  footLine:    { ar: 'إنتاج بصري وإدارة إعلانات. عمّان، الأردن.',
                 en: 'Production and advertising. Amman, Jordan.' },
  updated:     { ar: 'آخر تحديث',      en: 'Last updated' },

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

  castReached: { ar: 'وصلناله من',     en: 'Reached through' },
  castPick:    { ar: 'خلّي الذكاء الاصطناعي يختار طاقمك',
                 en: 'Let AI choose your perfect cast' },
  castPickBody: {
    ar: 'قوللنا شو بدك تصوّر ومنقرأ حسابك، وبنرجعلك بطاقم مقترح بالاسم — مع السعر، قبل أي مكالمة.',
    en: 'Tell us what you need to shoot. We read your account and come back with a cast proposed by name, priced, before any call.',
  },
  castNone: {
    ar: 'ما عندنا حدا بهالتخصص على الروستر لحد الآن. احكينا شو بدك ومنلاقيلك.',
    en: 'Nobody on the roster for this yet. Tell us what you need and we will find them.',
  },

  workPick:    { ar: 'شوف شو منعمل إلك', en: 'See what we would make for you' },
  workPickBody: {
    ar: 'كل شغلة هون بلّشت بتحقيق للحساب. ابعتلنا حسابك ومنقرأه بنفس الطريقة — مجانًا، وبسعر مكتوب قبل أي مكالمة.',
    en: 'Every piece here started as a teardown of the account. Send us yours and we read it the same way — free, and priced before any call.',
  },

  tdEyebrow:   { ar: 'التحقيق',        en: 'The teardown' },
  tdTitle:     { ar: 'شو منقرأ، وشو ما منقرأ', en: 'What we read, and what we do not' },
  tdBody: {
    ar: 'منقرأ اللي نشرتوه أنتم بشكل علني — لا أكثر. مية منشور، صيغها، توقيتها، والتعليقات الظاهرة. وإعلاناتكم وإعلانات جيرانكم من مكتبة ميتا العامة.',
    en: 'We read what you published publicly — nothing more. A hundred posts, their formats, their timing, and the visible comments. Plus your ads and your neighbours’ from Meta’s public library.',
  },
  tdCta:       { ar: 'ابعتوا الحساب',   en: 'Send the handle' },
  /* The field takes a Latin handle, so the placeholder stays Latin in both
     locales — an Arabic placeholder inside a dir="ltr" input renders mangled.
     The accessible name carries the language instead. */
  tdField:     { ar: 'حساب إنستغرام',   en: 'Instagram handle' },
  tdNote: {
    ar: 'حسابات الأعمال العامة بس. منبعتلكم رابط على واتساب خلال يوم عمل.',
    en: 'Public business accounts only. We send a link on WhatsApp within one working day.',
  },
  tdSwitch:    { ar: 'حسابكم لسّا شخصي؟', en: 'Account still personal?' },

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
