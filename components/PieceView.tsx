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
      <section className="wsec" style={{ paddingBlockStart: 'clamp(140px,20vh,240px)' }}>
        <div className="wrap">
          <div className="row-meta" style={{ marginBottom: 'var(--s5)' }}>
            <span className="u">{p.client[lang]}</span>
            <span className="u">{p.sector[lang]}</span>
            <span className="u num ltr">{p.date}</span>
          </div>
          <h1 className="mega" style={{ marginBottom: 'clamp(32px,5vw,72px)' }}>
            <span className="cut"><span className="d1">{p.idea[lang]}</span></span>
          </h1>
        </div>
        <div className="wrap wipeIn">
          <Plate src={`/plates/${p.slug}.svg`} alt={p.idea[lang]} width={1200} height={1500} priority grain={0.05} />
        </div>
        <div className="wrap" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))',
          gap: 'clamp(28px,4vw,72px)', marginTop: 'clamp(48px,7vw,110px)' }}>
          <div className="riseIn">
            <span className="u">{tx('idea', lang)}</span>
            <p className="body" style={{ marginTop: 'var(--s4)', maxWidth: '52ch' }}>{p.concept[lang]}</p>
          </div>
          <div className="riseIn">
            <span className="u">{tx('cast', lang)}</span>
            <div className="row-cast" style={{ marginTop: 'var(--s4)' }}>
              {p.cast.map((c) => (
                <span key={c.name.en}><b>{c.name[lang]}</b><span className="u">{c.role[lang]}</span></span>
              ))}
            </div>
            <div className="row-metric">
              <span className="v num">{p.metric}</span>
              <span className="u" style={{ maxWidth: '18ch' }}>{p.metricLabel[lang]}</span>
            </div>
            <div className="row-metric">
              <span className="v num">{p.price.toLocaleString('en-US')}</span>
              <span className="u">{tx('jod', lang)} · <span className="num">{p.assets}</span> {lang === 'ar' ? 'مقطع' : 'assets'}</span>
            </div>
          </div>
        </div>
        <div className="wrap" style={{ marginTop: 'clamp(48px,7vw,110px)' }}>
          <Link href={path(lang, 'work')} className="btn btn-s">← {tx('allWork', lang)}</Link>
        </div>
      </section>
    </Page>
  );
}
