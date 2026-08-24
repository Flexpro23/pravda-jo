import Prose, { S } from '@/components/Prose';
import { CO } from '@/lib/data/company';
import type { Lang } from '@/lib/i18n';

export async function generateMetadata({ params }: { params: Promise<{ lang: Lang }> }) {
  const { lang } = await params;
  return { title: lang === 'ar' ? 'بياناتك' : 'Your data' };
}

export default async function P({ params }: { params: Promise<{ lang: Lang }> }) {
  const { lang } = await params;
  const ar = lang === 'ar';
  const rights = ar
    ? [['شوف كل إشي عنّي', 'منبعتلك كل اللي عنّا خلال ٧ أيام.'],
       ['صحّح إشي غلط', 'منعدّله فورًا ومنبعتلك النسخة المصحّحة.'],
       ['احذف كل إشي', 'منحذف التحقيق ومصادره وكل بياناتك — نهائيًا، بدون سؤال.'],
       ['اسحب موافقتك', 'بتوقف المعالجة فورًا. ما بيأثّر على أي إشي بيننا.'],
       ['اعترض على التنميط', 'منوقف الحساب والترتيب لحسابك تحديدًا.'],
       ['خُد نسخة', 'ملف JSON فيه كل اللي عنّا، جاهز تاخده لحدا تاني.']]
    : [['Show me everything', 'We send you everything we hold within 7 days.'],
       ['Correct something wrong', 'We fix it immediately and send you the corrected version.'],
       ['Delete everything', 'We erase the teardown, its sources and all your data — permanently, no questions.'],
       ['Withdraw consent', 'Processing stops at once. It changes nothing else between us.'],
       ['Object to profiling', 'We stop scoring and ranking your account specifically.'],
       ['Take a copy', 'A JSON file of everything we hold, ready to hand to someone else.']];

  return (
    <Prose
      lang={lang}
      kicker={ar ? 'حقوقك' : 'Your rights'}
      title={ar ? 'بياناتك' : 'Your data'}
      lede={ar
        ? 'ستّة أشياء بتقدر تطلبها، وكلها مجانية. اكتب لنا وبنعملها — ما في نموذج، وما في «تحدّث إلى فريق المبيعات».'
        : 'Six things you can ask for, all free. Write to us and we do them — no form, no “speak to our team”.'}
    >
      <S title={ar ? 'الطلبات' : 'The requests'}>
        <dl className="facts facts-wide">
          {rights.map(([a, b]) => (
            <div key={a} className="fact-row">
              <dt className="mid fact-t">{a}</dt>
              <dd className="body">{b}</dd>
            </div>
          ))}
        </dl>
      </S>

      <S title={ar ? 'كيف تطلب' : 'How to ask'}>
        <p className="body">
          {ar
            ? 'ابعت رسالة على واتساب أو إيميل. اكتب اسم حسابك على إنستغرام وشو بدك. ما بنطلب إثبات هوية إلا إذا الطلب بيكشف بيانات — وقتها منتأكد إنّ الرقم هو نفسه اللي تواصلنا معه.'
            : 'Message us on WhatsApp or email. Include your Instagram handle and what you want. We ask for no identity proof unless the request would disclose data — then we confirm the number matches the one we contacted.'}
        </p>
        <p className="body">
          <a className="tel ltr" href={`mailto:${CO.privacyEmail}`}>{CO.privacyEmail}</a>
          {'  ·  '}
          <a className="tel ltr" href={`tel:${CO.phone}`}>{CO.phoneDisplay}</a>
        </p>
      </S>

      <S title={ar ? 'إذا ما رضينا' : 'If we refuse'}>
        <p className="body">
          {ar
            ? 'إذا رفضنا طلبك، منكتبلك السبب. وبتقدر تشتكي على وحدة حماية البيانات الشخصية في وزارة الاقتصاد الرقمي والريادة.'
            : 'If we refuse, we tell you why in writing. You can complain to the Personal Data Protection Unit at the Ministry of Digital Economy and Entrepreneurship.'}
        </p>
      </S>
    </Prose>
  );
}
