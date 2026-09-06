import type { Sheet } from '@/lib/store/sheets';

/**
 * The public specimen: one finished sheet, checked in.
 *
 * `/specimen/[lang]` is the page every cold visitor is sent to as proof, and it
 * renders through `components/SheetView.tsx` — the same component, the same
 * stylesheet and the same DOM as the sheet a real prospect receives. What is
 * shown as a specimen is therefore exactly the artefact that gets delivered,
 * which is the whole point of retiring the old configurator.
 *
 * Materialised by hand rather than composed at request time, deliberately:
 *
 *   - The specimen must not depend on Firestore, on the roster, or on a Meta
 *     call. It is a marketing page and it renders when everything else is down.
 *   - It must not drift. Running the engine at request time would silently
 *     restyle the public proof every time a threshold in `findings.ts` moved,
 *     and nobody would be looking at it when it did.
 *
 * Everything here is fictional and stamped as such on the page. The business is
 * `Bayt Al-Akhdar` — the same fictional restaurant as `SAMPLE_DEAL` in
 * `lib/data/specimens.ts` and the `bayt-al-akhdar` piece in `lib/data/work.ts`,
 * so the invented world stays one world. The cast are the placeholder people in
 * `lib/data/roster.ts`, who carry `placeholder: true` there and are excluded
 * from every real recommendation and every real booking by D5. They appear here
 * only because a fictional sheet for a fictional restaurant is the one surface
 * where an invented name is honest — the page says so above the fold.
 *
 * The figures below are internally consistent: 52 median reactions against
 * 6,400 followers is the 0.8% quoted, 96 posts across 214 days is the 3.1 a
 * week, and the format shares sum to 100.
 */

/** Amman hours, 0–23. Lunch-heavy, which is the finding. */
const BY_HOUR = [0, 0, 0, 0, 0, 0, 1, 2, 3, 5, 7, 9, 14, 17, 11, 6, 4, 3, 5, 6, 4, 3, 1, 0];

