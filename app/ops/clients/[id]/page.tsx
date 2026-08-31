import Link from 'next/link';
import { notFound } from 'next/navigation';
import { opsAuthed } from '@/lib/ops/auth';
import { getClient } from '@/lib/store/clients';
import { getSheet } from '@/lib/store/sheets';
import { getDeal } from '@/lib/store/deals';
import { CLIENT_LABEL, FAILURE_NOTE } from '@/lib/data/clients';
import OpsNav from '@/components/ops/OpsNav';
import ClientActions from '@/components/ops/ClientActions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * One account, and everything that has ever been produced about it.
 *
 * This is the page the "we have a new client" message links to, so it has to
 * answer the question that message raises — who are they and what do I do about
 * it — above anything else. The history sits underneath, because a business
 * read twice is the case this page exists to make legible.
 */
export default async function ClientAccount({
  params,
}: { params: Promise<{ id: string }> }) {
  if (!(await opsAuthed())) {
    return (
      <main className="gate">
        <h1>PRAVDA — operator</h1>
        <p className="muted">This session has expired.</p>
        <p><Link className="btn" href="/ops">Sign in</Link></p>
      </main>
    );
  }

  const { id } = await params;
  const c = await getClient(id);
  if (!c) notFound();

  // The reads, newest first. A sheet that has gone missing from the store is
  // shown as a gap rather than silently skipped — that is a bug worth seeing.
  const sheets = await Promise.all(
    c.sheetTokens.map(async (t) => ({ token: t, sheet: await getSheet(t).catch(() => null) })),
  );
  const deal = c.dealId ? await getDeal(c.dealId).catch(() => null) : null;
  const fail = c.readError ? FAILURE_NOTE[c.readError] : null;

  return (
    <main className="wrap">
      <OpsNav here="clients" />

      <div className="top" style={{ marginTop: 0 }}>
        <h1>{c.businessName || `@${c.handle}`}</h1>
        <span className="pill" data-s={
          c.status === 'won' ? 'won'
            : c.status === 'failed' || c.status === 'lost' ? 'warn'
              : c.status === 'ready' || c.status === 'sent' ? 'ready' : 'draft'
        }>{CLIENT_LABEL[c.status]}</span>
        <span className="sp" />
        <Link className="btn" href="/ops/clients">← Clients</Link>
      </div>

      <div className="panel" style={{ marginBottom: 22 }}>
        <p className="lab">Who asked</p>
        <p style={{ margin: '8px 0 0' }}>
          {c.contactName || <span className="muted">no name given</span>}
          {c.contactPhone && <>
            {' · '}
            <a className="mono" href={`tel:${c.contactPhone}`}>{c.contactPhone}</a>
          </>}
        </p>
        <p className="muted" style={{ marginTop: 6 }}>
          <a className="mono" href={`https://instagram.com/${c.handle}`}
             target="_blank" rel="noreferrer noopener">@{c.handle}</a>
          {c.website && <> · <a className="mono" href={c.website} target="_blank" rel="noreferrer noopener">{c.website}</a></>}
          {' · '}arrived {c.createdAt.slice(0, 10)} via {c.source}
          {' · '}replies in {c.lang === 'ar' ? 'Arabic' : 'English'}
        </p>
      </div>

      {fail && (
        <p className="note" data-k="err" style={{ marginBottom: 22 }}>
          <b>{fail.what}</b><br />{fail.do_}
        </p>
      )}

      <ClientActions
        id={c.id}
        notifiedNew={!!c.notifiedNewAt}
        notifiedReady={!!c.notifiedReadyAt}
        status={c.status}
      />

      <p className="lab" style={{ margin: '30px 0 10px' }}>
        Reads {sheets.length > 1 && <span className="muted">— newest first</span>}
      </p>
      {sheets.length === 0 ? (
        <p className="muted">
          Nothing read yet.
          {c.status === 'reading' && ' The engine is on it — reload in a moment.'}
        </p>
      ) : (
        <div className="scroll-x">
          <table>
            <thead>
              <tr><th>Read</th><th>Posts</th><th>Findings</th><th>Chosen</th><th>Status</th><th /></tr>
            </thead>
            <tbody>
              {sheets.map(({ token, sheet }) => (
                <tr key={token}>
                  <td className="muted">{sheet?.createdAt?.slice(0, 10) ?? <span className="mono">{token}</span>}</td>
                  <td className="mono">{sheet?.signals?.posts ?? '—'}{sheet?.site ? ' + site' : ''}</td>
                  <td className="mono">{sheet?.findings?.findings?.length ?? '—'}</td>
                  <td className="mono">{sheet ? `${sheet.chosen?.length ?? 0}/3` : '—'}</td>
                  <td>
                    {sheet
                      ? <span className="pill" data-s={sheet.dealId ? 'won' : sheet.status === 'approved' ? 'ready' : 'draft'}>
                          {sheet.dealId ? 'won' : sheet.status}
                        </span>
                      : <span className="pill" data-s="warn">missing</span>}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {sheet && <Link className="btn" href={`/ops/sheet/${token}`}>
                      {sheet.status === 'approved' ? 'Open' : 'Review'}
                    </Link>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {deal && (
        <>
          <p className="lab" style={{ margin: '30px 0 10px' }}>The job</p>
          <div className="panel">
            <p style={{ margin: 0 }}>
              {deal.concepts.length} idea{deal.concepts.length === 1 ? '' : 's'}
              {' · '}<span className="mono">{deal.clientTotalJOD} JOD</span>
              {deal.retainerJOD ? <> + <span className="mono">{deal.retainerJOD}/mo</span></> : null}
              {' · '}<span className="pill" data-s="ready">{deal.status}</span>
            </p>
            <p style={{ marginTop: 12, marginBottom: 0 }}>
              <Link className="btn go" href={`/ops/deals/${deal.id}`}>Open the deal</Link>
            </p>
          </div>
        </>
      )}
    </main>
  );
}
