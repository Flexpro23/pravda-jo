import Link from 'next/link';
import { notFound } from 'next/navigation';
import { opsAuthed } from '@/lib/ops/auth';
import { getDeal, bookingsForDeal, listTalent } from '@/lib/store/deals';
import { getSheet } from '@/lib/store/sheets';
import { castPlan } from '@/lib/store/convert';
import DealDetail from '@/components/ops/DealDetail';
import OpsNav from '@/components/ops/OpsNav';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await opsAuthed())) {
    return <main className="gate"><h1>PRAVDA — operator</h1><p><Link className="btn" href="/ops">Sign in</Link></p></main>;
  }
  const { id } = await params;
  const deal = await getDeal(id);
  if (!deal) notFound();
  const [bookings, talent] = await Promise.all([bookingsForDeal(id), listTalent()]);

  // The casting is read back off the sheet rather than copied onto the deal.
  // One record holds it, so an override Khaled makes on the sheet after winning
  // it is the one this page shows.
  const sheet = deal.sheetToken ? await getSheet(deal.sheetToken).catch(() => null) : null;
  const plan = sheet ? castPlan(sheet) : [];

  return (
    <main className="wrap">
      <OpsNav here="deals" />
      <h2 style={{ margin: '0 0 20px', fontWeight: 500, fontSize: 20 }}>{deal.clientName}</h2>
      <DealDetail deal={deal} bookings={bookings} talent={talent} plan={plan} />
    </main>
  );
}
