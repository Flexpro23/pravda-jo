import Link from 'next/link';
import { Lang, path, tx, other } from '@/lib/i18n';

export default function Masthead({ lang }: { lang: Lang }) {
  const o = other(lang);
  return (
    <header className="mast">
      <div className="wrap mast-in">
        <Link href={path(lang)} className="wm fade" aria-label="PRAVDA">
          {lang === 'ar' ? 'برافدا' : 'PRAVDA'}
        </Link>
        <nav className="mast-nav fade">
          <Link href={path(lang, 'work')} className="u link">{tx('navWork', lang)}</Link>
          <Link href={path(lang, 'cast')} className="u link">{tx('navCast', lang)}</Link>
          <Link href={path(lang, 'teardown')} className="u link">{tx('navTeardown', lang)}</Link>
          <Link href={path(o)} className="u link" hrefLang={o} lang={o}>{o === 'ar' ? 'ع' : 'EN'}</Link>
        </nav>
      </div>
    </header>
  );
}
