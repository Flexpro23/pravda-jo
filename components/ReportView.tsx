import Link from 'next/link';
import Masthead from '@/components/Masthead';
import Foot from '@/components/Foot';
import { CO } from '@/lib/data/company';
import type { Report } from '@/lib/data/report';
import { Lang, path, tx } from '@/lib/i18n';
import Configurator from '@/components/Configurator';

/**
 * The Teardown. This is the surface every cold visitor lands on, so it carries
 * no canvas, no heavy media, and the entire trust payload — a real name, Amman,
 * a tappable number — sits in the first screen as plain text.
 */
export default function ReportView({
  r, lang, specimen = false,
}: { r: Report; lang: Lang; specimen?: boolean }) {
  const ar = lang === 'ar';

  return (
    <>
      {specimen && (
        <div className="specimen">
          {ar ? 'نموذج توضيحي — منشأة غير حقيقية وأرقام تمثيلية. ليس تقريرًا فعليًا.'
             : 'Specimen — fictional business, illustrative figures. Not a real report.'}
        </div>
      )}
      <a className="skip" href="#main">
        {ar ? 'تخطَّ إلى التحقيق' : 'Skip to the teardown'}
      </a>
      <Masthead lang={lang} />

      <main id="main" tabIndex={-1}><article className="rep">
        {/* dateline — the trust payload, all text, first screen */}
        <header className="wrap rep-date">
          <span className="u">{ar ? `${CO.city.ar} · ${CO.city.en.toUpperCase()}` : CO.city.en}</span>
          <span className="u num ltr">{r.date}</span>
          <span className="u">{ar ? 'إلى' : 'For'} {r.client[lang]}</span>
          <a className="u tel ltr" href={`tel:${CO.phone}`}>{CO.phoneDisplay}</a>
        </header>

        <section className="wrap rep-hero">
          <p className="u brass">{ar ? 'أفضل شي نشرتوه هالسنة' : 'The best thing you made this year'}</p>
          <div className="rep-plate"><span className="u">{r.hero.cap[lang]}</span></div>
          <h1 className="big">{r.hero.head[lang]}</h1>
          <p className="body">{r.hero.body[lang]}</p>
        </section>

        <section className="wrap rep-s">
          <p className="u">{ar ? 'الخلاصة' : 'The verdict'}</p>
          <blockquote className="verdict-q mid">{r.verdict[lang]}</blockquote>
        </section>

        <section className="wrap rep-s">
          <p className="u">{ar ? 'المؤشرات' : 'Vitals'}</p>
          <div className="vitals">
            {r.vitals.map((v) => (
              <div className="vital" key={v.fig + v.label.en}>
                <span className={`v-fig num ltr${v.low ? ' low' : ''}`}>{v.fig}</span>
                <span className="u v-lbl">{v.label[lang]}</span>
                <span className="v-cmp body">
                  {v.cmp[lang]} <span className="prov">{v.prov[lang]}</span>
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="wrap rep-s">
          <p className="u">{ar ? 'الشغّال عندكم' : 'What is working'}</p>
          {r.working.map((w, i) => <p className="body" key={i}>{w[lang]}</p>)}
        </section>

        <section className="wrap rep-s">
          <p className="u">{ar ? 'النمط' : 'The pattern'}</p>
          <div className="finding">
            <p className="mid">{r.pattern.head[lang]}</p>
            <div className="bars">
              {r.pattern.bars.map((b) => (
                <div className="bar-row" key={b.label.en}>
                  <span className="u">{b.label[lang]}</span>
                  <span className="bar-track">
                    <span className={`bar-fill${b.hi ? ' hi' : ''}`} style={{ width: `${b.v}%` }} />
                  </span>
                  <span className="bar-val num ltr">{b.x}</span>
                </div>
              ))}
            </div>
            <p className="body">{r.pattern.tail[lang]}</p>
          </div>
        </section>

        {/* Paid only runs when a human has read the Ad Library; there is no
            API path to it for Jordan. A teardown without it is still whole. */}
        {r.ads && (
          <section className="wrap rep-s">
            <p className="u">{ar ? 'الإعلانات المدفوعة' : 'Paid'}</p>
            <div className="ads">
              <div><p className="ads-big num low ltr">{r.ads.mine}</p><p className="u">{r.ads.mineLabel[lang]}</p></div>
              <div><p className="ads-big num ltr">{r.ads.theirs}</p><p className="u">{r.ads.theirsLabel[lang]}</p></div>
            </div>
            <p className="body">{r.ads.p[lang]}</p>
          </section>
        )}

        <section className="wrap rep-s">
          <p className="u brass">{ar ? 'مجانًا' : 'Free'}</p>
          <h2 className="mid">{ar ? 'خمس إشيا صلّحوها هالأسبوع، بدوننا' : 'Five things to fix this week, without us'}</h2>
          <ol className="fixes">
            {r.fixes.map((f, i) => (
              <li key={f.h.en}>
                <span className="fix-n num">{String(i + 1).padStart(2, '0')}</span>
                <span>
                  <span className="fix-h">{f.h[lang]}</span>
                  <span className="body">{f.p[lang]}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>

        {/* The concepts used to be a list to read. They are a thing to answer
            now: tick what you want, watch it price itself, send it. */}
        {r.concepts.length > 0 && (
          <Configurator r={r} lang={lang} specimen={specimen} />
        )}


        <section className="wrap rep-s">
          <p className="u">{ar ? 'لو اشتغلنا سوا' : 'If we worked together'}</p>
          <h2 className="mid">{ar ? 'أول تسعين يوم' : 'The first ninety days'}</h2>
          <div className="plan">
            {r.plan.map((s) => (
              <div className="pl" key={s.m.en}>
                <span className="u brass">{s.m[lang]}</span>
                <p className="body">{s.p[lang]}</p>
              </div>
            ))}
          </div>
        </section>

        {/* A specimen is read on the website, not in a WhatsApp thread — so it
            closes on getting your own rather than on replying to a message. */}
        <section className="wrap rep-cta">
          <h2 className="big">
            {specimen
              ? (ar ? 'بدكم تحقيق زي هاد؟' : 'Want one of these?')
              : (ar ? 'بدكم مواعيد التصوير؟' : 'Want the shoot dates?')}
          </h2>
          <p className="body">
            {specimen
              ? (ar ? 'ابعتوا حسابكم، ومنقرأه كله، ومنبعتلكم تحقيقكم إنتو. مجانًا، وبدون مكالمة مبيعات قبله.'
                    : 'Send us your handle. We read the whole account and send back one of these about you — free, and with no sales call first.')
              : (ar ? 'ردّوا على هالرسالة وخالد بيحكي معكم. بدون فورم، وبدون عرض تقديمي.'
                    : 'Reply to this message and Khaled will call you. No form, no deck.')}
          </p>
          <div className="hero-actions">
            {specimen
              ? <Link className="btn" href={path(lang, 'teardown')}>{tx('heroCta', lang)}</Link>
              : <a className="btn" href={`tel:${CO.phone}`}>{ar ? 'اتصلوا بخالد' : 'Call Khaled'}</a>}
            <Link className="btn btn-s" href={path(lang, 'work')}>{tx('allWork', lang)}</Link>
          </div>
        </section>

        <section className="wrap rep-prov">
          <p className="u">{ar ? 'من وين إجت هالأرقام' : 'Where these numbers came from'}</p>
          {r.provenance.map((p, i) => <p className="body prov-p" key={i}>{p[lang]}</p>)}
          <div className="routes">
            <a href={`mailto:${CO.privacyEmail}?subject=Correction`}>
              {ar ? 'في إشي غلط هون — خبرونا' : 'Something here is wrong — tell us'}
            </a>
            <a href={`mailto:${CO.privacyEmail}?subject=Delete`}>
              {ar ? 'احذفوا هاي وكل إشي وراها' : 'Delete this and everything behind it'}
            </a>
          </div>
        </section>
      </article></main>

      <Foot lang={lang} />
    </>
  );
}
