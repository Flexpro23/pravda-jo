'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Terrain, { capable } from '@/components/webgl/Terrain';
import { SCENES } from '@/lib/data/scenes';
import { Lang, path, tx } from '@/lib/i18n';

const clamp = (n: number, a = 0, b = 1) => Math.min(b, Math.max(a, n));

/**
 * The flight. Scroll never moves the document — it is captured, integrated
 * into a single normalised progress value, and that one value drives both the
 * camera and the type. One clock, two consumers.
 *
 * If the device cannot carry it, or the reader asked for reduced motion, the
 * whole thing renders as an ordinary scrolling page instead.
 */
export default function Flight({ lang }: { lang: Lang }) {
  const progress = useRef(0);
  const target = useRef(0);
  const [live, setLive] = useState<boolean | null>(null);
  const [p, setP] = useState(0);
  const stage = useRef<HTMLDivElement>(null);

  useEffect(() => { setLive(capable()); }, []);

  useEffect(() => {
    if (!live) return;
    const el = stage.current;
    if (!el) return;

    let raf = 0;
    const SPAN = 5200; // px of wheel travel for the whole flight

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      target.current = clamp(target.current + e.deltaY / SPAN);
    };
    let touchY = 0;
    const onTouchStart = (e: TouchEvent) => { touchY = e.touches[0].clientY; };
    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0].clientY;
      target.current = clamp(target.current + (touchY - y) / (SPAN * 0.42));
      touchY = y;
      e.preventDefault();
    };
    const onKey = (e: KeyboardEvent) => {
      const step = e.key === 'PageDown' || e.key === ' ' ? 0.14
        : e.key === 'PageUp' ? -0.14
        : e.key === 'ArrowDown' ? 0.05 : e.key === 'ArrowUp' ? -0.05 : 0;
      if (step) { e.preventDefault(); target.current = clamp(target.current + step); }
    };

    // dev handle so the flight can be driven from the console / tests
    if (process.env.NODE_ENV !== 'production') {
      (window as unknown as Record<string, unknown>).__flight = {
        get: () => ({ p: progress.current, t: target.current }),
        set: (v: number) => { target.current = clamp(v); },
      };
    }
    window.addEventListener('wheel', onWheel, { passive: false });
    document.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('keydown', onKey);

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const next = progress.current + (target.current - progress.current) * 0.062;
      if (Math.abs(next - progress.current) > 0.00002) {
        progress.current = next;
        setP(next);
      }
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('wheel', onWheel);
      document.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('keydown', onKey);
    };
  }, [live]);

  // ── fallback: a plain scrolling page ──
  if (live === false) {
    return (
      <div className="flat">
        {SCENES.map((s, i) => (
          <section className="flat-scene" key={i}>
            {s.pre && <p className="u">{s.pre[lang]}</p>}
            <h2 className="mega">
              {s.head[lang]}
              {s.sup && <span className="sup num">{s.sup}</span>}
            </h2>
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
    <div ref={stage} className="stage" data-live={live ? 'true' : 'false'}>
      <Terrain progressRef={progress} />

      <div className="stage-type">
        {SCENES.map((s, i) => {
          const [a, b] = s.at;
          const span = b - a;
          const t = clamp((p - a) / span);
          // Symmetric in/out envelope, then CLIPPED so the tails reach a true
          // zero. Without the clip, neighbouring scenes overlap in the gap
          // between their ranges and render on top of one another.
          const PAD = 0.05;
          const env = Math.sin(clamp((p - (a - PAD)) / (span + PAD * 2)) * Math.PI);
          const e = clamp(env * 1.55 - 0.18);
          const vis = e > 0.012;
          // Scenes must not crossfade in place — two headlines at the same
          // position read as a broken render, not a transition. The outgoing
          // one travels up and away while the incoming rises into frame.
          const headY = (0.5 - t) * 190;      // px
          const headScale = 1 + (0.5 - t) * 0.10;
          const preX = (0.5 - t) * 26;

          return (
            <div
              key={i}
              className="scene"
              aria-hidden={!vis}
              style={{ opacity: e, visibility: vis ? 'visible' : 'hidden' }}
            >
              {s.pre && (
                <span className="scene-pre u" style={{ transform: `translateX(${preX}vw)`, opacity: e * 0.9 }}>
                  {s.pre[lang]}
                </span>
              )}
              <h2
                className="scene-head mega"
                style={{ transform: `translate3d(0,${headY}px,0) scale(${headScale})` }}
              >
                {s.head[lang]}
                {s.sup && <span className="sup num">{s.sup}</span>}
              </h2>
              <p
                className="scene-sub body"
                style={{ opacity: clamp(e * 1.8 - 0.7), transform: `translate3d(0,${headY * 0.42}px,0)` }}
              >{s.sub[lang]}</p>
              {s.outro && (
                <div className="scene-actions" style={{ opacity: clamp(e * 1.6 - 0.5) }}>
                  <Link className="btn" href={path(lang, 'teardown')}>{tx('heroCta', lang)}</Link>
                  <Link className="btn btn-s" href={path(lang, 'work')}>{tx('allWork', lang)}</Link>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="stage-hud">
        <span className="u">{p < 0.02 ? tx('scrollIn', lang) : p > 0.97 ? tx('keepGoingEnd', lang) : tx('keepGoing', lang)}</span>
        <span className="rail"><span className="rail-fill" style={{ transform: `scaleX(${p})` }} /></span>
        <span className="u num">{String(Math.round(p * 100)).padStart(2, '0')}</span>
      </div>
    </div>
  );
}
