'use client';

import { useEffect, useRef, useState } from 'react';
import { EmeraldHorizonBackground } from '@designcodeio/threeui/components/EmeraldHorizonBackground';
import { RibbonFieldBackground } from '@designcodeio/threeui/components/RibbonFieldBackground';

/**
 * ThreeUI's generative shader backgrounds, wrapped.
 *
 * The library components pause on IntersectionObserver but ship no
 * prefers-reduced-motion check, no visibilitychange pause, and no
 * webglcontextlost handling. This wrapper adds all three, plus a capability
 * gate so nothing is mounted — and therefore no shader is compiled — on a
 * device that would stall on it.
 *
 * Under any failing condition the CSS gradient underneath is what shows, so
 * the page is never blank and nothing appears then vanishes.
 */
function useCapable() {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const rm = window.matchMedia('(prefers-reduced-motion: reduce)');
    const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    const check = () =>
      !rm.matches &&
      !(typeof mem === 'number' && mem < 4) &&
      !(navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) &&
      (() => { try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; } })();
    setOk(check());
    const onChange = () => setOk(check());
    rm.addEventListener('change', onChange);
    return () => rm.removeEventListener('change', onChange);
  }, []);
  return ok;
}

/** Pauses the subtree when the tab is hidden, and unmounts on context loss. */
function Guard({ children }: { children: React.ReactNode }) {
  const host = useRef<HTMLDivElement>(null);
  const [alive, setAlive] = useState(true);
  const [awake, setAwake] = useState(true);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const onVis = () => setAwake(!document.hidden);
    document.addEventListener('visibilitychange', onVis);
    // capture — the canvas is a descendant and the event does not bubble
    const onLost = (e: Event) => { e.preventDefault(); setAlive(false); };
    el.addEventListener('webglcontextlost', onLost, true);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      el.removeEventListener('webglcontextlost', onLost, true);
    };
  }, []);

  return (
    <div ref={host} className="tui-host" data-awake={awake ? 'true' : 'false'}>
      {alive && awake ? children : null}
    </div>
  );
}

/** Hero field — hue pulled off emerald toward PRAVDA petrol. */
export function Horizon({ className = '' }: { className?: string }) {
  const ok = useCapable();
  return (
    <div className={`field ${className}`} aria-hidden="true">
      {ok && (
        <Guard>
          <EmeraldHorizonBackground
            className="tui-canvas"
            hue={-22}
            speed={0.55}
            waveScale={1.4}
            variation={1.25}
            glow={1.45}
            vignette={0.85}
          />
        </Guard>
      )}
    </div>
  );
}

/** Second field, for surfaces that need a different note. */
export function Ribbon({ className = '' }: { className?: string }) {
  const ok = useCapable();
  return (
    <div className={`field field-alt ${className}`} aria-hidden="true">
      {ok && (
        <Guard>
          <RibbonFieldBackground
            className="tui-canvas"
            hue={-26}
            saturation={0.42}
            speed={0.5}
            brightness={1.05}
            opacity={0.9}
            pointerAmount={1.2}
            smoothing={0.03}
          />
        </Guard>
      )}
    </div>
  );
}
