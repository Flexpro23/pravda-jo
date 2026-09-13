import { notFound } from 'next/navigation';
import { getSheet, getShared } from '@/lib/store/sheets';
import { opsAuthed } from '@/lib/ops/auth';
import { SPECIMEN_SHEET } from '@/lib/data/specimenSheet';
import { registerFor, tallyOf, type RegisterRow } from '@/lib/teardown/register';
import { VERTICAL_LABEL } from '@/lib/data/concepts';
import { CO } from '@/lib/data/company';
import PrintBar from '@/components/doc/PrintBar';
import { num, arNum, n1 } from '@/lib/format/num';
import { fmtDate } from '@/lib/format/date';
import type { Sheet } from '@/lib/store/sheets';
import type { Finding } from '@/lib/teardown/findings';
import '../audit.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The audit, as a document rather than a page.
 *
 * `/s/[token]` is the artefact a client is sent — short, on a phone, ending in
 * a price. This is the other half: the full method, printed, for the client who
 * asks *how do you know that*, and for the meeting where somebody wants the
 * working rather than the conclusion.
 *
 * Everything on it comes from the same stored sheet `/s` renders, so the two
 * cannot disagree. Nothing is recomputed here, and no number appears that the
 * engine did not already compute and store.
 *
 * What makes it an audit rather than a longer brochure is section four. A
 * teardown lists what it found; this lists what it looked for, all twenty-two
 * tests, including the ones that could not run and the reason each one could
 * not. Ten of those on a typical account is not a gap to be papered over — it
 * is the most useful page in the document, because it is the list of things a
 * business would learn about itself by fixing one thing.
 *
 * No crew figure reaches this page and no route brings one here: it reads a
 * `Sheet`, and a `Sheet` has never carried what a provider is paid.
 */

const N = ({ v, ar }: { v: number | string; ar: boolean }) => (
  <span className="fig">{num(v, ar)}</span>
);

/** The provenance rail. Every claim on this page carries its source here. */
function Rail({ figure, source }: { figure?: string; source?: string }) {
  return (
    <div className="rail">
      {figure && <p className="rail-fig">{figure}</p>}
      {source && <p className="rail-src">{source}</p>}
    </div>
  );
}

function Claim({ f, ar }: { f: Finding; ar: boolean }) {
  return (
    <article className={`claim claim--${f.severity}`}>
      <Rail figure={f.figure?.[ar ? 'ar' : 'en']} source={f.provenance?.[ar ? 'ar' : 'en']} />
      <div className="claim-body">
        <h3>{f.title[ar ? 'ar' : 'en']}</h3>
        <p>{f.detail[ar ? 'ar' : 'en']}</p>
      </div>
    </article>
  );
}

/** Twenty-four hours of publishing, as a strip. Printable, no library. */
function Hours({ byHour, ar }: { byHour: number[]; ar: boolean }) {
  const peak = Math.max(1, ...byHour);
  return (
    <div className="hours" aria-hidden="true">
      {byHour.map((n, h) => (
        <span key={h} className="hours-col">
          <span className="hours-bar" style={{ height: `${Math.round((n / peak) * 100)}%` }} />
          {h % 6 === 0 && (
            <span className="hours-tick">{ar ? arNum(h) : h}</span>
          )}
        </span>
      ))}
    </div>
  );
}

