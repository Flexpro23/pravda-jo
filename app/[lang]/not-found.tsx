import Link from 'next/link';

/**
 * Rendered without a locale param, so both languages are authored and the
 * stylesheet shows the half matching <html lang>, which the layout has set.
 */
export default function NotFound() {
  return (
    <main className="wrap" style={{ paddingBlock: 'clamp(120px,20vh,220px) var(--s10)' }}>
      <p className="u brass">404</p>
      <h1 className="big lang-en" style={{ margin: 'var(--s5) 0' }}>
        This page does not exist.
      </h1>
      <h1 className="big lang-ar" style={{ margin: 'var(--s5) 0' }}>
        هالصفحة مش موجودة.
      </h1>
      <p className="body lang-en">The link may be old, or a character short.</p>
      <p className="body lang-ar">يمكن الرابط قديم، أو فيه حرف ناقص.</p>
      <div className="hero-actions" style={{ marginTop: 'var(--s6)' }}>
        <Link className="btn lang-en" href="/en">Home</Link>
        <Link className="btn lang-ar" href="/ar">الرئيسية</Link>
        <Link className="btn btn-s lang-en" href="/en/teardown">Get your teardown</Link>
        <Link className="btn btn-s lang-ar" href="/ar/teardown">اطلبوا تحقيقكم</Link>
      </div>
    </main>
  );
}
