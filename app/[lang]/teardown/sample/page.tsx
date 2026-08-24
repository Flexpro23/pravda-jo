import ReportView from '@/components/ReportView';
import { SPECIMEN } from '@/lib/data/report';
import type { Lang } from '@/lib/i18n';

export async function generateMetadata({ params }: { params: Promise<{ lang: Lang }> }) {
  const { lang } = await params;
  return {
    title: lang === 'ar' ? 'نموذج تحقيق' : 'A specimen teardown',
    description: lang === 'ar'
      ? 'شوف شكل التحقيق كامل قبل ما تبعتلنا حسابك.'
      : 'Read a complete teardown before you send us anything.',
  };
}

export default async function P({ params }: { params: Promise<{ lang: Lang }> }) {
  const { lang } = await params;
  return <ReportView r={SPECIMEN} lang={lang} specimen />;
}
