import Link from 'next/link';
import Page from '@/components/Page';
import Intake from '@/components/Intake';
import { Ribbon } from '@/components/webgl/Horizon';
import { Lang, tx, fwd } from '@/lib/i18n';

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

  /* Not a live figure — no data backs a number here, so the mock names the
     same four things the evidence rows above already promise, rather than
     inventing a stat nobody can check. Purely decorative. */
  const specimenHref = `/specimen/${lang}`;

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
          {/* The artefact promised before the handle is asked for, not after. */}
          <p className="body fade d4">{tx('tdDeliver', lang)}</p>
          <Intake lang={lang} />
          {/* Whoever is deciding whether to hand over a handle should be able to
              read a finished one first. */}
          <p className="hero-alt fade d5">
            <Link className="btn btn-s" href={specimenHref}>
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

      {/* "What arrives": the earlier line is a promise, this is the shape of it —
          named again with a mock of the artefact and a full-size way to read it. */}
      <section className="wsec td-arrives"><div className="wrap">
        <p className="body riseIn td-arrives-lede">{tx('tdDeliver', lang)}</p>
        <div className="td-mock" aria-hidden="true">
          <span className="td-mock-mark">{ar ? 'برافدا' : 'PRAVDA'}</span>
          <p className="td-mock-h">{ar ? 'شو رح توصلكم' : 'What you get back'}</p>
          <div className="td-mock-figs">
            {rows.map(([a]) => (
              <div className="td-mock-fig" key={a}>
                <span className="td-mock-bar" />
                <span>{a}</span>
              </div>
            ))}
          </div>
        </div>
        <Link className="btn" href={specimenHref}>{tx('heroCta2', lang)} {fwd(lang)}</Link>
      </div></section>
    </Page>
  );
}
