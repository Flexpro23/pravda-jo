import Link from 'next/link';
import { opsAuthed } from '@/lib/ops/auth';
import { listTalent } from '@/lib/store/deals';
import type { Talent } from '@/lib/data/deals';
import TalentManager from '@/components/ops/TalentManager';
import OpsNav from '@/components/ops/OpsNav';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function TalentPage() {
  if (!(await opsAuthed())) {
    return (
      <main className="gate">
        <h1>PRAVDA — operator</h1>
        <p><Link className="btn" href="/ops">Sign in</Link></p>
      </main>
    );
  }
  let talent: Talent[] = [];
  try { talent = await listTalent(); } catch { /* an unreachable store shows an empty roster, not a crash */ }

  return (
    <main className="wrap">
      <OpsNav here="talent" />
      <p className="muted" style={{ marginBottom: 22 }}>
        Day rates are what PRAVDA pays. They never appear on anything a client
        sees, and the client&rsquo;s price never appears on anything a provider
        sees — the two numbers live in different collections so that no screen
        can accidentally put them together.
      </p>
      <TalentManager talent={talent} />
    </main>
  );
}
