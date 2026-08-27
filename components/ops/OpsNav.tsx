import Link from 'next/link';

const TABS = [
  { key: 'queue', href: '/ops', label: 'Teardowns' },
  { key: 'deals', href: '/ops/deals', label: 'Deals' },
  { key: 'talent', href: '/ops/talent', label: 'Talent' },
] as const;

export default function OpsNav({ here }: { here: 'queue' | 'deals' | 'talent' }) {
  return (
    <div className="top">
      <h1>PRAVDA — operator</h1>
      {TABS.map((t) => (
        <Link key={t.key} className="btn" href={t.href}
              style={t.key === here ? { borderColor: 'var(--brass)', color: 'var(--brass)' } : undefined}>
          {t.label}
        </Link>
      ))}
      <span className="sp" />
      <form method="post" action="/api/ops/logout">
        <button type="submit">Sign out</button>
      </form>
    </div>
  );
}
