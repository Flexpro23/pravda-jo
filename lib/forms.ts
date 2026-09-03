/**
 * Source forms for the point field to resolve into.
 *
 * Two families. The diagrams below are drawn on a plane and sampled as
 * outlines — light lines on nothing. The solid forms in `forms3d.ts` are
 * objects sampled across their surface: the instruments of the work with a
 * front, a back and a silhouette, which is what survives being seen through
 * a hundred thousand points. FORMS at the bottom decides which set the flight
 * uses.
 *
 * Replace these with real PRAVDA photography when it exists: `sampleForm`
 * takes any drawable source, so an <img> of a real frame drops straight in.
 */
import { phone, figure, slate, camera, wave, send } from '@/lib/forms3d';

export type Form = (c: CanvasRenderingContext2D, w: number, h: number) => void;

/** One optical weight across the set, so no form shouts over another. */
const pen = (c: CanvasRenderingContext2D, w: number, k = 1) => {
  c.strokeStyle = '#fff';
  c.lineWidth = Math.max(1, w * 0.0042 * k);
  c.lineCap = 'butt';
};

/** Deterministic scatter — one composition, not a new one each visit. */
const seeded = (s: number) => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);

/**
 * The read. A 9:16 frame implied by its corners and measured down one edge,
 * with a single rule across it stopped at what it found.
 */
export const reticle: Form = (c, w, h) => {
  const fh = h * 0.82, fw = fh * (9 / 16);
  const x = (w - fw) / 2 + w * 0.04, y = (h - fh) / 2;
  const m = fw * 0.26;

  pen(c, w, 2.2);
  const corner = (px: number, py: number, sx: number, sy: number) => {
    c.beginPath();
    c.moveTo(px, py + sy * m); c.lineTo(px, py); c.lineTo(px + sx * m, py);
    c.stroke();
  };
  corner(x, y, 1, 1); corner(x + fw, y, -1, 1);
  corner(x, y + fh, 1, -1); corner(x + fw, y + fh, -1, -1);

  // graduations outside the left edge — the frame under measurement
  pen(c, w, 1.0);
  const gx = x - fw * 0.20;
  for (let i = 0; i <= 36; i++) {
    const ty = y + (fh * i) / 36;
    const len = i % 4 === 0 ? fw * 0.10 : fw * 0.045;
    c.beginPath(); c.moveTo(gx, ty); c.lineTo(gx + len, ty); c.stroke();
  }

  // the read: one pass across, marked where it stopped
  pen(c, w, 1.3);
  const ry = y + fh * 0.58;
  c.beginPath(); c.moveTo(x + fw * 0.03, ry); c.lineTo(x + fw * 0.97, ry); c.stroke();
  c.beginPath(); c.arc(x + fw * 0.68, ry, fw * 0.055, 0, Math.PI * 2); c.stroke();
};

/**
 * Ninety. Count them — ten across, nine down, jittered so it is a population
 * and not a grid. Four carry a ring: the ones cast for the idea on the table.
 */
export const roster: Form = (c, w, h) => {
  const COLS = 10, ROWS = 9;
  const gw = w * 0.78, gh = h * 0.68;
  const x0 = (w - gw) / 2, y0 = (h - gh) / 2;
  const rand = seeded(7);
  for (let r = 0; r < ROWS; r++) {
    for (let i = 0; i < COLS; i++) {
      const n = r * COLS + i;
      const px = x0 + (gw * i) / (COLS - 1) + (rand() - 0.5) * gw * 0.030;
      const py = y0 + (gh * r) / (ROWS - 1) + (rand() - 0.5) * gh * 0.034;
      // rings, not dots: the field samples outlines, so a filled dot would
      // arrive as a ring anyway. Draw what will actually be drawn.
      pen(c, w, 1.0);
      c.beginPath();
      c.arc(px, py, w * (0.0085 + rand() * 0.0060), 0, Math.PI * 2);
      c.stroke();
      if (n === 14 || n === 33 || n === 57 || n === 78) {
        pen(c, w, 1.6);
        c.beginPath(); c.arc(px, py, w * 0.034, 0, Math.PI * 2); c.stroke();
        c.fillStyle = '#fff';
        c.beginPath(); c.arc(px, py, w * 0.004, 0, Math.PI * 2); c.fill();
      }
    }
  }
};

/**
 * Thirty ideas, each already shot. A contact sheet: thirty 9:16 cells, three
 * of them bracketed — the shortlist that becomes a proposal.
 */
export const library: Form = (c, w, h) => {
  const COLS = 6, ROWS = 5;
  // sized from the height, so thirty cells always fit the square
  const gh = h * 0.84;
  const gapY = gh * 0.048;
  const ch = (gh - gapY * (ROWS - 1)) / ROWS;
  const cw = ch * (9 / 16);
  const gapX = cw * 0.46;
  const gw = COLS * cw + gapX * (COLS - 1);
  const x0 = (w - gw) / 2, y0 = (h - gh) / 2;

  for (let r = 0; r < ROWS; r++) {
    for (let i = 0; i < COLS; i++) {
      const n = r * COLS + i;
      const x = x0 + i * (cw + gapX), y = y0 + r * (ch + gapY);
      pen(c, w, 0.9);
      c.strokeRect(x, y, cw, ch);
      if (n === 8 || n === 15 || n === 23) {
        // chosen: brackets outside the cell, the way a frame gets selected
        pen(c, w, 2.2);
        const m = cw * 0.38, o = gapX * 0.28;
        const br = (px: number, py: number, sx: number, sy: number) => {
          c.beginPath();
          c.moveTo(px, py + sy * m); c.lineTo(px, py); c.lineTo(px + sx * m, py);
          c.stroke();
        };
        br(x - o, y - o, 1, 1); br(x + cw + o, y - o, -1, 1);
        br(x - o, y + ch + o, 1, -1); br(x + cw + o, y + ch + o, -1, -1);
      }
    }
  }
};

