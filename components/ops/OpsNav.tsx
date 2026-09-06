'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';

const TABS = [
  { key: 'today', href: '/ops', label: 'Today' },
  { key: 'clients', href: '/ops/clients', label: 'Clients' },
  { key: 'deals', href: '/ops/deals', label: 'Deals' },
  { key: 'talent', href: '/ops/talent', label: 'Roster' },
] as const;

export type OpsTab = (typeof TABS)[number]['key'];

/**
 * Four tabs, a badge, and Sign out — all in one scrolling strip.
 *
 * Title, four tabs and Sign out used to be six flex children wrapping into
 * three ragged lines under about 500px. They now share one horizontally
 * scrolling track: the tabs stay put in position order and Sign out rides at
 * the end of the same track, reachable by scrolling rather than by hunting
 * for it among wrapped lines. A client component only for the one effect
 * that needs one — scrolling the active tab into view, so arriving on
 * Roster from a link does not leave it sitting off-screen to the right.
 *
 * The badge used to count un-notified leads and sit on Clients, because that
 * was the only thing that got worse on its own. Today counts everything
 * that is owed, so the number belongs where the list is.
 */
export default function OpsNav({ here, waiting = 0 }: { here: OpsTab; waiting?: number }) {
  const activeRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [here]);

  return (
    <div className="top">
      <h1>PRAVDA — operator</h1>
      <div className="top-tabs">
        {TABS.map((t) => (
          <Link
            key={t.key}
            ref={t.key === here ? activeRef : undefined}
            className="btn"
            href={t.href}
            style={t.key === here ? { borderColor: 'var(--brass)', color: 'var(--brass)' } : undefined}
          >
            {t.label}
            {t.key === 'today' && waiting > 0 && (
              <span className="badge" aria-label={`${waiting} waiting`}>{waiting}</span>
            )}
          </Link>
        ))}
        <form method="post" action="/api/ops/logout">
          <button type="submit">Sign out</button>
        </form>
      </div>
    </div>
  );
}
