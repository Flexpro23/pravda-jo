import CastView from '@/components/CastView';
import type { Lang } from '@/lib/i18n';
export async function generateMetadata({ params }: { params: Promise<{ lang: Lang }> }) {
  const { lang } = await params;
  return { title: lang === 'ar' ? 'الوجوه والطاقم' : 'Cast & crew' };
}
export default async function P({ params }: { params: Promise<{ lang: Lang }> }) {
  const { lang } = await params;
  return <CastView lang={lang} />;
}
