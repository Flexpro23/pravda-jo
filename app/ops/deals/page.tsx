import Link from 'next/link';
import { opsAuthed } from '@/lib/ops/auth';
import { listDeals, bookingsForDeal } from '@/lib/store/deals';
import { listTeardowns } from '@/lib/store/teardowns';
import { DEAL_LABEL, type Deal } from '@/lib/data/deals';
import NewDeal from '@/components/ops/DealList';
import OpsNav from '@/components/ops/OpsNav';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function DealsPage() {
  if (!(await opsAuthed())) {
    return <main className="gate"><h1>PRAVDA — operator</h1><p><Link className="btn" href="/ops">Sign in</Link></p></main>;
  }

  let deals: Deal[] = [];
  let tokens: { token: string; handle: string; client: string }[] = [];
  try {
    deals = await listDeals();
    tokens = (await listTeardowns(50))
      .filter((t) => t.status !== 'draft')
      .map((t) => ({ token: t.token, handle: t.handle, client: t.report?.client?.en ?? t.handle }));
  } catch { /* an unreachable store shows an empty pipeline, not a crash */ }

  const crew = await Promise.all(deals.map(async (d) => {
    try { return (await bookingsForDeal(d.id)).reduce((a, b) => a + b.feeJOD, 0); }
    catch { return 0; }
  }));

  const open = deals.filter((d) => !['lost', 'delivered'].includes(d.status));
  const pipeline = open.reduce((a, d) => a + d.clientTotalJOD, 0);

  return (
    <main className="wrap">
      <OpsNav here="deals" />
      <p className="muted" style={{ marginBottom: 18 }}>
        {open.length} open · {pipeline} JOD in the pipeline
      </p>
      <NewDeal tokens={tokens} />

      {deals.length === 0 ? (
        <p className="muted">
          No deals yet. One starts when a teardown gets a reply.
        </p>
      ) : (
        <div className="scroll-x">
        <table>
          <thead>
            <tr><th>Client</th><th>Status</th><th>Client pays</th><th>Crew</th><th>Kept</th><th /></tr>
          </thead>
          <tbody>
            {deals.map((d, i) => (
              <tr key={d.id}>
                <td>{d.clientName}
                  {d.clientHandle && <span className="muted mono"> @{d.clientHandle.replace('@', '')}</span>}
                  {/* Arrived by itself, rather than being typed up afterwards. */}
                  {d.source === 'configurator' && (
                    <span className="pill" data-s="ready" style={{ marginInlineStart: 8 }}>
                      from the client
                    </span>
                  )}
                </td>
                <td><span className="pill" data-s={d.status === 'paid' ? 'ready' : d.status === 'lost' ? 'draft' : undefined}>
                  {DEAL_LABEL[d.status]}</span></td>
                <td className="mono">{d.clientTotalJOD}</td>
                <td className="mono muted">{crew[i]}</td>
                <td className="mono" style={{ color: 'var(--go)' }}>{d.clientTotalJOD - crew[i]}</td>
                <td style={{ textAlign: 'right' }}>
                  <Link className="btn" href={`/ops/deals/${d.id}`}>Open</Link>
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
