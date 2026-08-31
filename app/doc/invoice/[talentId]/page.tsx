import { notFound } from 'next/navigation';
import { getTalent, bookingsForTalent } from '@/lib/store/deals';
import { currentTalent } from '@/lib/talent/auth';
import { opsAuthed } from '@/lib/ops/auth';
import { CO } from '@/lib/data/company';
import { SAMPLE_TALENT, SAMPLE_BOOKINGS } from '@/lib/data/specimens';
import PrintBar from '@/components/doc/PrintBar';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const AR_MONTHS = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران',
  'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'];
const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const arNum = (s: string | number) =>
  String(s).replace(/(?<=\d),(?=\d)/g, '٬').replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[+d]);
const money = (n: number, ar: boolean) =>
  ar ? arNum(n.toLocaleString('en-US')) : n.toLocaleString('en-US');
/**
 * Arabic counts in five shapes, not two. One is the noun alone, two has its own
 * dual form, three to ten takes the plural, and eleven up returns to an
 * accusative singular. "١ يوم" is none of them.
 */
const days = (n: number, ar: boolean) => {
  if (!ar) return `${n} day${n === 1 ? '' : 's'}`;
  if (n === 1) return 'يوم واحد';
  if (n === 2) return 'يومين';
  if (n <= 10) return `${arNum(n)} أيام`;
  return `${arNum(n)} يومًا`;
};

const dayOf = (iso: string, ar: boolean) => {
  const d = new Date(`${iso}T00:00:00`);
  return ar
    ? `${arNum(d.getDate())} ${AR_MONTHS[d.getMonth()]}`
    : `${d.getDate()} ${EN_MONTHS[d.getMonth()]}`;
};

/**
 * What a provider is owed for a month, and what they were paid.
 *
 * Two people may open this: the provider themselves, and an operator. Nobody
 * else — this is one person's earnings, so the check is an identity match or a
 * console session, never the unguessable-link trust the proposal uses. A link
 * that leaks must not become a window onto what a colleague makes.
 *
 * Their own fees only. A Booking has no field for what the client paid, so
 * there is no figure on this page that could reveal the spread even by mistake.
 */
