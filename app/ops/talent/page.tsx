import { listTalent, listOpenBookings } from '@/lib/store/deals';
import type { Booking, Talent } from '@/lib/data/deals';
import TalentManager, { type TalentWork } from '@/components/ops/TalentManager';
import OpsNav from '@/components/ops/OpsNav';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function TalentPage() {
  let talent: Talent[] = [];
  let open: Booking[] = [];
  let broke = false;
  try {
    // One query for every open day on the books, grouped in memory. A
    // `bookingsForTalent` per person would be an N+1 that grows with the
    // roster, on a page whose whole job is to show the roster.
    [talent, open] = await Promise.all([listTalent(), listOpenBookings(300)]);
  } catch {
    // This used to catch and show nothing — an empty roster reads as
    // "nobody has joined", which is a different fact from "the store cannot
    // be reached" and the operator has no way to tell them apart.
    broke = true;
  }

  const work: Record<string, TalentWork> = {};
  for (const b of open) {
    const w = work[b.talentId] ??= { booked: 0, done: 0, owedJOD: 0 };
    if (b.status === 'done') { w.done += 1; w.owedJOD += b.feeJOD; } else { w.booked += 1; }
    if (b.status !== 'done' && (!w.next || b.date < w.next)) w.next = b.date;
  }

  return (
    <main className="wrap">
      <OpsNav here="talent" />
      {broke ? (
        <p className="note" data-k="err">
          Could not reach Firestore. The console is up; the store is not.
        </p>
      ) : (
        <>
          <p className="muted" style={{ marginBottom: 22 }}>
            Day rates are what PRAVDA pays. They never appear on anything a client
            sees, and the client&rsquo;s price never appears on anything a provider
            sees — the two numbers live in different collections so that no screen
            can accidentally put them together. Owed totals below count days shot and
            not yet paid; a day already paid leaves this page and lives on the
            invoice.
          </p>
          <TalentManager talent={talent} work={work} />
        </>
      )}
    </main>
  );
}
