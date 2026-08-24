import LegalView from '@/components/LegalView';
import type { Lang } from '@/lib/i18n';
export async function generateMetadata({ params }: { params: Promise<{ lang: Lang }> }) {
  const { lang } = await params;
  return { title: lang === 'ar' ? 'إشعار المعالجة' : 'Processing notice' };
}
export default async function P({ params }: { params: Promise<{ lang: Lang }> }) {
  const { lang } = await params;
  return <LegalView lang={lang} kind="notice" />;
}
