import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="wrap" style={{ paddingBlock: 'var(--s10)' }}>
      <h1 className="d1" style={{ marginBottom: 'var(--s5)' }}>٤٠٤</h1>
      <p className="body">هالصفحة مش موجودة. / This page does not exist.</p>
      <Link className="btn" href="/" style={{ marginTop: 'var(--s6)' }}>الرئيسية · Home</Link>
    </main>
  );
}