function RegisterTable({ rows, ar }: { rows: RegisterRow[]; ar: boolean }) {
  const word = {
    flagged: ar ? 'مشكلة' : 'Problem',
    clear: ar ? 'سليم' : 'Clear',
    'not-run': ar ? 'ما انفحص' : 'Not run',
  } as const;
  return (
    <table className="reg">
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className={`reg--${r.outcome.state}`}>
            <td className="reg-state"><span>{word[r.outcome.state]}</span></td>
            <td className="reg-asks">
              {r.asks[ar ? 'ar' : 'en']}
              {r.outcome.state === 'not-run' && (
                <em className="reg-why">{r.outcome.why[ar ? 'ar' : 'en']}</em>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default async function AuditDoc({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { id } = await params;
  const { lang } = await searchParams;
  const ar = lang !== 'en';

  // Addressed by the SHARE token, like the proposal: this document is kept and
  // forwarded, so its URL travels further than any other and must never be the
  // operator address. `sheet-` is the draft preview, behind the console.
  const shared = id.startsWith('share-')
    ? await getShared(id.slice(6)).catch(() => null) : null;
  const draft = id.startsWith('sheet-') && await opsAuthed()
    ? await getSheet(id.slice(6)).catch(() => null) : null;
  // Served from code so the template can be read before any client exists.
  const sheet: Sheet | null = id === 'sample' ? SPECIMEN_SHEET : (shared ?? draft);
  if (!sheet) notFound();

  const t = ar ? {
    kicker: 'تحقيق الحساب', doc: 'تقرير كامل',
    forWhom: 'إلى', read: 'قراءة يوم',
    print: 'احفظ PDF', hint: 'اختاروا «حفظ كـ PDF» من نافذة الطباعة.', other: 'English',
    s1: 'اللي قرأناه', s2: 'اللي بيكلّفكم', s3: 'اللي قِسناه', s4: 'اللي شغّال',
    s5: 'كل فحص عملناه', s6: 'اللي ما قدرنا نعرفه',
    followers: 'متابع', postsRead: 'منشور انقرأ', perWeek: 'منشور بالأسبوع',
    reactions: 'تفاعل بالمنشور العادي', engagement: 'نسبة التفاعل',
    method: 'الطريقة', methodBody:
      'قرأنا الحساب العام بس — المنشورات، صيغها، توقيتها، الكابشنات، والبايو. وقرأنا الموقع لو كان في موقع. '
      + 'ما دخلنا على ولا إشي خاص، وما طلبنا منكم كلمة سر ولا صلاحية، وما حكينا مع حدا عنكم.',
    since: 'من', publishing: 'ناشرين من',
    tallyLead: 'فحص', tallyProblem: 'لقينا فيها مشكلة', tallyClear: 'طلعت سليمة',
    tallyNotRun: 'ما قدرنا نفحصها',
    whenYouPost: 'إمتى بتنشروا', amman: 'بتوقيت عمّان',
    business: 'شو هالشغل', trade: 'القطاع',
    limitsBody:
      'الفحوصات اللي ما قدرنا نشغّلها، مجمّعة حسب السبب اللي وقّفها. ولا واحد فيها انقدّر بالتخمين. '
      + 'وأغلبها بينفتح لحاله أول ما يصير في موقع نقرأه.',
    footer: 'كل رقم بهاي الصفحة محسوب من إشي نشرتوه إنتو علنًا. ما وصلنا لولا إشي خاص.',
    ref: 'رقم المرجع',
  } : {
    kicker: 'Account teardown', doc: 'Full report',
    forWhom: 'For', read: 'Read on',
    print: 'Save as PDF', hint: 'Choose “Save as PDF” in the print dialogue.', other: 'عربي',
    s1: 'What we read', s2: 'What is costing you', s3: 'What we measured',
    s4: 'What is working', s5: 'Every test we ran', s6: 'What we could not determine',
    followers: 'Followers', postsRead: 'Posts read', perWeek: 'Posts a week',
    reactions: 'Reactions on a typical post', engagement: 'Engagement rate',
    method: 'Method', methodBody:
      'We read the public account only — the posts, their formats, their timing, the captions and the bio. '
      + 'And the website, where there was one. We accessed nothing private, asked you for no password and no '
      + 'permission, and spoke to nobody about you.',
    since: 'Since', publishing: 'Publishing for',
    tallyLead: 'tests', tallyProblem: 'found a problem', tallyClear: 'came back clear',
    tallyNotRun: 'could not run',
    whenYouPost: 'When you publish', amman: 'Amman time',
    business: 'What this business is', trade: 'Trade',
    limitsBody:
      'The tests that could not run, grouped by what stopped them. Not one of them was estimated around. '
      + 'Most open on their own the moment there is a website to read.',
    footer: 'Every figure on this page is computed from what you published publicly. We accessed nothing private.',
    ref: 'Reference',
  };

  const s = sheet.signals;
  const F = sheet.findings.findings;
  const criticals = F.filter((f) => f.severity === 'critical');
  const notables = F.filter((f) => f.severity === 'notable');
  const goods = F.filter((f) => f.severity === 'good');
  const rows = registerFor(sheet);
  const tally = tallyOf(rows);
  // Grouped by the reason itself, biggest first, so the document ends on the
  // one sentence that is actually actionable: nine of these need a website.
  const byCause = new Map<string, number>();
  for (const r of rows) {
    if (r.outcome.state !== 'not-run') continue;
    const why = r.outcome.why[ar ? 'ar' : 'en'];
    byCause.set(why, (byCause.get(why) ?? 0) + 1);
  }
  const blocked = [...byCause.entries()].sort((a, b) => b[1] - a[1]);
  const accountRows = rows.filter((r) => r.source === 'account');
  const websiteRows = rows.filter((r) => r.source === 'website');
  const ref = (sheet.shareToken ?? sheet.token).slice(0, 6).toUpperCase();
  const readAt = sheet.profile?.readAt ?? sheet.createdAt;

  return (
    <>
      <PrintBar label={t.print} hint={t.hint} otherLang={t.other}
                otherHref={ar ? `?lang=en` : `?lang=ar`} />

      <main className="doc">
        {/* ── cover ─────────────────────────────────────────────────────── */}
        <header className="cover">
          <div className="cover-top">
            <p className="mark">PRAVDA</p>
            <p className="u">{t.kicker} · {t.doc}</p>
          </div>

          <p className="cover-for u">{t.forWhom}</p>
          <h1 className="cover-name">{sheet.clientName}</h1>
          <p className="cover-meta">
            <span className="ltr">@{sheet.handle}</span>
            <span className="dot">·</span>
            {t.read} {fmtDate(readAt, ar)}
            <span className="dot">·</span>
            {t.ref} PRV-{ref}
          </p>

          {/* The thesis. No one else prints what they could not measure, and
              the tally says so before a single finding is read. */}
          <div className="tally">
            <p className="tally-lead">
              <N v={tally.total} ar={ar} />{' '}{t.tallyLead}
            </p>
            <ul>
              <li className="tally--flag">
                <b>{num(tally.flagged, ar)}</b><span>{t.tallyProblem}</span>
              </li>
              <li className="tally--clear">
                <b>{num(tally.clear, ar)}</b><span>{t.tallyClear}</span>
              </li>
              <li className="tally--none">
                <b>{num(tally.notRun, ar)}</b><span>{t.tallyNotRun}</span>
              </li>
            </ul>
          </div>
        </header>

        {/* ── 1. what we read ───────────────────────────────────────────── */}
        <section className="sec">
          <h2><span className="sec-n">01</span>{t.s1}</h2>

          {sheet.businessSummary && (
            <div className="lede">
              <p className="u">{t.business}</p>
              <p>{sheet.businessSummary[ar ? 'ar' : 'en']}</p>
              {sheet.vertical && (
                <p className="u lede-trade">
                  {t.trade} — {VERTICAL_LABEL[sheet.vertical][ar ? 'ar' : 'en']}
                </p>
              )}
            </div>
          )}

          <dl className="facts">
            <div><dt>{t.followers}</dt><dd>{num(s.followers, ar)}</dd></div>
            <div><dt>{t.postsRead}</dt><dd>{num(s.posts, ar)}</dd></div>
            <div><dt>{t.perWeek}</dt><dd>{num(n1(s.postsPerWeek), ar)}</dd></div>
            <div><dt>{t.reactions}</dt><dd>{num(Math.round(s.medianEngagement), ar)}</dd></div>
            {s.engagementReliable && (
              <div><dt>{t.engagement}</dt>
                <dd>{num(n1(s.engagementRate), ar)}{ar ? '٪' : '%'}</dd></div>
            )}
            <div><dt>{t.publishing}</dt>
              <dd>{num(Math.round(s.activeSpanDays), ar)} {ar ? 'يوم' : 'days'}</dd></div>
          </dl>

          <div className="chart">
            <p className="u">{t.whenYouPost} <span className="dim">· {t.amman}</span></p>
            <Hours byHour={s.byHour} ar={ar} />
          </div>

          <div className="method">
            <p className="u">{t.method}</p>
            <p>{t.methodBody}</p>
          </div>
        </section>

        {/* ── 2. what is costing them ───────────────────────────────────── */}
        {criticals.length > 0 && (
          <section className="sec">
            <h2><span className="sec-n">02</span>{t.s2}</h2>
            {criticals.map((f) => <Claim key={f.id} f={f} ar={ar} />)}
          </section>
        )}

        {/* ── 3. what we measured ───────────────────────────────────────── */}
        {notables.length > 0 && (
          <section className="sec">
            <h2><span className="sec-n">03</span>{t.s3}</h2>
            {notables.map((f) => <Claim key={f.id} f={f} ar={ar} />)}
          </section>
        )}

        {/* ── 4. what is working ────────────────────────────────────────── */}
        {goods.length > 0 && (
          <section className="sec">
            <h2><span className="sec-n">04</span>{t.s4}</h2>
            {goods.map((f) => <Claim key={f.id} f={f} ar={ar} />)}
          </section>
        )}

        {/* ── 5. the register ───────────────────────────────────────────── */}
        <section className="sec sec--break">
          <h2><span className="sec-n">05</span>{t.s5}</h2>
          <p className="sec-lede">
            {ar
              ? 'هاي كل الفحوصات اللي بيعملها المحرك، مش بس اللي لقى فيها إشي.'
              : 'This is every test the engine runs, not only the ones that found something.'}
          </p>

          <h4 className="reg-head u">{ar ? 'الحساب' : 'The account'}</h4>
          <RegisterTable rows={accountRows} ar={ar} />

          <h4 className="reg-head u">{ar ? 'الموقع' : 'The website'}</h4>
          <RegisterTable rows={websiteRows} ar={ar} />
        </section>

        {/* ── 6. limits ─────────────────────────────────────────────────────
            Grouped by cause, not repeated row by row. Section five already
            names every test that could not run; printing the same ten lines
            again pads the document and buries the only thing this section is
            for — that the ten share three causes, and fixing one of them
            returns nine tests. */}
        {blocked.length > 0 && (
          <section className="sec">
            <h2><span className="sec-n">06</span>{t.s6}</h2>
            <p className="sec-lede">{t.limitsBody}</p>
            <ul className="blocked">
              {blocked.map(([why, n]) => (
                <li key={why}>
                  <div className="blocked-n">
                    <b>{num(n, ar)}</b>
                    <span>{ar ? (n === 1 ? 'فحص' : 'فحوصات') : (n === 1 ? 'test' : 'tests')}</span>
                  </div>
                  <em>{why}</em>
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="foot">
          <p>{t.footer}</p>
          <p className="foot-co">
            {CO.legalName[ar ? 'ar' : 'en']} · <span className="ltr">{CO.phoneDisplay}</span>
          </p>
        </footer>
      </main>
    </>
  );
}
