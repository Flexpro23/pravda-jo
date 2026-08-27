'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useCutStage } from '@/components/useCutStage';
import {
  DISCIPLINES, DISCIPLINE_LABEL, DISCIPLINE_SHORT, shotFor,
  type Discipline, type CastMember,
} from '@/lib/data/roster';
import type { Piece } from '@/lib/data/work';
import { CO } from '@/lib/data/company';
import { Lang, path, tx, fwd, back } from '@/lib/i18n';

type Filter = Discipline | 'all';
type Scene =
  | { kind: 'intro' }
  | { kind: 'member'; m: CastMember }
  | { kind: 'empty' }
  | { kind: 'outro' };


/**
 * The roster, cut rather than scrolled.
 *
 * The stage is fixed, so the page never moves: a gesture commits one screen and
 * the frame changes under it — image wiping, name masking up — the way the home
 * page advances. Reduced motion drops to an ordinary scrolling list, because a
 * hijacked scroll with no animation to justify it is only an obstacle.
 */
export default function CastFlow({
  lang, roster, work,
}: { lang: Lang; roster: CastMember[]; work: Piece[] }) {
  const [filter, setFilter] = useState<Filter>('all');
  const demo = roster.some((m) => m.placeholder);
  const shown = filter === 'all' ? roster : roster.filter((m) => m.discipline === filter);

  /* Resolved here rather than imported, because the roster and the archive are
     both read from the store now and a module-level lookup would be reaching
     for data this component was not given. */
  const countBy = (d: Filter) =>
    d === 'all' ? roster.length : roster.filter((m) => m.discipline === d).length;
  const pieceOf = (m: CastMember) => work.find((w) => w.slug === m.piece);

  const scenes: Scene[] = [
    { kind: 'intro' },
    ...(shown.length
      ? shown.map((m): Scene => ({ kind: 'member', m }))
      : [{ kind: 'empty' } as Scene]),
    { kind: 'outro' },
  ];
  const LAST = scenes.length - 1;
  const { i: cur, from, dir, flat, jump, step } = useCutStage(LAST);

  /** A new discipline starts from its first face rather than wherever you were. */
  const pick = (c: Filter) => {
    setFilter(c);
    jump(1);
  };

  const toggle = (
    <nav className="cast-toggle" aria-label={lang === 'ar' ? 'التخصص' : 'Discipline'}>
      {(['all', ...DISCIPLINES] as Filter[]).map((c) => {
        const n = countBy(c);
        return (
          <button
            key={c} type="button" className="u cast-chip"
            aria-pressed={filter === c}
            data-empty={n === 0 ? 'true' : 'false'}
            onClick={() => pick(c)}
            /* Both spellings sit in the DOM and CSS picks one by width, so the
               accessible name is given here rather than read twice over. */
            aria-label={`${DISCIPLINE_LABEL[c][lang]} — ${n}`}
          >
            <span className="cast-long" aria-hidden="true">{DISCIPLINE_LABEL[c][lang]}</span>
            <span className="cast-short" aria-hidden="true">{DISCIPLINE_SHORT[c][lang]}</span>
            <span className="cast-n num ltr" aria-hidden="true">{n}</span>
          </button>
        );
      })}
    </nav>
  );

  const body = (s: Scene, n: number) => {
    if (s.kind === 'intro') {
      return (
        <div className="cast-title cutcopy">
          <h1 className="mega">
            <span className="cut"><span className="d1">{lang === 'ar' ? 'الوجوه' : 'Cast'}</span></span>
          </h1>
          <p className="body cast-thesis lift" style={{ ["--lift" as string]: 2 }}>{tx(demo ? 'castBodyDemo' : 'castBody', lang)}</p>
        </div>
      );
    }
    if (s.kind === 'empty') {
      return <div className="cast-title"><p className="body">{tx('castNone', lang)}</p></div>;
    }
    if (s.kind === 'outro') {
      return (
        <div className="cast-title cutcopy cast-end">
          <span className="u brass lift" style={{ ["--lift" as string]: 0 }}>{tx('navTeardown', lang)}</span>
          <h2 className="cast-end-h">
            <span className="cut"><span className="d1">{tx('castPick', lang)}</span></span>
          </h2>
          <p className="body lift" style={{ ["--lift" as string]: 2 }}>{tx('castPickBody', lang)}</p>
          <div className="hero-actions lift" style={{ ["--lift" as string]: 3 }}>
            <Link className="btn" href={path(lang, 'teardown')}>{tx('heroCta', lang)}</Link>
            <Link className="btn btn-s" href={path(lang, 'teardown/sample')}>{tx('heroCta2', lang)}</Link>
          </div>
          {/* the stage is fixed, so the entity block rides the closing screen */}
          <address className="scene-entity lift" style={{ ["--lift" as string]: 4 }}>
            <span className="u">{CO.legalName[lang]}</span>
            <span className="u">{lang === 'ar' ? 'س.ت' : 'CR'} <span className="num ltr">{CO.cr}</span></span>
            <a className="u tel ltr" href={`tel:${CO.phone}`}>{CO.phoneDisplay}</a>
            <Link className="u link" href={path(lang, 'studio')}>{tx('navStudio', lang)}</Link>
            <Link className="u link" href={path(lang, 'privacy')}>{tx('navPrivacy', lang)}</Link>
          </address>
        </div>
      );
    }
    const { m } = s;
    const piece = pieceOf(m);
    return (
      <>
        <div className="cast-shot cutshot">
          <img src={shotFor(m)} alt="" aria-hidden="true"
               loading={n <= 1 ? 'eager' : 'lazy'} fetchPriority={n <= 1 ? 'high' : 'auto'} />
          <span className="cast-veil" aria-hidden="true" />
        </div>
        <div className="cast-info cutcopy">
          <span className="u cast-disc lift" style={{ ["--lift" as string]: 0 }}>{DISCIPLINE_LABEL[m.discipline][lang]}</span>
          <h2 className="cast-name">
            <span className="cut"><span>{m.name[lang]}</span></span>
          </h2>
          <p className="u cast-role lift" style={{ ["--lift" as string]: 1 }}>{m.role[lang]}</p>
          <p className="body cast-line lift" style={{ ["--lift" as string]: 2 }}>{m.line[lang]}</p>
          {piece && (
            <p className="cast-via lift" style={{ ["--lift" as string]: 3 }}>
              <span className="u">{tx('castReached', lang)}</span>
              <Link className="cast-piece" href={path(lang, `work/${m.piece}`)}>
                {piece.idea[lang]} <span aria-hidden="true">{fwd(lang)}</span>
              </Link>
            </p>
          )}
        </div>
      </>
    );
  };

  const label = (s: Scene) =>
    s.kind === 'member' ? s.m.name[lang]
      : s.kind === 'outro' ? tx('castPick', lang)
        : lang === 'ar' ? 'الوجوه' : 'Cast';

  // ── ordinary scrolling page, for anyone who asked not to be moved ──
  if (flat !== false) {
    return (
      <div className="cast-flat" data-ready={flat === null ? 'false' : 'true'}>
        {toggle}
        {scenes.map((s, n) => (
          <section key={n} className="cast-scene" data-kind={s.kind}
                   data-side={n % 2 ? 'end' : 'start'} aria-label={label(s)}>
            {body(s, n)}
          </section>
        ))}
      </div>
    );
  }

  return (
    <div className="cutstage cast-stage">
      {scenes.map((s, n) => {
        const on = n === cur, out = n === from && n !== cur;
        if (!on && !out) return null;
        return (
          <section
            key={`${filter}-${n}`}
            className="cutscene cast-scene" data-kind={s.kind}
            data-side={n % 2 ? 'end' : 'start'}
            data-state={on ? 'in' : 'out'} data-dir={dir === 1 ? 'fwd' : 'back'}
            aria-hidden={out || undefined}
            aria-label={label(s)}
          >
            {body(s, n)}
          </section>
        );
      })}

      {toggle}

      <div className="cast-hud">
        <span className="u cast-say">
          {tx(cur === 0 ? 'scrollIn' : cur === LAST ? 'keepGoingEnd' : 'keepGoing', lang)}
        </span>
        <span className="ticks" role="presentation">
          {scenes.map((s, n) => <span key={n} className="tick" data-on={n <= cur ? 'true' : 'false'} />)}
        </span>
        <span className="u num ltr">
          {String(cur + 1).padStart(2, '0')} / {String(scenes.length).padStart(2, '0')}
        </span>
        {/* A gesture is not an affordance. These are the same commit, reachable
            by keyboard and announced to a screen reader. */}
        <span className="cast-step">
          <button type="button" className="u cast-arrow" onClick={() => step(-1)}
                  disabled={cur === 0}
                  aria-label={lang === 'ar' ? 'الشاشة السابقة' : 'Previous screen'}>
            <span aria-hidden="true">{back(lang)}</span>
          </button>
          <button type="button" className="u cast-arrow" onClick={() => step(1)}
                  disabled={cur === LAST}
                  aria-label={lang === 'ar' ? 'الشاشة التالية' : 'Next screen'}>
            <span aria-hidden="true">{fwd(lang)}</span>
          </button>
        </span>
      </div>
    </div>
  );
}
