'use client';

import { useEffect, useRef } from 'react';
import {
  WebGLRenderer, Scene, PerspectiveCamera, Points, BufferGeometry, BufferAttribute,
  RawShaderMaterial, Vector2, Vector3, Vector4, Color, AdditiveBlending, Sphere,
} from 'three';
import { VERT, FRAG } from './terrain.glsl';
import { FORMS, sampleForm } from '@/lib/forms';

const COLS = 300;      // across
const ROWS = 400;      // into the screen
const SPREAD = 0.82;   // world units between points
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
export type RippleFn = (strength?: number, spreadX?: number) => void;
export type FormFn = (index: number) => void;

export default function Terrain({
  progressRef, morphRef, onReady,
}: {
  progressRef: React.MutableRefObject<number>;
  /** 0 = raw field, 1 = the form fully resolved */
  morphRef: React.MutableRefObject<number>;
  /** hands back the ripple trigger and the form selector */
  onReady?: (fire: RippleFn, setForm: FormFn) => void;
}) {
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
        // Jitter breaks the lattice. A regular grid seen in perspective
        // produces strong moiré arcs across the near field — that repeating
        // beaded pattern is aliasing, not terrain.
        pos[i * 3] = (c - COLS / 2) * SPREAD + (Math.random() - 0.5) * SPREAD * 1.25;
        pos[i * 3 + 1] = 0;
        pos[i * 3 + 2] = -r * SPREAD + (Math.random() - 0.5) * SPREAD * 1.25;
        rnd[i] = Math.random();
        i++;
      }
    }

    // Target positions — where each point sits when a form is resolved. The
    // plane hangs in front of the camera's travel, sized to fill the view.
    // Offset right of centre: the type is flush left, so a centred form
    // collides with the headline. This puts the image where the eye lands
    // after reading, not underneath the words.
    const FORM_W = 70, FORM_H = 70, FORM_Y = 10.5, FORM_Z = -44, FORM_X = 19;
    const target = new Float32Array(N * 3);
    const built: Float32Array[] = [];

    const applyForm = (index: number) => {
      let pts = built[index];
      if (!pts) {
        pts = sampleForm(FORMS[index % FORMS.length]);
        built[index] = pts;
      }
      const count = pts.length / 2;
      if (!count) return;
      for (let k = 0; k < N; k++) {
        // deterministic pick per point so a form is stable across re-entry
        const j = (k * 2654435761) % count;
        target[k * 3] = FORM_X + pts[j * 2] * FORM_W + (rnd[k] - 0.5) * 0.55;
        target[k * 3 + 1] = FORM_Y + pts[j * 2 + 1] * FORM_H + (rnd[(k + 7) % N] - 0.5) * 0.55;
        target[k * 3 + 2] = FORM_Z + (rnd[(k + 13) % N] - 0.5) * 3.2;
      }
      const attr = geo.getAttribute('aTarget') as BufferAttribute | undefined;
      if (attr) attr.needsUpdate = true;
    };

    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    geo.setAttribute('aRand', new BufferAttribute(rnd, 1));
    geo.setAttribute('aTarget', new BufferAttribute(target, 3));
    applyForm(0);
    geo.boundingSphere = new Sphere(new Vector3(0, 0, -DEPTH / 2), DEPTH);

    const pointer = new Vector2(0, 0), aim = new Vector2(0, 0);

    const mat = new RawShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, depthWrite: false, blending: AdditiveBlending,
      uniforms: {
        uTime: { value: 0 }, uZ: { value: 0 }, uDepth: { value: DEPTH },
        uAmp: { value: 9.6 }, uIn: { value: 0 }, uMorph: { value: 0 }, uPointer: { value: pointer }, uDpr: { value: 1 },
        uBone: { value: new Color('#DCE8DE') },
        uBrass: { value: new Color('#D8B46A') },
        uDeep: { value: new Color('#0E2A26') },
        uRipples: { value: [new Vector4(), new Vector4(), new Vector4(), new Vector4()] },
      },
    });

    const scene = new Scene();
    const pts = new Points(geo, mat);
    pts.frustumCulled = false;
    scene.add(pts);

    const cam = new PerspectiveCamera(58, 1, 0.1, DEPTH * 1.1);
    cam.position.set(0, 17.0, 10);

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

    // round-robin ripple slots so overlapping strikes coexist
    let slot = 0;
    const ripples = mat.uniforms.uRipples.value as Vector4[];
    const fire: RippleFn = (strength = 1, spreadX = 0) => {
      const now = (performance.now() - t0) / 1000;
      // The camera covers roughly 107 world units per section while the wave
      // front travels 7 units/second — so striking just ahead of the camera
      // means it flies straight past before the ring can open. Strike well
      // downrange instead, at about where the camera will ARRIVE, so the
      // viewer flies into the expanding ring as it opens around them.
      const originZ = -(z % DEPTH) - 132;
      ripples[slot].set(spreadX * 26, originZ, now, strength);
      slot = (slot + 1) % ripples.length;
    };
    onReady?.(fire, applyForm);

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (!visible || dead || !renderer) return;
      const t = (now - t0) / 1000;

      // travel = a constant drift plus the scroll position, so it never dies
      const target = t * 2.2 + progressRef.current * DEPTH * 2.35;
      z += (target - z) * 0.055;

      mat.uniforms.uTime.value = t;
      mat.uniforms.uIn.value = Math.min(1, t / 2.2);
      mat.uniforms.uMorph.value += (morphRef.current - mat.uniforms.uMorph.value) * 0.055;
      mat.uniforms.uZ.value = z;
      pointer.lerp(aim, 0.03);

      // fly ABOVE the dunes and look down the corridor, so the field recedes
      // instead of collapsing into a band at eye level
      const p = progressRef.current;
      // high enough to see the field recede, shallow enough to keep a horizon
      // at mid-frame with dark sky above it for the type to live in
      cam.position.y = 17.0 + Math.sin(p * Math.PI) * 5.0;
      cam.rotation.z = pointer.x * 0.024;
      cam.lookAt(pointer.x * 3.4, 5.0 + Math.sin(p * Math.PI) * 1.6, -78);

      renderer.render(scene, cam);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      dead = true; cancelAnimationFrame(raf);
      ro.disconnect(); io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pointermove', onMove);
      cv.removeEventListener('webglcontextlost', onLost);
      onReady?.(() => {}, () => {});
      geo.dispose(); mat.dispose(); renderer?.dispose();
    };
  }, [progressRef, morphRef, onReady]);

  return (
    <div ref={host} className="terrain" aria-hidden="true">
      <canvas ref={cvRef} />
    </div>
  );
}
