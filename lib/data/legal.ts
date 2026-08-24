import { CO } from './company';
import type { Lang } from '@/lib/i18n';

export const UPDATED = '2026-08-23';
type B = { ar: string; en: string };
export type Block = { h: B; p: B[] };

/** PDPL Article 9 requires six disclosures in writing BEFORE processing begins. */
export const NOTICE: Block[] = [
  {
    h: { ar: '١. البيانات وتاريخ بدء المعالجة', en: '1. The data, and when processing starts' },
    p: [{
      ar: 'منعالج اسم الحساب على إنستغرام، وآخر ١٠٠ منشور علني (النص، التوقيت، الصيغة، وعدّادات التفاعل الظاهرة)، والملف العلني للصفحة، والإعلانات النشطة الظاهرة في مكتبة إعلانات ميتا العامة. وإذا بعتّونا اسمكم ورقمكم، منعالجهم كمان. بتبدأ المعالجة لحظة ما تضغطوا «ابعتوا الحساب»، أو لحظة ما نبعتلكم رسالة إذا إحنا اللي بدأنا.',
      en: 'We process the Instagram handle, the last 100 public posts (caption, timestamp, format and the visible engagement counters), the public profile, and any active ads visible in Meta’s public Ad Library. If you send us your name and number, we process those too. Processing begins the moment you submit the handle, or the moment we message you if we made contact first.',
    }],
  },
  {
    h: { ar: '٢. الغرض', en: '2. The purpose' },
    p: [{
      ar: 'غرض واحد: إنتاج تحقيق عن أداء حسابكم، واقتراح ثلاث أفكار إنتاجية بأسعارها. ما منستعمل البيانات لأي غرض تاني، وما منبيعها، وما منشاركها مع طرف تالت غير مزوّدي الخدمة المذكورين تحت.',
      en: 'One purpose: to produce a teardown of your account’s performance and propose three priced production ideas. We do not use the data for anything else, we do not sell it, and we do not share it with third parties beyond the processors named below.',
    }],
  },
  {
    h: { ar: '٣. مدة الاحتفاظ', en: '3. How long we keep it' },
    p: [{
      ar: 'التحقيق ومصادره: ١٨٠ يوم من تاريخ الإرسال، وبعدها بينحذف. الاسم والرقم: لحد ما تطلبوا حذفهم، أو ٢٤ شهر من آخر تواصل — أيّهم أقرب. سجلّ الدفعات بينحفظ للمدة اللي بيفرضها قانون الضريبة.',
      en: 'The teardown and its sources: 180 days from sending, then deleted. Your name and number: until you ask us to delete them, or 24 months after our last contact — whichever comes first. Payment records are kept for the period tax law requires.',
    }],
  },
  {
    h: { ar: '٤. مَن بيعالج البيانات', en: '4. Who processes the data' },
    p: [{
      ar: `برافدا (${CO.legalName.ar}) هي المتحكّم. ومزوّدو الخدمة: Meta Platforms (الولايات المتحدة) لقراءة البيانات العلنية وإرسال رسائل واتساب، Vercel (الولايات المتحدة) للاستضافة، ومزوّد نماذج لغوية (الولايات المتحدة) لصياغة نص التحقيق. كل هدول خارج الأردن، ومنقل البيانات إلهم لهالغرض بس.`,
      en: `PRAVDA (${CO.legalName.en}) is the controller. Our processors: Meta Platforms (United States) to read public data and deliver WhatsApp messages, Vercel (United States) for hosting, and a language-model provider (United States) to draft the teardown’s prose. All sit outside Jordan, and data is transferred to them for this purpose only.`,
    }],
  },
  {
    h: { ar: '٥. إجراءات الحماية', en: '5. Security measures' },
    p: [{
      ar: 'كل الاتصالات مشفّرة (TLS). روابط التحقيق برموز غير قابلة للتخمين وما بتتفهرس على محرّكات البحث. الوصول للبيانات محصور بعلي وخالد، وكل قراءة مسجّلة. ما منخزّن كلمات سر، وما منطلب وصول لحساباتكم أبدًا.',
      en: 'All transport is encrypted (TLS). Teardown links carry unguessable tokens and are not indexed by search engines. Access is limited to Ali and Khaled, and every read is logged. We store no passwords and never request access to your accounts.',
    }],
  },
  {
    h: { ar: '٦. التنميط', en: '6. Profiling' },
    p: [{
      ar: 'منحسب مؤشرات من منشوراتكم — نسبة التفاعل، توزيع الصيغ، أوقات النشر، وتركّز المعلّقين — ومنقارنها بمتوسط قطاعكم. وبنرتّب العملاء المحتملين حسب ردّهم علينا. ما منقيس سلوككم على الصفحة إلا إذا وافقتوا صراحةً، والقياس مطفي افتراضيًا.',
      en: 'We compute measures from your posts — engagement rate, format mix, posting times, commenter concentration — and compare them to your category’s median. We also rank prospects by whether they reply to us. We do not measure your behaviour on the page unless you explicitly opt in, and that measurement is off by default.',
    }],
  },
];

