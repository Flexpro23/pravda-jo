'use client';

import { useEffect, useRef } from 'react';
import {
  WebGLRenderer, Scene, PerspectiveCamera, Points, BufferGeometry, BufferAttribute,
  RawShaderMaterial, Vector2, Vector3, Color, AdditiveBlending, Sphere,
} from 'three';
import { VERT, FRAG } from './terrain.glsl';

const COLS = 190;      // across
const ROWS = 260;      // into the screen
const SPREAD = 1.05;   // world units between points
const DEPTH = ROWS * SPREAD;

export function capable(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (typeof mem === 'number' && mem < 4) return false;
  if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) return false;
  try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; }
}

/**
 * A corridor of points, displaced into dunes, that the camera flies through.
 * `progressRef` is the single normalised value (0..1) shared with the type
 * layer, so the camera and the words are driven by one clock rather than two.
 */
export default function Terrain({
  progressRef,
}: { progressRef: React.MutableRefObject<number> }) {
  const host = useRef<HTMLDivElement>(null);
  const cvRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = host.current, cv = cvRef.current;
    if (!el || !cv || !capable()) return;

    let raf = 0, dead = false, visible = true;
    let renderer: WebGLRenderer | null = null;

    const N = COLS * ROWS;
    const pos = new Float32Array(N * 3);
    const rnd = new Float32Array(N);
    let i = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        pos[i * 3] = (c - COLS / 2) * SPREAD;
        pos[i * 3 + 1] = 0;
        pos[i * 3 + 2] = -r * SPREAD;
        rnd[i] = Math.random();
        i++;
      }
    }

    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    geo.setAttribute('aRand', new BufferAttribute(rnd, 1));
    geo.boundingSphere = new Sphere(new Vector3(0, 0, -DEPTH / 2), DEPTH);

    const pointer = new Vector2(0, 0), aim = new Vector2(0, 0);

    const mat = new RawShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, depthWrite: false, blending: AdditiveBlending,
      uniforms: {
        uTime: { value: 0 }, uZ: { value: 0 }, uDepth: { value: DEPTH },
        uAmp: { value: 8.4 }, uPointer: { value: pointer }, uDpr: { value: 1 },
        uBone: { value: new Color('#CFE0D6') },
        uBrass: { value: new Color('#D8B46A') },
      },
    });

    const scene = new Scene();
    const pts = new Points(geo, mat);
    pts.frustumCulled = false;
    scene.add(pts);

    const cam = new PerspectiveCamera(58, 1, 0.1, DEPTH * 1.1);
    cam.position.set(0, 13.5, 6);

    const onLost = (e: Event) => { e.preventDefault(); dead = true; cancelAnimationFrame(raf); };
    cv.addEventListener('webglcontextlost', onLost);

    try {
      renderer = new WebGLRenderer({ canvas: cv, antialias: false, alpha: true, powerPreference: 'high-performance' });
    } catch { return; }
    const dpr = Math.min(window.devicePixelRatio, 1.75);
    renderer.setPixelRatio(dpr);
    mat.uniforms.uDpr.value = dpr;

    const resize = () => {
      if (!renderer || dead) return;
      const r = el.getBoundingClientRect();
      renderer.setSize(r.width, r.height, false);
      cam.aspect = r.width / Math.max(1, r.height);
      cam.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize); ro.observe(el); resize();

    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { rootMargin: '100px' });
    io.observe(el);
    const onVis = () => { if (document.hidden) visible = false; else visible = true; };
    document.addEventListener('visibilitychange', onVis);

    const onMove = (e: PointerEvent) => {
      aim.set((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
    };
    window.addEventListener('pointermove', onMove, { passive: true });

    const t0 = performance.now();
    let z = 0;

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (!visible || dead || !renderer) return;
      const t = (now - t0) / 1000;

      // travel = a constant drift plus the scroll position, so it never dies
      const target = t * 2.2 + progressRef.current * DEPTH * 2.35;
      z += (target - z) * 0.055;

      mat.uniforms.uTime.value = t;
      mat.uniforms.uZ.value = z;
      pointer.lerp(aim, 0.03);

      // fly ABOVE the dunes and look down the corridor, so the field recedes
      // instead of collapsing into a band at eye level
      const p = progressRef.current;
      // high enough to see the field recede, shallow enough to keep a horizon
      // at mid-frame with dark sky above it for the type to live in
      cam.position.y = 13.5 + Math.sin(p * Math.PI) * 4.2;
      cam.rotation.z = pointer.x * 0.028;
      cam.lookAt(pointer.x * 3.0, 3.5 + Math.sin(p * Math.PI) * 1.4, -62);

      renderer.render(scene, cam);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      dead = true; cancelAnimationFrame(raf);
      ro.disconnect(); io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pointermove', onMove);
      cv.removeEventListener('webglcontextlost', onLost);
      geo.dispose(); mat.dispose(); renderer?.dispose();
    };
  }, [progressRef]);

  return (
    <div ref={host} className="terrain" aria-hidden="true">
      <canvas ref={cvRef} />
    </div>
  );
}
