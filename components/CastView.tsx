import Masthead from '@/components/Masthead';
import CastFlow from '@/components/CastFlow';
import { getCastPage } from '@/lib/store/content';
import type { Lang } from '@/lib/i18n';

/**
 * Like the homepage, the roster is a fixed stage rather than a document, so it
 * carries no footer — the closing screen holds the offer and the entity block.
 */
export default async function CastView({ lang }: { lang: Lang }) {
  const { roster, work } = await getCastPage();
  return (
    <>
      <a className="skip" href="#main">
        {lang === 'ar' ? 'تخطَّ إلى الوجوه' : 'Skip to the cast'}
      </a>
      <Masthead lang={lang} />
      <main id="main" tabIndex={-1}><CastFlow lang={lang} roster={roster} work={work} /></main>
    </>
  );
}
