'use client';

import { useEffect, useRef } from 'react';
import {
  WebGLRenderer, Scene, PerspectiveCamera, Points, BufferGeometry, BufferAttribute,
  RawShaderMaterial, Vector2, Vector3, Vector4, Color, AdditiveBlending, Sphere,
} from 'three';
import { VERT, FRAG } from './terrain.glsl';
import { FORMS, sampleForm } from '@/lib/forms';
import { STRIDE } from '@/lib/forms3d';

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
    // aTarget is object-local: centred on the origin, longest side one unit.
    // The shader scales it, turns it about its own axis, and places it at
    // uFormPos — so an object can revolve under the pointer without the whole
    // attribute being rewritten every frame.
    const FORM_SIZE = 26, FORM_Y = 12.5, FORM_Z = -40, FORM_X = 23;
    const target = new Float32Array(N * 3);
    // the surface normal at each target — zero for a drawn form, which has none
    const normal = new Float32Array(N * 3);
    const built: { pts: Float32Array; dims: number }[] = [];
    // Points per source sample. Held constant across forms so a bare ring and
    // a camera body draw with the same weight of light.
    const PER = 15;
    let join = 0.42;
    let formYaw = 0, formPitch = 0, formLift = 0, formSize = FORM_SIZE, sizeScale = 1;
    let portrait = false;

    const applyForm = (index: number) => {
      let b = built[index];
      if (!b) {
        const spec = FORMS[index % FORMS.length];
        b = spec.kind === 'draw'
          ? { pts: sampleForm(spec.draw), dims: 2 }
          : { pts: spec.build(), dims: STRIDE };
        built[index] = b;
      }
      const { pts, dims } = b;
      const count = pts.length / dims;
      if (!count) return;
      const spec = FORMS[index % FORMS.length];
      formYaw = spec.kind === 'solid' ? (spec.yaw ?? 0) : 0;
      formPitch = spec.kind === 'solid' ? (spec.pitch ?? 0) : 0;
      formLift = spec.kind === 'solid' ? (spec.lift ?? 0) : 0;
      if (matRef) placeForm();   // the first form is applied before the material exists; resize() places it
      formSize = FORM_SIZE * (spec.kind === 'solid' ? (spec.size ?? 1) : 1);
      // a solid object is sampled a few times more densely than a diagram, so
      // its share of the field is held rather than derived
      const solid = dims === STRIDE;
      join = solid ? 0.55 : 1 - Math.min(0.62, Math.max(0.13, (count * PER) / N));
      if (matRef) matRef.uniforms.uJoin.value = join;
      for (let k = 0; k < N; k++) {
        // deterministic pick per point so a form is stable across re-entry
        const j = (k * 2654435761) % count;
        const o = j * dims;
        target[k * 3] = pts[o] + (rnd[k] - 0.5) * 0.006;
        target[k * 3 + 1] = pts[o + 1] + (rnd[(k + 7) % N] - 0.5) * 0.006;
        target[k * 3 + 2] = solid ? pts[o + 2] : (rnd[(k + 13) % N] - 0.5) * 0.05;
        normal[k * 3] = solid ? pts[o + 3] : 0;
        normal[k * 3 + 1] = solid ? pts[o + 4] : 0;
        normal[k * 3 + 2] = solid ? pts[o + 5] : 0;
      }
      for (const name of ['aTarget', 'aNormal']) {
        const attr = geo.getAttribute(name) as BufferAttribute | undefined;
        if (attr) attr.needsUpdate = true;
      }
    };

    let matRef: RawShaderMaterial | null = null;

    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    geo.setAttribute('aRand', new BufferAttribute(rnd, 1));
    geo.setAttribute('aTarget', new BufferAttribute(target, 3));
    geo.setAttribute('aNormal', new BufferAttribute(normal, 3));
    applyForm(0);
    geo.boundingSphere = new Sphere(new Vector3(0, 0, -DEPTH / 2), DEPTH);

    const pointer = new Vector2(0, 0), aim = new Vector2(0, 0);

    const mat = new RawShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, depthWrite: false, blending: AdditiveBlending,
      uniforms: {
        uJoin: { value: join },
        uTime: { value: 0 }, uZ: { value: 0 }, uDepth: { value: DEPTH },
        uAmp: { value: 9.6 }, uIn: { value: 0 }, uMorph: { value: 0 }, uPointer: { value: pointer }, uDpr: { value: 1 },
        uFormPos: { value: new Vector3(FORM_X, FORM_Y, FORM_Z) }, uFormSize: { value: FORM_SIZE },
        uSpin: { value: new Vector2(0, 0) },
        uBone: { value: new Color('#EFECE5') },
        uBrass: { value: new Color('#CDC4B3') },
        uDeep: { value: new Color('#17231B') },
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
    matRef = mat;
    mat.uniforms.uDpr.value = dpr;

    // Landscape: the object sits to the right of the type, where the eye
    // lands after reading. Portrait: there is no right; it sits below. Each
    // object may also ride a little higher or lower than the stage position.
    const placeForm = () => {
      sizeScale = portrait ? 0.62 : 1;
      const size = formSize * sizeScale;
      (mat.uniforms.uFormPos.value as Vector3).set(
        portrait ? 1.5 : FORM_X, (portrait ? 3.5 : FORM_Y) + formLift * size, FORM_Z);
      mat.uniforms.uFormSize.value = size;
    };

    const resize = () => {
      if (!renderer || dead) return;
      const r = el.getBoundingClientRect();
      renderer.setSize(r.width, r.height, false);
      cam.aspect = r.width / Math.max(1, r.height);
      cam.updateProjectionMatrix();
      portrait = cam.aspect < 1;
      placeForm();
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
    let z = 0, last = t0;

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
      // Easing is done against the clock, not the frame: the same settle on a
      // 120Hz display, a 60Hz one, and a phone that has dropped to 30.
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const k = 1 - Math.exp(-dt * 3.4);   // ≈ 0.055 per frame at 60Hz

      // travel = a constant drift plus the scroll position, so it never dies
      const target = t * 2.2 + progressRef.current * DEPTH * 2.35;
      z += (target - z) * k;

      mat.uniforms.uTime.value = t;
      mat.uniforms.uIn.value = Math.min(1, t / 2.2);
      mat.uniforms.uMorph.value += (morphRef.current - mat.uniforms.uMorph.value) * k;
      mat.uniforms.uZ.value = z;
      pointer.lerp(aim, 1 - Math.exp(-dt * 1.8));
      // The object turns slowly on its own and follows the pointer: yaw from
      // x, a little pitch from y — held, not played.
      const spin = mat.uniforms.uSpin.value as Vector2;
      spin.set(formYaw + Math.sin(t * 0.21) * 0.16 + pointer.x * 0.50, formPitch - 0.06 + pointer.y * 0.20);

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
