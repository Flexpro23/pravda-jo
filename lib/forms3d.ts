/**
 * Solid forms — the instruments of the work, built as objects rather than
 * drawn as diagrams, so the field resolves into something with a front, a
 * back and a silhouette that survives being seen through 120k points.
 *
 * Every builder returns a flat xyz array in a unit box (roughly -0.5..0.5,
 * y up, the object facing +z). Points are sampled from the surface, weighted
 * by area, so a lens barrel and a body get the same density of light.
 *
 * Nothing here is loaded: each object is a handful of primitives, which keeps
 * the route under its JS budget and means the objects can be tuned in code.
 */
import {
  BoxGeometry, CylinderGeometry, TorusGeometry, SphereGeometry, CapsuleGeometry, LatheGeometry,
  Mesh, MeshBasicMaterial, BufferGeometry, BufferAttribute, Matrix4, Vector2, Vector3, Euler, Quaternion,
} from 'three';
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

type Part = {
  g: BufferGeometry; at?: [number, number, number]; rot?: [number, number, number];
  /** non-uniform scale, for an ellipsoid head or an oval torso */
  sc?: [number, number, number];
  /** sampling weight per unit area — a faint skin gets far fewer points than the edges around it */
  w?: number;
};

const place = ({ g, at = [0, 0, 0], rot = [0, 0, 0], sc = [1, 1, 1], w = 1 }: Part) => {
  const m = new Matrix4().compose(
    new Vector3(...at),
    new Quaternion().setFromEuler(new Euler(...rot)),
    new Vector3(...sc),
  );
  const out = g.index ? g.toNonIndexed() : g.clone();
  out.applyMatrix4(m);   // transforms position and normal both
  // position and normal are all that is needed; dropping the rest lets unlike primitives merge
  for (const k of Object.keys(out.attributes)) if (k !== 'position' && k !== 'normal') out.deleteAttribute(k);
  const count = out.getAttribute('position').count;
  out.setAttribute('weight', new BufferAttribute(new Float32Array(count).fill(w), 1));
  return out;
};

/**
 * Sample `n` surface points from a set of parts and normalise into the unit
 * box. Six floats per sample: position, then the surface normal — the shader
 * lights the object by its rim, which is what keeps a solid from burning to
 * a white mass under additive blending.
 */
export const STRIDE = 6;
function sample(parts: Part[], n: number, seed = 1): Float32Array {
  const merged = mergeGeometries(parts.map(place), false);
  const sampler = new MeshSurfaceSampler(new Mesh(merged, new MeshBasicMaterial())).setWeightAttribute('weight');
  // deterministic scatter — one object, not a new one each visit
  let s = seed >>> 0;
  // present at runtime since r150; absent from the bundled type definitions
  (sampler as unknown as { setRandomGenerator(f: () => number): void })
    .setRandomGenerator(() => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296));
  sampler.build();
  const out = new Float32Array(n * STRIDE);
  const p = new Vector3(), nm = new Vector3();
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < n; i++) {
    sampler.sample(p, nm);
    const o = i * STRIDE;
    out[o] = p.x; out[o + 1] = p.y; out[o + 2] = p.z;
    out[o + 3] = nm.x; out[o + 4] = nm.y; out[o + 5] = nm.z;
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    if (p.z < minZ) minZ = p.z; if (p.z > maxZ) maxZ = p.z;
  }
  // centre and scale so the longest side spans one unit
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, cz = (minZ + maxZ) / 2;
  const k = 1 / Math.max(maxX - minX, maxY - minY, maxZ - minZ, 1e-6);
  for (let i = 0; i < n; i++) {
    const o = i * STRIDE;
    out[o] = (out[o] - cx) * k;
    out[o + 1] = (out[o + 1] - cy) * k;
    out[o + 2] = (out[o + 2] - cz) * k;
  }
  merged.dispose();
  return out;
}

const HALF = Math.PI / 2;

