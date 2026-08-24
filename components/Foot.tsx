import Link from 'next/link';
import { Lang, path, tx, sep } from '@/lib/i18n';
import { CO } from '@/lib/data/company';

/**
 * The entity block is not decoration. Meta Business Verification requires the
 * exact legal name and address on the site, and a cold visitor checking whether
 * PRAVDA is real looks for precisely these four things: a registered name, a
 * number, a street, and a phone that answers.
 */
export default function Foot({ lang }: { lang: Lang }) {
  const nav = [
    ['navWork', 'work'], ['navCast', 'cast'], ['navTeardown', 'teardown'],
    ['navStudio', 'studio'], ['navPricing', 'pricing'],
  ] as const;
  const legal = [
    ['navPrivacy', 'privacy'], ['navNotice', 'notice'],
    ['navTerms', 'terms'], ['navData', 'data'],
  ] as const;

  return (
    <footer className="foot"><div className="wrap">
      <div className="foot-in">
        <div className="foot-brand">
          <p className="big">{lang === 'ar' ? 'برافدا' : 'PRAVDA'}</p>
          <p className="body foot-line">{tx('footLine', lang)}</p>
        </div>

        <nav className="foot-nav" aria-label={lang === 'ar' ? 'الصفحات' : 'Pages'}>
          {nav.map(([k, p]) => (
            <Link key={p} href={path(lang, p)} className="u link">{tx(k, lang)}</Link>
          ))}
        </nav>

        <nav className="foot-nav" aria-label={lang === 'ar' ? 'قانوني' : 'Legal'}>
          {legal.map(([k, p]) => (
            <Link key={p} href={path(lang, p)} className="u link">{tx(k, lang)}</Link>
          ))}
        </nav>
      </div>

      <address className="entity">
        <span className="u">{CO.legalName[lang]}</span>
        <span className="u">{lang === 'ar' ? 'س.ت' : 'CR'} <span className="num ltr">{CO.cr}</span></span>
        <span className="u">
          {[CO.street, CO.district, CO.city, CO.country].map((f) => f[lang]).join(sep(lang))}
        </span>
        <a className="u tel ltr" href={`tel:${CO.phone}`}>{CO.phoneDisplay}</a>
        <a className="u tel ltr" href={`mailto:${CO.email}`}>{CO.email}</a>
        <a className="u tel ltr" href={`https://instagram.com/${CO.instagram}`} rel="me">@{CO.instagram}</a>
      </address>

      <p className="u foot-rights">© {CO.founded} {CO.legalName[lang]}</p>
    </div></footer>
  );
}
