import Masthead from '@/components/Masthead';
import Foot from '@/components/Foot';
import type { Lang } from '@/lib/i18n';

/** lang and dir are set server-side on <html> by the locale layout. */
export default function Page({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return (
    <>
      <Masthead lang={lang} />
      <main>{children}</main>
      <Foot lang={lang} />
    </>
  );
}
