export type Piece = {
  slug: string;
  client: { ar: string; en: string };
  sector: { ar: string; en: string };
  idea: { ar: string; en: string };
  concept: { ar: string; en: string };
  result: { ar: string; en: string };
  metric: string;
  metricLabel: { ar: string; en: string };
  cast: { name: { ar: string; en: string }; role: { ar: string; en: string } }[];
  price: number;
  assets: number;
  date: string;
  hue: string;
  /**
   * Invented, and shown as though it were not. True for everything shipped
   * before there was real work to show. The archive's copy keys off this, so
   * the claim disappears with the record rather than needing to be remembered.
   */
  placeholder?: boolean;
};

export const WORK: Piece[] = [
  {
    slug: 'bayt-al-akhdar',
    client: { ar: 'بيت الأخضر', en: 'Bayt Al-Akhdar' },
    sector: { ar: 'مطاعم', en: 'Restaurant' },
    idea: { ar: 'اتناشر سؤال من الواتساب', en: 'Twelve questions from the inbox' },
    concept: {
      ar: 'سحبنا تسعين يوم من رسائل الواتساب وطلّعنا الاتناشر سؤال اللي الزباين فعلًا بيكتبوهم. وصاحب المحل جاوب عليهم كلهم بنص يوم، بإعداد واحد ما انتقل.',
      en: 'We exported ninety days of WhatsApp messages and pulled the twelve questions customers actually type. The owner answered all of them in half a day, on one setup that never moved.',
    },
    result: { ar: 'عشر مقاطع ضلّت تطلع بالبحث لشهور', en: 'Ten clips that kept surfacing for months' },
    metric: '4.2×', metricLabel: { ar: 'وصول مقارنة بالمعدل', en: 'reach vs their average' },
    cast: [{ name: { ar: 'عمر', en: 'Omar' }, role: { ar: 'تصوير وتركيب', en: 'Shoot & edit' } }],
    price: 1500, assets: 10, date: '2026-06', hue: '#22332A',
    placeholder: true,
  },
  {
    slug: 'nadi-sittin',
    client: { ar: 'نادي ستّين', en: 'Nadi Sitteen' },
    sector: { ar: 'لياقة', en: 'Fitness' },
    idea: { ar: 'الدقيقة المجانية', en: 'The free minute' },
    concept: {
      ar: 'بدل إعلان، درس. المدرّب بيعطي تمرين كامل بستين ثانية، لقطة وحدة، بدون قص. اللي بيتفرّج بيتعلّم إشي حتى لو ما إجا.',
      en: 'A lesson instead of an advert. The trainer gives one complete exercise in sixty seconds, single take, no cuts. A viewer learns something even if they never walk in.',
    },
    result: { ar: 'ستة دروس، وسبعة اشتراكات بالشهر الأول', en: 'Six lessons, seven memberships in month one' },
    metric: '7', metricLabel: { ar: 'اشتراك بالشهر الأول', en: 'sign-ups, month one' },
    cast: [
      { name: { ar: 'رنا', en: 'Rana' }, role: { ar: 'تصوير', en: 'Camera' } },
      { name: { ar: 'ليث', en: 'Laith' }, role: { ar: 'أمام الكاميرا', en: 'On camera' } },
    ],
    price: 900, assets: 6, date: '2026-05', hue: '#1A2A20',
    placeholder: true,
  },
  {
    slug: 'zeitouna-optics',
    client: { ar: 'بصريات الزيتونة', en: 'Zeitouna Optics' },
    sector: { ar: 'تجزئة', en: 'Retail' },
    idea: { ar: 'قصّة الستارة', en: 'Curtain cut' },
    concept: {
      ar: 'كل خميس، وصلة جديدة بتتعلّق. منصوّر لحظة التعليق بس — تسعين دقيقة، مقطع واحد، وخمس صور. طقس أسبوعي بيتحوّل لعادة عند المتابع.',
      en: 'Every Thursday a new arrival goes up. We film only the moment it is hung — ninety minutes, one clip, five stills. A weekly ritual that becomes a habit for the follower.',
    },
    result: { ar: 'خمسة وعشرين أسبوع بدون ما ينكسر', en: 'Twenty-five weeks unbroken' },
    metric: '25', metricLabel: { ar: 'أسبوع متواصل', en: 'consecutive weeks' },
    cast: [
      { name: { ar: 'دانا', en: 'Dana' }, role: { ar: 'أمام الكاميرا', en: 'On camera' } },
      { name: { ar: 'عمر', en: 'Omar' }, role: { ar: 'تصوير وتركيب', en: 'Shoot & edit' } },
    ],
    price: 600, assets: 11, date: '2026-04', hue: '#283B2E',
    placeholder: true,
  },
  {
    slug: 'dar-hikma',
    client: { ar: 'دار الحكمة', en: 'Dar Hikma' },
    sector: { ar: 'تعليم', en: 'Education' },
    idea: { ar: 'الأربعين فلس', en: 'The forty fils number' },
    concept: {
      ar: 'المؤسِّس على بُعد ذراع، بالمكتب اللي ما حدا بيصوّره. قاعدة وحدة: ما بينزل مقطع إلا وفيه رقم محدّد بيقدر أي حدا يتأكد منه.',
      en: 'The founder at arm’s length, in the back office nobody photographs. One rule: no take ships without a specific, checkable number he volunteers.',
    },
    result: { ar: 'أربع مقاطع، وأعلى نسبة ردود عندهم لحد الآن', en: 'Four clips, their highest reply rate to date' },
    metric: '31%', metricLabel: { ar: 'نسبة الردود', en: 'reply rate' },
    cast: [{ name: { ar: 'عمر', en: 'Omar' }, role: { ar: 'تصوير وتركيب', en: 'Shoot & edit' } }],
    price: 600, assets: 4, date: '2026-03', hue: '#1E3025',
    placeholder: true,
  },
];

export const byslug = (s: string) => WORK.find((w) => w.slug === s);
