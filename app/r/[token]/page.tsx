import { notFound } from 'next/navigation';
import ReportView from '@/components/ReportView';
import { SPECIMEN } from '@/lib/data/report';
import './report.css';

export const metadata = {
  title: 'PRAVDA',
  // a teardown is written for one recipient and must never surface in search
  robots: { index: false, follow: false, nocache: true },
};

/** In production this resolves the token against the store. */
function resolve(token: string) {
  return token === 'sample' ? SPECIMEN : null;
}

export default async function P({
  params, searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { token } = await params;
  const { lang: q } = await searchParams;
  const r = resolve(token);
  if (!r) notFound();
  const lang = q === 'en' ? 'en' : 'ar';
  return <ReportView r={r} lang={lang} specimen={r.token === 'sample'} />;
}