export const SPECIMEN_SHEET: Sheet = {
  token: 'specimen0000',
  handle: 'baytalakhdar',
  clientName: 'Bayt Al-Akhdar',
  vertical: 'food',

  signals: {
    handle: 'baytalakhdar',
    followers: 6400,
    posts: 96,
    shallow: true,
    readShare: 0.71,
    first: '2026-02-03T10:12:00.000Z',
    last: '2026-09-03T11:40:00.000Z',
    spanDays: 214,
    daysSinceLast: 3,
    activeSpanDays: 217,
    postsPerWeek: 3.1,
    postsPerWeekInWindow: 3.1,
    recentPosts: 40,

    coverage: { likesKnown: 96, commentsKnown: 96, engagementKnown: 96, recentEngagementKnown: 40 },
    engagementReliable: true,

    engagementRate: 0.8,
    meanEngagementRate: 1.4,
    recentEngagementRate: 0.8,
    recentMedianEngagement: 52,
    selfP25Rate: 0.4,
    medianEngagement: 52,

    formats: [
      { format: 'IMAGE', posts: 52, known: 52, sharePosts: 54.2, shareKnown: 54.2, shareEngagement: 33.6, medianEngagement: 38 },
      { format: 'CAROUSEL_ALBUM', posts: 26, known: 26, sharePosts: 27.1, shareKnown: 27.1, shareEngagement: 23.1, medianEngagement: 44 },
      { format: 'REELS', posts: 18, known: 18, sharePosts: 18.8, shareKnown: 18.8, shareEngagement: 43.3, medianEngagement: 148 },
    ],
    strongest: {
      format: 'REELS', posts: 18, known: 18, sharePosts: 18.8, shareKnown: 18.8,
      shareEngagement: 43.3, medianEngagement: 148, p: 0.004,
    },
    busiest: { format: 'IMAGE', posts: 52, known: 52, sharePosts: 54.2, shareKnown: 54.2, shareEngagement: 33.6, medianEngagement: 38 },

    byHour: BY_HOUR,
    peakWindow: { from: 12, to: 14, share: 32.3 },
    bestWindow: { from: 20, to: 22, median: 119, n: 10, vsRest: 2.3 },
    best: {
      permalink: 'https://www.instagram.com/p/SPECIMEN/',
      timestamp: '2026-07-18T18:05:00.000Z',
      engagement: 322,
      multiple: 6.2,
      format: 'REELS',
    },
    captions: {
      withCaption: 92, none: 4, medianWords: 21,
      asking: 7, askingShare: 7.6, questioning: 11, questioningShare: 12.0,
    },
    bio: {
      biography: 'مطعم بيت الأخضر · عمّان · فطور وغدا يومي',
      website: undefined,
    },
  },

  site: null,

  findings: {
    read: { posts: 96, site: false, adsChecked: false },
    // Nothing failed on this fictional read, and none of this reaches /s anyway.
    operatorNotes: [],
    findings: [
      {
        id: 'ig-best',
        severity: 'good',
        source: 'instagram',
        figure: { ar: '٦٫٢×', en: '6.2×' },
        title: {
          ar: 'عندكم منشور طلع أقوى من العادي بستة أضعاف',
          en: 'One of your posts outperformed your typical one six times over',
        },
        detail: {
          ar: 'ريل نشرتوه بتموز أخد ٣٢٢ تفاعل، والمنشور العادي عندكم بياخد ٥٢. مش صدفة — نفس الشكل بيتكرر بكل الريلز عندكم.',
          en: 'A Reel you published in July drew 322 reactions against a typical 52. It is not an outlier — every Reel on the account behaves the same way.',
        },
        provenance: {
          ar: 'محسوب من ٩٦ منشور بين ٣ شباط و٣ أيلول ٢٠٢٦',
          en: 'Computed from 96 posts between 3 February and 3 September 2026',
        },
      },
      {
        id: 'ig-engagement',
        severity: 'critical',
        source: 'instagram',
        figure: { ar: '٠٫٨٪', en: '0.8%' },
        title: {
          ar: 'حسابكم بيوصل لجزء صغير من متابعينه',
          en: 'Your account reaches a fraction of its own followers',
        },
        detail: {
          ar: 'المنشور العادي عندكم بياخد ٥٢ تفاعل، وعندكم ٦٬٤٠٠ متابع. يعني ٠٫٨٪.',
          en: 'A typical post draws 52 reactions against 6,400 followers — 0.8%.',
        },
        provenance: { ar: 'محسوب من ٩٦ منشور', en: 'Computed from 96 posts' },
      },
      {
        id: 'ig-format',
        severity: 'critical',
        source: 'instagram',
        figure: { ar: '٤٣٪', en: '43%' },
        title: {
          ar: 'شغلكم رايح بمكان، والنتيجة بمكان تاني',
          en: 'Your effort is in one place and your results are in another',
        },
        detail: {
          ar: 'الريلز ١٩٪ من منشوراتكم وبتحمل ٤٣٪ من كل التفاعل. الصور المفردة ٥٤٪ من الشغل وبترجّع ٣٤٪.',
          en: 'Reels are 19% of what you publish and carry 43% of all engagement. Single images are 54% of the work and return 34%.',
        },
        provenance: {
          ar: 'محسوب من ٩٦ منشور: ١٨ ريل، ٢٦ ألبوم، ٥٢ صورة',
          en: 'Computed from 96 posts: 18 Reels, 26 carousels, 52 single images',
        },
      },
      {
        id: 'ig-ask',
        severity: 'notable',
        source: 'instagram',
        figure: { ar: '٧٪', en: '7%' },
        title: {
          ar: 'كابشناتكم بتحكي، بس نادرًا بتطلب',
          en: 'Your captions talk, but they rarely ask',
        },
        detail: {
          ar: '٧ من ٩٦ منشور فيهم طلب واضح — سؤال، أو رابط، أو «رنّوا علينا». الباقي بيوصف الأكل وبيوقف.',
          en: '7 of 96 posts carry an explicit ask — a question, a link, or "message us". The rest describe the food and stop.',
        },
        provenance: {
          ar: 'محسوب من نص الكابشن بـ ٩٦ منشور',
          en: 'Computed from the caption text of 96 posts',
        },
      },
    ],
    charts: [
      {
        kind: 'bars',
        id: 'formats',
        title: {
          ar: 'التفاعل للمنشور الواحد، حسب الشكل',
          en: 'Engagement on a typical post, by format',
        },
        note: {
          ar: 'مقارنة بالمنشور العادي عندكم — ٥٢ تفاعل.',
          en: 'Against your own typical post — 52 reactions.',
        },
        series: [
          { label: { ar: 'ريلز', en: 'Reels' }, value: 2.8, hi: true },
          { label: { ar: 'ألبومات', en: 'Carousels' }, value: 0.8 },
          { label: { ar: 'صور مفردة', en: 'Single images' }, value: 0.7 },
        ],
      },
      {
        kind: 'hours',
        id: 'hours',
        title: { ar: 'ساعات النشر، بتوقيت عمّان', en: 'Publishing hours, Amman time' },
        byHour: BY_HOUR,
        peak: [12, 14],
        best: [20, 22],
      },
    ],
  },

  recommendations: [
    {
      conceptN: 8,
      crewNotes: ['photographer', 'editor'],
      shape: 'product',
      name: 'The Menu Day',
      tier: 'light',
      videos: 8,
      priceJOD: 1200,
      hook: 'An audible slam of the product hitting a hard surface in frame one, no logo, no face, no intro — and the still of the same item is already on the client’s grid.',
      premise: 'One lighting setup, one half day: thirty to forty finished stills of the menu plus eight to ten six-second locked-off loops of the same dishes, so the grid and the Reels tab are fed from the same hour of work.',
      format: 'Stills-led half day: 30-40 finished stills plus 8-10 six-second locked-off loops from one lighting setup.',
      because: {
        ar: 'لأنه بنفس الشكل اللي أصلًا بيشتغل معهم.',
        en: 'Because it is the format already working for them.',
      },
      answers: ['ig-format', 'ig-engagement'],
      models: 1,
      needsVoice: false,
      cast: [
        { talentId: 'seed-omar', name: { ar: 'عمر', en: 'Omar' }, discipline: 'videographer', why: { ar: 'بيصوّر وبيركّب نفس الشغلة.', en: 'Shoots and cuts the same piece.' } },
        { talentId: 'seed-dana', name: { ar: 'دانا', en: 'Dana' }, discipline: 'model', why: { ar: 'بتشتغل أسبوعي، ونفس الوجه بيرجع.', en: 'Works weekly, so the same face returns.' } },
      ],
    },
    {
      conceptN: 6,
      crewNotes: ['editor'],
      shape: 'product',
      name: 'Five Dinars Gets You',
      tier: 'light',
      videos: 6,
      priceJOD: 900,
      hook: 'A 5 JD note slapped on the counter and pushed toward the lens, and a counter starting to tick.',
      premise: 'A fixed budget lands on the counter and the tray fills against a running total on screen, ending on what the note actually bought. Repeats at every price point the menu supports.',
      format: 'Reel 12-18s with an on-screen running counter. Endless series at different price points.',
      because: {
        ar: 'لأنه بيحطّ السعر على الشاشة، والسعر مش مكتوب عندهم بأي مكان.',
        en: 'Because it puts the price on screen, and no price appears anywhere they publish.',
      },
      answers: ['web-price', 'ig-format'],
      models: 1,
      needsVoice: false,
      cast: [
        { talentId: 'seed-zaid', name: { ar: 'زيد', en: 'Zaid' }, discipline: 'videographer', why: { ar: 'بيشتغل بلقطة وحدة ثابتة.', en: 'Works locked off, one setup.' } },
        { talentId: 'seed-hala', name: { ar: 'هلا', en: 'Hala' }, discipline: 'model', why: { ar: 'إيديها بتشتغل قدّام الكاميرا بدون تمثيل.', en: 'Her hands work on camera without performing.' } },
      ],
    },
    {
      conceptN: 9,
      crewNotes: ['editor'],
      shape: 'ugc',
      name: 'Status Thirty',
      tier: 'light',
      videos: 6,
      priceJOD: 900,
      hook: 'No hook, deliberately. A familiar face already talking to you as if you had asked — the pattern interrupt is that it does not behave like an ad.',
      premise: 'Six vertical cuts built for WhatsApp Status and the broadcast list rather than the feed, welded from footage already shot on the menu day, so they cost an editor and nothing else.',
      format: 'Vertical 20-30s built for WhatsApp Status and broadcast lists, not for the feed.',
      because: {
        ar: 'لأنه بيوصل الزبون على الواتساب، وهناك بيصير الطلب أصلًا.',
        en: 'Because it lands the buyer on WhatsApp, which is where the order already happens.',
      },
      answers: ['ig-ask'],
      models: 0,
      needsVoice: false,
      // Client-fronted: the owner is the face, so there is nobody to cast.
      cast: [],
    },
    {
      conceptN: 10,
      crewNotes: ['videographer', 'editor'],
      shape: 'talking-head',
      name: 'The Bad Review, Answered',
      tier: 'light',
      videos: 2,
      priceJOD: 300,
      hook: 'A real one-star complaint about the business held silent and legible on screen for three seconds, published by the business itself.',
      premise: 'The owner reads one real complaint aloud, answers it without defending, and says what changed. Shot on whatever talking-head setup is already standing.',
      format: 'Reel 25-40s, single take plus one insert.',
      because: {
        ar: 'لأنه بيطلب من المتفرّج إشي، وهاد بالضبط اللي ما بتعمله كابشناتهم.',
        en: 'Because it asks the viewer for something, which is exactly what their captions never do.',
      },
      answers: ['ig-ask', 'ig-engagement'],
      models: 0,
      needsVoice: false,
      cast: [],
    },
    {
      conceptN: 7,
      crewNotes: ['editor', 'producer'],
      shape: 'ugc',
      name: 'Phone Kit Friday',
      tier: 'light',
      videos: 6,
      priceJOD: 900,
      hook: 'Whatever the client’s own hands are doing, framed correctly for the first time in their life — the difference is legible in frame one because the tape does the directing.',
      premise: 'A kit ships to the shop, the marks go down once, and the staff shoot six clips a cycle on their own phone. The editor is the only person on the clock.',
      format: 'No crew day at all. PRAVDA ships a kit and directs over WhatsApp.',
      because: {
        ar: 'مناسب لقطاعهم، وبيطلع ٦ مقاطع من غير يوم تصوير أصلًا.',
        en: 'Fits their trade, and yields 6 pieces with no crew day at all.',
      },
      answers: [],
      models: 0,
      needsVoice: false,
      cast: [],
      // Shown on the shortlist and not chosen: there is no producer on the
      // roster to run the weekly WhatsApp review this depends on.
      uncastable: 'no producer on the roster',
    },
  ],

  chosen: [8, 6, 9],

  /**
   * The Arabic Khaled would have written for this client. The library is
   * English on purpose — it is source material for an operator — so an idea
   * reaches a recipient either in Arabic written for them, or in English
   * correctly isolated. Never machine-translated in between.
   */
  copy: {
    '8': {
      name: 'يوم المنيو',
      hook: 'صوت الصحن وهو بينحطّ على الطاولة بأول ثانية. بدون شعار، بدون وجه، بدون مقدمة — وصورة نفس الطبق بتكون أصلًا على البروفايل.',
    },
    '6': {
      name: 'بخمس دنانير',
      hook: 'ورقة خمس دنانير بتنحطّ على الكاونتر وبتنزحف للكاميرا، والعدّاد بيبلّش.',
    },
    '9': {
      name: 'ستوري الثلاثين',
      hook: 'بدون هوك، وبقصد. وجه بتعرفوه عم يحكي معكم كأنكم سألتوه — المفاجأة إنه ما بيتصرّف كإعلان.',
    },
  },

  offer: {
    videos: 6,
    pricePerVideo: 150,
    ads: true,
    adsMonthlyJOD: 400,
    totalJOD: 900,
  },

  status: 'approved',
  createdAt: '2026-09-04T07:30:00.000Z',
  updatedAt: '2026-09-04T09:10:00.000Z',
  approvedAt: '2026-09-04T09:10:00.000Z',
};
