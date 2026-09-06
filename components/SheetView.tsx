import { CO } from '@/lib/data/company';
import { arNum, num, hourShort as hour } from '@/lib/format/num';
import { fmtDate } from '@/lib/format/date';
import { DISCIPLINE_LABEL } from '@/lib/data/roster';
import { CREW_LABEL } from '@/lib/data/deals';
import PrintBar from '@/components/doc/PrintBar';
import type { Sheet } from '@/lib/store/sheets';
import { engagementBasis } from '@/lib/teardown/findings';
import type { CastPick } from '@/lib/teardown/recommend';

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
 *
 * Pure and store-free on purpose. One component renders both the real sheet at
 * `/s/<shareToken>` and the public specimen at `/specimen/<lang>`, so what a
 * stranger is shown as proof is the same artefact a prospect receives — and
 * every Arabic fix is written once rather than twice.
 */

type B = { ar: string; en: string };

export default function SheetView({
  sheet, ar, specimen, shareToken,
}: { sheet: Sheet; ar: boolean; specimen?: boolean; shareToken?: string }) {
  const L = ar ? 'ar' : 'en';
  const { signals: s, findings: fx, offer } = sheet;
  const chosen = sheet.recommendations.filter((r) => sheet.chosen.includes(r.conceptN));
  const good = fx.findings.filter((f) => f.severity === 'good');
  const bad = fx.findings.filter((f) => f.severity !== 'good');
  const hours = fx.charts.find((c) => c.kind === 'hours');
  const bars = fx.charts.find((c) => c.kind === 'bars');
  const inWin = (h: number, w?: [number, number]) =>
    !!w && (w[0] <= w[1] ? h >= w[0] && h < w[1] : h >= w[0] || h < w[1]);

  // The same reference the proposal prints, so a reply, the quote and the deal
  // it becomes all name one record down the phone.
  const ref = (shareToken ?? '').replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase();

  const reply = ar
    ? `مرحبا، شفت الصفحة اللي بعتوها عن ${sheet.clientName}.${ref ? ` (PRV-${ref})` : ''}`
    : `Hello — I read the page you sent about ${sheet.clientName}.${ref ? ` (PRV-${ref})` : ''}`;
  const wa = `https://wa.me/${CO.phone.replace('+', '')}?text=${encodeURIComponent(reply)}`;

  // On the specimen every call to action is the one thing a stranger can
  // actually do: ask for their own. Nothing here replies to anybody.
  const ctaHref = specimen ? `/${L}/teardown` : wa;
  const ctaLabel = specimen
    ? (ar ? 'اطلبوا تحقيقكم' : 'Get your teardown')
    : (ar ? 'ردّوا على واتساب' : 'Reply on WhatsApp');

  const langHref = specimen
    ? `/specimen/${ar ? 'en' : 'ar'}`
    : `/s/${shareToken ?? ''}/lang?to=${ar ? 'en' : 'ar'}`;

  const disc = (d: string) =>
    (DISCIPLINE_LABEL as Record<string, B | undefined>)[d]?.[L] ?? d;

  /**
   * The role in the reader's language, or the library's own word for it.
   *
   * Falling back rather than dropping: a crew line that quietly loses the
   * driver understates the day, and understating the day is how a shoot is
   * bought twice.
   */
  const crew = (role: string) =>
    (CREW_LABEL as Record<string, B | undefined>)[role.toLowerCase()]?.[L] ?? role;

  /**
   * Who is on this idea — the operator's cast when he changed it.
   *
   * `castOverrides` is materialised by the `cast` action, so this is a read and
   * nothing more: no roster fetch, no id resolution, and no way for a talent
   * record edited next week to change the page somebody was already sent.
   */
  const castOf = (conceptN: number): CastPick[] => {
    const override = sheet.castOverrides?.[String(conceptN)];
    if (override && override.length) return override;
    return sheet.recommendations.find((r) => r.conceptN === conceptN)?.cast ?? [];
  };

  /**
   * Nothing about reach may be said when the reactions were not returned.
   *
   * Instagram omits `like_count` entirely for an account that hides its like
   * counts, so an engagement rate computed off what did come back is a rate
   * for a subset presented as a rate for the account. The tile is dropped and
   * `ig-likes-hidden` — which the engine emits for exactly this case — takes
   * its place, so the reader is told why the number is missing rather than
   * being given a number that is wrong.
   */
  const likesHidden = !s.engagementReliable;
  const hiddenFinding = fx.findings.find((f) => f.id === 'ig-likes-hidden');

  /**
   * The same basis the `ig-engagement` finding below is written on.
   *
   * The tile used to read `s.engagementRate` — the lifetime figure — straight
   * off the signals while the finding printed the trailing-window one, so the
   * header and the paragraph under it quoted two different percentages of the
   * same account. One function decides, both read it.
   *
   * A followerless account is the other half: `pct(n, 0)` is 0, and "0%
   * engagement" is a sentence about a business, not about a missing
   * denominator. No followers, no rate.
   */
  const basis = engagementBasis(s);
  const rateSayable = s.followers > 0 && basis.sayable;

  const readOn = sheet.approvedAt ?? sheet.createdAt;

  return (
    <>
      <a className="skip" href="#main">{ar ? 'تخطّي للمحتوى' : 'Skip to content'}</a>

      <PrintBar
        label={ar ? 'احفظ PDF' : 'Save as PDF'}
        hint={ar
          ? 'اختاروا «حفظ كـ PDF» من نافذة الطباعة.'
          : 'Choose “Save as PDF” in the print dialogue.'}
        otherLang={ar ? 'English' : 'عربي'}
        otherHref={langHref}
      />

      <div className="wrap" style={{ position: 'relative' }}>
        <a className="lang" href={langHref}>{ar ? 'English' : 'عربي'}</a>

        <main id="main" tabIndex={-1}>
          {specimen && (
            <>
              <a className="spec-back" href={`/${L}`}>
                {ar ? '← برافدا' : '← PRAVDA'}
              </a>
              <p className="stamp">
                {ar
                  ? 'نموذج — منشأة غير حقيقية وأرقام تمثيلية'
                  : 'Specimen — fictional business, illustrative figures'}
              </p>
            </>
          )}

          <header>
            <p className="mark">PRAVDA</p>
            <p className="for">{ar ? 'إلى' : 'For'} {sheet.clientName}</p>
            {/* Provenance is a date as much as a method. The page asserts that
                every figure came from what they published; saying when it was
                read is what makes that checkable rather than rhetorical. */}
            <p className="dateline">
              {ar ? `قراءة يوم ${fmtDate(readOn, true)}` : `Read on ${fmtDate(readOn, false)}`}
            </p>
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
              {/* Both reaction figures rest on like counts. When those did not
                  come back for most of the account, neither is a fact about
                  the account, so the finding that says so stands in their
                  place rather than a rate quietly computed off the remainder. */}
              {likesHidden || !rateSayable ? (
                hiddenFinding && (
                  <div className="fig">
                    <b>{hiddenFinding.figure?.[L]}</b>
                    <span>{hiddenFinding.title[L]}</span>
                  </div>
                )
              ) : (
                <>
                  <div className="fig">
                    <b className={basis.rate < 1 ? 'low' : undefined}>{num(Math.round(basis.rate * 10) / 10, ar)}{ar ? '٪' : '%'}</b>
                    <span>{ar ? 'نسبة التفاعل' : 'Engagement rate'}</span>
                  </div>
                  <div className="fig">
                    <b>{num(Math.round(basis.median), ar)}</b>
                    <span>{ar ? 'تفاعل للمنشور العادي' : 'Reactions on a typical post'}</span>
                  </div>
                </>
              )}
              <div className="fig">
                <b>{num(s.followers, ar)}</b>
                <span>{ar ? 'متابع' : 'Followers'}</span>
              </div>
              <div className="fig">
                <b>{num(Math.round(s.postsPerWeek * 10) / 10, ar)}</b>
                <span>{ar ? 'منشور بالأسبوع' : 'Posts a week'}</span>
              </div>
            </div>
          </header>

          {/* Both halves are guarded. An account with nothing measurably good
              would otherwise open straight into what it is costing them, and an
              empty `bad` array would print a kicker and a heading over nothing. */}
          {good.length > 0 && (
            <section>
              <p className="u">{ar ? 'اللي شغّال' : 'What is working'}</p>
              <h2>{ar ? 'قبل أي إشي تاني' : 'Before anything else'}</h2>
              {good.map((f) => (
                <div className="find" data-s="good" key={f.id}>
                  <div className="find-h">
                    {f.figure && <span className="find-f num">{f.figure[L]}</span>}
                    <span className="find-t">{f.title[L]}</span>
                  </div>
                  <p>{f.detail[L]}</p>
                  <p className="prov">{f.provenance[L]}</p>
                </div>
              ))}
            </section>
          )}

          {bad.length > 0 && (
            <section>
              <p className="u">{ar ? 'اللي بيكلّفكم' : 'What is costing you'}</p>
              <h2>{ar ? 'هدول الأرقام كلها من عندكم' : 'Every one of these is your own number'}</h2>
              {bad.map((f) => (
                <div className="find" data-s={f.severity} key={f.id}>
                  <div className="find-h">
                    {f.figure && <span className="find-f num">{f.figure[L]}</span>}
                    <span className="find-t">{f.title[L]}</span>
                  </div>
                  <p>{f.detail[L]}</p>
                  <p className="prov">{f.provenance[L]}</p>
                </div>
              ))}
            </section>
          )}

          {bars && bars.kind === 'bars' && (
            <section>
              <p className="u">{ar ? 'أي شكل بيشتغل' : 'Which format works'}</p>
              <h2>{bars.title[L]}</h2>
              <div className="chart">
                {bars.series.map((b, i) => {
                  const max = Math.max(...bars.series.map((x) => x.value), 1);
                  return (
                    <div className="brow" key={i}>
                      <span>{b.label[L]}</span>
                      <span className="btrack">
                        <span className="bfill" data-hi={!!b.hi}
                              style={{ width: `${Math.max(4, (b.value / max) * 100)}%` }} />
                      </span>
                      <span className="bval num">{num(b.value, ar)}×</span>
                    </div>
                  );
                })}
              </div>
              {bars.note && <p className="keys">{bars.note[L]}</p>}
            </section>
          )}

          {hours && hours.kind === 'hours' && (
            <section>
              <p className="u">{ar ? 'إمتى بتنشروا' : 'When you publish'}</p>
              <h2>{hours.title[L]}</h2>
              {/* The axis itself is forced left-to-right in s.css — every clock,
                  calendar and chart a Jordanian business owner has ever read
                  runs earliest to latest that way. Only the labels are Arabic. */}
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

          {/* Everything from here down is the sticky bar's containing block, and
              the bar is its first child. A sticky element cannot escape its own
              containing block, so it simply is not on screen until the reader
              has passed the findings — a sentinel with no JavaScript in it. */}
          <div className="stick-zone">
            <a className="reply-stick" href={ctaHref}>{ctaLabel}</a>

            <section>
              <p className="u">{ar ? 'اللي منعمله إلكم' : 'What we would make'}</p>
              <h2>
                {ar ? 'تلات أفكار، مختارة لحسابكم إنتو' : 'Three ideas, chosen for your account'}
              </h2>
              {chosen.map((r, i) => {
                const written = sheet.copy?.[String(r.conceptN)];
                const name = (ar && written?.name) || r.name;
                const hook = (ar && written?.hook) || r.hook;
                // English inside an RTL document must carry its own direction, or
                // the full stop lands at the start of the line and the paragraph
                // reads as though it were badly typeset. Isolated, it simply
                // reads — and `lang` with it, so a screen reader does not say
                // English words in an Arabic voice.
                const nameLtr = ar && !written?.name;
                const hookLtr = ar && !written?.hook;
                const cast = castOf(r.conceptN);
                // `uncastable` is the recommender saying the roster could not
                // fill this concept — but an operator who then cast it by hand
                // has answered exactly that. Reading the flag alone printed
                // "cast confirmed before the shoot" over four named people the
                // client was about to be quoted for.
                const overridden = !!sheet.castOverrides?.[String(r.conceptN)]?.length;
                return (
                <article className="idea" key={r.conceptN}>
                  <span className="idea-n num">{ar ? arNum(i + 1) : i + 1} / {ar ? '٣' : '3'}</span>
                  <h3 className={nameLtr ? 'ltr' : undefined}
                      {...(nameLtr ? { dir: 'ltr' as const, lang: 'en' } : {})}>{name}</h3>
                  <p className={hookLtr ? 'hook ltr' : 'hook'}
                     {...(hookLtr ? { dir: 'ltr' as const, lang: 'en' } : {})}>{hook}</p>
                  {/* The deciding sentence: what this idea does that the other
                      four on the shortlist do not. It is the rarest answer
                      across the shortlist precisely so it says something
                      specific, and it is the most persuasive line the engine
                      produces. Bilingual from the recommender, so it never
                      needs the isolation the English name and hook do. */}
                  <p className="idea-why">{r.because[L]}</p>
                  {/* `format` is NOT shown here and must not be. It is written for an
                      operator — "budget 1.5 editor days", "the floor product below
                      every shot concept", "cut from footage already shot on another
                      concept day". A client reading that is being told they are
                      buying the cheap option with recycled footage. The hook
                      describes the creative; the yield line below says what they
                      get. Both are written for them. */}
                  {r.uncastable && !overridden ? (
                    <p className="cast-tbc">
                      {ar ? 'الطاقم بيتأكد قبل التصوير' : 'cast confirmed before the shoot'}
                    </p>
                  ) : cast.length > 0 && (
                    <div className="cast">
                      {cast.map((c) => (
                        <div key={c.talentId}>
                          <b>{c.name[L]}</b>
                          <span className="u">{disc(c.discipline)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* The rest of the day, said plainly. An editor and a
                      producer are real cost and real people, and a cast block
                      that lists two names while four turn up is the sentence
                      that makes the price look arbitrary. It borrows the yield
                      line's style rather than inventing one: app/s/s.css
                      belongs to nobody this wave, and a class with no rule
                      behind it renders as body copy. */}
                  {r.crewNotes.length > 0 && (
                    <p className="idea-yield">
                      {ar ? 'كمان على اليوم: ' : 'Also on the day: '}
                      {r.crewNotes.map((c) => crew(c)).join(ar ? '، ' : ', ')}
                    </p>
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
                  <a className="btn" href={ctaHref}>{ctaLabel}</a>
                  {!specimen && (
                    <a className="btn ghost" href={`tel:${CO.phone}`}>{ar ? 'اتصلوا' : 'Call us'}</a>
                  )}
                </div>
                <p className="keys" style={{ marginTop: 'var(--s3)' }}>
                  {specimen
                    ? (ar
                      ? 'هاي صفحة نموذج. تحقيقكم بينبنى من حسابكم إنتو، وبيوصلكم خلال يوم عمل.'
                      : 'This is a specimen. Your own is built from your own account and arrives within one working day.')
                    : (ar
                      ? 'ما في إشي موقّع لحد الآن. بتزورونا بالمكتب ومنوقّع العقد هناك.'
                      : 'Nothing is signed yet. You visit the office and we sign there.')}
                </p>
              </section>
            )}
          </div>
        </main>

        <footer className="foot">
          <div>
            {CO.legalName[L]}
            {CO.cr && <> · {ar ? 'س.ت' : 'CR'} <span className="num">{CO.cr}</span></>}
          </div>
          <div>{CO.district[L]}، {CO.city[L]} · <a className="num" href={`tel:${CO.phone}`}>{CO.phoneDisplay}</a></div>
          <div>
            {specimen
              ? (ar
                ? 'كل رقم بهالصفحة تمثيلي، والمنشأة مش حقيقية. التحقيق الحقيقي بينحسب من اللي بتنشروه إنتو بشكل علني.'
                : 'Every figure on this page is illustrative and the business is fictional. A real teardown is computed from what you published publicly.')
              : (ar
                ? 'كل رقم بهالصفحة محسوب من اللي نشرتوه أنتم بشكل علني. ما دخلنا على أي إشي خاص.'
                : 'Every figure on this page is computed from what you published publicly. We accessed nothing private.')}
          </div>
        </footer>
      </div>
    </>
  );
}
