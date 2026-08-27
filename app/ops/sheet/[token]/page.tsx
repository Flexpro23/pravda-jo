import Link from 'next/link';
import { notFound } from 'next/navigation';
import { opsAuthed } from '@/lib/ops/auth';
import { getSheet } from '@/lib/store/sheets';
import { listTalent } from '@/lib/store/deals';
import SheetReview from '@/components/ops/SheetReview';
import OpsNav from '@/components/ops/OpsNav';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function SheetPage({ params }: { params: Promise<{ token: string }> }) {
  if (!(await opsAuthed())) {
    return <main className="gate"><h1>PRAVDA — operator</h1><p><Link className="btn" href="/ops">Sign in</Link></p></main>;
  }
  const { token } = await params;
  const sheet = await getSheet(token);
  if (!sheet) notFound();
  const roster = await listTalent().catch(() => []);

  return (
    <main className="wrap">
      <OpsNav here="queue" />
      <h2 style={{ margin: '0 0 6px', fontWeight: 500, fontSize: 21 }}>{sheet.clientName}</h2>
      <p className="muted" style={{ marginBottom: 22 }}>
        Read {sheet.signals.posts} posts{sheet.site ? ' and their website' : ''} ·{' '}
        {sheet.findings.findings.length} findings · five ideas selected from the library
      </p>
      <SheetReview sheet={sheet} roster={roster} />
    </main>
  );
}
