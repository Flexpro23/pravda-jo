import Link from 'next/link';

const TABS = [
  { key: 'clients', href: '/ops/clients', label: 'Clients' },
  { key: 'queue', href: '/ops', label: 'Teardowns' },
  { key: 'deals', href: '/ops/deals', label: 'Deals' },
  { key: 'talent', href: '/ops/talent', label: 'Talent' },
] as const;

export type OpsTab = (typeof TABS)[number]['key'];

/**
 * `waiting` is the count of leads nobody has been told about, or whose report is
 * ready and unannounced. It sits on the Clients tab because an un-notified lead
 * is the one thing in this console that goes stale on its own — everything else
 * waits patiently.
 */
export default function OpsNav({ here, waiting = 0 }: { here: OpsTab; waiting?: number }) {
  return (
    <div className="top">
      <h1>PRAVDA — operator</h1>
      {TABS.map((t) => (
        <Link key={t.key} className="btn" href={t.href}
              style={t.key === here ? { borderColor: 'var(--brass)', color: 'var(--brass)' } : undefined}>
          {t.label}
          {t.key === 'clients' && waiting > 0 && (
            <span className="badge" aria-label={`${waiting} waiting`}>{waiting}</span>
          )}
        </Link>
      ))}
      <span className="sp" />
      <form method="post" action="/api/ops/logout">
        <button type="submit">Sign out</button>
      </form>
    </div>
  );
}
