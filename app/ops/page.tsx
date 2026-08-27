import Link from 'next/link';
import { opsAuthed } from '@/lib/ops/auth';
import { listTeardowns } from '@/lib/store/teardowns';
import { listSheets } from '@/lib/store/sheets';
import RunHandle from '@/components/ops/RunHandle';
import OpsNav from '@/components/ops/OpsNav';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The queue. Everything read, newest first, with what still needs doing. */
export default async function Ops({
  searchParams,
}: { searchParams: Promise<{ bad?: string }> }) {
  const { bad } = await searchParams;

  if (!(await opsAuthed())) {
    return (
      <main className="gate">
        <h1>PRAVDA — operator</h1>
        <form method="post" action="/api/ops/login">
          <input
            type="password" name="key" autoFocus autoComplete="off"
            placeholder="Operator key" aria-label="Operator key"
          />
          <button className="go" type="submit">Enter</button>
          {bad && <p className="note" data-k="err">That key was not accepted.</p>}
        </form>
        <p className="muted" style={{ marginTop: 18 }}>
          The key is in Secret Manager as OPERATOR_KEY.
        </p>
      </main>
    );
  }

  // A store that cannot be read is worth saying plainly rather than crashing
  // the console — the operator can still tell the difference and act on it.
  let rows; let sheets: Awaited<ReturnType<typeof listSheets>> = [];
  try {
    rows = await listTeardowns(100);
    sheets = await listSheets(60).catch(() => []);
  } catch {
    return (
      <main className="wrap">
        <p className="note" data-k="err">
          Could not reach Firestore. The console is up; the store is not.
        </p>
      </main>
    );
  }

  const counts = {
    draft: rows.filter((r) => r.status === 'draft').length,
    ready: rows.filter((r) => r.status === 'ready').length,
    sent: rows.filter((r) => r.status === 'sent').length,
  };

  return (
    <main className="wrap">
      <OpsNav here="queue" />
      <p className="muted" style={{ marginBottom: 18 }}>
        {counts.draft} draft · {counts.ready} ready · {counts.sent} sent
      </p>

      <RunHandle />

      {sheets.length > 0 && (
        <>
          <p className="lab" style={{ marginBottom: 10 }}>Sheets</p>
          <table style={{ marginBottom: 34 }}>
            <thead>
              <tr><th>Business</th><th>Read</th><th>Findings</th><th>Chosen</th><th>Status</th><th /></tr>
            </thead>
            <tbody>
              {sheets.map((sh) => (
                <tr key={sh.token}>
                  <td>{sh.clientName}<span className="muted mono"> @{sh.handle}</span></td>
                  <td className="mono">{sh.signals?.posts ?? '—'}{sh.site ? ' + site' : ''}</td>
                  <td className="mono">{sh.findings?.findings?.length ?? 0}</td>
                  <td className="mono">{sh.chosen?.length ?? 0}/3</td>
                  <td>
                    <span className="pill" data-s={sh.status === 'approved' ? 'ready' : 'draft'}>
                      {sh.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <Link className="btn" href={`/ops/sheet/${sh.token}`}>
                      {sh.status === 'approved' ? 'Open' : 'Review'}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {rows.length === 0 ? (
        <p className="muted">
          Nothing read yet. Put a handle in above and the engine will read a
          hundred posts and compose what the arithmetic supports.
        </p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Handle</th><th>Client</th><th>Status</th>
              <th>Posts</th><th>Read</th><th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.token}>
                <td className="mono">@{r.handle}</td>
                <td>{r.report?.client?.en ?? '—'}</td>
                <td><span className="pill" data-s={r.status}>{r.status}</span></td>
                <td className="mono">{r.signals?.posts ?? '—'}</td>
                <td className="muted">{r.readAt?.slice(0, 10) ?? '—'}</td>
                <td style={{ textAlign: 'right' }}>
                  <Link className="btn" href={`/ops/${r.token}`}>
                    {r.status === 'draft' ? 'Write' : 'Open'}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
