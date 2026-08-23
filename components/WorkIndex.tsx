import Page from '@/components/Page';
import WorkRows from '@/components/WorkRows';
import { WORK } from '@/lib/data/work';
import { Lang, tx } from '@/lib/i18n';

export default function WorkIndex({ lang }: { lang: Lang }) {
  return (
    <Page lang={lang}>
      <section className="wsec" style={{ paddingBlockStart: 'clamp(140px,20vh,260px)' }}>
        <div className="wrap wsec-head">
          <h1 className="mega">
            <span className="cut"><span className="d1">{lang === 'ar' ? 'الأعمال' : 'WORK'}</span></span>
          </h1>
          <p className="body fade d3">{tx('workBody', lang)}</p>
        </div>
        <div className="wrap"><WorkRows lang={lang} pieces={WORK} /></div>
      </section>
    </Page>
  );
}
