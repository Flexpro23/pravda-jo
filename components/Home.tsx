import Masthead from '@/components/Masthead';
import Flight from '@/components/Flight';
import type { Lang } from '@/lib/i18n';

/**
 * The homepage is the flight. No footer, no sections — it is one continuous
 * scene, and every other route is a normal page.
 */
export default function Home({ lang }: { lang: Lang }) {
  return (
    <>
      <Masthead lang={lang} />
      <Flight lang={lang} />
    </>
  );
}
