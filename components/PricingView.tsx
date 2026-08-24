import Link from 'next/link';
import Page from '@/components/Page';
import { RATES } from '@/lib/data/company';
import { Lang, path, tx } from '@/lib/i18n';

export default function PricingView({ lang }: { lang: Lang }) {
  const ar = lang === 'ar';
  return (
    <Page lang={lang}>
      <section className="wsec" style={{ paddingBlockStart: 'clamp(140px,20vh,240px)' }}>
        <div className="wrap wsec-head">
          <h1 className="mega"><span className="cut"><span className="d1">{ar ? 'الأسعار' : 'PRICING'}</span></span></h1>
          <p className="body fade d3">
            {ar
              ? 'مكتوبة هون، مش بالمكالمة. إذا حدا ما بيقلّك السعر إلا بعد اجتماع، السبب إنه السعر بيتغيّر حسب مين إنت.'
              : 'Published here, not quoted on a call. If someone will not tell you a price until after a meeting, it is because the price depends on who you are.'}
          </p>
        </div>

        <div className="wrap">
          <div className="rates">
            {RATES.map((r) => (
              <div key={r.key} className="rate riseIn">
                <p className="u">{r.label[lang]}</p>
                <p className="rate-v num">
                  {r.price === 0 ? (ar ? '٠' : '0') : r.price.toLocaleString('en-US')}
                  <span className="rate-u">{r.unit[lang]}</span>
                </p>
                <p className="body rate-note">{r.note[lang]}</p>
              </div>
            ))}
          </div>

          <div className="card-block riseIn" style={{ marginTop: 'var(--s8)' }}>
            <p className="u" style={{ marginBottom: 'var(--s4)' }}>{ar ? 'شو بيدخل بالسعر' : 'What the price includes'}</p>
            <ul className="plain">
              {(ar
                ? ['التصوير والتركيب — نفس الشخص بيعمل الاتنين.',
                   'الملفات النهائية بصيغ إنستغرام وتيك توك.',
                   'حقوق النشر العضوي على حساباتكم لمدة سنة.',
                   'الإعلانات المدفوعة إلها ترخيص منفصل — مكتوب بالعرض.']
                : ['Shoot and edit — the same person does both.',
                   'Final files in Instagram and TikTok formats.',
                   'Organic usage on your own accounts for twelve months.',
                   'Paid advertising is licensed separately, stated in the proposal.']
              ).map((t) => <li key={t}>{t}</li>)}
            </ul>
          </div>

          <div style={{ marginTop: 'var(--s8)' }}>
            <Link className="btn" href={path(lang, 'teardown')}>{tx('heroCta', lang)}</Link>
          </div>
        </div>
      </section>
    </Page>
  );
}
