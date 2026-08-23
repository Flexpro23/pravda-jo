import Page from '@/components/Page';
import Triptych from '@/components/Triptych';
import { WORK } from '@/lib/data/work';
import { Lang, tx } from '@/lib/i18n';

export default function WorkIndex({ lang }: { lang: Lang }) {
  return (
    <Page lang={lang}>
      <section className="hero" style={{ paddingBlock: 'var(--s9) var(--s7)' }}>
        <div className="wrap">
          <span className="u eyebrow register">{tx('workEyebrow', lang)}</span>
          <h1 className="d1 register-2" style={{ marginBottom: 'var(--s5)' }}>{tx('workTitle', lang)}</h1>
          <p className="body register-3">{tx('workBody', lang)}</p>
        </div>
      </section>
      <section><div className="wrap work-list">
        {WORK.map((p, i) => (
          <Triptych key={p.slug} piece={p} lang={lang} index={i} priority={i === 0} />
        ))}
      </div></section>
    </Page>
  );
}
