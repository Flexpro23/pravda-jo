import Link from 'next/link';
import Page from '@/components/Page';
import { WORK } from '@/lib/data/work';
import { Lang, path, tx } from '@/lib/i18n';

/** No directory, no filters, no measurements. Everyone is reached through work. */
export default function CastView({ lang }: { lang: Lang }) {
  const seen = new Map<string, { name: string; role: string; slug: string; piece: string }>();
  for (const p of WORK) {
    for (const c of p.cast) {
      if (!seen.has(c.name.en)) {
        seen.set(c.name.en, {
          name: c.name[lang], role: c.role[lang], slug: p.slug, piece: p.idea[lang],
        });
      }
    }
  }
  const people = [...seen.values()];

  return (
    <Page lang={lang}>
      <section className="hero" style={{ paddingBlock: 'var(--s9) var(--s7)' }}>
        <div className="wrap">
          <span className="u eyebrow register">{tx('castEyebrow', lang)}</span>
          <h1 className="d1 register-2" style={{ marginBottom: 'var(--s5)' }}>{tx('castTitle', lang)}</h1>
          <p className="body register-3">{tx('castBody', lang)}</p>
        </div>
      </section>
      <section><div className="wrap">
        <div className="rail">
          {people.map((p) => (
            <Link key={p.name} href={path(lang, `work/${p.slug}`)} className="face reveal">
              <div className="face-img" />
              <div className="face-i">
                <p className="face-nm">{p.name}</p>
                <p className="u">{p.role}</p>
              </div>
            </Link>
          ))}
        </div>
      </div></section>
    </Page>
  );
}
