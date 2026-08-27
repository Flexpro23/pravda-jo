import PieceView from '@/components/PieceView';
import { getWork, getPiece } from '@/lib/store/content';
import type { Lang } from '@/lib/i18n';

/* The archive and roster are read from Firestore, so these cannot be baked at
   build time and left there — a record edited in the database would not appear
   until the next deploy, which is the whole thing the move to a store was for.
   Still prerendered, just refreshed: fast for readers, current within minutes. */
export const revalidate = 300;


export async function generateStaticParams() {
  // Falls back to the seed when the build cannot reach Firestore, so a build
  // never fails on the store. Anything added later renders on demand.
  const work = await getWork();
  return (['ar', 'en'] as const).flatMap((lang) => work.map((w) => ({ lang, slug: w.slug })));
}
export async function generateMetadata({ params }: { params: Promise<{ lang: Lang; slug: string }> }) {
  const { lang, slug } = await params;
  return { title: (await getPiece(slug))?.idea[lang] ?? '' };
}
export default async function P({ params }: { params: Promise<{ lang: Lang; slug: string }> }) {
  const { lang, slug } = await params;
  return <PieceView lang={lang} slug={slug} />;
}
