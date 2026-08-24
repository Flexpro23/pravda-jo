/**
 * Source forms for the point field to resolve into.
 *
 * Drawn on an offscreen canvas rather than loaded as assets, so there is no
 * network cost and no stock imagery. Each returns a luminance map that the
 * terrain samples to build target positions.
 *
 * Replace these with real PRAVDA photography when it exists — `sampleImage`
 * takes any drawable source, so a <img> of a real frame drops straight in.
 */
export type Form = (c: CanvasRenderingContext2D, w: number, h: number) => void;

/** Head and shoulders, three-quarter. The most legible "this is a person". */
export const portrait: Form = (c, w, h) => {
  const cx = w * 0.5, headR = w * 0.145;
  const headY = h * 0.32;
  c.fillStyle = '#fff';
  // shoulders
  c.beginPath();
  c.moveTo(w * 0.12, h);
  c.bezierCurveTo(w * 0.16, h * 0.66, w * 0.34, h * 0.55, cx - headR * 0.5, h * 0.50);
  c.lineTo(cx + headR * 0.62, h * 0.50);
  c.bezierCurveTo(w * 0.70, h * 0.56, w * 0.86, h * 0.68, w * 0.90, h);
  c.closePath(); c.fill();
  // neck
  c.fillRect(cx - headR * 0.38, headY, headR * 0.78, h * 0.22);
  // head
  c.beginPath();
  c.ellipse(cx, headY, headR * 0.92, headR * 1.22, 0, 0, Math.PI * 2);
  c.fill();
  // hair mass, offset — keeps it from reading as a mannequin
  c.beginPath();
  c.ellipse(cx - headR * 0.16, headY - headR * 0.42, headR * 1.12, headR * 0.98, -0.22, 0, Math.PI * 2);
  c.fill();
};

/** An aperture, mid-open. Reads instantly as a camera. */
export const aperture: Form = (c, w, h) => {
  const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.40;
  c.strokeStyle = '#fff'; c.lineWidth = Math.max(2, R * 0.055);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const a2 = a + (Math.PI * 2) / 7;
    c.beginPath();
    c.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
    c.lineTo(cx + Math.cos(a2) * R * 0.34, cy + Math.sin(a2) * R * 0.34);
    c.stroke();
  }
  c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.stroke();
};

/** A 9:16 frame with crop marks — the format the work actually lives in. */
export const frame: Form = (c, w, h) => {
  const fh = h * 0.80, fw = fh * (9 / 16);
  const x = (w - fw) / 2, y = (h - fh) / 2;
  c.strokeStyle = '#fff'; c.lineWidth = Math.max(2, w * 0.006);
  c.strokeRect(x, y, fw, fh);
  // thirds
  c.lineWidth = Math.max(1, w * 0.0025);
  for (let i = 1; i < 3; i++) {
    c.beginPath(); c.moveTo(x + (fw / 3) * i, y); c.lineTo(x + (fw / 3) * i, y + fh); c.stroke();
    c.beginPath(); c.moveTo(x, y + (fh / 3) * i); c.lineTo(x + fw, y + (fh / 3) * i); c.stroke();
  }
  // corner marks
  c.lineWidth = Math.max(3, w * 0.008);
  const m = fw * 0.13;
  const corner = (px: number, py: number, sx: number, sy: number) => {
    c.beginPath(); c.moveTo(px, py + sy * m); c.lineTo(px, py); c.lineTo(px + sx * m, py); c.stroke();
  };
  corner(x, y, 1, 1); corner(x + fw, y, -1, 1);
  corner(x, y + fh, 1, -1); corner(x + fw, y + fh, -1, -1);
};

/** Two figures, a shoot in progress: one holding a camera, one posed. */
export const shoot: Form = (c, w, h) => {
  c.fillStyle = '#fff';
  // model, right
  const mx = w * 0.66, mr = w * 0.085;
  c.beginPath(); c.ellipse(mx, h * 0.30, mr * 0.9, mr * 1.15, 0, 0, Math.PI * 2); c.fill();
  c.beginPath();
  c.moveTo(mx - mr * 1.5, h); c.bezierCurveTo(mx - mr * 1.2, h * 0.60, mx - mr * 0.7, h * 0.46, mx, h * 0.44);
  c.bezierCurveTo(mx + mr * 0.8, h * 0.46, mx + mr * 1.3, h * 0.62, mx + mr * 1.7, h);
  c.closePath(); c.fill();
  // photographer, left, camera raised
  const px = w * 0.28, pr = w * 0.072;
  c.beginPath(); c.ellipse(px, h * 0.40, pr * 0.9, pr * 1.1, 0, 0, Math.PI * 2); c.fill();
  c.beginPath();
  c.moveTo(px - pr * 1.5, h); c.bezierCurveTo(px - pr * 1.2, h * 0.68, px - pr * 0.7, h * 0.56, px, h * 0.54);
  c.bezierCurveTo(px + pr * 0.8, h * 0.56, px + pr * 1.3, h * 0.70, px + pr * 1.7, h);
  c.closePath(); c.fill();
  c.fillRect(px + pr * 0.5, h * 0.355, pr * 1.5, pr * 0.95);      // camera body
  c.beginPath(); c.arc(px + pr * 1.55, h * 0.40, pr * 0.44, 0, Math.PI * 2); c.fill(); // lens
};

export const FORMS: Form[] = [frame, portrait, aperture, shoot, portrait, frame];

/**
 * Draw a form and return the coordinates of every lit pixel, normalised to
 * -0.5..0.5 with y up.
 */
export function sampleForm(form: Form, res = 210): Float32Array {
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
      // every edge pixel, and 7% of the interior to give the form some body
      if (edge || Math.random() < 0.07) pts.push(x / res - 0.5, 0.5 - y / res);
    }
  }
  return new Float32Array(pts);
}
