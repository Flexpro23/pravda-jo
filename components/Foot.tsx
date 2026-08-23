import Link from 'next/link';
import { Lang, path, tx } from '@/lib/i18n';

export default function Foot({ lang }: { lang: Lang }) {
  return (
    <footer className="foot"><div className="wrap">
      <div className="foot-in">
        <p className="big">{lang === 'ar' ? 'برافدا' : 'PRAVDA'}</p>
        <nav className="foot-nav">
          <Link href={path(lang, 'work')} className="u link">{tx('navWork', lang)}</Link>
          <Link href={path(lang, 'cast')} className="u link">{tx('navCast', lang)}</Link>
          <Link href={path(lang, 'teardown')} className="u link">{tx('navTeardown', lang)}</Link>
        </nav>
        <div>
          <p className="u" style={{ lineHeight: 2.2 }}>
            {tx('founders', lang)}<br />{tx('addr', lang)}<br />
            <a className="tel ltr" href="tel:+962797989818">+962 79 798 9818</a>
          </p>
        </div>
      </div>
      <p className="u">{tx('rights', lang)}</p>
    </div></footer>
  );
}
