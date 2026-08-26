import { notFound } from 'next/navigation';
import ReportView from '@/components/ReportView';
import { getTeardown } from '@/lib/store/teardowns';
import './report.css';

export const metadata = {
  title: 'PRAVDA',
  // a teardown is written for one recipient and must never surface in search
  robots: { index: false, follow: false, nocache: true },
};



export default async function P({
  params, searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { token } = await params;
  const { lang: q } = await searchParams;
  const r = await getTeardown(token);
  if (!r) notFound();
  const lang = q === 'en' ? 'en' : 'ar';
  return <ReportView r={r} lang={lang} specimen={r.token === 'sample'} />;
}
