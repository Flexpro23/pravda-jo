'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Lang, path, tx, other } from '@/lib/i18n';

const NAV = [
  ['navWork', 'work'], ['navCast', 'cast'],
  ['navTeardown', 'teardown'], ['navStudio', 'studio'], ['navPricing', 'pricing'],
] as const;

/** A delivery surface carries its language in the query, not the path. */
const isDelivery = (p: string) => /^\/(r|p)\//.test(p);

export default function MastNav({ lang }: { lang: Lang }) {
  const o = other(lang);
  const here = usePathname() || path(lang);
  const seg = here.replace(/^\/(ar|en)\/?/, '').split('/')[0];

  // Below 760px the full set overflows, so it collapses to the one action that
  // matters — and to the archive when the teardown is already on screen.
  const compact = seg === 'teardown' ? NAV[0] : NAV[2];

  // Switching language should keep the reader on the page they are reading.
  const swap = isDelivery(here)
    ? `${here}${o === 'en' ? '?lang=en' : ''}`
    : here.startsWith(`/${lang}`)
      ? `/${o}${here.slice(lang.length + 1)}`
      : path(o);

  const label = o === 'ar' ? 'ع' : 'EN';
  const langAttrs = { hrefLang: o, lang: o, className: 'u link' };

  return (
    <nav className="mast-nav fade" aria-label={lang === 'ar' ? 'التنقّل' : 'Navigation'}>
      {NAV.map(([k, p]) => (
        <Link key={p} href={path(lang, p)} className="u link mast-full"
              aria-current={seg === p ? 'page' : undefined}>
          {tx(k, lang)}
        </Link>
      ))}
      <Link href={path(lang, compact[1])} className="u link mast-compact">
        {tx(compact[0], lang)}
      </Link>
      {/* A delivery page reads its language on load, so that swap is a real
          navigation rather than a client-side transition. */}
      {isDelivery(here)
        ? <a href={swap} {...langAttrs}>{label}</a>
        : <Link href={swap} {...langAttrs}>{label}</Link>}
    </nav>
  );
}