export default async function InvoiceDoc({
  params, searchParams,
}: {
  params: Promise<{ talentId: string }>;
  searchParams: Promise<{ lang?: string; m?: string }>;
}) {
  const { talentId } = await params;
  const { lang, m } = await searchParams;
  const ar = lang !== 'en';

  // A specimen anyone may read: it names nobody real and holds nobody's
  // earnings, so it carries none of the trust the real statement does.
  const specimen = talentId === 'sample';

  if (!specimen) {
    const [me, operator] = await Promise.all([currentTalent(), opsAuthed()]);
    if (!operator && me?.id !== talentId) notFound();
  }

  const talent = specimen ? SAMPLE_TALENT : await getTalent(talentId);
  if (!talent) notFound();

  // Default to the month just gone, which is when anyone actually invoices.
  const now = new Date();
  const month = /^\d{4}-\d{2}$/.test(m ?? '')
    ? (m as string)
    : specimen ? '2026-08'
      : `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

  const all = specimen ? SAMPLE_BOOKINGS : await bookingsForTalent(talentId).catch(() => []);
  // Only work that actually happened. An offered or declined day is not owed.
  const rows = all
    .filter((b) => b.date.startsWith(month) && (b.status === 'done' || b.status === 'paid'))
    .sort((a, b) => a.date.localeCompare(b.date));

  const total = rows.reduce((a, b) => a + b.feeJOD, 0);
  const paid = rows.filter((b) => b.status === 'paid').reduce((a, b) => a + b.feeJOD, 0);
  const due = total - paid;
  const [y, mo] = month.split('-').map(Number);
  const monthName = ar ? `${AR_MONTHS[mo - 1]} ${arNum(y)}` : `${EN_MONTHS[mo - 1]} ${y}`;

  return (
    <>
      <PrintBar
        label={ar ? 'احفظ PDF' : 'Save as PDF'}
        hint={ar ? 'اختار «حفظ كـ PDF» من نافذة الطباعة.' : 'Choose “Save as PDF” in the print dialogue.'}
        otherLang={ar ? 'English' : 'عربي'}
        otherHref={`?lang=${ar ? 'en' : 'ar'}&m=${month}`}
      />

      <div className="sheet">
        {specimen && (
          <p className="stamp">
            {ar ? 'نموذج — أرقام توضيحية.' : 'Specimen — illustrative figures.'}
          </p>
        )}
        <div className="head">
          <div>
            <p className="mark">PRAVDA</p>
            <span className="u">{ar ? 'كشف مستحقات' : 'Statement of work'}</span>
          </div>
          <div className="entity">
            <span>{CO.legalName[ar ? 'ar' : 'en']}</span>
            {CO.cr && <span>{ar ? 'س.ت' : 'CR'} <span className="num">{CO.cr}</span></span>}
            <span>{CO.district[ar ? 'ar' : 'en']}، {CO.city[ar ? 'ar' : 'en']}</span>
            <span className="num">{CO.phoneDisplay}</span>
          </div>
        </div>

        <div className="title">
          <h1>{monthName}</h1>
          <span className="ref num">
            PRV-{talentId.toUpperCase()}-{month.replace('-', '')}
          </span>
        </div>
        <p className="to">
          {ar ? 'إلى' : 'For'} <b>{talent.name[ar ? 'ar' : 'en']}</b> ·{' '}
          {ar ? 'أيام تصوير' : 'shooting days'}
        </p>

        {rows.length === 0 ? (
          <p className="note" style={{ marginTop: 0, borderTop: 'none' }}>
            {ar
              ? 'ما في أيام منتهية بهالشهر.'
              : 'No completed days in this month.'}
          </p>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th>{ar ? 'اليوم' : 'Day'}</th>
                  <th className="r">{ar ? 'الأجرة' : 'Fee'}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <span className="what num">{dayOf(b.date, ar)}</span>
                      <span className="sub">
                        {b.brief || (ar ? 'يوم تصوير' : 'Shooting day')}
                        {b.status === 'paid' ? ` · ${ar ? 'مدفوع' : 'paid'}` : ''}
                      </span>
                    </td>
                    <td className="amt r">{money(b.feeJOD, ar)} {ar ? 'دينار' : 'JOD'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="totals">
              <div className="tot">
                <span className="lab">{days(rows.length, ar)}</span>
                <span className="val">{money(total, ar)} {ar ? 'دينار' : 'JOD'}</span>
              </div>
              {paid > 0 && (
                <div className="tot">
                  <span className="lab">{ar ? 'مدفوع' : 'Already paid'}</span>
                  <span className="val">−{money(paid, ar)} {ar ? 'دينار' : 'JOD'}</span>
                </div>
              )}
              <div className="tot big">
                <span className="lab">{ar ? 'المستحق' : 'Due'}</span>
                <span className="val">{money(due, ar)} {ar ? 'دينار' : 'JOD'}</span>
              </div>
            </div>
          </>
        )}

        <div className="note">
          <p>
            {ar
              ? 'هاد كشف بالأيام اللي اشتغلتها والمستحق عليها. مش فاتورة ضريبية — المعاملة الضريبية مسؤولية المتعاقد.'
              : 'This is a record of days worked and what is owed for them. It is not a tax invoice — tax treatment is the contractor’s own responsibility.'}
          </p>
          <p>
            {ar
              ? 'لو في يوم ناقص أو رقم غلط، احكي مع برافدا قبل ما تصدر فاتورتك.'
              : 'If a day is missing or a figure looks wrong, raise it with PRAVDA before issuing your own invoice.'}
          </p>
        </div>
      </div>
    </>
  );
}
