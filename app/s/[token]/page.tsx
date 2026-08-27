import { notFound } from 'next/navigation';
import { getShared } from '@/lib/store/sheets';
import { CO } from '@/lib/data/company';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const arNum = (s: string | number) => String(s)
  .replace(/(?<=\d)\.(?=\d)/g, '٫').replace(/(?<=\d),(?=\d)/g, '٬')
  .replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[+d]);
const num = (n: number | string, ar: boolean) => {
  const s = typeof n === 'number' ? n.toLocaleString('en-US') : n;
  return ar ? arNum(s) : s;
};
const hour = (h: number, ar: boolean) => {
  const t = h % 12 === 0 ? 12 : h % 12;
  if (!ar) return `${t}${h < 12 ? 'am' : 'pm'}`;
  const part = h < 12 ? 'ص' : 'م';
  return `${arNum(t)}${part}`;
};

/**
 * The sheet, as the business owner reads it.
 *
 * Everything Khaled approved and nothing else — no controls, no choices, no
 * price to assemble. He fixed all of it before this page existed, so the reader
 * has exactly one decision left, which is whether to reply.
 *
 * Ordered the way the plan orders it: recognition, then what is working, then
 * what is costing them, then what we would make, then the number. Discomfort
 * only lands after they have been told something true and generous first.
 */
