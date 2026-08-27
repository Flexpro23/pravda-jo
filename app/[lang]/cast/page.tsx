import CastView from '@/components/CastView';
import type { Lang } from '@/lib/i18n';

/* The archive and roster are read from Firestore, so these cannot be baked at
   build time and left there — a record edited in the database would not appear
   until the next deploy, which is the whole thing the move to a store was for.
   Still prerendered, just refreshed: fast for readers, current within minutes. */
export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ lang: Lang }> }) {
  const { lang } = await params;
  return { title: lang === 'ar' ? 'الوجوه والطاقم' : 'Cast & crew' };
}
export default async function P({ params }: { params: Promise<{ lang: Lang }> }) {
  const { lang } = await params;
  return <CastView lang={lang} />;
}
