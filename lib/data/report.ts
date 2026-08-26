/**
 * A teardown claims only what it can prove.
 *
 * Everything here is derivable from what the subject published, read through
 * Business Discovery, which needs no permission from them. That boundary is the
 * whole credibility of the artifact, so it is enforced in the schema rather
 * than left to whoever writes the copy.
 *
 * Deliberately absent: audience composition. It reads as the strongest section
 * in the report — who is actually talking to you, versus who follows you — and
 * it cannot be built. It needs comment text, and the comments edge is Standard
 * rather than Public, so it is unreachable for a business that has not
 * authorised us, at every access tier. `comments_count` is public; the comments
 * are not. A section that needs the words cannot be honest here.
 */
type B = { ar: string; en: string };

export type Vital = {
  fig: string; label: B; cmp: B; prov: B; low?: boolean;
};
export type Fix = { h: B; p: B };
export type Concept = {
  name: B; line: B; idea: B; cast: { name: B; role: B }[];
  price: number; assets: B; note: B;
};

export type Report = {
  token: string;
  client: B;
  sector: B;
  date: string;
  window: B;
  hero: { cap: B; head: B; body: B };
  verdict: B;
  vitals: Vital[];
  working: B[];
  pattern: { head: B; bars: { label: B; v: number; x: string; hi?: boolean }[]; tail: B };
  /**
   * Paid. The Ad Library API returns nothing for Jordan — non-EU ads surface
   * only if they are about social issues, elections or politics — so this can
   * never be engine-derived. A human reads the public web interface and fills
   * it, or the section does not run. Optional, so a report is whole without it.
   */
  ads?: { mine: string; theirs: string; mineLabel: B; theirsLabel: B; p: B };
  fixes: Fix[];
  concepts: Concept[];
  plan: { m: B; p: B }[];
  provenance: B[];
};

