import Page from '@/components/Page';
import Intake from '@/components/Intake';
import { Ribbon } from '@/components/webgl/Horizon';
import { Lang, tx } from '@/lib/i18n';

export default function TeardownView({ lang }: { lang: Lang }) {
  const ar = lang === 'ar';
  const rows = ar
    ? [['مية منشور', 'صيغها، توقيتها، وأداؤها'],
       ['التعليقات الظاهرة', 'الأسئلة المتكررة ونسبة الرد'],
       ['مكتبة الإعلانات', 'إعلاناتكم وإعلانات جيرانكم'],
       ['الملف الشخصي', 'البايو، الرابط، ومسار الطلب']]
    : [['A hundred posts', 'formats, timing, performance'],
       ['Visible comments', 'recurring questions, reply rate'],
       ['The Ad Library', 'your ads and your neighbours’'],
       ['The profile', 'bio, link, path to an order']];

  return (
    <Page lang={lang}>
      <section className="hero" style={{ minHeight: '86svh' }}>
        <Ribbon className="hero-canvas" />
        <div className="wrap hero-in">
          <span className="u hero-kick fade">{tx('tdEyebrow', lang)}</span>
          <h1 className="mega hero-mega">
            <span className="cut"><span className="d1">{ar ? 'التحقيق' : 'THE'}</span></span>
            <span className="cut l3"><span className="d2">{ar ? 'مجانًا' : 'TEARDOWN'}</span></span>
          </h1>
          <p className="body fade d4">{tx('tdBody', lang)}</p>
          <Intake lang={lang} />
        </div>
      </section>

      <section className="wsec"><div className="wrap">
        {rows.map(([a, b], i) => (
          <div key={a} className="row riseIn" style={{ gridTemplateColumns: '1fr 1fr',
            paddingBlock: 'clamp(28px,4vw,64px)', alignItems: 'baseline' }}>
            <p className="mid">{a}</p>
            <p className="body" style={{ margin: 0 }}>{b}</p>
          </div>
        ))}
      </div></section>
    </Page>
  );
}