/**
 * A frame — four bars around an opening. In a point cloud a flat face is
 * noise and an edge is information, so anything that would be a panel is
 * drawn as the frame around it.
 */
const frame = (w: number, h: number, t: number, d: number, at: [number, number, number]): Part[] => {
  const [x, y, z] = at;
  return [
    { g: new BoxGeometry(w, t, d), at: [x, y + h / 2 - t / 2, z] },
    { g: new BoxGeometry(w, t, d), at: [x, y - h / 2 + t / 2, z] },
    { g: new BoxGeometry(t, h - t * 2, d), at: [x - w / 2 + t / 2, y, z] },
    { g: new BoxGeometry(t, h - t * 2, d), at: [x + w / 2 - t / 2, y, z] },
  ];
};

/** A bar between two points — the line of a technical drawing. */
const bar = (a: [number, number, number], b: [number, number, number], r = 0.012): Part => {
  const from = new Vector3(...a), to = new Vector3(...b);
  const len = from.distanceTo(to);
  const mid = from.clone().add(to).multiplyScalar(0.5);
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), to.clone().sub(from).normalize());
  const e = new Euler().setFromQuaternion(q);
  return { g: new CylinderGeometry(r, r, len, 8), at: [mid.x, mid.y, mid.z], rot: [e.x, e.y, e.z] };
};

/** A limb — a tapered cylinder from one joint to the next. */
const limb = (a: [number, number, number], b: [number, number, number], r1: number, r2: number): Part => {
  const from = new Vector3(...a), to = new Vector3(...b);
  const len = from.distanceTo(to);
  const mid = from.clone().add(to).multiplyScalar(0.5);
  // a cylinder's +y runs from radiusBottom to radiusTop, so the wide end sits at `a`
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), to.clone().sub(from).normalize());
  const e = new Euler().setFromQuaternion(q);
  return { g: new CylinderGeometry(r2, r1, len, 14), at: [mid.x, mid.y, mid.z], rot: [e.x, e.y, e.z] };
};

/** A box drawn by its twelve edges. A panel in a point cloud is noise; its outline is the object. */
const wireBox = (w: number, h: number, d: number, at: [number, number, number], r = 0.012): Part[] => {
  const [x, y, z] = at;
  const c = (sx: number, sy: number, sz: number): [number, number, number] =>
    [x + sx * w / 2, y + sy * h / 2, z + sz * d / 2];
  return [
    bar(c(-1, -1, -1), c(1, -1, -1), r), bar(c(-1, 1, -1), c(1, 1, -1), r),
    bar(c(-1, -1, 1), c(1, -1, 1), r), bar(c(-1, 1, 1), c(1, 1, 1), r),
    bar(c(-1, -1, -1), c(-1, 1, -1), r), bar(c(1, -1, -1), c(1, 1, -1), r),
    bar(c(-1, -1, 1), c(-1, 1, 1), r), bar(c(1, -1, 1), c(1, 1, 1), r),
    bar(c(-1, -1, -1), c(-1, -1, 1), r), bar(c(1, -1, -1), c(1, -1, 1), r),
    bar(c(-1, 1, -1), c(-1, 1, 1), r), bar(c(1, 1, -1), c(1, 1, 1), r),
  ];
};

/** Raw triangles, for the few shapes primitives cannot make. */
const tris = (faces: [number, number, number][][]): BufferGeometry => {
  const pos: number[] = [];
  for (const [a, b, c] of faces) pos.push(...a, ...b, ...c);
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.computeVertexNormals();
  return g;
};

/**
 * The camera. A cinema body with a long lens and a matte box, two magazines
 * on top, a top handle and a viewfinder off the side. Nothing consumer-grade:
 * the silhouette is the one every crew recognises.
 */
