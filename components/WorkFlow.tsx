'use client';

import Link from 'next/link';
import { useCutStage } from '@/components/useCutStage';
import Plate from '@/components/webgl/Plate';
import WorkRows from '@/components/WorkRows';
import { WORK, type Piece } from '@/lib/data/work';
import { CO } from '@/lib/data/company';
import { Lang, path, tx, fwd, back, sep } from '@/lib/i18n';

type Scene = { kind: 'intro' } | { kind: 'piece'; p: Piece; n: number } | { kind: 'outro' };


/**
 * The archive, cut rather than scrolled.
 *
 * Same stage as Cast: fixed, one gesture per screen, the arriving frame wiping
 * over the outgoing one. A piece carries more record than a person does — who
 * it was for, what the idea was, who shot it, what it returned — so the plate
 * takes one half and the record the other, and the sides alternate.
 */
export default function WorkFlow({ lang }: { lang: Lang }) {

  const scenes: Scene[] = [
    { kind: 'intro' },
    ...WORK.map((p, n): Scene => ({ kind: 'piece', p, n })),
    { kind: 'outro' },
  ];
  const LAST = scenes.length - 1;
  const { i: cur, from, dir, flat, step } = useCutStage(LAST);

  const body = (s: Scene, n: number) => {
    if (s.kind === 'intro') {
      return (
        <div className="wk-title cutcopy">
          <h1 className="mega">
            <span className="cut"><span className="d1">{lang === 'ar' ? 'الأعمال' : 'Work'}</span></span>
          </h1>
          <p className="body wk-thesis lift" style={{ ['--lift' as string]: 2 }}>{tx('workBody', lang)}</p>
        </div>
      );
    }
    if (s.kind === 'outro') {
      return (
        <div className="wk-title wk-end cutcopy">
          <span className="u brass lift" style={{ ['--lift' as string]: 0 }}>{tx('navTeardown', lang)}</span>
          <h2 className="wk-end-h">
            <span className="cut"><span className="d1">{tx('workPick', lang)}</span></span>
          </h2>
          <p className="body lift" style={{ ['--lift' as string]: 2 }}>{tx('workPickBody', lang)}</p>
          <div className="hero-actions lift" style={{ ['--lift' as string]: 3 }}>
            <Link className="btn" href={path(lang, 'teardown')}>{tx('heroCta', lang)}</Link>
            <Link className="btn btn-s" href={path(lang, 'teardown/sample')}>{tx('heroCta2', lang)}</Link>
          </div>
          {/* the stage is fixed, so the entity block rides the closing screen */}
          <address className="scene-entity lift" style={{ ['--lift' as string]: 4 }}>
            <span className="u">{CO.legalName[lang]}</span>
            <span className="u">{lang === 'ar' ? 'س.ت' : 'CR'} <span className="num ltr">{CO.cr}</span></span>
            <a className="u tel ltr" href={`tel:${CO.phone}`}>{CO.phoneDisplay}</a>
            <Link className="u link" href={path(lang, 'studio')}>{tx('navStudio', lang)}</Link>
            <Link className="u link" href={path(lang, 'privacy')}>{tx('navPrivacy', lang)}</Link>
          </address>
        </div>
      );
    }
    const { p } = s;
    return (
      <>
        <Link href={path(lang, `work/${p.slug}`)} className="wk-shot cutshot"
              aria-label={`${p.idea[lang]} — ${p.client[lang]}`}>
          <Plate src={`/plates/${p.slug}.svg`} alt="" width={1200} height={1500}
                 priority={n <= 1} grain={0.05} fill />
          <span className="wk-veil" aria-hidden="true" />
          <span className="wk-n num ltr" aria-hidden="true">{String(s.n + 1).padStart(2, '0')}</span>
        </Link>

        <div className="wk-info cutcopy">
          <div className="row-meta lift" style={{ ['--lift' as string]: 0 }}>
            <span className="u">{p.client[lang]}</span>
            <span className="u">{p.sector[lang]}</span>
            <span className="u num ltr">{p.date}</span>
          </div>
          <h2 className="wk-idea">
            <span className="cut"><span>{p.idea[lang]}</span></span>
          </h2>
          <p className="body wk-concept lift" style={{ ['--lift' as string]: 2 }}>{p.concept[lang]}</p>
          <div className="row-cast lift" style={{ ['--lift' as string]: 3 }}>
            {p.cast.map((c) => (
              <span key={c.name.en}>
                <b>{c.name[lang]}</b>
                <span className="u">{c.role[lang]}</span>
              </span>
            ))}
          </div>
          <div className="row-metric lift" style={{ ['--lift' as string]: 4 }}>
            <span className="v num ltr">{p.metric}</span>
            <span className="u" style={{ maxWidth: '18ch' }}>{p.metricLabel[lang]}</span>
          </div>
          <p className="wk-go lift" style={{ ['--lift' as string]: 5 }}>
            <Link className="u link" href={path(lang, `work/${p.slug}`)}>
              {tx('readMore', lang)} {fwd(lang)}
            </Link>
            <span className="u wk-price">
              {p.price.toLocaleString('en-US')} {tx('jod', lang)}{sep(lang)}
              <span className="num">{p.assets}</span>{' '}
              {lang === 'ar' ? (p.assets >= 3 && p.assets <= 10 ? 'مقاطع' : 'مقطعًا') : 'assets'}
            </span>
          </p>
        </div>
      </>
    );
  };

  const label = (s: Scene) =>
    s.kind === 'piece' ? s.p.idea[lang]
      : s.kind === 'outro' ? tx('workPick', lang)
        : lang === 'ar' ? 'الأعمال' : 'Work';

  // ── ordinary scrolling page, for a phone or anyone who asked not to be moved ──
  if (flat !== false) {
    return (
      <div className="wk-flat" data-ready={flat === null ? 'false' : 'true'}>
        <section className="wsec" style={{ paddingBlockStart: 'clamp(140px,20vh,260px)' }}>
          <div className="wrap wsec-head">
            <h1 className="mega">
              <span className="cut"><span className="d1">{lang === 'ar' ? 'الأعمال' : 'Work'}</span></span>
            </h1>
            <p className="body fade d3">{tx('workBody', lang)}</p>
          </div>
          <div className="wrap"><WorkRows lang={lang} pieces={WORK} /></div>
        </section>
        <section className="wk-title wk-end wk-end-flat">
          <span className="u brass">{tx('navTeardown', lang)}</span>
          <h2 className="wk-end-h">{tx('workPick', lang)}</h2>
          <p className="body">{tx('workPickBody', lang)}</p>
          <div className="hero-actions">
            <Link className="btn" href={path(lang, 'teardown')}>{tx('heroCta', lang)}</Link>
            <Link className="btn btn-s" href={path(lang, 'teardown/sample')}>{tx('heroCta2', lang)}</Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="cutstage wk-stage">
      {scenes.map((s, n) => {
        const on = n === cur, out = n === from && n !== cur;
        if (!on && !out) return null;
        return (
          <section
            key={n}
            className="cutscene wk-scene" data-kind={s.kind}
            data-side={n % 2 ? 'end' : 'start'}
            data-state={on ? 'in' : 'out'} data-dir={dir === 1 ? 'fwd' : 'back'}
            aria-hidden={out || undefined}
            aria-label={label(s)}
          >
            {body(s, n)}
          </section>
        );
      })}

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
