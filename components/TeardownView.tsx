import Link from 'next/link';
import Page from '@/components/Page';
import Intake from '@/components/Intake';
import { Ribbon } from '@/components/webgl/Horizon';
import { Lang, path, tx, fwd } from '@/lib/i18n';

export default function TeardownView({ lang }: { lang: Lang }) {
  const ar = lang === 'ar';
  const rows = ar
    ? [['مية منشور', 'صيغها، توقيتها، وأداؤها'],
       ['الكابشنات', 'شو بتحكوا، وكل قدّيش بتطلبوا إشي'],
       ['مكتبة الإعلانات', 'إعلاناتكم وإعلانات جيرانكم'],
       ['الملف الشخصي', 'البايو، الرابط، ومسار الطلب']]
    : [['A hundred posts', 'formats, timing, performance'],
       ['Your captions', 'what you say, and how often you ask for anything'],
       ['The Ad Library', 'your ads and your neighbours’'],
       ['The profile', 'bio, link, path to an order']];

  return (
    <Page lang={lang}>
      <section className="hero">
        <Ribbon className="hero-canvas" />
        <div className="wrap hero-in">
          <span className="u hero-kick fade">{tx('tdEyebrow', lang)}</span>
          <h1 className="mega hero-mega">
            <span className="cut"><span className="d1">{ar ? 'التحقيق' : 'The'}</span></span>
            <span className="cut l3"><span className="d2">{ar ? 'مجانًا' : 'Teardown'}</span></span>
          </h1>
          <p className="body fade d4">{tx('tdBody', lang)}</p>
          <Intake lang={lang} />
          {/* Whoever is deciding whether to hand over a handle should be able to
              read a finished one first. */}
          <p className="hero-alt fade d5">
            <Link className="u link" href={path(lang, 'teardown/sample')}>
              {tx('heroCta2', lang)} {fwd(lang)}
            </Link>
          </p>
        </div>
      </section>

      <section className="wsec"><div className="wrap">
        {rows.map(([a, b]) => (
          <div key={a} className="td-row td-evidence riseIn">
            <p className="mid">{a}</p>
            <p className="body">{b}</p>
          </div>
        ))}
      </div></section>
    </Page>
  );
}