export const PRIVACY: Block[] = [
  {
    h: { ar: 'شو منجمع', en: 'What we collect' },
    p: [{
      ar: 'بيانات علنية عن منشأتكم، والاسم والرقم إذا بعتّوهم. ما منجمع أي إشي خاص: ما منقرأ رسائلكم، ولا إحصاءات حسابكم، ولا أي إشي بيتطلّب تسجيل دخول. وما فينا نقراهم أصلًا.',
      en: 'Public data about your business, plus your name and number if you send them. We collect nothing private: not your messages, not your account insights, nothing behind a login. We could not read them if we wanted to.',
    }],
  },
  {
    h: { ar: 'حقوقكم', en: 'Your rights' },
    p: [{
      ar: 'بموجب قانون حماية البيانات الشخصية الأردني رقم ٢٤ لسنة ٢٠٢٣: الاطّلاع على بياناتكم، تصحيحها، حذفها، سحب الموافقة، تقييد المعالجة، الاعتراض على التنميط، ونقل نسخة. ممارسة أي حق منها ما بترتّب عليكم أي كلفة ولا بتأثّر على تعاملنا معكم إطلاقًا.',
      en: 'Under Jordan’s Personal Data Protection Law No. 24 of 2023: access, correction, erasure, withdrawal of consent, restriction of processing, objection to profiling, and portability. Exercising any of them costs you nothing and changes nothing about how we deal with you.',
    }],
  },
  {
    h: { ar: 'الكوكيز والقياس', en: 'Cookies and measurement' },
    p: [{
      ar: 'ما في كوكيز تتبّع على هالموقع. ما في تحليلات طرف تالت. قياس سلوك القراءة على صفحة التحقيق مطفي افتراضيًا وبيشتغل بموافقة صريحة بس.',
      en: 'There are no tracking cookies on this site and no third-party analytics. Reading-behaviour measurement on a teardown page is off by default and runs only on explicit opt-in.',
    }],
  },
];

export const TERMS: Block[] = [
  {
    h: { ar: 'التحقيق', en: 'The teardown' },
    p: [{
      ar: 'مجاني وبدون التزام. الأرقام فيه محسوبة من بيانات علنية بتاريخ محدّد ومكتوب على الصفحة — وممكن تتغيّر بعدها. الأفكار المقترحة إلكم تستعملوها أو لأ، بس تنفيذها من غيرنا مسؤوليتكم.',
      en: 'Free and without obligation. Its figures are computed from public data on a stated date and may change after it. The proposed ideas are yours to use or not; executing them without us is your own affair.',
    }],
  },
  {
    h: { ar: 'الإنتاج', en: 'Production' },
    p: [{
      ar: 'الأسعار منشورة. أي شغل بيبدأ بعد تأكيد خطّي وعربون. مواعيد التصوير بتتثبّت بعد تأكيد الطاقم. الإلغاء قبل ٤٨ ساعة مجاني؛ الإلغاء خلال ٢٤ ساعة بيترتّب عليه أجر الطاقم كامل، لأنّ الطاقم بيكون حجز اليوم.',
      en: 'Prices are published. Work begins after written confirmation and a deposit. Shoot dates are fixed once the crew confirms. Cancelling more than 48 hours ahead is free; cancelling within 24 hours carries the full crew fee, because the crew has already held the day.',
    }],
  },
  {
    h: { ar: 'الملكية والاستخدام', en: 'Ownership and usage' },
    p: [{
      ar: 'الملفات النهائية إلكم عند اكتمال الدفع. النشر العضوي على حساباتكم لمدة ١٢ شهر داخل بالسعر. الاستخدام بالإعلانات المدفوعة، أو خارج الأردن، أو على لوحات الطرق، إله ترخيص وسعر منفصل مكتوب بالعرض.',
      en: 'Final files are yours on full payment. Organic use on your own accounts for 12 months is included. Paid advertising, use outside Jordan, and out-of-home placement are licensed and priced separately, stated in the proposal.',
    }],
  },
  {
    h: { ar: 'حدود المسؤولية', en: 'Limits' },
    p: [{
      ar: 'ما منضمن نتيجة إعلانية محدّدة. منضمن التنفيذ حسب المتّفق عليه، والتسليم بالمواعيد، وإنّ كل رقم منعطيكم إيّاه محسوب مش مقدّر. القانون المطبّق هو القانون الأردني.',
      en: 'We do not guarantee a specific advertising outcome. We do guarantee execution as agreed, delivery on the dates given, and that every figure we hand you is computed rather than estimated. Jordanian law applies.',
    }],
  },
];
