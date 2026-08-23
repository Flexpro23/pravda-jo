import PieceView from '@/components/PieceView';
import { WORK, byslug } from '@/lib/data/work';
import type { Lang } from '@/lib/i18n';

export function generateStaticParams() {
  return (['ar', 'en'] as const).flatMap((lang) => WORK.map((w) => ({ lang, slug: w.slug })));
}
export async function generateMetadata({ params }: { params: Promise<{ lang: Lang; slug: string }> }) {
  const { lang, slug } = await params;
  return { title: byslug(slug)?.idea[lang] ?? '' };
}
export default async function P({ params }: { params: Promise<{ lang: Lang; slug: string }> }) {
  const { lang, slug } = await params;
  return <PieceView lang={lang} slug={slug} />;
}
