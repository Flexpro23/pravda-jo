import Page from '@/components/Page';
import { CO, FOUNDERS } from '@/lib/data/company';
import { Lang, sep } from '@/lib/i18n';

/** Distinct tints so two reserved frames never read as one repeated box. */
const TINTS = ['#283B2E', '#1C2A20'];

export default function StudioView({ lang }: { lang: Lang }) {
  const ar = lang === 'ar';
  return (
    <Page lang={lang}>
      <section className="wsec" style={{ paddingBlockStart: 'clamp(140px,20vh,240px)' }}>
        <div className="wrap wsec-head">
          <h1 className="mega"><span className="cut"><span className="d1">{ar ? 'الاستوديو' : 'Studio'}</span></span></h1>
          <p className="body fade d3">
            {ar
              ? 'برافدا اتنين: علي وخالد. والباقي روستر منشتغل معه لكل مشروع — ما منوظّف تسعين شخص، منكاستهم.'
              : 'PRAVDA is two people, Ali and Khaled. Everyone else is a roster we cast per project — we do not employ ninety people, we book them.'}
          </p>
        </div>

        <div className="wrap founders">
          {FOUNDERS.map((f, i) => (
            <article key={f.key} className="founder riseIn">
              <div className="founder-img"
                   style={{ '--tint': TINTS[i % TINTS.length] } as React.CSSProperties}>
                <span className="mono" aria-hidden="true">{[...f.name[lang]][0]}</span>
              </div>
              <div>
                <h2 className="mid">{f.name[lang]}</h2>
                <p className="u founder-role">{f.role[lang]}</p>
                <p className="body">{f.bio[lang]}</p>
              </div>
            </article>
          ))}
        </div>

        <div className="wrap">
          <div className="card-block riseIn">
            <p className="u" style={{ marginBottom: 'var(--s4)' }}>
              {ar ? 'الشركة' : 'The company'}
            </p>
            <dl className="facts">
              <dt className="u">{ar ? 'الاسم القانوني' : 'Registered name'}</dt>
              <dd>{CO.legalName[lang]}</dd>
              <dt className="u">{ar ? 'السجل التجاري' : 'Commercial registration'}</dt>
              <dd className="num ltr">{CO.cr}</dd>
              <dt className="u">{ar ? 'العنوان' : 'Address'}</dt>
              <dd>{[CO.street, CO.district, CO.city, CO.country].map((f) => f[lang]).join(sep(lang))}</dd>
              <dt className="u">{ar ? 'الهاتف' : 'Phone'}</dt>
              <dd><a className="tel ltr" href={`tel:${CO.phone}`}>{CO.phoneDisplay}</a></dd>
              <dt className="u">{ar ? 'البريد' : 'Email'}</dt>
              <dd><a className="tel ltr" href={`mailto:${CO.email}`}>{CO.email}</a></dd>
            </dl>
            <p className="body" style={{ marginTop: 'var(--s5)' }}>
              {ar
                ? 'حطّينا هالتفاصيل لأنّ اللي بيوصله رسالة من حدا ما بيعرفه بيدوّر عليها — اسم مسجّل، رقم، عنوان، وتلفون بيردّ.'
                : 'These are here because someone who receives a message from a stranger goes looking for them — a registered name, a number, a street, and a phone that answers.'}
            </p>
          </div>
        </div>
      </section>
    </Page>
  );
}
