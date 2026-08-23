import Link from 'next/link';
import Plate from '@/components/webgl/Plate';
import { Lang, path, tx } from '@/lib/i18n';
import type { Piece } from '@/lib/data/work';

/**
 * The system's spine. One layout renders a public archive record and a live
 * teardown concept — identical to the eye, which is where the trust payoff is.
 */
export default function Triptych({
  piece, lang, priority = false, index = 0,
}: { piece: Piece; lang: Lang; priority?: boolean; index?: number }) {
  const img = `/plates/${piece.slug}.svg`;
  return (
    <article className="trip reveal" style={{ ['--hue' as string]: piece.hue }}>
      <Link href={path(lang, `work/${piece.slug}`)} className="trip-plate">
        <Plate src={img} alt={piece.idea[lang]} width={1000} height={1250} priority={priority} />
        <span className="trip-idx u num">{String(index + 1).padStart(2, '0')}</span>
      </Link>

      <div className="trip-body">
        <p className="u trip-meta">
          {piece.client[lang]} · {piece.sector[lang]} · <span className="num ltr">{piece.date}</span>
        </p>
        <h3 className="d2 trip-idea">{piece.idea[lang]}</h3>
        <p className="body trip-concept">{piece.concept[lang]}</p>

        <div className="trip-foot">
          <div>
            <span className="u">{tx('cast', lang)}</span>
            <ul className="cast-list">
              {piece.cast.map((c) => (
                <li key={c.name.en}>
                  <span className="cast-nm">{c.name[lang]}</span>
                  <span className="u cast-role">{c.role[lang]}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="trip-res">
            <span className="u">{tx('result', lang)}</span>
            <p className="metric num">{piece.metric}</p>
            <p className="u metric-lbl">{piece.metricLabel[lang]}</p>
          </div>
        </div>

        <Link href={path(lang, `work/${piece.slug}`)} className="u link trip-more">
          {tx('readMore', lang)} →
        </Link>
      </div>
    </article>
  );
}
