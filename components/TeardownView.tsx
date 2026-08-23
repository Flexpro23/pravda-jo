import Page from '@/components/Page';
import Intake from '@/components/Intake';
import { Lang, tx } from '@/lib/i18n';

export default function TeardownView({ lang }: { lang: Lang }) {
  const rows = lang === 'ar'
    ? [['مية منشور', 'صيغها، توقيتها، وأداؤها'],
       ['التعليقات الظاهرة', 'الأسئلة المتكررة ونسبة الرد'],
       ['مكتبة الإعلانات', 'إعلاناتكم وإعلانات جيرانكم'],
       ['الملف الشخصي', 'البايو، الرابط، ومسار الطلب']]
    : [['A hundred posts', 'formats, timing, performance'],
       ['Visible comments', 'recurring questions and reply rate'],
       ['The Ad Library', 'your ads and your neighbours’'],
       ['The profile', 'bio, link, and the path to an order']];

  return (
    <Page lang={lang}>
      <section className="hero" style={{ paddingBlock: 'var(--s9) var(--s7)' }}>
        <div className="wrap">
          <span className="u eyebrow register">{tx('tdEyebrow', lang)}</span>
          <h1 className="d1 register-2" style={{ marginBottom: 'var(--s5)' }}>{tx('tdTitle', lang)}</h1>
          <p className="body register-3">{tx('tdBody', lang)}</p>
          <Intake lang={lang} />
        </div>
      </section>

      <section className="sec"><div className="wrap">
        <div style={{ display: 'grid', gap: 1, background: 'var(--rule)',
                      border: '1px solid var(--rule)' }}>
          {rows.map(([a, b]) => (
            <div key={a} style={{ background: 'var(--void)', padding: 'var(--s5)',
                                  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s4)' }}>
              <span className="d3">{a}</span>
              <span className="body" style={{ margin: 0 }}>{b}</span>
            </div>
          ))}
        </div>
      </div></section>
    </Page>
  );
}
