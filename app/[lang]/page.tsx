import Home from '@/components/Home';
import type { Lang } from '@/lib/i18n';
export default async function P({ params }: { params: Promise<{ lang: Lang }> }) {
  const { lang } = await params;
  return <Home lang={lang} />;
}
