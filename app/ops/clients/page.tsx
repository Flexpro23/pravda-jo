import Link from 'next/link';
import { listClients } from '@/lib/store/clients';
import { CLIENT_LABEL, owesNotice, type Client } from '@/lib/data/clients';
import { ago, readStuck } from '@/lib/ops/today';
import OpsNav from '@/components/ops/OpsNav';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The book.
 *
 * Every business that ever asked, in one place, ordered by what needs doing
 * rather than by when it arrived. A lead that came in an hour ago and has been
 * answered matters less than one from Tuesday that nobody has replied to, so
 * the sort is by whether it still owes somebody a message — the same order
 * Today puts them in, from the same predicates.
 */

/** Waiting first, then stalled, then failed, then everything else. */
const rank = (c: Client, at: number) =>
  (c.status === 'failed' ? 0
    : owesNotice(c) ? 1
      : readStuck(c, at) ? 2
        : c.status === 'reading' ? 3 : 4);

export default async function Clients() {
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

  const at = Date.now();
  const waiting = rows.filter(owesNotice).length;
  const sorted = [...rows].sort((a, b) =>
    rank(a, at) - rank(b, at) || b.updatedAt.localeCompare(a.updatedAt));

  return (
    <main className="wrap">
      <OpsNav here="clients" />

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
          {sorted.some((c) => readStuck(c, at)) && (
            <p className="hint" style={{ marginBottom: 10 }}>
              <b style={{ color: 'var(--warn)' }}>Stalled</b> means the claim on
              that read expired — re-run it from the account.
            </p>
          )}
          <table>
            <thead>
              <tr>
                <th>Business</th><th>Contact</th><th>Status</th>
                <th>Told — new · ready</th><th>Reads</th><th>Asked</th><th />
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) => (
                <tr key={c.id}>
                  <td dir="auto" data-l="Business">
                    {c.businessName || `@${c.handle}`}
                    {c.businessName && <span className="muted mono" dir="ltr"> @{c.handle}</span>}
                  </td>
                  <td dir="auto" data-l="Contact">
                    {c.contactName || <span className="muted">—</span>}
                    {c.contactPhone && <><br /><span className="muted mono" dir="ltr">{c.contactPhone}</span></>}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }} data-l="Status">
                    <span className="pill" data-s={
                      c.status === 'won' ? 'won'
                        : c.status === 'failed' || c.status === 'lost' ? 'warn'
                          : c.status === 'ready' || c.status === 'sent' ? 'ready' : 'draft'
                    }>{CLIENT_LABEL[c.status]}</span>
                    {/* A read whose claim has expired looks identical to one
                        still running, and is the one that never finishes. The
                        explanation is the hint above the table now, not a
                        tooltip nothing on a phone can see. */}
                    {readStuck(c, at) && (
                      <span className="pill stalled" style={{ marginInlineStart: 6 }}>
                        stalled
                      </span>
                    )}
                  </td>
                  <td className="mono" data-l="Told">
                    {/* Two dots, two events, in the order the header names
                        them. An empty one is a message nobody has sent, which
                        is the only thing on this page that gets worse on its
                        own. */}
                    <span style={{ color: c.notifiedNewAt ? 'var(--go)' : 'var(--warn)' }}>
                      {c.notifiedNewAt ? '●' : '○'}
                    </span>
                    {' '}
                    <span style={{ color: c.notifiedReadyAt ? 'var(--go)' : 'var(--ash)' }}>
                      {c.notifiedReadyAt ? '●' : '○'}
                    </span>
                  </td>
                  <td className="mono" data-l="Reads">{c.sheetTokens.length}</td>
                  <td className="muted" data-l="Asked">{ago(Math.round((at - +new Date(c.createdAt)) / 60000))}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }} data-l="">
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
