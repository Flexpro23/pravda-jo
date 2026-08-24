import Link from 'next/link';
import { Lang, path, tx, other } from '@/lib/i18n';

const NAV = [
  ['navWork', 'work'], ['navCast', 'cast'],
  ['navTeardown', 'teardown'], ['navStudio', 'studio'], ['navPricing', 'pricing'],
] as const;

export default function Masthead({ lang }: { lang: Lang }) {
  const o = other(lang);
  return (
    <header className="mast">
      <div className="wrap mast-in">
        <Link href={path(lang)} className="wm fade" aria-label="PRAVDA">
          {lang === 'ar' ? 'برافدا' : 'PRAVDA'}
        </Link>
        <nav className="mast-nav fade" aria-label={lang === 'ar' ? 'التنقّل' : 'Navigation'}>
          {NAV.map(([k, p]) => (
            <Link key={p} href={path(lang, p)} className="u link">{tx(k, lang)}</Link>
          ))}
          <Link href={path(o)} className="u link" hrefLang={o} lang={o}>{o === 'ar' ? 'ع' : 'EN'}</Link>
        </nav>
      </div>
    </header>
  );
}
