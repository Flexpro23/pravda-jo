import Masthead from '@/components/Masthead';
import WorkFlow from '@/components/WorkFlow';
import type { Lang } from '@/lib/i18n';

/**
 * Like Cast and the homepage, the archive is a fixed stage rather than a
 * document, so it carries no footer — the closing screen holds the offer and
 * the entity block. On a phone it falls back to the scrolling rows.
 */
export default function WorkIndex({ lang }: { lang: Lang }) {
  return (
    <>
      <a className="skip" href="#main">
        {lang === 'ar' ? 'تخطَّ إلى الأعمال' : 'Skip to the work'}
      </a>
      <Masthead lang={lang} />
      <main id="main" tabIndex={-1}><WorkFlow lang={lang} /></main>
    </>
  );
}
