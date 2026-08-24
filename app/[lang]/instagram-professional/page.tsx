import Link from 'next/link';
import Prose, { S } from '@/components/Prose';
import { Lang, path, tx } from '@/lib/i18n';

export async function generateMetadata({ params }: { params: Promise<{ lang: Lang }> }) {
  const { lang } = await params;
  return { title: lang === 'ar' ? 'حوّل حسابك لمهني' : 'Switch to a Professional account' };
}

export default async function P({ params }: { params: Promise<{ lang: Lang }> }) {
  const { lang } = await params;
  const ar = lang === 'ar';
  const steps = ar
    ? [['افتح إنستغرام وروح على صفحتك', 'اضغط على صورتك تحت على اليمين.'],
       ['الإعدادات', 'التلات خطوط فوق، بعدين «الإعدادات والخصوصية».'],
       ['نوع الحساب والأدوات', 'انزل لـ«نوع الحساب والأدوات»، بعدين «التبديل إلى حساب احترافي».'],
       ['اختر التصنيف', 'اختر اللي بيوصف شغلك — مطعم، صالون، متجر. وبعدها «شركة».']]
    : [['Open Instagram and go to your profile', 'Tap your picture, bottom right.'],
       ['Settings', 'The three lines top right, then Settings and privacy.'],
       ['Account type and tools', 'Scroll to Account type and tools, then Switch to professional account.'],
       ['Pick a category', 'Choose what describes your business — restaurant, salon, shop. Then Business.']];

  return (
    <Prose
      lang={lang}
      kicker={ar ? 'ثلاثين ثانية' : 'Thirty seconds'}
      title={ar ? 'حوّل حسابك لمهني' : 'Switch to a Professional account'}
      lede={ar
        ? 'حسابك مضبوط كـ«شخصي»، وهيك البيانات العلنية اللي بيحتاجها التحقيق مش موجودة. التحويل مجاني، وبياخد نص دقيقة، ومفيد إلك حتى لو ما حكيتنا أبدًا.'
        : 'Your account is set to personal, so the public data a teardown needs is not there. Switching is free, takes half a minute, and is useful to you whether or not you ever talk to us.'}
    >
      <S title={ar ? 'الخطوات' : 'The steps'}>
        <ol className="steps">
          {steps.map(([t, d], i) => (
            <li key={t}>
              <span className="step-n num">{String(i + 1).padStart(2, '0')}</span>
              <span>
                <span className="mid step-t">{t}</span>
                <span className="body">{d}</span>
              </span>
            </li>
          ))}
        </ol>
      </S>

      <S title={ar ? 'شو بيتغيّر' : 'What changes'}>
        <p className="body">
          {ar
            ? 'بتشوف إحصاءات حسابك، وبتقدر تضيف زرّ تواصل ورقم واتساب، وبتقدر تموّل منشوراتك. ما بيصير حسابك عام إذا كان خاص، وما حدا بيشوف إشي جديد عنك.'
            : 'You get your own insights, a contact button and a WhatsApp number, and the ability to promote posts. It does not make a private account public, and nobody sees anything new about you.'}
        </p>
      </S>

      <S title={ar ? 'خلّصت؟' : 'Done?'}>
        <p className="body">
          {ar ? 'ارجع وابعتلنا الحساب مرّة تانية.' : 'Come back and send us the handle again.'}
        </p>
        <Link className="btn" href={path(lang, 'teardown')} style={{ marginTop: 'var(--s4)' }}>
          {tx('heroCta', lang)}
        </Link>
      </S>
    </Prose>
  );
}
