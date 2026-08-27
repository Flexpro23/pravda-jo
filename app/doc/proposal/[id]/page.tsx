import { notFound } from 'next/navigation';
import { getDeal } from '@/lib/store/deals';
import { getSheet } from '@/lib/store/sheets';
import { SAMPLE_DEAL } from '@/lib/data/specimens';
import type { Deal } from '@/lib/data/deals';
import { VIDEO_JOD } from '@/lib/data/deals';
import { CO } from '@/lib/data/company';
import PrintBar from '@/components/doc/PrintBar';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const AR_MONTHS = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران',
  'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'];
const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const arNum = (s: string | number) => String(s)
  .replace(/(?<=\d)\.(?=\d)/g, '٫').replace(/(?<=\d),(?=\d)/g, '٬')
  .replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[+d]);

const fmtDate = (iso: string, ar: boolean) => {
  const d = new Date(iso);
  const day = d.getUTCDate(), m = d.getUTCMonth(), y = d.getUTCFullYear();
  return ar ? `${arNum(day)} ${AR_MONTHS[m]} ${arNum(y)}` : `${day} ${EN_MONTHS[m]} ${y}`;
};
const money = (n: number, ar: boolean) =>
  ar ? arNum(n.toLocaleString('en-US')) : n.toLocaleString('en-US');

/**
 * The proposal a client keeps.
 *
 * Reachable by whoever holds the link — the deal id is 12 random bytes, the
 * same trust the teardown runs on, and the person it is addressed to is the
 * person who asked for it.
 *
 * Client prices only. There is no crew figure anywhere on this page and no
 * route by which one could arrive: a Deal holds what the client pays, and what
 * the crew is paid lives on Bookings, which nothing here reads.
 */
