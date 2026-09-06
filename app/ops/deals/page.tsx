import Link from 'next/link';
import { listDeals, listOpenBookings } from '@/lib/store/deals';
import { DEAL_LABEL, type Booking, type Deal } from '@/lib/data/deals';
import NewDeal from '@/components/ops/DealList';
import OpsNav from '@/components/ops/OpsNav';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function DealsPage() {
  let deals: Deal[] = [];
  let open: Booking[] = [];
  let broke = false;
  try {
    // Two queries, whatever the deal count. This used to be one
    // `bookingsForDeal` per deal inside a `Promise.all` — an N+1 against
    // Firestore on every load of a page nobody thinks of as expensive.
    [deals, open] = await Promise.all([listDeals(), listOpenBookings(300)]);
  } catch {
    // This used to catch and show nothing — an empty pipeline reads as "no
    // deals", which is a different fact from "the store cannot be reached"
    // and the operator has no way to tell them apart.
    broke = true;
  }

  const crew = new Map<string, number>();
  for (const b of open) crew.set(b.dealId, (crew.get(b.dealId) ?? 0) + b.feeJOD);

  const live = deals.filter((d) => !['lost', 'delivered'].includes(d.status));
  const pipeline = live.reduce((a, d) => a + d.clientTotalJOD, 0);

  return (
    <main className="wrap">
      <OpsNav here="deals" />

      {broke ? (
        <p className="note" data-k="err">
          Could not reach Firestore. The console is up; the store is not.
        </p>
      ) : (
        <>
          <p className="muted" style={{ marginBottom: 18 }}>
            {live.length} open · {pipeline} JOD in the pipeline
          </p>
          <NewDeal />

          {deals.length === 0 ? (
            <p className="muted">
              No deals yet. One starts when a client says yes to a sheet.
            </p>
          ) : (
            <div className="scroll-x">
            <table>
              <thead>
                <tr><th>Client</th><th>Status</th><th>Client pays</th><th>Crew</th><th>Kept</th><th /></tr>
              </thead>
              <tbody>
                {deals.map((d) => {
                  const spent = crew.get(d.id) ?? 0;
                  return (
                    <tr key={d.id}>
                      <td dir="auto" data-l="Client">{d.clientName}
                        {d.clientHandle && <span className="muted mono" dir="ltr"> @{d.clientHandle.replace('@', '')}</span>}
                        {/* Arrived by itself, rather than being typed up afterwards. */}
                        {d.source === 'configurator' && (
                          <span className="pill" data-s="ready" style={{ marginInlineStart: 8 }}>
                            from the client
                          </span>
                        )}
                      </td>
                      <td data-l="Status"><span className="pill" data-s={d.status === 'paid' ? 'ready' : d.status === 'lost' ? 'draft' : undefined}>
                        {DEAL_LABEL[d.status]}</span></td>
                      <td className="mono" data-l="Client pays">{d.clientTotalJOD}</td>
                      {/* Open days only — a delivered job's crew cost is on its
                          own page, and summing paid history here would read as
                          money still going out. */}
                      <td className="mono muted" data-l="Crew">{spent}</td>
                      <td className="mono" data-l="Kept" style={{ color: d.clientTotalJOD - spent >= 0 ? 'var(--go)' : 'var(--warn)' }}>
                        {d.clientTotalJOD - spent}
                      </td>
                      <td style={{ textAlign: 'right' }} data-l="">
                        <Link className="btn" href={`/ops/deals/${d.id}`}>Open</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}
        </>
      )}
    </main>
  );
}
