import Link from 'next/link';
import Plate from '@/components/webgl/Plate';
import { Lang, path, tx, fwd } from '@/lib/i18n';
import type { Piece } from '@/lib/data/work';

export default function WorkRows({
  lang, pieces, offset = 0,
}: { lang: Lang; pieces: Piece[]; offset?: number }) {
  return (
    <>
      {pieces.map((p, i) => (
        <article className="row row-work" key={p.slug} style={{ '--row-index': i } as React.CSSProperties}>
          <Link href={path(lang, `work/${p.slug}`)} className="row-media wipeIn">
            <span className="row-n num">{String(offset + i + 1).padStart(2, '0')}</span>
            <Plate src={`/plates/${p.slug}.svg`} alt={p.idea[lang]}
                   width={1200} height={1500} priority={i === 0} grain={0.05} />
          </Link>

          <div className="row-body riseIn row-work-body">
            <div className="row-meta">
              <span className="u">{p.client[lang]}</span>
              <span className="u">{p.sector[lang]}</span>
              <span className="u num ltr">{p.date}</span>
            </div>
            <h3 className="big">{p.idea[lang]}</h3>
            <p className="body">{p.concept[lang]}</p>

            <div className="row-cast">
              {p.cast.map((c) => (
                <span key={c.name.en}>
                  <b>{c.name[lang]}</b>
                  <span className="u">{c.role[lang]}</span>
                </span>
              ))}
            </div>

            <div className="row-metric">
              <span className="v num ltr">{p.metric}</span>
              <span className="u" style={{ maxWidth: '18ch' }}>{p.metricLabel[lang]}</span>
            </div>

            <Link href={path(lang, `work/${p.slug}`)} className="u link">
              {tx('readMore', lang)} {fwd(lang)}
            </Link>
          </div>
        </article>
      ))}
    </>
  );
}