export default async function ProposalDoc({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { id } = await params;
  const { lang } = await searchParams;
  const ar = lang !== 'en';
  // Served from code, so it works before any deal exists and cannot be edited
  // by whatever can write to the collection.
  const specimen = id === 'sample';
  // A sheet Khaled approved becomes a proposal without being copied into a
  // deal first: the offer he composed IS the proposal, so re-entering it would
  // only be a chance for the two to disagree.
  const fromSheet = id.startsWith('sheet-') ? await getSheet(id.slice(6)).catch(() => null) : null;
  const deal: Deal | null = specimen ? SAMPLE_DEAL
    : fromSheet && fromSheet.offer ? {
      id: fromSheet.token,
      clientName: fromSheet.clientName,
      clientHandle: fromSheet.handle,
      concepts: fromSheet.recommendations
        .filter((r) => fromSheet.chosen.includes(r.conceptN))
        .map((r) => ({ conceptN: r.conceptN, name: r.name, priceJOD: r.priceJOD })),
      clientTotalJOD: fromSheet.offer.totalJOD,
      retainerJOD: fromSheet.offer.ads ? fromSheet.offer.adsMonthlyJOD : undefined,
      perMonth: undefined,
      status: 'proposed',
      createdAt: fromSheet.createdAt,
      updatedAt: fromSheet.updatedAt,
    }
      : await getDeal(id).catch(() => null);
  if (!deal) notFound();

  // The sheet prices by video, flat. Show that rather than a per-concept
  // breakdown the client was never quoted.
  const flat = fromSheet?.offer;

  // Letters and digits only: slicing a raw id leaves a dangling hyphen, and a
  // reference number is something a person reads aloud down a phone.
  const ref = (fromSheet?.token ?? id).replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase();

  const perMonthCost = (deal.perMonth ?? 0) * VIDEO_JOD;
  const retainer = (deal.retainerJOD ?? 0) - perMonthCost;
  const monthly = deal.retainerJOD ?? 0;
  // A quote a client can act on needs a date it stops being true.
  const issued = deal.updatedAt ?? deal.createdAt;
  const validUntil = new Date(new Date(issued).getTime() + 30 * 86_400_000).toISOString();

  return (
    <>
      <PrintBar
        label={ar ? 'احفظ PDF' : 'Save as PDF'}
        hint={ar
          ? 'اختار «حفظ كـ PDF» من نافذة الطباعة.'
          : 'Choose “Save as PDF” in the print dialogue.'}
        otherLang={ar ? 'English' : 'عربي'}
        otherHref={`?lang=${ar ? 'en' : 'ar'}`}
      />

      <div className="sheet">
        {specimen && (
          <p className="stamp">
            {ar
              ? 'نموذج — أرقام توضيحية وزبون غير حقيقي. مش عرض سعر.'
              : 'Specimen — illustrative figures, fictional client. Not a quotation.'}
          </p>
        )}
        <div className="head">
          <div>
            <p className="mark">PRAVDA</p>
            <span className="u">{ar ? 'إنتاج بصري وإعلانات' : 'Production & advertising'}</span>
          </div>
          <div className="entity">
            <span>{CO.legalName[ar ? 'ar' : 'en']}</span>
            <span>{ar ? 'س.ت' : 'CR'} <span className="num">{CO.cr}</span></span>
            <span>{CO.street[ar ? 'ar' : 'en']}، {CO.district[ar ? 'ar' : 'en']}</span>
            <span>{CO.city[ar ? 'ar' : 'en']}، {CO.country[ar ? 'ar' : 'en']}</span>
            <span className="num">{CO.phoneDisplay}</span>
            <span>{CO.email}</span>
          </div>
        </div>

        <div className="title">
          <h1>{ar ? 'عرض سعر' : 'Proposal'}</h1>
          {/* Two runs, isolated separately. Put a Latin reference and an
              Arabic date inside one LTR isolate and bidi lays the date out
              backwards — ٢٧ آب ٢٠٢٦ arrives as ٢٠٢٦ آب ٢٧ on a document a
              client keeps. */}
          <span className="ref">
            <span className="num">PRV-{ref}</span>
            {' · '}
            <span>{fmtDate(issued, ar)}</span>
          </span>
        </div>
        <p className="to">
          {ar ? 'إلى' : 'For'} <b>{deal.clientName}</b>
          {deal.contactName ? <> · {deal.contactName}</> : null}
        </p>

        <table>
          <thead>
            <tr>
              <th>{ar ? 'البند' : 'Item'}</th>
              <th className="r">{ar ? 'السعر' : 'Amount'}</th>
            </tr>
          </thead>
          <tbody>
            {flat ? (
              <tr>
                <td>
                  <span className="what">
                    {ar ? `${arNum(flat.videos)} مقاطع فيديو` : `${flat.videos} videos`}
                  </span>
                  <span className="sub">
                    {ar
                      ? `${arNum(flat.pricePerVideo)} دينار للمقطع · التصوير والمونتاج والطاقم والتسويق`
                      : `${flat.pricePerVideo} JOD each · shoot, edit, cast and marketing`}
                  </span>
                  <span className="sub">
                    {deal.concepts.map((c) => c.name).join(' · ')}
                  </span>
                </td>
                <td className="amt r">{money(flat.totalJOD, ar)} {ar ? 'دينار' : 'JOD'}</td>
              </tr>
            ) : deal.concepts.map((c, i) => (
              <tr key={i}>
                <td>
                  <span className="what">{c.name}</span>
                  <span className="sub">{ar ? 'إنتاج، مرة وحدة' : 'Production, one-off'}</span>
                </td>
                <td className="amt r">{money(c.priceJOD, ar)} {ar ? 'دينار' : 'JOD'}</td>
              </tr>
            ))}
            {deal.perMonth ? (
              <tr>
                <td>
                  <span className="what">
                    {ar
                      ? `${arNum(deal.perMonth)} فيديو بالشهر`
                      : `${deal.perMonth} videos a month`}
                  </span>
                  <span className="sub">
                    {ar
                      ? `${arNum(VIDEO_JOD)} دينار للفيديو · اشتراك شهري`
                      : `${VIDEO_JOD} JOD per video · monthly`}
                  </span>
                </td>
                <td className="amt r">
                  {money(perMonthCost, ar)} {ar ? 'دينار/شهر' : 'JOD/mo'}
                </td>
              </tr>
            ) : null}
            {retainer > 0 ? (
              <tr>
                <td>
                  <span className="what">{ar ? 'إدارة الإعلانات' : 'Advertising management'}</span>
                  <span className="sub">
                    {ar ? 'تشغيل ومتابعة حملات ميتا' : 'Running and managing Meta campaigns'}
                  </span>
                </td>
                <td className="amt r">{money(retainer, ar)} {ar ? 'دينار/شهر' : 'JOD/mo'}</td>
              </tr>
            ) : null}
          </tbody>
        </table>

        <div className="totals">
          {deal.clientTotalJOD > 0 && (
            <div className="tot big">
              <span className="lab">{ar ? 'المجموع، مرة وحدة' : 'Total, one-off'}</span>
              <span className="val">{money(deal.clientTotalJOD, ar)} {ar ? 'دينار' : 'JOD'}</span>
            </div>
          )}
          {monthly > 0 && (
            <div className="tot big">
              <span className="lab">{ar ? 'شهريًا' : 'Per month'}</span>
              <span className="val">{money(monthly, ar)} {ar ? 'دينار' : 'JOD'}</span>
            </div>
          )}
        </div>

        <div className="note">
          <p>
            <b>{ar ? 'صالح لحد' : 'Valid until'}</b>{' '}
            {fmtDate(validUntil, ar)}.{' '}
            {ar
              ? 'الأسعار مكتوبة ومنشورة، وما بتتغيّر حسب الزبون.'
              : 'Prices are published and do not vary by client.'}
          </p>
          <p>
            {ar
              ? 'المواقع والسيارات والإكسسوارات، لو احتاجها العمل، منأمّنها إحنا وبتتحسب لحالها.'
              : 'Locations, vehicles and props, where a piece needs them, are sourced by us and billed separately.'}
          </p>
          <p>
            {ar
              ? 'هاد عرض سعر مش عقد. ما في إشي بيبدا قبل ما توافقوا خطيًا.'
              : 'This is a quotation, not a contract. Nothing begins until you agree in writing.'}
          </p>
        </div>

        <div className="sign">
          <div><span className="u">{ar ? 'عن برافدا' : 'For PRAVDA'}</span></div>
          <div><span className="u">{ar ? 'الموافقة والتاريخ' : 'Accepted, and date'}</span></div>
        </div>
      </div>
    </>
  );
}
