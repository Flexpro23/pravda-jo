import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { getShared } from '@/lib/store/sheets';
import SheetView from '@/components/SheetView';
import Opened from '@/components/s/Opened';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The client's address for a sheet.
 *
 * Fetch, resolve the language, render. Everything the reader actually sees is
 * `components/SheetView.tsx`, which the public specimen renders too — so what a
 * stranger is shown as proof is the same artefact, from the same code, as the
 * thing a prospect receives.
 */
export default async function SharedSheet({
  params, searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { token } = await params;
  const { lang } = await searchParams;
  // The query string wins, because a link somebody was sent in English must
  // open in English on any device. The cookie only answers a bare URL — a
  // reader who switched once and then tapped the original link again.
  const cookieLang = (await cookies()).get('pravda_lang')?.value;
  const ar = lang === 'en' ? false : lang === 'ar' ? true : cookieLang !== 'en';

  // Only ever resolves an approved sheet; a draft has no address here at all.
  const sheet = await getShared(token);
  if (!sheet) notFound();

  return (
    <>
      <SheetView sheet={sheet} ar={ar} shareToken={token} />
      <Opened token={token} />
    </>
  );
}
