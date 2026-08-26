'use client';

import { useEffect, useRef, useState } from 'react';

/** One gesture moves exactly one screen — the same contract as the flight. */
const THRESHOLD = 70;   // accumulated wheel px before a screen commits
const QUIET = 260;      // ms of silence required before the next gesture counts

/**
 * The cut length lives in CSS as --cut and is read back here, so the gesture
 * lock and the animation can never disagree about how long a screen takes.
 */
const cutMs = () => {
  const v = getComputedStyle(document.documentElement).getPropertyValue('--cut').trim();
  return parseFloat(v) || 720;
};

const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));

/**
 * The nearest ancestor that can still be scrolled. A fixed stage swallows every
 * gesture, which is correct until a screen's own copy is taller than the phone
 * holding it — then the reader has to be able to pan that copy without the
 * stage stealing the drag and jumping to the next screen.
 */
const scrollableUnder = (start: EventTarget | null): HTMLElement | null => {
  let n: Element | null = start instanceof Element ? start : null;
  while (n && n !== document.body) {
    const s = getComputedStyle(n);
    if (/(auto|scroll)/.test(s.overflowY) && n.scrollHeight - n.clientHeight > 1) {
      return n as HTMLElement;
    }
    n = n.parentElement;
  }
  return null;
};

const hasRoom = (el: HTMLElement, d: number) =>
  d > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 1 : el.scrollTop > 1;

/**
 * The shared stage controller behind Cast and Work.
 *
 * Both pages present the same contract — a fixed frame, one gesture per screen,
 * the arriving frame wiping over the outgoing one — so they run the same
 * controller rather than two copies that drift apart. The stage is the
 * experience at every width; only an explicit reduced-motion preference drops
 * to the scrolling fallback.
 */
export function useCutStage(last: number) {
  const [i, setI] = useState(0);
  const [from, setFrom] = useState<number | null>(null);
  const [dir, setDir] = useState<1 | -1>(1);
  const [flat, setFlat] = useState<boolean | null>(null);
  const idx = useRef(0);
  /* the committed advance, so visible controls can drive the same path a gesture does */
  const goRef = useRef<(d: 1 | -1) => void>(() => {});

  useEffect(() => {
    const still = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setFlat(still.matches);
    sync();
    still.addEventListener('change', sync);
    return () => still.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (flat !== false) return;

    let locked = false, accum = 0, lastInput = 0, startedAt = 0;
    let raf = 0, drop = 0;
    let panner: HTMLElement | null = null;
    const CUT = cutMs();

    const go = (d: 1 | -1) => {
      const next = clamp(idx.current + d, 0, last);
      if (next === idx.current) return;
      setFrom(idx.current);
      setDir(d);
      idx.current = next;
      setI(next);
      startedAt = performance.now();
      locked = true;
      accum = 0;
      // the outgoing screen is only needed while it is being wiped away
      window.clearTimeout(drop);
      drop = window.setTimeout(() => setFrom(null), CUT);
    };
    goRef.current = go;

    const feed = (delta: number) => {
      lastInput = performance.now();
      if (locked) return;                     // absorb trackpad momentum whole
      accum += delta;
      if (Math.abs(accum) >= THRESHOLD) go(accum > 0 ? 1 : -1);
    };

    const onWheel = (e: WheelEvent) => {
      const d = e.deltaY || e.deltaX;
      const p = scrollableUnder(e.target);
      if (p && hasRoom(p, d)) return;         // the copy still has room; let it pan
      e.preventDefault();
      feed(d);
    };

    // One finger is followed by identifier, not by position in the touch list.
    // touches[0] is an index, not a finger: rest a thumb on the screen while
    // dragging with another finger and lifting the thumb makes the drag finger
    // become touches[0], so the next move measures the gap between two
    // different fingers and commits a cut nobody asked for.
    let touchY = 0;
    let touchId: number | null = null;

    const onTouchStart = (e: TouchEvent) => {
      if (touchId !== null) return;            // already following a finger
      const t = e.changedTouches[0];
      if (!t) return;
      touchId = t.identifier;
      touchY = t.clientY;
      lastInput = performance.now();
      panner = scrollableUnder(t.target);
    };

    const tracked = (list: TouchList) => {
      for (let k = 0; k < list.length; k++) {
        if (list[k].identifier === touchId) return list[k];
      }
      return null;
    };

    const onTouchMove = (e: TouchEvent) => {
      const t = tracked(e.touches);
      if (!t) return;                          // our finger is not the one moving
      const y = t.clientY;
      // A single frame can never legitimately travel a whole screen; clamping
      // keeps any residual jump from skipping several screens at once.
      const d = Math.max(-260, Math.min(260, (touchY - y) * 2.1));
      touchY = y;
      if (panner && hasRoom(panner, d)) return;
      e.preventDefault();
      feed(d);
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (tracked(e.changedTouches)) { touchId = null; panner = null; }
    };

    const onKey = (e: KeyboardEvent) => {
      const d = ['ArrowDown', 'PageDown', ' ', 'ArrowRight'].includes(e.key) ? 1
        : ['ArrowUp', 'PageUp', 'ArrowLeft'].includes(e.key) ? -1 : 0;
      if (!d) return;
      const el = document.activeElement;
      if (el && /^(INPUT|TEXTAREA|BUTTON|A)$/.test(el.tagName) && e.key === ' ') return;
      e.preventDefault();
      lastInput = performance.now();
      if (!locked) go(d as 1 | -1);
    };

    if (process.env.NODE_ENV !== 'production') {
      (window as unknown as Record<string, unknown>).__stage = {
        get: () => ({ i: idx.current, last }),
        to: (n: number) => {
          const next = clamp(n, 0, last);
          setFrom(null); setDir(next >= idx.current ? 1 : -1);
          idx.current = next; setI(next);
        },
      };
    }

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchEnd, { passive: true });
    window.addEventListener('keydown', onKey);

    // Release only once the cut has finished AND input has gone quiet, with an
    // unconditional failsafe — a stuck lock makes the page unusable.
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (locked && now - startedAt > CUT && now - lastInput > QUIET) { locked = false; accum = 0; }
      if (locked && now - startedAt > CUT + 2500) { locked = false; accum = 0; }
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(drop);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
      window.removeEventListener('keydown', onKey);
    };
  }, [flat, last]);

  /** Jump without a cut — for a filter change, which re-forms the whole list. */
  const jump = (n: number) => {
    const next = clamp(n, 0, last);
    idx.current = next; setI(next); setFrom(null);
  };

  /**
   * The same commit a gesture makes. A fixed stage that only answers to wheel
   * and swipe is unreachable past its first screen for anyone using a screen
   * reader or a keyboard on a touch device, so the pages surface this as real
   * buttons rather than relying on the gesture alone.
   */
  const step = (d: 1 | -1) => goRef.current(d);

  return { i: Math.min(i, last), from, dir, flat, jump, step };
}
