import Link from 'next/link';
import { Lang, path, tx, other } from '@/lib/i18n';

export default function Masthead({ lang }: { lang: Lang }) {
  const o = other(lang);
  const nav = [
    ['navWork', 'work'], ['navCast', 'cast'], ['navTeardown', 'teardown'],
  ] as const;

  return (
    <header className="mast">
      <div className="wrap mast-in">
        <Link href={path(lang)} className="wm register" aria-label="PRAVDA">
          {lang === 'ar' ? 'برافدا' : 'PRAVDA'}
        </Link>
        <nav className="mast-nav register-2">
          {nav.map(([k, p]) => (
            <Link key={p} href={path(lang, p)} className="u link">{tx(k, lang)}</Link>
          ))}
          <Link href={path(o)} className="u lang-swap" hrefLang={o} lang={o}>
            {o === 'ar' ? 'ع' : 'EN'}
          </Link>
        </nav>
      </div>
      <div className="wrap mast-date register-3">
        <span className="u">{lang === 'ar' ? 'عمّان' : 'AMMAN'} · AMMAN</span>
        <a className="u tel ltr" href="tel:+962797989818">+962 79 798 9818</a>
      </div>
    </header>
  );
}
