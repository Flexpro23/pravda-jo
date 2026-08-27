import { currentTalent } from '@/lib/talent/auth';
import { bookingsForTalent } from '@/lib/store/deals';
import type { Booking } from '@/lib/data/deals';
import Portal from '@/components/t/Portal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function TalentPortal({
  searchParams,
}: { searchParams: Promise<{ bad?: string }> }) {
  const { bad } = await searchParams;
  const me = await currentTalent();

  if (!me) {
    return (
      <main className="gate">
        <h1>PRAVDA</h1>
        <form method="post" action="/api/t/login">
          <input
            name="code" inputMode="numeric" autoComplete="one-time-code"
            maxLength={6} placeholder="······" aria-label="رمز الدخول" autoFocus
          />
          <button className="go" type="submit">دخول</button>
          {bad && <p className="note" data-k="err">الرمز مش صحيح.</p>}
        </form>
        <p className="u" style={{ marginTop: 20, lineHeight: 1.8 }}>
          الرمز بيوصلك من برافدا
        </p>
      </main>
    );
  }

  // The only query this surface ever runs, scoped to the signed-in provider at
  // the query itself rather than filtered afterwards.
  let bookings: Booking[] = [];
  try { bookings = await bookingsForTalent(me.id); } catch { /* an unreachable store shows no days, not a crash */ }

  return <Portal me={me} bookings={bookings} />;
}
