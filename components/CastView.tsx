import Link from 'next/link';
import Page from '@/components/Page';
import { WORK } from '@/lib/data/work';
import { Lang, path, tx } from '@/lib/i18n';

/** Distinct tints so the grid never reads as one box repeated. */
const TINTS = ['#22332A', '#1A2A20', '#283B2E', '#1E3025', '#243629', '#182A1F'];

export default function CastView({ lang }: { lang: Lang }) {
  const seen = new Map<string, { name: string; role: string; slug: string; piece: string }>();
  for (const p of WORK) for (const c of p.cast)
    if (!seen.has(c.name.en)) {
      seen.set(c.name.en, {
        name: c.name[lang], role: c.role[lang], slug: p.slug, piece: p.idea[lang],
      });
    }
  const people = [...seen.values()];

  return (
    <Page lang={lang}>
      <section className="wsec" style={{ paddingBlockStart: 'clamp(140px,20vh,260px)' }}>
        <div className="wrap wsec-head">
          <h1 className="mega">
            <span className="cut"><span className="d1">{lang === 'ar' ? 'الوجوه' : 'Cast'}</span></span>
          </h1>
          <p className="body fade d3">{tx('castBody', lang)}</p>
        </div>
        <div className="wrap">
          <div className="faces">
            {people.map((p, i) => (
              <Link
                key={p.name}
                href={path(lang, `work/${p.slug}`)}
                className="face riseIn"
                /* The card shows a name; the link goes to the work it was made
                   on, which is the whole premise of the page. */
                aria-label={`${p.name} — ${p.role} — ${p.piece}`}
              >
                <div className="face-img"
                     style={{ '--tint': TINTS[i % TINTS.length] } as React.CSSProperties}>
                  <span className="mono" aria-hidden="true">{[...p.name][0]}</span>
                </div>
                <div className="face-i">
                  <p className="face-nm">{p.name}</p>
                  <span className="u">{p.role}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </Page>
  );
}
