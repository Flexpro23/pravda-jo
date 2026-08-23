import Link from 'next/link';
import { notFound } from 'next/navigation';
import Page from '@/components/Page';
import Plate from '@/components/webgl/Plate';
import { byslug } from '@/lib/data/work';
import { Lang, path, tx } from '@/lib/i18n';

export default function PieceView({ lang, slug }: { lang: Lang; slug: string }) {
  const p = byslug(slug);
  if (!p) notFound();

  return (
    <Page lang={lang}>
      <section className="piece-hero"><div className="wrap">
        <Link href={path(lang, 'work')} className="u link piece-back">← {tx('allWork', lang)}</Link>
        <p className="u register">{p.client[lang]} · {p.sector[lang]} · <span className="num ltr">{p.date}</span></p>
        <h1 className="d1 register-2" style={{ margin: 'var(--s5) 0' }}>{p.idea[lang]}</h1>
      </div></section>

      <div className="wrap">
        <Plate src={`/plates/${p.slug}.svg`} alt={p.idea[lang]} width={1000} height={1250} priority grain={0.06} />
      </div>

      <section className="sec"><div className="wrap piece-grid">
        <div>
          <span className="u eyebrow">{tx('idea', lang)}</span>
          <p className="body" style={{ fontSize: 18 }}>{p.concept[lang]}</p>
        </div>
        <div>
          <span className="u eyebrow">{tx('cast', lang)}</span>
          <ul className="cast-list">
            {p.cast.map((c) => (
              <li key={c.name.en}>
                <span className="cast-nm">{c.name[lang]}</span>
                <span className="u cast-role">{c.role[lang]}</span>
              </li>
            ))}
          </ul>
          <div className="stat">
            <span className="u">{tx('result', lang)}</span>
            <p className="stat-v num">{p.metric}</p>
            <p className="u" style={{ marginTop: 4 }}>{p.metricLabel[lang]}</p>
          </div>
          <div className="stat">
            <span className="u">{tx('from', lang)}</span>
            <p className="stat-v num" style={{ color: 'var(--brass)' }}>
              {p.price.toLocaleString('en-US')}
            </p>
            <p className="u" style={{ marginTop: 4 }}>
              {tx('jod', lang)} · <span className="num">{p.assets}</span>{' '}
              {lang === 'ar' ? 'مقطع' : 'assets'}
            </p>
          </div>
        </div>
      </div></section>
    </Page>
  );
}
