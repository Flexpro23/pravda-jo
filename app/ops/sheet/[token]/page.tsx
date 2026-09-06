import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSheet } from '@/lib/store/sheets';
import { listTalent } from '@/lib/store/deals';
import { clientForSheet } from '@/lib/store/clients';
import SheetReview from '@/components/ops/SheetReview';
import OpsNav from '@/components/ops/OpsNav';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function SheetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const sheet = await getSheet(token);
  if (!sheet) notFound();
  const [roster, client] = await Promise.all([
    listTalent().catch(() => []),
    clientForSheet(token).catch(() => null),
  ]);

  return (
    <main className="wrap">
      <OpsNav here="today" />
      <div className="top" style={{ marginTop: 0, marginBottom: 14 }}>
        <h1 dir="auto">{sheet.clientName}</h1>
        <span className="sp" />
        {client && <Link className="btn" href={`/ops/clients/${client.id}`}>The account →</Link>}
      </div>
      <p className="muted" style={{ marginBottom: 22 }}>
        Read {sheet.signals.posts} posts{sheet.site ? ' and their website' : ''} ·{' '}
        {sheet.findings.findings.length} findings · five ideas selected from the library
        {client?.contactPhone
          ? <> · <span className="mono" dir="ltr">{client.contactPhone}</span></>
          : <> · <span style={{ color: 'var(--warn)' }}>no number on the account</span></>}
      </p>
      <SheetReview sheet={sheet} roster={roster} />
    </main>
  );
}
