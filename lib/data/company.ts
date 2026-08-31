/**
 * One source of truth for the entity facts.
 *
 * These strings gate Meta Business Verification, which gates WhatsApp template
 * approval, which gates both Teardown delivery and the talent booking layer.
 * The legal name here must match the commercial registration exactly.
 */

/**
 * Where this deployment lives.
 *
 * Held as a variable rather than a literal because the domain is not bought
 * yet and probably will not be the one we first wanted. Everything that has to
 * name the site absolutely — canonical URLs, the sitemap, robots, the
 * user-agent we identify ourselves with when reading a prospect's page, the
 * link in a booking message — reads it from here, so the move is one
 * environment variable and no code change.
 *
 * The fallback is the App Hosting address, which is a real, reachable origin.
 * A placeholder domain would put a URL that resolves to nothing into a
 * sitemap and into strangers' server logs.
 */
export const SITE = (process.env.NEXT_PUBLIC_SITE_URL
  || 'https://my-web-app--pravda-jo.europe-west4.hosted.app').replace(/\/$/, '');

/** The bare host, for anywhere a URL would read as noise. */
export const SITE_HOST = SITE.replace(/^https?:\/\//, '');

export const CO = {
  legalName: { ar: 'برافدا للإنتاج الإبداعي', en: 'PRAVDA Creative Production' },
  /**
   * The commercial registration number.
   *
   * Deliberately absent until the real one exists. It was published as
   * `200-XXXXXX` on every page, on the client sheet, on the proposal a client
   * keeps and on the statement a provider is paid against — a visible
   * placeholder on documents that leave the building, from a studio whose
   * entire pitch is that it only says what it can prove.
   *
   * Every render site is guarded on this being set, so restoring it is exactly
   * one line here and nothing else. It becomes required again the moment we
   * submit to Meta Business Verification, which is what gates WhatsApp
   * templates — and, separately, Page Public Content Access, which is the only
   * route to reading a prospect's Facebook page.
   */
  cr: undefined as string | undefined,
  district: { ar: 'جبل عمّان', en: 'Jabal Amman' },
  city: { ar: 'عمّان', en: 'Amman' },
  country: { ar: 'الأردن', en: 'Jordan' },
  street: { ar: 'شارع رينبو', en: 'Rainbow Street' },
  phone: '+962797989818',
  phoneDisplay: '+962 79 798 9818',
  /**
   * Both mailboxes sit on a domain that is not registered yet, so they are
   * variables too and move with it. Until then the phone is the channel that
   * actually answers, which is why every page leads with it.
   */
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'hello@pravda.jo',
  privacyEmail: process.env.NEXT_PUBLIC_PRIVACY_EMAIL || 'privacy@pravda.jo',
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
