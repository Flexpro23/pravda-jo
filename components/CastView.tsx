import Link from 'next/link';
import Page from '@/components/Page';
import { WORK } from '@/lib/data/work';
import { Lang, path, tx } from '@/lib/i18n';

export default function CastView({ lang }: { lang: Lang }) {
  const seen = new Map<string, { name: string; role: string; slug: string }>();
  for (const p of WORK) for (const c of p.cast)
    if (!seen.has(c.name.en)) seen.set(c.name.en, { name: c.name[lang], role: c.role[lang], slug: p.slug });
  const people = [...seen.values()];

  return (
    <Page lang={lang}>
      <section className="wsec" style={{ paddingBlockStart: 'clamp(140px,20vh,260px)' }}>
        <div className="wrap wsec-head">
          <h1 className="mega">
            <span className="cut"><span className="d1">{lang === 'ar' ? 'الوجوه' : 'CAST'}</span></span>
          </h1>
          <p className="body fade d3">{tx('castBody', lang)}</p>
        </div>
        <div className="wrap">
          <div className="faces">
            {people.map((p) => (
              <Link key={p.name} href={path(lang, `work/${p.slug}`)} className="face riseIn">
                <div className="face-img" />
                <div className="face-i">
                  <p className="face-nm">{p.name}</p>
                  <span className="u">{p.role}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </Page>
  );
}
