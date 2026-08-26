'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Lang, path, tx, other } from '@/lib/i18n';

const NAV = [
  ['navWork', 'work'], ['navCast', 'cast'],
  ['navTeardown', 'teardown'], ['navStudio', 'studio'], ['navPricing', 'pricing'],
] as const;

/** A delivery surface carries its language in the query, not the path. */
const isDelivery = (p: string) => /^\/(r|p)\//.test(p);

export default function MastNav({ lang }: { lang: Lang }) {
  const [open, setOpen] = useState(false);
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

  useEffect(() => { setOpen(false); }, [here]);

  const links = NAV.map(([k, p]) => (
    <Link key={p} href={path(lang, p)} className="u link mast-link"
          aria-current={seg === p ? 'page' : undefined}
          onClick={() => setOpen(false)}>
      {tx(k, lang)}
    </Link>
  ));

  return (
    <nav className="mast-nav fade" aria-label={lang === 'ar' ? 'التنقّل' : 'Navigation'}>
      <span className="mast-full">{links}</span>
      <Link href={path(lang, compact[1])} className="u link mast-compact">
        {tx(compact[0], lang)}
      </Link>
      <button type="button" className="u mast-menu-toggle" aria-expanded={open}
              aria-controls="mast-menu" onClick={() => setOpen((v) => !v)}>
        <span className="mast-menu-label">{lang === 'ar' ? 'القائمة' : 'Menu'}</span>
        <span className="mast-menu-icon" aria-hidden="true"><i /><i /></span>
      </button>
      {/* A delivery page reads its language on load, so that swap is a real
          navigation rather than a client-side transition. */}
      {isDelivery(here)
        ? <a href={swap} {...langAttrs}>{label}</a>
        : <Link href={swap} {...langAttrs}>{label}</Link>}
      <div id="mast-menu" className="mast-menu" data-open={open ? 'true' : 'false'}>
        <div className="mast-menu-inner">
          <span className="u brass">{lang === 'ar' ? 'الانتقال' : 'Navigate'}</span>
          <div className="mast-menu-links">{links}</div>
        </div>
      </div>
    </nav>
  );
}