export default async function SharedSheet({
  params, searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { token } = await params;
  const { lang } = await searchParams;
  const ar = lang !== 'en';
  // Only ever resolves an approved sheet; a draft has no address here at all.
  const sheet = await getShared(token);
  if (!sheet) notFound();

  const { signals: s, findings: fx, offer } = sheet;
  const chosen = sheet.recommendations.filter((r) => sheet.chosen.includes(r.conceptN));
  const good = fx.findings.filter((f) => f.severity === 'good');
  const bad = fx.findings.filter((f) => f.severity !== 'good');
  const hours = fx.charts.find((c) => c.kind === 'hours');
  const bars = fx.charts.find((c) => c.kind === 'bars');
  const inWin = (h: number, w?: [number, number]) =>
    !!w && (w[0] <= w[1] ? h >= w[0] && h < w[1] : h >= w[0] || h < w[1]);

  const wa = `https://wa.me/${CO.phone.replace('+', '')}?text=${encodeURIComponent(
    ar ? `مرحبا، شفت الصفحة اللي بعتوها عن ${sheet.clientName}.`
      : `Hello — I read the page you sent about ${sheet.clientName}.`,
  )}`;

  return (
    <div className="wrap" style={{ position: 'relative' }}>
      <a className="lang" href={`?lang=${ar ? 'en' : 'ar'}`}>{ar ? 'English' : 'عربي'}</a>

      <header>
        <p className="mark">PRAVDA</p>
        <p className="for">{ar ? 'إلى' : 'For'} {sheet.clientName}</p>
        <h1>
          {ar
            ? 'قرأنا حسابكم كله، وهاي اللي لقيناه.'
            : 'We read your whole account. Here is what we found.'}
        </h1>
        <p className="read">
          {ar
            ? `${arNum(s.posts)} منشور${sheet.site ? ' وموقعكم' : ''} · ما طلبنا منكم إشي، وما في مكالمة مبيعات قبل هالصفحة.`
            : `${s.posts} posts${sheet.site ? ' and your website' : ''} · We asked you for nothing, and there was no sales call before this page.`}
        </p>

        <div className="figs">
          <div className="fig">
            <b className={s.engagementRate < 1 ? 'low' : undefined}>{num(Math.round(s.engagementRate * 10) / 10, ar)}%</b>
            <span>{ar ? 'نسبة التفاعل' : 'Engagement rate'}</span>
          </div>
          <div className="fig">
            <b>{num(s.followers, ar)}</b>
            <span>{ar ? 'متابع' : 'Followers'}</span>
          </div>
          <div className="fig">
            <b>{num(Math.round(s.medianEngagement), ar)}</b>
            <span>{ar ? 'تفاعل للمنشور العادي' : 'Reactions on a typical post'}</span>
          </div>
          <div className="fig">
            <b>{num(Math.round(s.postsPerWeek * 10) / 10, ar)}</b>
            <span>{ar ? 'منشور بالأسبوع' : 'Posts a week'}</span>
          </div>
        </div>
      </header>

      {good.length > 0 && (
        <section>
          <p className="u">{ar ? 'اللي شغّال' : 'What is working'}</p>
          <h2>{ar ? 'قبل أي إشي تاني' : 'Before anything else'}</h2>
          {good.map((f) => (
            <div className="find" data-s="good" key={f.id}>
              <div className="find-h">
                {f.figure && <span className="find-f num">{num(f.figure, ar)}</span>}
                <span className="find-t">{f.title[ar ? 'ar' : 'en']}</span>
              </div>
              <p>{f.detail[ar ? 'ar' : 'en']}</p>
              <p className="prov">{f.provenance[ar ? 'ar' : 'en']}</p>
            </div>
          ))}
        </section>
      )}

      <section>
        <p className="u">{ar ? 'اللي بيكلّفكم' : 'What is costing you'}</p>
        <h2>{ar ? 'هدول الأرقام كلها من عندكم' : 'Every one of these is your own number'}</h2>
        {bad.map((f) => (
          <div className="find" data-s={f.severity} key={f.id}>
            <div className="find-h">
              {f.figure && <span className="find-f num">{num(f.figure, ar)}</span>}
              <span className="find-t">{f.title[ar ? 'ar' : 'en']}</span>
            </div>
            <p>{f.detail[ar ? 'ar' : 'en']}</p>
            <p className="prov">{f.provenance[ar ? 'ar' : 'en']}</p>
          </div>
        ))}
      </section>

      {bars && bars.kind === 'bars' && (
        <section>
          <p className="u">{ar ? 'أي شكل بيشتغل' : 'Which format works'}</p>
          <h2>{bars.title[ar ? 'ar' : 'en']}</h2>
          <div className="chart">
            {bars.series.map((b, i) => {
              const max = Math.max(...bars.series.map((x) => x.value), 1);
              return (
                <div className="brow" key={i}>
                  <span>{b.label[ar ? 'ar' : 'en']}</span>
                  <span className="btrack">
                    <span className="bfill" data-hi={!!b.hi}
                          style={{ width: `${Math.max(4, (b.value / max) * 100)}%` }} />
                  </span>
                  <span className="bval num">{num(b.value, ar)}×</span>
                </div>
              );
            })}
          </div>
          {bars.note && <p className="keys">{bars.note[ar ? 'ar' : 'en']}</p>}
        </section>
      )}

      {hours && hours.kind === 'hours' && (
        <section>
          <p className="u">{ar ? 'إمتى بتنشروا' : 'When you publish'}</p>
          <h2>{hours.title[ar ? 'ar' : 'en']}</h2>
          <div className="hours">
            {hours.byHour.map((v, h) => {
              const max = Math.max(...hours.byHour, 1);
              return (
                <span className="hcol" key={h}
                      data-peak={inWin(h, hours.peak)} data-best={inWin(h, hours.best)}>
                  <span className="hbar" style={{ height: `${(v / max) * 100}%` }} />
                  {h % 6 === 0 && <span className="htick num">{hour(h, ar)}</span>}
                </span>
              );
            })}
          </div>
          <p className="keys">
            <span className="kdot" style={{ background: 'rgba(205,196,179,.35)' }} />
            {ar ? 'وقت نشركم' : 'when you post'}
            {hours.best && (
              <>
                {'   '}
                <span className="kdot" style={{ background: 'var(--go)' }} />
                {ar ? 'وقت أقوى منشوراتكم' : 'when your posts do best'}
              </>
            )}
          </p>
        </section>
      )}

      <section>
        <p className="u">{ar ? 'اللي منعمله إلكم' : 'What we would make'}</p>
        <h2>
          {ar ? 'تلات أفكار، مختارة لحسابكم إنتو' : 'Three ideas, chosen for your account'}
        </h2>
        {chosen.map((r, i) => {
          const written = sheet.copy?.[String(r.conceptN)];
          const name = (ar && written?.name) || r.name;
          const hook = (ar && written?.hook) || r.hook;
          // English inside an RTL document must carry its own direction, or the
          // full stop lands at the start of the line and the paragraph reads
          // as though it were badly typeset. Isolated, it simply reads.
          const nameLtr = ar && !written?.name;
          const hookLtr = ar && !written?.hook;
          return (
          <article className="idea" key={r.conceptN}>
            <span className="idea-n num">{ar ? arNum(i + 1) : i + 1} / {ar ? '٣' : '3'}</span>
            <h3 className={nameLtr ? 'ltr' : undefined} {...(nameLtr ? { dir: 'ltr' as const } : {})}>{name}</h3>
            <p className={hookLtr ? 'hook ltr' : 'hook'} {...(hookLtr ? { dir: 'ltr' as const } : {})}>{hook}</p>
            {/* `format` is NOT shown here and must not be. It is written for an
                operator — "budget 1.5 editor days", "the floor product below
                every shot concept", "cut from footage already shot on another
                concept day". A client reading that is being told they are
                buying the cheap option with recycled footage. The hook
                describes the creative; the yield line below says what they
                get. Both are written for them. */}
            {r.cast.length > 0 && (
              <div className="cast">
                {r.cast.map((c) => (
                  <div key={c.talentId}>
                    <b>{c.name[ar ? 'ar' : 'en']}</b>
                    <span className="u">{c.discipline}</span>
                  </div>
                ))}
              </div>
            )}
            <p className="idea-yield">
              {ar
                ? `${arNum(r.videos)} مقاطع من يوم تصوير واحد`
                : `${r.videos} finished pieces from a single shoot day`}
            </p>
          </article>
          );
        })}
      </section>

      {offer && (
        <section>
          <p className="u">{ar ? 'السعر' : 'The price'}</p>
          <h2>{ar ? 'مكتوب، وما بيتغيّر' : 'Published, and it does not move'}</h2>
          <div className="offer">
            <div className="price">
              <b className="num">{num(offer.totalJOD, ar)}</b>
              <span className="unit">
                {ar
                  ? `دينار · ${arNum(offer.videos)} مقاطع · ${arNum(offer.pricePerVideo)} للمقطع`
                  : `JOD · ${offer.videos} videos · ${offer.pricePerVideo} each`}
              </span>
            </div>
            <div className="incl">
              <span>{ar ? 'التصوير' : 'The shoot'}</span>
              <span>{ar ? 'المونتاج' : 'The edit'}</span>
              <span>{ar ? 'الطاقم' : 'The cast'}</span>
              <span>{ar ? 'التسويق' : 'The marketing'}</span>
            </div>
            {offer.ads && (
              <div className="monthly">
                <b className="num">{num(offer.adsMonthlyJOD, ar)}</b>
                <span className="unit">
                  {ar ? 'دينار بالشهر · إدارة إعلاناتكم على ميتا' : 'JOD a month · we run your Meta advertising'}
                </span>
              </div>
            )}
            {offer.note && <p style={{ marginTop: 'var(--s3)', marginBottom: 0 }}>{offer.note}</p>}
          </div>

          <div className="cta">
            <a className="btn" href={wa}>{ar ? 'ردّوا على واتساب' : 'Reply on WhatsApp'}</a>
            <a className="btn ghost" href={`tel:${CO.phone}`}>{ar ? 'اتصلوا' : 'Call us'}</a>
          </div>
          <p className="keys" style={{ marginTop: 'var(--s3)' }}>
            {ar
              ? 'ما في إشي موقّع لحد الآن. بتزورونا بالمكتب ومنوقّع العقد هناك.'
              : 'Nothing is signed yet. You visit the office and we sign there.'}
          </p>
        </section>
      )}

      <footer className="foot">
        <div>{CO.legalName[ar ? 'ar' : 'en']} · {ar ? 'س.ت' : 'CR'} <span className="num">{CO.cr}</span></div>
        <div>{CO.district[ar ? 'ar' : 'en']}، {CO.city[ar ? 'ar' : 'en']} · <a className="num" href={`tel:${CO.phone}`}>{CO.phoneDisplay}</a></div>
        <div>
          {ar
            ? 'كل رقم بهالصفحة محسوب من اللي نشرتوه أنتم بشكل علني. ما دخلنا على أي إشي خاص.'
            : 'Every figure on this page is computed from what you published publicly. We accessed nothing private.'}
        </div>
      </footer>
    </div>
  );
}
