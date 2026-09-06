import SheetView from '@/components/SheetView';
import { SPECIMEN_SHEET } from '@/lib/data/specimenSheet';

/**
 * The proof a stranger reads before they hand over anything.
 *
 * The same component, the same stylesheet and the same DOM as `/s/<token>`,
 * fed a checked-in sheet — so nobody is shown one product and sent another.
 * No store, no engine, no beacon: there is no record here to stamp.
 */
export default async function SpecimenPage(
  { params }: { params: Promise<{ lang: string }> },
) {
  const { lang } = await params;
  return <SheetView sheet={SPECIMEN_SHEET} ar={lang === 'ar'} specimen />;
}
