'use client';

/** The only thing on these pages that never reaches paper. */
export default function PrintBar({
  label, hint, otherLang, otherHref,
}: { label: string; hint: string; otherLang: string; otherHref: string }) {
  return (
    <div className="bar">
      <button type="button" onClick={() => window.print()}>{label}</button>
      <a href={otherHref}>{otherLang}</a>
      <span className="sp" />
      <span className="hint">{hint}</span>
    </div>
  );
}
