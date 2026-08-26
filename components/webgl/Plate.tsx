'use client';

import { useEffect, useRef, useState } from 'react';
import {
  WebGLRenderer, Scene, OrthographicCamera, Mesh, BufferGeometry,
  BufferAttribute, RawShaderMaterial, TextureLoader, Vector2, LinearFilter,
  ClampToEdgeWrapping, SRGBColorSpace, Sphere, Vector3,
} from 'three';
import { VERT, FRAG } from './plate.glsl';

type Props = {
  src: string;
  alt: string;
  /** intrinsic size — required, prevents CLS */
  width: number;
  height: number;
  /** the LCP plate on a page should set this; everything else lazy-loads */
  priority?: boolean;
  grain?: number;
  className?: string;
  /** fill the parent instead of holding the intrinsic ratio — for full-bleed use */
  fill?: boolean;
};

/** Capability gate. Runs once, cheaply, before anything is compiled. */
function capable(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  // Device memory is a strong proxy for whether a shader compile will stall.
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (typeof mem === 'number' && mem < 4) return false;
  if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) return false;
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch {
    return false;
  }
}

/**
 * A photograph, treated.
 *
 * The poster <img> is always rendered and is always the LCP element.
 * The canvas fades in over it only once the texture has decoded and the
 * shader has compiled — so a device that cannot do this sees a correct,
 * fast page and nothing that appears then vanishes.
 *
 * On context loss we fall back permanently for the session and never retry:
 * context loss here IS memory pressure, and rebuilding under memory pressure
 * produces a flicker loop.
 */
export default function Plate({
  src, alt, width, height, priority = false, grain = 0.055, className = '', fill = false,
}: Props) {
  const host = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (!capable()) return;
    const el = host.current;
    const cv = canvasRef.current;
    if (!el || !cv) return;

    let raf = 0;
    let disposed = false;
    let visible = false;
    let renderer: WebGLRenderer | null = null;

    const pointer = new Vector2(0, 0);
    const target = new Vector2(0, 0);
    const rtl = document.documentElement.dir === 'rtl' ? 1 : 0;

    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(
      new Float32Array([-1, -1, 3, -1, -1, 3]), 2,
    ));
    // 2-component positions break computeBoundingSphere(); supply one and never cull.
    geo.boundingSphere = new Sphere(new Vector3(0, 0, 0), 3);

    const mat = new RawShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uTex: { value: null },
        uRes: { value: new Vector2(1, 1) },
        uImg: { value: new Vector2(width, height) },
        uPointer: { value: pointer },
        uTime: { value: 0 },
        uReveal: { value: 0 },
        uGrain: { value: grain },
        uRtl: { value: rtl },
      },
    });

    const scene = new Scene();
    const cam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const mesh = new Mesh(geo, mat);
    mesh.frustumCulled = false;
    scene.add(mesh);

    const onLost = (e: Event) => {
      e.preventDefault();
      disposed = true;
      cancelAnimationFrame(raf);
      setLive(false); // permanent for the session — never retry
    };
    cv.addEventListener('webglcontextlost', onLost);

    try {
      renderer = new WebGLRenderer({
        canvas: cv, antialias: false, alpha: false,
        powerPreference: 'low-power', failIfMajorPerformanceCaveat: true,
      });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));

    const resize = () => {
      if (!renderer || disposed) return;
      const r = el.getBoundingClientRect();
      renderer.setSize(r.width, r.height, false);
      mat.uniforms.uRes.value.set(r.width, r.height);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(el);

    const io = new IntersectionObserver(
      ([entry]) => { visible = entry.isIntersecting; },
      { rootMargin: '120px' },
    );
    io.observe(el);

    const onVis = () => { if (document.hidden) visible = false; };
    document.addEventListener('visibilitychange', onVis);

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      target.set(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        -(((e.clientY - r.top) / r.height) * 2 - 1),
      );
    };
    const onLeave = () => target.set(0, 0);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);

    const loader = new TextureLoader();
    loader.load(src, (tex) => {
      if (disposed || !renderer) return;
      tex.minFilter = LinearFilter;
      tex.magFilter = LinearFilter;
      tex.wrapS = tex.wrapT = ClampToEdgeWrapping;
      tex.colorSpace = SRGBColorSpace;
      tex.generateMipmaps = false;
      mat.uniforms.uTex.value = tex;
      mat.uniforms.uImg.value.set(tex.image.width, tex.image.height);
      resize();

      const t0 = performance.now();
      setLive(true);

      const tick = (now: number) => {
        raf = requestAnimationFrame(tick);
        if (!visible || disposed || !renderer) return;
        const t = (now - t0) / 1000;
        mat.uniforms.uTime.value = t;
        // registration resolves over ~900ms, then holds
        mat.uniforms.uReveal.value = Math.min(1, t / 0.9);
        pointer.lerp(target, 0.06);
        renderer.render(scene, cam);
      };
      raf = requestAnimationFrame(tick);
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      cv.removeEventListener('webglcontextlost', onLost);
      geo.dispose();
      mat.dispose();
      mat.uniforms.uTex.value?.dispose?.();
      renderer?.dispose();
    };
  }, [src, width, height, grain]);

  return (
    <div
      ref={host}
      className={`plate ${fill ? 'plate-fill' : ''} ${className}`}
      style={fill ? undefined : { aspectRatio: `${width} / ${height}` }}
    >
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        decoding="async"
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        className="plate-poster"
      />
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="plate-canvas"
        data-live={live ? 'true' : 'false'}
      />
    </div>
  );
}
