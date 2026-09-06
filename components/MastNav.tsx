'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Lang, path, tx, other } from '@/lib/i18n';

const NAV = [
  ['navWork', 'work'], ['navCast', 'cast'],
  ['navTeardown', 'teardown'], ['navStudio', 'studio'], ['navPricing', 'pricing'],
] as const;

/** A delivery surface carries its language in the query, not the path. */
const isDelivery = (p: string) => /^\/(r|p)\//.test(p);

export default function MastNav({ lang }: { lang: Lang }) {
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
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

  // Escape closes the menu and hands focus back to the control that opened
  // it — a menu a keyboard user cannot dismiss or find their way back from is
  // a trap, not a control. Outside pointerdown does the same for a tap or
  // click that lands off the panel, which is the behaviour every native menu
  // on the platform already has.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || toggleRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

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
      <button ref={toggleRef} type="button" className="u mast-menu-toggle" aria-expanded={open}
              aria-controls="mast-menu" onClick={() => setOpen((v) => !v)}>
        <span className="mast-menu-label">{lang === 'ar' ? 'القائمة' : 'Menu'}</span>
        <span className="mast-menu-icon" aria-hidden="true"><i /><i /></span>
      </button>
      {/* A delivery page reads its language on load, so that swap is a real
          navigation rather than a client-side transition. */}
      {isDelivery(here)
        ? <a href={swap} {...langAttrs}>{label}</a>
        : <Link href={swap} {...langAttrs}>{label}</Link>}
      <div id="mast-menu" ref={menuRef} className="mast-menu" data-open={open ? 'true' : 'false'}>
        <div className="mast-menu-inner">
          <span className="u brass">{lang === 'ar' ? 'الانتقال' : 'Navigate'}</span>
          <div className="mast-menu-links">{links}</div>
        </div>
      </div>
    </nav>
  );
}
