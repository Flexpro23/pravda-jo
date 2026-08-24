import PricingView from '@/components/PricingView';
import type { Lang } from '@/lib/i18n';
export async function generateMetadata({ params }: { params: Promise<{ lang: Lang }> }) {
  const { lang } = await params;
  return { title: lang === 'ar' ? 'الأسعار' : 'Pricing' };
}
export default async function P({ params }: { params: Promise<{ lang: Lang }> }) {
  const { lang } = await params;
  return <PricingView lang={lang} />;
}
