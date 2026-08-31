import Link from 'next/link';
import { opsAuthed } from '@/lib/ops/auth';
import { listClients } from '@/lib/store/clients';
import { CLIENT_LABEL, owesNotice, type Client } from '@/lib/data/clients';
import OpsNav from '@/components/ops/OpsNav';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The book.
 *
 * Every business that ever asked, in one place, ordered by what needs doing
 * rather than by when it arrived. A lead that came in an hour ago and has been
 * answered matters less than one from Tuesday that nobody has replied to, so
 * the sort is by whether it still owes somebody a message.
 */

/** Waiting first, then reading, then everything else newest-first. */
const rank = (c: Client) =>
  owesNotice(c) ? 0 : c.status === 'reading' ? 1 : c.status === 'failed' ? 2 : 3;

const ago = (iso: string) => {
  const mins = Math.floor((Date.now() - +new Date(iso)) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

export default async function Clients() {
  if (!(await opsAuthed())) {
    return (
      <main className="gate">
        <h1>PRAVDA — operator</h1>
        <p className="muted">This session has expired.</p>
        <p><Link className="btn" href="/ops">Sign in</Link></p>
      </main>
    );
  }

  let rows: Client[];
  try {
    rows = await listClients(200);
  } catch {
    return (
      <main className="wrap">
        <OpsNav here="clients" />
        <p className="note" data-k="err">
          Could not reach Firestore. The console is up; the store is not.
        </p>
      </main>
    );
  }

  const waiting = rows.filter(owesNotice).length;
  const sorted = [...rows].sort((a, b) =>
    rank(a) - rank(b) || b.updatedAt.localeCompare(a.updatedAt));

  return (
    <main className="wrap">
      <OpsNav here="clients" waiting={waiting} />

      <p className="muted" style={{ marginBottom: 18 }}>
        {rows.length} account{rows.length === 1 ? '' : 's'}
        {waiting > 0 && <> · <b style={{ color: 'var(--warn)' }}>{waiting} waiting on a message</b></>}
      </p>

      {rows.length === 0 ? (
        <p className="muted">
          Nobody has asked yet. The handle form on the Teardown page opens an
          account here the moment somebody submits it, and reads them straight
          after.
        </p>
      ) : (
        <div className="scroll-x">
          <table>
            <thead>
              <tr>
                <th>Business</th><th>Contact</th><th>Status</th>
                <th>Told</th><th>Reads</th><th>Asked</th><th />
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) => (
                <tr key={c.id}>
                  <td>
                    {c.businessName || `@${c.handle}`}
                    {c.businessName && <span className="muted mono"> @{c.handle}</span>}
                  </td>
                  <td>
                    {c.contactName || <span className="muted">—</span>}
                    {c.contactPhone && <><br /><span className="muted mono">{c.contactPhone}</span></>}
                  </td>
                  <td>
                    <span className="pill" data-s={
                      c.status === 'won' ? 'won'
                        : c.status === 'failed' || c.status === 'lost' ? 'warn'
                          : c.status === 'ready' || c.status === 'sent' ? 'ready' : 'draft'
                    }>{CLIENT_LABEL[c.status]}</span>
                  </td>
                  <td className="mono">
                    {/* Two dots, two events. An empty one is a message nobody
                        has sent, which is the only thing on this page that
                        gets worse on its own. */}
                    <span title="New lead" style={{ color: c.notifiedNewAt ? 'var(--go)' : 'var(--warn)' }}>
                      {c.notifiedNewAt ? '●' : '○'}
                    </span>
                    {' '}
                    <span title="Report ready" style={{ color: c.notifiedReadyAt ? 'var(--go)' : 'var(--ash)' }}>
                      {c.notifiedReadyAt ? '●' : '○'}
                    </span>
                  </td>
                  <td className="mono">{c.sheetTokens.length + c.teardownTokens.length}</td>
                  <td className="muted">{ago(c.createdAt)}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <Link className="btn" href={`/ops/clients/${c.id}`}>Open</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
