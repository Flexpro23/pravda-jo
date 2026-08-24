import { notFound } from 'next/navigation';
import { SPECIMEN } from '@/lib/data/report';
import { CO } from '@/lib/data/company';
import { sep } from '@/lib/i18n';

export const metadata = {
  title: 'PRAVDA',
  robots: { index: false, follow: false, nocache: true },
};

function resolve(token: string) { return token === 'sample' ? SPECIMEN : null; }

/**
 * The preview. One screen, built only from what the subject published, sent as
 * the first touch. It never asks for anything — it shows one observation and
 * offers the full teardown.
 */
export default async function P({
  params, searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { token } = await params;
  const { lang: q } = await searchParams;
  const r = resolve(token);
  if (!r) notFound();
  const lang = q === 'en' ? 'en' : 'ar';
  const ar = lang === 'ar';

  return (
    <main className="prev">
      <div className="prev-in">
        <p className="u">{CO.city[lang]} · {r.date}</p>
        <p className="u prev-for">{ar ? 'إلى' : 'For'} {r.client[lang]}</p>

        <h1 className="big prev-head">{r.hero.head[lang]}</h1>
        <p className="body">{r.hero.body[lang]}</p>

        <div className="prev-vitals">
          {r.vitals.slice(0, 3).map((v) => (
            <div key={v.label.en}>
              <span className={`v-fig num${v.low ? ' low' : ''}`}>{v.fig}</span>
              <span className="u">{v.label[lang]}</span>
            </div>
          ))}
        </div>

        <p className="body prev-tail">
          {ar
            ? 'قرينا مية منشور من حسابكم العلني. التحقيق الكامل فيه كل الأرقام، وتلات أفكار بأسعارها.'
            : 'We read a hundred posts from your public account. The full teardown has every figure, and three priced ideas.'}
        </p>

        <div className="hero-actions">
          <a className="btn" href={`/r/${token}${ar ? '' : '?lang=en'}`}>
            {ar ? 'افتح التحقيق' : 'Open the teardown'}
          </a>
          <a className="btn btn-s" href={`tel:${CO.phone}`}>{CO.phoneDisplay}</a>
        </div>

        <p className="u prev-foot">
          {CO.legalName[lang]} · {CO.district[lang]}{sep(lang)}{CO.city[lang]} ·{' '}
          <a className="tel" href={`/${lang}/privacy`}>{ar ? 'الخصوصية' : 'Privacy'}</a>
        </p>
      </div>
    </main>
  );
}
