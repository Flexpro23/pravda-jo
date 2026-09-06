import { listSheets } from '@/lib/store/sheets';
import { listClients } from '@/lib/store/clients';
import { listDeals, listOpenBookings, listTalent } from '@/lib/store/deals';
import { configReport } from '@/lib/config/check';
import { buildToday } from '@/lib/ops/today';
import type { Talent } from '@/lib/data/deals';
import RunHandle from '@/components/ops/RunHandle';
import OpsNav from '@/components/ops/OpsNav';
import TodayList from '@/components/ops/TodayList';
import ConfigPanel from '@/components/ops/ConfigPanel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * What to do next.
 *
 * This page used to lead with the long-form teardown queue — the one pipeline
 * nothing feeds any more — while the live work was scattered across a badge on
 * one tab and a table on another. Now it answers the only question either
 * operator asks: five queries, one ordered list, and an inline action on every
 * card that has one.
 */
export default async function Ops() {
  // Five reads, fixed, whatever the volume. An unreachable store is said
  // plainly rather than crashing the console — the operator can still tell the
  // difference between "nothing to do" and "nothing can be read".
  let broke = false;
  const fail = <T,>(v: T) => (e: unknown) => { void e; broke = true; return v; };

  const [clients, sheets, deals, bookings, roster] = await Promise.all([
    listClients(200).catch(fail([])),
    listSheets(60).catch(fail([])),
    listDeals(100).catch(fail([])),
    listOpenBookings(200).catch(fail([])),
    listTalent().catch(fail([] as Talent[])),
  ]);

  const talentById = Object.fromEntries(roster.map((t) => [t.id, t]));
  const tasks = buildToday({ clients, sheets, deals, bookings, talentById });

  return (
    <main className="wrap">
      <OpsNav here="today" waiting={tasks.length} />

      {broke && (
        <p className="note" data-k="err" style={{ marginBottom: 18 }}>
          Part of the store could not be read, so this list is incomplete. What
          is below is real; what is missing is unknown.
        </p>
      )}

      <RunHandle />

      <p className="lab" style={{ margin: '0 0 12px' }}>
        {tasks.length === 0
          ? 'Nothing owed'
          : `${tasks.length} thing${tasks.length === 1 ? '' : 's'} owed`}
      </p>
      <TodayList tasks={tasks} />

      <div style={{ marginTop: 34 }}>
        <ConfigPanel rows={configReport()} />
      </div>
    </main>
  );
}
