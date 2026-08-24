import StudioView from '@/components/StudioView';
import type { Lang } from '@/lib/i18n';
export async function generateMetadata({ params }: { params: Promise<{ lang: Lang }> }) {
  const { lang } = await params;
  return { title: lang === 'ar' ? 'الاستوديو' : 'Studio' };
}
export default async function P({ params }: { params: Promise<{ lang: Lang }> }) {
  const { lang } = await params;
  return <StudioView lang={lang} />;
}