/**
 * The rate, published. Two graduated rules — an asset and a month — each cut
 * at the number it is set to. No figure drawn, only the fact that it is fixed.
 */
export const scale: Form = (c, w, h) => {
  const rule = (y: number, len: number, divs: number, mark: number) => {
    const x0 = (w - len) / 2;
    pen(c, w, 1.4);
    c.beginPath(); c.moveTo(x0, y); c.lineTo(x0 + len, y); c.stroke();
    pen(c, w, 0.9);
    for (let i = 0; i <= divs; i++) {
      const tx = x0 + (len * i) / divs;
      const t = i % 5 === 0 ? h * 0.045 : h * 0.020;
      c.beginPath(); c.moveTo(tx, y); c.lineTo(tx, y + t); c.stroke();
    }
    pen(c, w, 2.4);
    const mx = x0 + len * mark;
    c.beginPath(); c.moveTo(mx, y - h * 0.062); c.lineTo(mx, y + h * 0.062); c.stroke();
  };
  rule(h * 0.36, w * 0.78, 40, 0.375);
  rule(h * 0.66, w * 0.54, 28, 0.625);
};

/**
 * Nothing. One ring, wide open — an aperture at full, and a zero. After four
 * dense diagrams the restraint is the statement.
 */
export const zero: Form = (c, w, h) => {
  const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.33;
  pen(c, w, 1.5);
  c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.stroke();
  pen(c, w, 1.1);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const ux = Math.cos(a), uy = Math.sin(a);
    c.beginPath();
    c.moveTo(cx + ux * R * 1.10, cy + uy * R * 1.10);
    c.lineTo(cx + ux * R * 1.22, cy + uy * R * 1.22);
    c.stroke();
  }
};

/** Everything arrives at one place. The node, and what converges on it. */
export const converge: Form = (c, w, h) => {
  const nx = w * 0.5, ny = h * 0.5, R = Math.min(w, h) * 0.46;
  const rand = seeded(19);
  pen(c, w, 0.9);
  for (let i = 0; i < 44; i++) {
    const a = (i / 44) * Math.PI * 2 + (rand() - 0.5) * 0.08;
    const inner = R * (0.22 + rand() * 0.09);
    const outer = R * (0.66 + rand() * 0.34);
    c.beginPath();
    c.moveTo(nx + Math.cos(a) * inner, ny + Math.sin(a) * inner);
    c.lineTo(nx + Math.cos(a) * outer, ny + Math.sin(a) * outer);
    c.stroke();
  }
  pen(c, w, 1.8);
  c.beginPath(); c.arc(nx, ny, R * 0.14, 0, Math.PI * 2); c.stroke();
};

/**
 * A form is either drawn (a diagram, sampled as an outline on a plane) or
 * solid (an object, sampled across its surface in three dimensions). Both
 * arrive at the field as a list of target positions; the solid ones also turn.
 */
export type FormSpec =
  | { kind: 'draw'; draw: Form }
  | {
      kind: 'solid'; build: () => Float32Array;
      /** multiplier on the stage's object size — a wide, flat object needs more */
      size?: number;
      /** resting yaw and pitch in radians, so each object is met at its best angle */
      yaw?: number;
      pitch?: number;
      /** vertical offset from the stage's object position, as a fraction of its size */
      lift?: number;
    };

/** The diagrams, kept — drop any of them back into FORMS to compare. */
export const DIAGRAMS: Form[] = [reticle, roster, library, scale, zero, converge];

/**
 * One per scene, in order: read, roster, library, rate, nothing, send.
 * The instruments of the work as objects: the phone under review, a model at
 * the mark, the slate, the camera, the voice, the send.
 */
export const FORMS: FormSpec[] = [
  { kind: 'solid', build: phone,  size: 0.92, yaw: 0.30 },
  { kind: 'solid', build: figure, size: 1.12, yaw: 0.28 },
  { kind: 'solid', build: slate,  size: 1.05, yaw: -0.28 },
  { kind: 'solid', build: camera, size: 1.05, yaw: -1.20, pitch: 0.05, lift: -0.12 },
  { kind: 'solid', build: wave,   size: 1.60, yaw: 0.18 },
  { kind: 'solid', build: send,   size: 0.88, yaw: -0.45, pitch: 0.95, lift: -0.36 },
];

/**
 * Draw a form and return the coordinates of every lit pixel, normalised to
 * -0.5..0.5 with y up.
 */
export function sampleForm(form: Form, res = 300): Float32Array {
  const cv = document.createElement('canvas');
  cv.width = res; cv.height = res;
  const c = cv.getContext('2d', { willReadFrequently: true });
  if (!c) return new Float32Array(0);
  c.fillStyle = '#000'; c.fillRect(0, 0, res, res);
  form(c, res, res);

  const { data } = c.getImageData(0, 0, res, res);
  const lit = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < res && y < res && data[(y * res + x) * 4] > 96;

  // Edges plus a sparse interior. A solid fill concentrates every point into a
  // small area and additive blending turns it into a white mass — the exact
  // fault we removed from the terrain. An outline reads as a drawing.
  const pts: number[] = [];
  for (let y = 0; y < res; y++) {
    for (let x = 0; x < res; x++) {
      if (!lit(x, y)) continue;
      const edge = !lit(x - 1, y) || !lit(x + 1, y) || !lit(x, y - 1) || !lit(x, y + 1);
      if (edge || Math.random() < 0.07) pts.push(x / res - 0.5, 0.5 - y / res);
    }
  }
  return new Float32Array(pts);
}
