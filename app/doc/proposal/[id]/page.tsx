import { notFound } from 'next/navigation';
import { getDeal } from '@/lib/store/deals';
import { getSheet, getShared } from '@/lib/store/sheets';
import { opsAuthed } from '@/lib/ops/auth';
import { SAMPLE_DEAL } from '@/lib/data/specimens';
import type { Deal } from '@/lib/data/deals';
import { VIDEO_JOD } from '@/lib/data/deals';
import { CO } from '@/lib/data/company';
import PrintBar from '@/components/doc/PrintBar';
import { arNum, num as money } from '@/lib/format/num';
import { fmtDate } from '@/lib/format/date';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
  //
  // Addressed by the SHARE token. This document is kept, forwarded to a partner
  // and printed, so its URL travels further than any other in the system — and
  // the old `sheet-<token>` grammar published the operator address for that
  // record to everyone downstream, with the ops cookie as the only thing
  // between that URL and the review console.
  const shared = id.startsWith('share-')
    ? await getShared(id.slice(6)).catch(() => null) : null;
  // The draft-preview case, and only that: a sheet that has not been approved
  // has no share token, so this is the one way Khaled can see what the client
  // will be handed before he sends it. Behind the console session, so the
  // operator address is useless to anybody else holding it.
  const draft = id.startsWith('sheet-') && await opsAuthed()
    ? await getSheet(id.slice(6)).catch(() => null) : null;
  const fromSheet = shared ?? draft;
  const deal: Deal | null = specimen ? SAMPLE_DEAL
    : fromSheet && fromSheet.offer ? {
      id: fromSheet.token,
      clientName: fromSheet.clientName,
      clientHandle: fromSheet.handle,
      concepts: fromSheet.recommendations
        .filter((r) => fromSheet.chosen.includes(r.conceptN))
        // The Arabic he wrote for this client where he wrote it, so the same
        // idea is not called one thing on the sheet and another on the invoice.
        .map((r) => ({
          conceptN: r.conceptN,
          name: fromSheet.copy?.[String(r.conceptN)]?.name || r.name,
        })),
      clientTotalJOD: fromSheet.offer.totalJOD,
      retainerJOD: fromSheet.offer.ads ? fromSheet.offer.adsMonthlyJOD : undefined,
      perMonth: undefined,
      status: 'proposed',
      createdAt: fromSheet.createdAt,
      updatedAt: fromSheet.updatedAt,
    }
      : await getDeal(id).catch(() => null);
  if (!deal) notFound();

  // A deal won off a sheet is that same flat pack. Read the offer back rather
  // than printing a per-concept breakdown the client was never quoted — the
  // page they agreed to said "8 videos at 150", and so must this one.
  const wonFrom = !fromSheet && deal.sheetToken
    ? await getSheet(deal.sheetToken).catch(() => null) : null;

  // The sheet prices by video, flat. Show that rather than a per-concept
  // breakdown the client was never quoted.
  const flat = fromSheet?.offer ?? wonFrom?.offer;

  /**
   * The three ideas, each as its own row.
   *
   * They used to be `deal.concepts.map(c => c.name).join(' · ')` — a run of
   * Latin names joined by middots inside an RTL cell, with no isolation, so
   * bidi scattered the separators across the line. The client is buying three
   * specific ideas; they get three lines, each carrying its own direction and
   * its own hook, in the Arabic Khaled wrote for them where he wrote it.
   */
  const src = fromSheet ?? wonFrom;
  const ideas = src
    ? src.recommendations
      .filter((r) => src.chosen.includes(r.conceptN))
      .map((r) => {
        const w = src.copy?.[String(r.conceptN)];
        return {
          key: String(r.conceptN),
          name: (ar && w?.name) || r.name,
          nameLtr: ar && !w?.name,
          hook: (ar && w?.hook) || r.hook,
          hookLtr: ar && !w?.hook,
        };
      })
    : deal.concepts.map((c) => ({
      key: String(c.conceptN), name: c.name, nameLtr: false, hook: '', hookLtr: false,
    }));

  // Letters and digits only: slicing a raw id leaves a dangling hyphen, and a
  // reference number is something a person reads aloud down a phone. The
  // sheet's token wins where there is one, so the quote and the deal it became
  // carry the same reference down the phone.
  const ref = (fromSheet?.shareToken ?? wonFrom?.shareToken
    ?? fromSheet?.token ?? wonFrom?.token ?? id)
    .replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase();

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
        /* Through the cookie route, so the choice survives the next document
           we send them rather than living only in this URL. */
        otherHref={`/doc/lang?to=${ar ? 'en' : 'ar'}&next=${encodeURIComponent(`/doc/proposal/${id}`)}`}
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
            {CO.cr && <span>{ar ? 'س.ت' : 'CR'} <span className="num">{CO.cr}</span></span>}
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
                  <ul className="ideas">
                    {ideas.map((x) => (
                      <li key={x.key}>
                        <b className={x.nameLtr ? 'ltr' : undefined}
                           {...(x.nameLtr ? { dir: 'ltr' as const, lang: 'en' } : {})}>{x.name}</b>
                        {x.hook && (
                          <span className={x.hookLtr ? 'ltr' : undefined}
                                {...(x.hookLtr ? { dir: 'ltr' as const, lang: 'en' } : {})}>{x.hook}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                  {/* Time, which the proposal never used to mention at all.
                      One shoot day is what the flat pack is: the sheet already
                      told them "N finished pieces from a single shoot day", so
                      this repeats their own figure rather than inventing a
                      turnaround nobody has agreed. */}
                  <span className="sub">
                    {ar
                      ? `يوم تصوير واحد · ${arNum(flat.videos)} مقاطع جاهزة للنشر`
                      : `One shoot day · ${flat.videos} finished pieces from it`}
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
                <td className="amt r">
                  {/* A concept with no agreed price of its own is left blank
                      rather than printed as zero. The total below is the
                      figure; a 0 in this column reads as free. */}
                  {c.priceJOD === undefined ? '—'
                    : <>{money(c.priceJOD, ar)} {ar ? 'دينار' : 'JOD'}</>}
                </td>
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