export const camera = (n = 34000) => sample([
  ...wireBox(1.10, 0.66, 0.60, [0, 0, 0], 0.016),                             // body, by its edges
  { g: new BoxGeometry(1.10, 0.66, 0.60), at: [0, 0, 0], w: 0.10 },            // and a faint fill behind them
  { g: new CylinderGeometry(0.21, 0.24, 0.78, 28), at: [0, 0.02, 0.66], rot: [HALF, 0, 0] }, // lens barrel
  { g: new TorusGeometry(0.235, 0.028, 10, 36), at: [0, 0.02, 1.02] },          // front ring
  { g: new TorusGeometry(0.19, 0.02, 8, 36), at: [0, 0.02, 0.62] },             // focus ring
  ...frame(0.72, 0.50, 0.04, 0.05, [0, 0.10, 1.18]),                           // matte box
  { g: new BoxGeometry(0.72, 0.04, 0.30), at: [0, 0.37, 1.06] },                // matte box hood
  { g: new CylinderGeometry(0.30, 0.30, 0.16, 36), at: [-0.32, 0.62, -0.05], rot: [0, 0, HALF] }, // magazine, rear
  { g: new CylinderGeometry(0.30, 0.30, 0.16, 36), at: [0.32, 0.62, -0.05], rot: [0, 0, HALF] },  // magazine, front
  { g: new BoxGeometry(0.16, 0.24, 0.40), at: [0, 0.45, -0.05] },               // magazine throat
  { g: new CapsuleGeometry(0.035, 0.46, 4, 12), at: [0.02, 0.98, -0.02], rot: [0, 0, HALF] },     // top handle
  { g: new BoxGeometry(0.05, 0.14, 0.05), at: [-0.20, 0.88, -0.02] },
  { g: new BoxGeometry(0.05, 0.14, 0.05), at: [0.24, 0.88, -0.02] },
  { g: new CylinderGeometry(0.075, 0.075, 0.42, 20), at: [-0.68, 0.16, -0.10], rot: [HALF, 0, 0] }, // viewfinder tube
  { g: new BoxGeometry(0.12, 0.16, 0.16), at: [-0.68, 0.16, -0.36] },           // eyepiece
  { g: new BoxGeometry(0.16, 0.20, 0.16), at: [0.62, -0.05, 0.10] },            // side grip
  { g: new CylinderGeometry(0.10, 0.10, 0.12, 24), at: [0, -0.39, 0.05] },      // baseplate mount
], n, 7);

/**
 * The phone. A 9:19 slab drawn as its bezel and its feed — a header, a hero
 * frame and a grid of tiles, each a frame standing proud of the glass — and
 * one rule across it: the read, stopped where it found something.
 */
export const phone = (n = 30000) => {
  const parts: Part[] = [
    ...frame(0.64, 1.32, 0.030, 0.06, [0, 0, 0]),                                // bezel
    { g: new BoxGeometry(0.58, 1.26, 0.008), at: [0, 0, -0.03], w: 0.25 },       // back plate, faint
    { g: new TorusGeometry(0.034, 0.010, 8, 20), at: [-0.19, 0.52, -0.04] },      // rear camera
    ...frame(0.50, 0.07, 0.012, 0.03, [0, 0.54, 0.03]),                           // header
    ...frame(0.50, 0.40, 0.012, 0.03, [0, 0.27, 0.03]),                           // hero frame
  ];
  // a 3 x 3 grid of tiles below the hero
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    parts.push(...frame(0.15, 0.15, 0.012, 0.03, [-0.17 + c * 0.17, -0.06 - r * 0.17, 0.03]));
  }
  // the read: a bar across the glass and a ring where it stopped
  parts.push({ g: new BoxGeometry(0.72, 0.014, 0.03), at: [0, 0.12, 0.07] });
  parts.push({ g: new TorusGeometry(0.06, 0.010, 8, 28), at: [0.12, 0.12, 0.08] });
  return sample(parts, n, 11);
};

