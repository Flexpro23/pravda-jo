import Link from 'next/link';
import { Horizon } from '@/components/webgl/Horizon';
import Page from '@/components/Page';
import WorkRows from '@/components/WorkRows';
import { WORK } from '@/lib/data/work';
import { Lang, path, tx } from '@/lib/i18n';

export default function Home({ lang }: { lang: Lang }) {
  const ar = lang === 'ar';
  return (
    <Page lang={lang}>
      <section className="hero">
        <Horizon className="hero-canvas" />
        <div className="wrap hero-in">
          <span className="u hero-kick fade">{tx('heroKicker', lang)}</span>

          <h1 className="mega hero-mega">
            <span className="cut"><span className="d1">{ar ? 'منشوف' : 'WE READ'}</span></span>
            <span className="cut l2"><span className="d2">{ar ? 'حسابك' : 'YOUR'}</span></span>
            <span className="cut l3"><span className="d3">{ar ? 'قبل ما نحكيك' : 'ACCOUNT'}</span></span>
          </h1>

          <div className="hero-tail">
            <p className="body fade d4">{tx('heroBody', lang)}</p>
            <div className="hero-actions fade d5">
              <Link className="btn" href={path(lang, 'teardown')}>{tx('heroCta', lang)}</Link>
              <Link className="btn btn-s" href={path(lang, 'work')}>{tx('heroCta2', lang)}</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="band">
        <div className="wrap">
          <p className="u" style={{ marginBottom: 'var(--s6)' }}>{tx('workEyebrow', lang)}</p>
          <p className="mid riseIn">
            {ar
              ? 'ما منبيع صور. منبيع فكرة، ومَن نفّذها، والرقم اللي طلع.'
              : 'We do not sell pictures. We sell an idea, the people who made it, and the number it returned.'}
          </p>
        </div>
      </section>

      <section className="wsec"><div className="wrap">
        <WorkRows lang={lang} pieces={WORK.slice(0, 3)} />
        <Link className="btn btn-s" href={path(lang, 'work')} style={{ marginTop: 'var(--s8)' }}>
          {tx('allWork', lang)}
        </Link>
      </div></section>

      <section className="band">
        <div className="wrap" style={{ display: 'flex', justifyContent: 'space-between',
          gap: 'var(--s7)', flexWrap: 'wrap', alignItems: 'end' }}>
          <p className="big riseIn">{tx('tdTitle', lang)}</p>
          <Link className="btn" href={path(lang, 'teardown')}>{tx('heroCta', lang)}</Link>
        </div>
      </section>
    </Page>
  );
}
