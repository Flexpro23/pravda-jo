'use client';
import { useEffect } from 'react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <main className="wrap" style={{ paddingBlock: 'clamp(160px,26vh,300px) var(--s10)' }}>
      <p className="u brass">خطأ · Error</p>
      <h1 className="big" style={{ margin: 'var(--s5) 0' }}>
        صار إشي غلط.<br />Something broke.
      </h1>
      <p className="body">
        مش إنت — إحنا. جرّب مرة تانية، وإذا ضلّت، احكينا.<br />
        Not you — us. Try again, and if it persists, tell us.
      </p>
      <div className="hero-actions">
        <button className="btn" type="button" onClick={reset}>جرّب مرة تانية · Try again</button>
        <a className="btn btn-s" href="tel:+962797989818">+962 79 798 9818</a>
      </div>
    </main>
  );
}