/**
 * The voice. Thirty-two bars of a waveform, standing, their heights an
 * envelope with one loud passage — a sound being read, not a logo.
 */
export const wave = (n = 26000) => {
  const parts: Part[] = [];
  const BARS = 32;
  for (let i = 0; i < BARS; i++) {
    const t = i / (BARS - 1);
    const x = (t - 0.5) * 1.5;
    const env = Math.exp(-Math.pow((t - 0.42) * 3.2, 2)) * 0.62 + Math.exp(-Math.pow((t - 0.78) * 6, 2)) * 0.30;
    const h = 0.06 + env * (0.7 + 0.3 * Math.sin(i * 2.3)) + 0.04 * Math.sin(i * 1.7);
    parts.push({ g: new CapsuleGeometry(0.017, h, 3, 10), at: [x, 0, 0] });
  }
  parts.push({ g: new BoxGeometry(1.62, 0.006, 0.006), at: [0, 0, 0] });        // the baseline
  return sample(parts, n, 13);
};

/**
 * The slate. A clapperboard, sticks open, with the fields ruled on the board
 * — the thirty ideas already shot, each one a take.
 */
export const slate = (n = 30000) => {
  const parts: Part[] = [
    { g: new BoxGeometry(1.10, 0.86, 0.06), at: [0, -0.10, 0] },                 // board
    { g: new BoxGeometry(1.10, 0.12, 0.06), at: [0, 0.39, 0] },                  // lower stick
    { g: new BoxGeometry(1.10, 0.12, 0.06), at: [0.14, 0.62, 0], rot: [0, 0, 0.42] }, // upper stick, open
    { g: new CylinderGeometry(0.05, 0.05, 0.10, 16), at: [-0.50, 0.45, 0], rot: [HALF, 0, 0] }, // hinge
  ];
  // ruled fields: four rows, each a rule and a short caption block
  for (let r = 0; r < 4; r++) {
    const y = 0.16 - r * 0.20;
    parts.push({ g: new BoxGeometry(0.94, 0.008, 0.02), at: [0, y, 0.04] });
    parts.push({ g: new BoxGeometry(0.22, 0.05, 0.012), at: [-0.36, y + 0.06, 0.04] });
  }
  // stripes on the sticks: nine stubs, alternating
  for (let i = 0; i < 5; i++) {
    parts.push({ g: new BoxGeometry(0.09, 0.12, 0.014), at: [-0.44 + i * 0.22, 0.39, 0.04] });
  }
  return sample(parts, n, 17);
};

/**
 * The figure. A woman at the mark in a runway stance — weight on one leg,
 * the other crossed a little in front, one hand on the hip, long hair, a
 * fitted dress to the knee, heels. Turned on a lathe so the shoulders, bust,
 * waist and hips flow into one silhouette, which is what a body reads by in
 * a point cloud; no face is attempted at this resolution.
 */
