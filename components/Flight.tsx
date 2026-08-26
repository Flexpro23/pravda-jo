'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Terrain, { capable, type RippleFn, type FormFn } from '@/components/webgl/Terrain';
import { SCENES } from '@/lib/data/scenes';
import { CO } from '@/lib/data/company';
import { Lang, path, tx } from '@/lib/i18n';

const clamp = (n: number, a = 0, b = 1) => Math.min(b, Math.max(a, n));
const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/** Each scene holds at the centre of its own range. */
const STOPS = SCENES.map((s) => (s.at[0] + s.at[1]) / 2);
const LAST = STOPS.length - 1;

/** One gesture moves exactly one section. */
const THRESHOLD = 70;    // accumulated wheel px before a section commits
const DURATION = 900;    // ms of travel between sections
const QUIET = 260;       // ms of silence required before the next gesture counts

export default function Flight({ lang }: { lang: Lang }) {
  const progress = useRef(STOPS[0]);
  const idx = useRef(0);
  const [live, setLive] = useState<boolean | null>(null);
  const [p, setP] = useState(STOPS[0]);
  const [section, setSection] = useState(0);
  const fireRef = useRef<RippleFn>(() => {});
  const formRef = useRef<FormFn>(() => {});
  const morph = useRef(0);

  const onTerrainReady = useCallback((fire: RippleFn, setForm: FormFn) => {
    fireRef.current = fire;
    formRef.current = setForm;
  }, []);

  useEffect(() => { setLive(capable()); }, []);

  useEffect(() => {
    if (!live) return;

    // tween state
    let from = STOPS[0], to = STOPS[0], startedAt = 0, tweening = false;
    // gesture state
    let accum = 0, lastInput = 0, locked = false;
    let raf = 0;

    const go = (dir: 1 | -1) => {
      const next = Math.min(LAST, Math.max(0, idx.current + dir));
      if (next === idx.current) return false;
      idx.current = next;
      // swap the form while the field is dispersed, so the change is unseen
      formRef.current(next);
      from = progress.current;
      to = STOPS[next];
      startedAt = performance.now();
      tweening = true;
      locked = true;
      accum = 0;
      setSection(next);
      // strike the surface — strength scales with how far we travelled
      fireRef.current(1, (Math.random() - 0.5) * 1.4);
      return true;
    };

    const feed = (delta: number) => {
      lastInput = performance.now();
      if (locked) return;              // absorb momentum entirely
      accum += delta;
      if (Math.abs(accum) >= THRESHOLD) go(accum > 0 ? 1 : -1);
    };

    const onWheel = (e: WheelEvent) => { e.preventDefault(); feed(e.deltaY); };

    // One finger is followed by identifier, not by position in the touch list.
    // touches[0] is an index, not a finger: rest a thumb on the screen while
    // dragging with another finger and lifting the thumb makes the drag finger
    // become touches[0], so the next move measures the gap between two
    // different fingers and throws the flight several sections at once.
    let touchY = 0;
    let touchId: number | null = null;

    const tracked = (list: TouchList) => {
      for (let k = 0; k < list.length; k++) {
        if (list[k].identifier === touchId) return list[k];
      }
      return null;
    };

    const onTouchStart = (e: TouchEvent) => {
      // Keep following our finger only while it is genuinely still down. A
      // touchend can go missing — iOS hands the gesture to the system for a
      // Control Centre or app-switcher swipe and neither end nor cancel
      // arrives — and a touchId pinned to a finger that has long since left
      // would leave the stage deaf to every later swipe, with no failsafe the
      // way the commit lock has one.
      if (touchId !== null && tracked(e.touches)) return;
      const t = e.changedTouches[0];
      if (!t) return;
      touchId = t.identifier;
      touchY = t.clientY;
      lastInput = performance.now();
    };
    const onTouchMove = (e: TouchEvent) => {
      const t = tracked(e.touches);
      if (!t) return;                          // our finger is not the one moving
      e.preventDefault();
      const y = t.clientY;
      // A single frame can never legitimately travel a whole screen; clamping
      // keeps any residual jump from skipping several sections at once.
      feed(Math.max(-260, Math.min(260, (touchY - y) * 2.1)));
      touchY = y;
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (!tracked(e.changedTouches)) return;  // some other finger left; ours still leads
      // Hand the gesture to a finger that is still down rather than dropping it,
      // re-anchored to where that finger is now so the handover itself moves nothing.
      const next = e.touches[0];
      touchId = next ? next.identifier : null;
      if (next) touchY = next.clientY;
    };

    const onKey = (e: KeyboardEvent) => {
      const d = e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ' ? 1
        : e.key === 'ArrowUp' || e.key === 'PageUp' ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      lastInput = performance.now();
      if (!locked) go(d as 1 | -1);
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchEnd, { passive: true });
    window.addEventListener('keydown', onKey);

    if (process.env.NODE_ENV !== 'production') {
      (window as unknown as Record<string, unknown>).__flight = {
        get: () => ({ p: progress.current, i: idx.current, locked }),
        to: (n: number) => { const d = n > idx.current ? 1 : -1; while (idx.current !== n && go(d)); },
      };
    }

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);

      if (tweening) {
        const t = clamp((now - startedAt) / DURATION);
        progress.current = from + (to - from) * easeInOut(t);
        setP(progress.current);
        // The field disperses while travelling and resolves once it settles —
        // raw material between scenes, a formed image at each one.
        morph.current = t < 0.55 ? 0 : (t - 0.55) / 0.45;
        if (t >= 1) { tweening = false; morph.current = 1; }
      }

      // Unlock only when the travel has finished AND the input has gone quiet.
      // Without the quiet test, trackpad momentum immediately commits the next
      // section and a single flick skips three.
      if (locked && !tweening && now - lastInput > QUIET) {
        locked = false;
        accum = 0;
      }

      // Failsafe. A lock that never clears makes the page unscrollable, which
      // is far worse than a skipped section — so release unconditionally well
      // past the point where both conditions should already have been met.
      if (locked && now - startedAt > DURATION + 2500) {
        locked = false;
        tweening = false;
        progress.current = to;
        setP(to);
        morph.current = 1;
        accum = 0;
      }
    };
    // the first form resolves once the entrance has settled
    const opening = window.setTimeout(() => { morph.current = 1; }, 2600);

    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(opening);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
      window.removeEventListener('keydown', onKey);
    };
  }, [live]);

  // ── fallback: an ordinary scrolling page ──
  if (live === false) {
    return (
      <div className="flat">
        {SCENES.map((s, i) => (
          <section className="flat-scene" key={i}>
            {s.pre && <p className="u">{s.pre[lang]}</p>}
            <h2 className="mega">{s.head[lang]}{s.sup && <span className="sup num">{s.sup}</span>}</h2>
            <p className="body">{s.sub[lang]}</p>
            {s.outro && (
              <>
                <div className="hero-actions">
                  <Link className="btn" href={path(lang, 'teardown')}>{tx('heroCta', lang)}</Link>
                  <Link className="btn btn-s" href={path(lang, 'work')}>{tx('allWork', lang)}</Link>
                </div>
                <address className="scene-entity">
                  <span className="u">{CO.legalName[lang]}</span>
                  <span className="u">{lang === 'ar' ? 'س.ت' : 'CR'} <span className="num ltr">{CO.cr}</span></span>
                  <span className="u">{CO.district[lang]}، {CO.city[lang]}</span>
                  <a className="u tel ltr" href={`tel:${CO.phone}`}>{CO.phoneDisplay}</a>
                </address>
              </>
            )}
          </section>
        ))}
      </div>
    );
  }

  return (
    <div className="stage" data-live={live ? 'true' : 'false'}>
      <Terrain progressRef={progress} morphRef={morph} onReady={onTerrainReady} />

      <div className="stage-type">
        {SCENES.map((s, i) => {
          const [a, b] = s.at;
          const span = b - a;
          const t = clamp((p - a) / span);
          const PAD = 0.05;
          const env = Math.sin(clamp((p - (a - PAD)) / (span + PAD * 2)) * Math.PI);
          const e = clamp(env * 1.55 - 0.18);
          const vis = e > 0.012;
          const headY = (0.5 - t) * 190;
          const headScale = 1 + (0.5 - t) * 0.10;
          const preX = (0.5 - t) * 26;

          return (
            <div key={i} className="scene" aria-hidden={!vis}
                 style={{ opacity: e, visibility: vis ? 'visible' : 'hidden' }}>
              {s.pre && (
                <span className="scene-pre u" style={{ transform: `translateX(${preX}vw)`, opacity: e * 0.9 }}>
                  {s.pre[lang]}
                </span>
              )}
              <h2 className="scene-head mega"
                  style={{ transform: `translate3d(0,${headY}px,0) scale(${headScale})` }}>
                {s.head[lang]}{s.sup && <span className="sup num">{s.sup}</span>}
              </h2>
              <p className="scene-sub body"
                 style={{ opacity: clamp(e * 1.8 - 0.7), transform: `translate3d(0,${headY * 0.42}px,0)` }}>
                {s.sub[lang]}
              </p>
              {s.outro && (
                <div style={{ opacity: clamp(e * 1.8 - 0.7) }}>
                  <div className="scene-actions">
                    <Link className="btn" href={path(lang, 'teardown')}>{tx('heroCta', lang)}</Link>
                    <Link className="btn btn-s" href={path(lang, 'work')}>{tx('allWork', lang)}</Link>
                  </div>
                  {/* The entity block belongs on the homepage too: it is where a
                      cold visitor lands when they search the name, and it is
                      what Meta Business Verification checks for. */}
                  <address className="scene-entity">
                    <span className="u">{CO.legalName[lang]}</span>
                    <span className="u">{lang === 'ar' ? 'س.ت' : 'CR'} <span className="num ltr">{CO.cr}</span></span>
                    <span className="u">{CO.district[lang]}، {CO.city[lang]}</span>
                    <a className="u tel ltr" href={`tel:${CO.phone}`}>{CO.phoneDisplay}</a>
                    <Link className="u link" href={path(lang, 'studio')}>{tx('navStudio', lang)}</Link>
                    <Link className="u link" href={path(lang, 'privacy')}>{tx('navPrivacy', lang)}</Link>
                  </address>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* discrete markers — one per section, so position is legible at a glance */}
      <div className="stage-hud">
        <span className="u">
          {section === 0 ? tx('scrollIn', lang) : section === LAST ? tx('keepGoingEnd', lang) : tx('keepGoing', lang)}
        </span>
        <span className="ticks" role="presentation">
          {SCENES.map((_, i) => (
            <span key={i} className="tick" data-on={i <= section ? 'true' : 'false'} />
          ))}
        </span>
        <span className="u num">{String(section + 1).padStart(2, '0')} / {String(SCENES.length).padStart(2, '0')}</span>
      </div>
    </div>
  );
}
