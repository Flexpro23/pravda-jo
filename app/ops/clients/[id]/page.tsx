import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getClient } from '@/lib/store/clients';
import { getSheet } from '@/lib/store/sheets';
import { getDeal } from '@/lib/store/deals';
import { CLIENT_LABEL, FAILURE_NOTE } from '@/lib/data/clients';
import { buildToday } from '@/lib/ops/today';
import OpsNav from '@/components/ops/OpsNav';
import ClientActions from '@/components/ops/ClientActions';
import NextAction from '@/components/ops/NextAction';
import Timeline from '@/components/ops/Timeline';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WEB_STATE: Record<string, string> = {
  'no-url': 'no website given',
  unreadable: 'their site refused us',
  'error-page': 'their site returned an error page',
  read: 'site read',
};

const ROSTER_STATE: Record<string, string> = {
  real: 'cast from real people',
  'placeholder-only': 'cast entirely from worked examples — cannot be sent',
  empty: 'nobody on the roster to cast from',
};

/**
 * One account, and everything that has ever been produced about it.
 *
 * This is the page the "we have a new client" message links to, so it answers
 * the question that message raises before anything else: what do I do about it.
 * `NextAction` says the one sentence and carries the button; the timeline
 * underneath is the record it was derived from, so the sentence can be argued
 * with rather than merely believed.
 */
export default async function ClientAccount({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await getClient(id);
  if (!c) notFound();

  // The reads, newest first. A sheet that has gone missing from the store is
  // shown as a gap rather than silently skipped — that is a bug worth seeing.
  const sheets = await Promise.all(
    c.sheetTokens.map(async (t) => ({ token: t, sheet: await getSheet(t).catch(() => null) })),
  );
  const newest = sheets.find((s) => s.sheet)?.sheet ?? null;
  const deal = c.dealId ? await getDeal(c.dealId).catch(() => null) : null;
  const fail = c.readError ? FAILURE_NOTE[c.readError] : null;

  // The same rules as Today, over this one account, so the two screens cannot
  // disagree about what is owed.
  const mine = buildToday({
    clients: [c],
    sheets: sheets.map((s) => s.sheet).filter((s) => s !== null),
    deals: deal ? [deal] : [],
    bookings: [],
  });

  return (
    <main className="wrap">
      <OpsNav here="clients" />

      <div className="top" style={{ marginTop: 0 }}>
        <h1 dir="auto">{c.businessName || `@${c.handle}`}</h1>
        <span className="pill" data-s={
          c.status === 'won' ? 'won'
            : c.status === 'failed' || c.status === 'lost' ? 'warn'
              : c.status === 'ready' || c.status === 'sent' ? 'ready' : 'draft'
        }>{CLIENT_LABEL[c.status]}</span>
        <span className="sp" />
        <Link className="btn" href="/ops/clients">← Clients</Link>
      </div>

      <NextAction task={mine[0] ?? null} />

      <div className="panel" style={{ margin: '22px 0' }}>
        <p className="lab">Who asked</p>
        <p style={{ margin: '8px 0 0' }} dir="auto">
          {c.contactName || <span className="muted">no name given</span>}
          {c.contactPhone && <>
            {' · '}
            <a className="mono" href={`tel:${c.contactPhone}`} dir="ltr">{c.contactPhone}</a>
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

      <ClientActions client={c} guess={newest?.verticalGuess ?? null} />

      <p className="lab" style={{ margin: '30px 0 10px' }}>How far it got</p>
      <Timeline client={c} sheet={newest} deal={deal} />

      {c.notes && c.notes.length > 0 && (
        <>
          <p className="lab" style={{ margin: '30px 0 10px' }}>Notes</p>
          <div className="panel">
            {[...c.notes].reverse().map((n, i) => (
              <p key={`${n.at}-${i}`} className="noteline" dir="auto">
                <span className="muted mono">{n.at.slice(0, 10)} · {n.by}</span><br />
                {n.text}
              </p>
            ))}
          </div>
        </>
      )}

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
              <tr>
                <th>Read</th><th>Posts</th><th>Their site</th><th>Findings</th>
                <th>Cast</th><th>Chosen</th><th>Status</th><th />
              </tr>
            </thead>
            <tbody>
              {sheets.map(({ token, sheet }) => (
                <tr key={token}>
                  <td className="muted" data-l="Read">{sheet?.createdAt?.slice(0, 10) ?? <span className="mono">{token}</span>}</td>
                  <td className="mono" data-l="Posts">{sheet?.signals?.posts ?? '—'}</td>
                  <td className="muted" data-l="Their site">
                    {sheet?.webState ? WEB_STATE[sheet.webState.state] ?? sheet.webState.state : '—'}
                  </td>
                  <td className="mono" data-l="Findings">{sheet?.findings?.findings?.length ?? '—'}</td>
                  <td className="muted" data-l="Cast">
                    {sheet?.rosterState
                      ? <span style={{ color: sheet.rosterState === 'real' ? undefined : 'var(--warn)' }}>
                          {ROSTER_STATE[sheet.rosterState] ?? sheet.rosterState}
                        </span>
                      : '—'}
                  </td>
                  <td className="mono" data-l="Chosen">{sheet ? `${sheet.chosen?.length ?? 0}/3` : '—'}</td>
                  <td data-l="Status">
                    {sheet
                      ? <span className="pill" data-s={sheet.dealId ? 'won' : sheet.status === 'approved' ? 'ready' : 'draft'}>
                          {sheet.dealId ? 'won' : sheet.status}
                        </span>
                      : <span className="pill" data-s="warn">missing</span>}
                  </td>
                  <td style={{ textAlign: 'right' }} data-l="">
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

      {/* What the engine could not do, said where only an operator reads it. */}
      {newest?.findings?.operatorNotes && newest.findings.operatorNotes.length > 0 && (
        <>
          <p className="lab" style={{ margin: '24px 0 10px' }}>
            What the read could not do
          </p>
          <div className="panel">
            {newest.findings.operatorNotes.map((n) => (
              <p key={n.id} className="hint" style={{ margin: '0 0 6px' }}>{n.en}</p>
            ))}
          </div>
        </>
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