export const figure = (n = 32000) => {
  // the body from the collar to the hem, as (radius, height) — an oval in plan
  const profile = [
    [0.055, 1.60], [0.13, 1.56], [0.185, 1.52], [0.175, 1.46], [0.165, 1.40],
    [0.170, 1.33], [0.150, 1.26], [0.118, 1.19], [0.108, 1.13], [0.125, 1.06],
    [0.158, 0.98], [0.172, 0.90], [0.168, 0.80], [0.172, 0.68], [0.182, 0.56],
    [0.190, 0.50],
  ].map(([r, y]) => new Vector2(r, y));
  const body: Part = { g: new LatheGeometry(profile, 36), sc: [1, 1, 0.62] };
  const hem: Part = { g: new TorusGeometry(0.19, 0.008, 6, 40), at: [0, 0.50, 0], rot: [HALF, 0, 0], sc: [1, 0.62, 1] };

  const head: Part = { g: new SphereGeometry(0.10, 28, 20), at: [0, 1.80, 0.01], sc: [0.92, 1.18, 1] };
  const neck: Part = { g: new CylinderGeometry(0.040, 0.050, 0.12, 16), at: [0, 1.64, 0] };
  // hair: a fuller ellipsoid behind the crown, and a fall to the shoulder blades
  const hair: Part[] = [
    { g: new SphereGeometry(0.115, 28, 20), at: [0, 1.82, -0.035], sc: [1, 1.12, 1.05], w: 0.55 },
    { g: new CylinderGeometry(0.115, 0.075, 0.46, 24, 1, true), at: [0, 1.55, -0.07], sc: [1, 1, 0.75], w: 0.55 },
  ];

  // arms — left hangs with a slight bend, right hand rests on the hip
  const arms: Part[] = [
    { g: new SphereGeometry(0.055, 16, 12), at: [-0.19, 1.51, 0] },
    limb([-0.20, 1.50, 0], [-0.25, 1.22, -0.01], 0.046, 0.038),
    limb([-0.25, 1.22, -0.01], [-0.27, 0.96, 0.03], 0.036, 0.028),
    { g: new SphereGeometry(0.035, 12, 10), at: [-0.275, 0.91, 0.04], sc: [0.8, 1.4, 0.6] },
    { g: new SphereGeometry(0.055, 16, 12), at: [0.19, 1.51, 0] },
    limb([0.20, 1.50, 0], [0.32, 1.26, -0.02], 0.046, 0.038),
    limb([0.32, 1.26, -0.02], [0.17, 1.02, 0.03], 0.036, 0.028),
  ];

  // legs from the hem down — the left carries the weight, the right crosses in front
  const legs: Part[] = [
    limb([-0.09, 0.52, 0], [-0.10, 0.30, 0.01], 0.062, 0.045),
    limb([-0.10, 0.30, 0.01], [-0.10, 0.09, 0.0], 0.045, 0.030),
    { g: new BoxGeometry(0.065, 0.04, 0.20), at: [-0.10, 0.045, 0.06], rot: [0.12, 0, 0] },
    { g: new BoxGeometry(0.02, 0.07, 0.02), at: [-0.10, 0.035, -0.02] },            // heel
    limb([0.08, 0.52, 0.03], [0.0, 0.30, 0.09], 0.062, 0.045),
    limb([0.0, 0.30, 0.09], [0.02, 0.09, 0.12], 0.045, 0.030),
    { g: new BoxGeometry(0.065, 0.04, 0.20), at: [0.02, 0.045, 0.18], rot: [0.12, -0.25, 0] },
    { g: new BoxGeometry(0.02, 0.07, 0.02), at: [0.02, 0.035, 0.10] },              // heel
  ];

  const mark: Part = { g: new CylinderGeometry(0.42, 0.42, 0.015, 40), at: [0, 0.0, 0.06], w: 0.28 };

  return sample([body, hem, head, neck, ...hair, ...arms, ...legs, mark], n, 19);
};

/** The send. A paper plane drawn by its folds, banked into its turn. */
export const send = (n = 24000) => {
  const nose: [number, number, number] = [0.62, 0.02, 0];
  const tailL: [number, number, number] = [-0.50, 0.06, -0.40];
  const tailR: [number, number, number] = [-0.50, 0.06, 0.40];
  const tailC: [number, number, number] = [-0.46, 0.00, 0];
  const keel: [number, number, number] = [-0.40, -0.24, 0];
  return sample([
    bar(nose, tailL, 0.014), bar(nose, tailR, 0.014),                          // leading edges
    bar(tailL, tailC, 0.012), bar(tailR, tailC, 0.012),                        // trailing edges
    bar(nose, tailC, 0.012), bar(nose, keel, 0.012), bar(keel, tailC, 0.012),  // spine and keel
    { g: tris([[nose, tailL, tailC], [nose, tailC, tailR], [nose, tailC, keel]]), w: 0.10 }, // a faint skin
  ], n, 23);
};
