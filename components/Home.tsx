import Link from 'next/link';
import Plate from '@/components/webgl/Plate';
import Triptych from '@/components/Triptych';
import Page from '@/components/Page';
import { WORK } from '@/lib/data/work';
import { Lang, path, tx } from '@/lib/i18n';

export default function Home({ lang }: { lang: Lang }) {
  return (
    <Page lang={lang}>
      <section className="hero">
        <div className="wrap hero-grid">
          <div>
            <p className="u hero-kick register">{tx('heroKicker', lang)}</p>
            <h1 className="d1 hero-h">
              <span className="register">{tx('heroLine1', lang)}</span>
              <span className="register-2">{tx('heroLine2', lang)}</span>
            </h1>
            <p className="body register-3">{tx('heroBody', lang)}</p>
            <div className="hero-actions register-3">
              <Link className="btn" href={path(lang, 'teardown')}>{tx('heroCta', lang)}</Link>
              <Link className="btn btn-s" href={path(lang, 'work')}>{tx('heroCta2', lang)}</Link>
            </div>
          </div>
          <Plate src="/plates/hero.svg" alt={tx('heroLine1', lang)}
                 width={1000} height={1250} priority grain={0.07} />
        </div>
      </section>

      <section className="sec">
        <div className="wrap">
          <div className="sec-head">
            <span className="u eyebrow">{tx('workEyebrow', lang)}</span>
            <h2 className="d2">{tx('workTitle', lang)}</h2>
            <p className="body" style={{ marginTop: 'var(--s4)' }}>{tx('workBody', lang)}</p>
          </div>
          <div className="work-list">
            {WORK.slice(0, 2).map((p, i) => (
              <Triptych key={p.slug} piece={p} lang={lang} index={i} />
            ))}
          </div>
          <Link className="btn btn-s" href={path(lang, 'work')} style={{ marginTop: 'var(--s6)' }}>
            {tx('allWork', lang)}
          </Link>
        </div>
      </section>

      <section className="sec">
        <div className="wrap">
          <div className="sec-head">
            <span className="u eyebrow">{tx('tdEyebrow', lang)}</span>
            <h2 className="d2">{tx('tdTitle', lang)}</h2>
            <p className="body" style={{ marginTop: 'var(--s4)' }}>{tx('tdBody', lang)}</p>
          </div>
          <Link className="btn" href={path(lang, 'teardown')}>{tx('heroCta', lang)}</Link>
        </div>
      </section>
    </Page>
  );
}
