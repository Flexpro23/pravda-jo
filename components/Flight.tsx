'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Terrain, { capable, type RippleFn } from '@/components/webgl/Terrain';
import { SCENES } from '@/lib/data/scenes';
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

  const onTerrainReady = useCallback((fire: RippleFn) => { fireRef.current = fire; }, []);

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

    let touchY = 0;
    const onTouchStart = (e: TouchEvent) => { touchY = e.touches[0].clientY; lastInput = performance.now(); };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const y = e.touches[0].clientY;
      feed((touchY - y) * 2.1);
      touchY = y;
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
        if (t >= 1) tweening = false;
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
        accum = 0;
      }
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
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
              <div className="hero-actions">
                <Link className="btn" href={path(lang, 'teardown')}>{tx('heroCta', lang)}</Link>
                <Link className="btn btn-s" href={path(lang, 'work')}>{tx('allWork', lang)}</Link>
              </div>
            )}
          </section>
        ))}
      </div>
    );
  }

  return (
    <div className="stage" data-live={live ? 'true' : 'false'}>
      <Terrain progressRef={progress} onReady={onTerrainReady} />

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
                <div className="scene-actions" style={{ opacity: clamp(e * 1.8 - 0.7) }}>
                  <Link className="btn" href={path(lang, 'teardown')}>{tx('heroCta', lang)}</Link>
                  <Link className="btn btn-s" href={path(lang, 'work')}>{tx('allWork', lang)}</Link>
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
