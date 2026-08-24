/**
 * One source of truth for the entity facts.
 *
 * These strings gate Meta Business Verification, which gates WhatsApp template
 * approval, which gates both Teardown delivery and the talent booking layer.
 * The legal name here must match the commercial registration exactly.
 */
export const CO = {
  legalName: { ar: 'برافدا للإنتاج الإبداعي', en: 'PRAVDA Creative Production' },
  // TODO(ali): replace with the real CR number before submitting to Meta
  cr: '200-XXXXXX',
  district: { ar: 'جبل عمّان', en: 'Jabal Amman' },
  city: { ar: 'عمّان', en: 'Amman' },
  country: { ar: 'الأردن', en: 'Jordan' },
  street: { ar: 'شارع رينبو', en: 'Rainbow Street' },
  phone: '+962797989818',
  phoneDisplay: '+962 79 798 9818',
  email: 'hello@pravda.jo',
  privacyEmail: 'privacy@pravda.jo',
  instagram: 'pravda.jo',
  founded: '2026',
} as const;

export const FOUNDERS = [
  {
    key: 'ali',
    name: { ar: 'علي عودات', en: 'Ali Odat' },
    role: { ar: 'الأنظمة والإعلانات المدفوعة', en: 'Systems & paid advertising' },
    bio: {
      ar: 'بيبني الأنظمة اللي بتشتغل عليها برافدا، وبيدير حملات الإعلانات لكل العملاء. خلفيته بتطوير البرمجيات وتحليل الأداء.',
      en: 'Builds the systems PRAVDA runs on and manages every client’s advertising. Background in software and performance analysis.',
    },
  },
  {
    key: 'khaled',
    name: { ar: 'خالد', en: 'Khaled' },
    role: { ar: 'الإنتاج والروستر', en: 'Production & the roster' },
    bio: {
      ar: 'بيدير الإنتاج والطاقم. بنى على مدى سنين علاقات مع عارضين ومصوّرين ومركّبين في عمّان — وهاد الروستر اللي منشتغل فيه.',
      en: 'Runs production and the roster. Built the relationships with models, photographers and editors across Amman over years — that roster is what we cast from.',
    },
  },
] as const;

/** Published prices. Never quoted on a call. */
export const RATES = [
  {
    key: 'asset',
    label: { ar: 'مقطع واحد', en: 'One asset' },
    price: 150, unit: { ar: 'دينار', en: 'JOD' },
    note: {
      ar: 'ضمن يوم تصوير مشترك. المقطع المنفرد بيوم كامل بيتسعّر بسعر اليوم.',
      en: 'As part of a shared shoot day. A single asset needing a dedicated crew day is priced at the day rate.',
    },
  },
  {
    key: 'ads',
    label: { ar: 'إدارة الإعلانات', en: 'Advertising management' },
    price: 400, unit: { ar: 'دينار بالشهر', en: 'JOD / month' },
    note: {
      ar: 'من ٤٠٠. الحسابات اللي بتصرف أكثر بتتسعّر حسب حجم الصرف.',
      en: 'From 400. Accounts spending materially more are priced against that spend.',
    },
  },
  {
    key: 'teardown',
    label: { ar: 'التحقيق', en: 'The teardown' },
    price: 0, unit: { ar: 'مجانًا', en: 'free' },
    note: {
      ar: 'دائمًا. ما في شرط، وما في مكالمة مبيعات قبله.',
      en: 'Always. No conditions, and no sales call before it.',
    },
  },
] as const;