/** A specimen. Fictional business, illustrative figures — never a real report. */
export const SPECIMEN: Report = {
  token: 'sample',
  client: { ar: 'مطعم بيت الأخضر', en: 'Bayt Al-Akhdar' },
  sector: { ar: 'مطاعم', en: 'Restaurant' },
  date: '2026-08-23',
  window: { ar: '١٢ آذار — ٢١ آب ٢٠٢٦ · ١٠٠ منشور', en: '12 March — 21 August 2026 · 100 posts' },
  hero: {
    cap: { ar: '١٤ آذار · ريل · ٤١٢٠٠ مشاهدة', en: '14 March · Reel · 41,200 views' },
    head: {
      ar: 'إيدين الطبّاخ، أربعين ثانية، بدون موسيقى. وصل ٤٫٢ ضعف أي منشور تاني نشرتوه.',
      en: 'Your cook’s hands, forty seconds, no music. It out-reached everything else you posted by 4.2×.',
    },
    body: {
      ar: 'وما عدتوا عملتوا شي زيّه. خلال الخمس شهور اللي بعده، كل فيديو نشرتوه كان طبق جاهز على طاولة مع موسيقى. ولا واحد فيهم قرّب.',
      en: 'You have not made another one like it since. In the five months after that post, every video you published was a plated dish on a table with a music bed. None came close.',
    },
  },
  verdict: {
    ar: 'تصويركم للأكل ممتاز فعلًا. بس بتعملوا محتوى لناس أصلًا بتتابعكم، وتقريبًا ولا إشي بيوصل لحدا جديد.',
    en: 'Your food photography is genuinely good. But you are making content for people who already follow you, and almost none that reaches anyone new.',
  },
  vitals: [
    { fig: '1.1%', low: true,
      label: { ar: 'نسبة التفاعل', en: 'Engagement rate' },
      cmp: { ar: 'متوسط المطاعم في عمّان ضمن نفس شريحة المتابعين ٣٫٤٪. أنتم عند ثلث القطاع.', en: 'Amman restaurants in your follower band average 3.4%. You are at a third of your category.' },
      prov: { ar: 'محسوب · ١٠٠ منشور', en: 'Computed · 100 posts' } },
    { fig: '4.2',
      label: { ar: 'منشورات بالأسبوع', en: 'Posts per week' },
      cmp: { ar: 'الكمية مش مشكلتكم. بس ٧١٪ بتنزل بين ٢ و٤ العصر، أهدأ فترة عندكم.', en: 'Volume is not your problem. But 71% land between 2 and 4pm, your quietest window.' },
      prov: { ar: 'محسوب · التوقيتات', en: 'Computed · timestamps' } },
    { fig: '12%',
      label: { ar: 'من المنشورات ريلز', en: 'Of posts are Reels' },
      cmp: { ar: 'هالـ١٢٪ بتحمل ٦١٪ من وصولكم. الصيغة الأقل فعالية فيها ٨٨٪ من جهدكم.', en: 'Those 12% carry 61% of your reach. The format that works least is where 88% of your effort goes.' },
      prov: { ar: 'محسوب · ١٠٠ منشور', en: 'Computed · 100 posts' } },
    { fig: '0', low: true,
      label: { ar: 'إعلانات نشطة', en: 'Active ads' },
      cmp: { ar: 'تلات مطاعم على بعد كيلومتر شغّالين ١٩ إعلان بينهم هلّق.', en: 'Three restaurants within a kilometre are running 19 between them right now.' },
      prov: { ar: 'مكتبة الإعلانات · ٢٢ آب', en: 'Ad Library · read 22 Aug' } },
  ],
  working: [
    { ar: 'تصويركم ثابت — نفس الإضاءة، نفس الزاوية، نفس انضباط التقديم على مدى خمس شهور. هاي أندر مما بتتصوّروا.',
      en: 'Your photography is consistent — same light, same angle, same plating discipline across five months. That is rarer than you think.' },
    { ar: 'وبتردّوا على التعليقات بالعربي، بصوتكم، مش قوالب. والبايو بيقول بالضبط شو بتبيعوا ووين.',
      en: 'You reply to comments in Arabic, in your own voice, not templates. And your bio says exactly what you sell and where.' },
  ],
  pattern: {
    head: { ar: 'المنشورات اللي فيها شخص بأول لقطة بتتفوّق على صور الأكل بـ٣٫٤ أضعاف. و٧٨٪ من منشوراتكم صور أكل.',
            en: 'Posts with a person in the first frame outperform plated food by 3.4×. Seventy-eight percent of your posts are plated food.' },
    bars: [
      { label: { ar: 'في شخص', en: 'A person' }, v: 100, x: '3.4×', hi: true },
      { label: { ar: 'إيدين بس', en: 'Hands only' }, v: 71, x: '2.4×', hi: true },
      { label: { ar: 'طبق جاهز', en: 'Plated food' }, v: 29, x: '1.0×' },
    ],
    tail: { ar: 'هالإشي ما بينشاف إلا لما تتفرّج على مية منشور مع بعض. أي أسبوع لحاله بيبيّن تمام — وهاد ليش ولا حدا من جوّا الشغل بيلاقيه.',
            en: 'This is only visible across a hundred posts at once. Any single week looks fine — which is exactly why nobody inside a business ever finds it.' },
  },
  ads: {
    mine: '0', theirs: '19',
    mineLabel: { ar: 'إعلاناتكم النشطة', en: 'Your active ads' },
    theirsLabel: { ar: 'تلات جيران، مجتمعين', en: 'Three neighbours, combined' },
    p: { ar: 'التسعتعش كلهم ظاهرين لأي حدا على مكتبة الإعلانات العامة. اتنين من التلاتة شغّالين نفس تركيبة العرض — سعر غدا ثابت، صورة وحدة، بدون فيديو.',
         en: 'All nineteen are visible to anyone in Meta’s public Ad Library. Two of the three run the same offer structure — a set lunch price, a single image, no video.' },
  },
  fixes: [
    { h: { ar: 'غيّروا وقت النشر', en: 'Move your posting window' },
      p: { ar: 'بطّلوا تنشروا الساعة ٢. أقوى خمس منشورات عندكم كلهم نزلوا بعد الساعة ٧ مساءً.', en: 'Stop posting at 2pm. Your five strongest posts all went out after 7pm.' } },
    { h: { ar: 'حطّوا شخص بأول لقطة', en: 'Put a person in the first frame' },
      p: { ar: 'مش عارضة. الطبّاخ، الكاشير، الرجّال اللي صارله تسع سنين عندكم.', en: 'Not a model. Your cook, your cashier, the man who has worked there nine years.' } },
    { h: { ar: 'جاوبوا على سؤال السعر بالبايو', en: 'Answer the price question in your bio' },
      p: { ar: 'الغريب ما بيعرف قدّيش بتكلّف الوجبة. حطّوا نطاق سعري.', en: 'A stranger cannot tell what a meal costs. Put a range in the bio.' } },
    { h: { ar: 'فعّلوا زرّ واتساب', en: 'Turn on a WhatsApp button' },
      p: { ar: 'الرابط عندكم بيودّي على PDF بياخد إحدعش ثانية يفتح على الموبايل.', en: 'Your link goes to a menu PDF that takes eleven seconds to open on a phone.' } },
    { h: { ar: 'ردّوا خلال ساعة', en: 'Reply within the hour' },
      p: { ar: 'بتردّوا على تلث التعليقات، وعادةً باليوم اللي بعده. الساعة الأولى هي اللي بتقرّر الوصول.', en: 'You reply to about a third of comments, usually the next day. The first hour decides reach.' } },
  ],
  concepts: [
    { name: { ar: 'التحقيق: اتناشر سؤال', en: 'The Inbox Twelve' },
      line: { ar: 'منسحب تسعين يوم من رسائل الواتساب ومنطلّع الاتناشر سؤال اللي الزباين فعلًا بيكتبوهم. وبعدين منصوّر الأجوبة.',
              en: 'We export ninety days of your WhatsApp inbox and pull the twelve questions customers actually type. Then we film the answers.' },
      idea: { ar: 'إعداد واحد، ما بينتقل. صاحب المحل، من الصدر لفوق، بيجاوب سؤال حقيقي بكل مقطع. بدون سلام — منقصّ وهو بنص الجواب.',
              en: 'One setup, never moved. The owner, chest up, answering one real question per clip. No greeting — we cut in mid-answer.' },
      cast: [{ name: { ar: 'عمر', en: 'Omar' }, role: { ar: 'تصوير وتركيب', en: 'Shoot & edit' } }],
      price: 1500, assets: { ar: '١٠ مقاطع، نص يوم', en: '10 assets, half a day' },
      note: { ar: 'المقاطع اللي بتبلّش بالجواب بتضلّ تطلع لشهور بدل ما تموت بتلات أيام.', en: 'Answer-first clips keep surfacing for months instead of dying in three days.' } },
    { name: { ar: 'الأربعين فلس', en: 'The Forty Fils Number' },
      line: { ar: 'الطبّاخ، متصوّر على بُعد ذراع بغرفة التحضير اللي ما حدا بيصوّرها. قاعدة وحدة: ما بينزل مقطع إلا وفيه رقم بيقدر أي حدا يتأكد منه.',
              en: 'Your cook, filmed at arm’s length in the prep room nobody photographs. One rule: no take ships without a number anyone could check.' },
      idea: { ar: '«هاي بتكلّفنا أربعين فلس زيادة عالكاسة، وبضل نعملها.» الرقم اللي بيتأكّد منه بيقرا صح بوسط فيد كله صفات.',
              en: '“This costs us forty fils extra per cup, and we still do it.” A checkable claim reads as true in a feed made of adjectives.' },
      cast: [{ name: { ar: 'عمر', en: 'Omar' }, role: { ar: 'تصوير وتركيب', en: 'Shoot & edit' } }],
      price: 600, assets: { ar: '٤ مقاطع، زيارة وحدة', en: '4 assets, one visit' },
      note: { ar: 'أعلى قيمة بالساعة — بيستخدم حدا أصلًا موجود بالمحل.', en: 'Highest value per hour — it uses someone already on site.' } },
    { name: { ar: 'يوم المنيو', en: 'The Menu Day' },
      line: { ar: 'نص يوم تصوير بيبدّل كل الصور عندكم على الحساب وعلى تطبيقات التوصيل مرة وحدة.',
              en: 'A stills-led half day that replaces every photograph on your account and your delivery listings at once.' },
      idea: { ar: 'تلاتين لأربعين صورة نهائية زائد تمن لقطات ست ثواني ثابتة، من إعداد إضاءة واحد. وإيدين بتدخل الكادر بكل تالت لقطة.',
              en: 'Thirty to forty finished stills plus eight six-second locked-off loops from one lighting setup. Hands enter frame every third shot.' },
      cast: [{ name: { ar: 'رنا', en: 'Rana' }, role: { ar: 'تصوير', en: 'Photography' } },
             { name: { ar: 'عمر', en: 'Omar' }, role: { ar: 'تركيب', en: 'Edit' } }],
      price: 1200, assets: { ar: '٨ مقاطع + ٣٠ صورة', en: '8 assets + 30 stills' },
      note: { ar: 'وبيصلّح صور تطبيقات التوصيل، ومن هناك بتبلّش أغلب طلباتكم.', en: 'It fixes the delivery-app photos too, which is where most of your orders start.' } },
  ],
  plan: [
    { m: { ar: 'الشهر الأول', en: 'Month 1' },
      p: { ar: 'يوم المنيو والاتناشر سؤال، متصوّرين بنفس الأسبوع. ووقت النشر بينتقل للمسا. وما بنموّل ولا إشي — عم نثبّت خط أساس.',
           en: 'The Menu Day and the Inbox Twelve, shot in the same week. Posting moves to evenings. Nothing is boosted yet — we are establishing a baseline.' } },
    { m: { ar: 'الشهر الثاني', en: 'Month 2' },
      p: { ar: 'بيبلّش المدفوع — من ٤٠٠ دينار بالشهر. منشغّل أقوى قطعتين عضويًا كإعلانات قبل ما نعمل إشي جديد، لأنّ الجمهور أصلًا صوّت.',
           en: 'Paid begins — from 400 JOD a month. We run the two strongest organic pieces as ads before making anything new, because the audience already voted.' } },
    { m: { ar: 'الشهر الثالث', en: 'Month 3' },
      p: { ar: 'تصوير الأربعين فلس، مبني على الأسئلة اللي جابت ردود. ولهون منكون عارفين كلفة الطلب عندكم.',
           en: 'The Forty Fils shoot, informed by which questions actually drove replies. By here we know your cost per order.' } },
  ],
  provenance: [
    { ar: 'المصدر: حسابكم المهني العام على إنستغرام — ١٠٠ منشور، من ١٢ آذار إلى ٢١ آب ٢٠٢٦. ومكتبة الإعلانات العامة من ميتا، بتاريخ ٢٢ آب ٢٠٢٦.',
      en: 'Source: your public Instagram Professional account — 100 posts, 12 March to 21 August 2026. Meta’s public Ad Library, read 22 August 2026.' },
    { ar: 'ما في ولا رقم تقديري. كل الأرقام محسوبة من بيانات منشورة قبل ما تنكتب هالصفحة. ما قرينا رسائلكم ولا إحصاءاتكم — وما فينا.',
      en: 'Nothing here is estimated. Every figure was computed from published data before this page was written. We did not read your messages or your insights — we cannot.' },
    { ar: 'ملاحظة: عدّاد المشاهدات عند إنستغرام بيشمل المدفوع والعضوي مع بعض. إذا موّلتوا أي منشور، رقم وصوله مش عضوي بالكامل.',
      en: 'One caveat: Instagram’s view counts include both paid and organic views. If you have boosted a post, its reach figure is not purely organic.' },
  ],
};
