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
  {
    slug: 'mirage-detailing',
    client: { ar: 'ميراج للعناية بالسيارات', en: 'Mirage Detailing' },
    sector: { ar: 'سيارات', en: 'Automotive' },
    idea: { ar: 'قبل وبعد، بدون موسيقى', en: 'Before and after, no music' },
    concept: {
      ar: 'كاميرا واحدة مثبّتة، وسيارة بتدخل وسخة وبتطلع نضيفة. ما في مونتاج سريع ولا أغنية — صوت الشغل بس. اللي بيتفرّج بيشوف الوقت الحقيقي اللي بياخده الشغل، وهاد اللي بيبرّر السعر.',
      en: 'One locked-off camera, a car in dirty and out clean. No fast cuts and no track — just the sound of the work. The viewer sees how long it actually takes, and that is what justifies the price.',
    },
    result: { ar: 'ثمن مقاطع، وأول مرة بيتحكى السعر بدون جدال', en: 'Eight clips, and the first month nobody argued about price' },
    metric: '8', metricLabel: { ar: 'مقاطع من يومين', en: 'clips from two days' },
    cast: [{ name: { ar: 'عمر', en: 'Omar' }, role: { ar: 'تصوير وتركيب', en: 'Shoot & edit' } }],
    price: 1200, assets: 8, date: '2026-07', hue: '#1B2C24',
    placeholder: true,
  },
  {
    slug: 'noor-clinic',
    client: { ar: 'عيادة نور للجلدية', en: 'Noor Skin Clinic' },
    sector: { ar: 'عناية', en: 'Body & skin' },
    idea: { ar: 'الأسئلة اللي بتنسأل بالعيادة', en: 'The questions asked in the room' },
    concept: {
      ar: 'الدكتورة بتجاوب على الأسئلة اللي بتتكرّر كل يوم بالعيادة، وحدة بالمقطع. ما في ولا صورة نتيجة، وما في ولا وعد — قاعدة كتبناها قبل ما نصوّر، ومشينا عليها.',
      en: 'The doctor answers the questions that repeat in the room every day, one per clip. Not a single result photograph and not one promise — a rule written before the shoot and kept to.',
    },
    result: { ar: 'اتناشر مقطع، ونص المواعيد صارت تجي من الحساب', en: 'Twelve clips, and half of new bookings started naming one' },
    metric: '12', metricLabel: { ar: 'سؤال متكرّر، متجاوب', en: 'repeat questions, answered' },
    cast: [
      { name: { ar: 'رنا', en: 'Rana' }, role: { ar: 'تصوير', en: 'Camera' } },
      { name: { ar: 'سيرين', en: 'Sireen' }, role: { ar: 'تعليق صوتي', en: 'Voiceover' } },
    ],
    price: 1800, assets: 12, date: '2026-07', hue: '#23342B',
    placeholder: true,
  },
  {
    slug: 'wadi-properties',
    client: { ar: 'وادي العقارية', en: 'Wadi Properties' },
    sector: { ar: 'عقارات', en: 'Property' },
    idea: { ar: 'المشوار من الباب', en: 'The walk from the door' },
    concept: {
      ar: 'ما في لقطات درون وما في زوايا واسعة بتكذب. بنمشي بالشقة زي ما بيمشي فيها اللي بيسكنها — من الباب لآخر غرفة، لقطة وحدة. اللي ما بيعجبه بيعرف من أول عشر ثواني، وهاد بيوفّر معاينات ما إلها لزوم.',
      en: 'No drone and no wide angle that lies. We walk the flat the way somebody living in it would — from the door to the last room, one take. Anyone it does not suit knows in ten seconds, which saves the viewings that go nowhere.',
    },
    result: { ar: 'ستة عقارات، ومعاينات أقل بس أجدى', en: 'Six properties, fewer viewings and better ones' },
    metric: '6', metricLabel: { ar: 'عقارات بيوم واحد', en: 'properties in one day' },
    cast: [{ name: { ar: 'رنا', en: 'Rana' }, role: { ar: 'تصوير', en: 'Camera' } }],
    price: 900, assets: 6, date: '2026-06', hue: '#1F2E26',
    placeholder: true,
  },
  {
    slug: 'sahn-wa-nus',
    client: { ar: 'صحن ونص', en: 'Sahn w Nus' },
    sector: { ar: 'مطاعم', en: 'Restaurant' },
    idea: { ar: 'الطبق اللي بينباع لحاله', en: 'The dish that sells itself' },
    concept: {
      ar: 'اخترنا الطبق الوحيد اللي بيرجّع الزبون، وصوّرناه ستة أشكال — عم بينعمل، عم بينحط، عم بينتاكل، والصحن الفاضي. نفس الطبق، ستة مقاطع، ويوم تصوير واحد.',
      en: 'We picked the one dish that brings people back and shot it six ways — being made, being put down, being eaten, and the empty plate. Same dish, six clips, one shoot day.',
    },
    result: { ar: 'الطبق صار ثلث الطلبات', en: 'That dish became a third of orders' },
    metric: '33%', metricLabel: { ar: 'من الطلبات، طبق واحد', en: 'of orders, one dish' },
    cast: [
      { name: { ar: 'عمر', en: 'Omar' }, role: { ar: 'تصوير وتركيب', en: 'Shoot & edit' } },
      { name: { ar: 'هلا', en: 'Hala' }, role: { ar: 'أمام الكاميرا', en: 'On camera' } },
    ],
    price: 900, assets: 6, date: '2026-05', hue: '#26362B',
    placeholder: true,
  },
  {
    slug: 'qalam-legal',
    client: { ar: 'قلم للاستشارات', en: 'Qalam Legal' },
    sector: { ar: 'خدمات مهنية', en: 'Professional services' },
    idea: { ar: 'الشغلة اللي بتوقّع الناس', en: 'The thing that catches people out' },
    concept: {
      ar: 'المحامي بيشرح خطأ واحد بيشوفه كل أسبوع، وشو بيكلّف اللي بيعمله. بدون مصطلحات، وبدون ما يبيع إشي — والمقطع بينتهي بجملة مش «تواصلوا معنا».',
      en: 'The lawyer explains one mistake he sees every week and what it costs the person who makes it. No jargon, nothing sold — and the clip ends on a sentence that is not “get in touch”.',
    },
    result: { ar: 'عشر مقاطع، وأسئلة أجدّ بالرسائل', en: 'Ten clips, and better questions in the inbox' },
    metric: '10', metricLabel: { ar: 'مقاطع من يوم ونص', en: 'clips from a day and a half' },
    cast: [{ name: { ar: 'زيد', en: 'Zaid' }, role: { ar: 'تصوير وتركيب', en: 'Shoot & edit' } }],
    price: 1500, assets: 10, date: '2026-04', hue: '#1D2B23',
    placeholder: true,
  },
];


export const byslug = (s: string) => WORK.find((w) => w.slug === s);
