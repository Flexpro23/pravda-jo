/**
 * Generate a plate for every piece in the archive that does not have one.
 *
 *   node scripts/make-plates.mjs          # only what is missing
 *   node scripts/make-plates.mjs --force  # redraw everything
 *
 * These are deliberately not stock photography. A generated abstract plate
 * reads as a placeholder; a stock photograph of somebody else's restaurant
 * reads as a lie, and the archive already carries `placeholder: true` because
 * being caught inventing work is the one thing that would make a teardown's
 * whole claim worthless.
 *
 * Everything is derived from a hash of the slug, so a rerun produces the same
 * file byte for byte. A plate that changed on every deploy would push a new
 * asset through the CDN for no reason and make diffs unreadable.
 */
import { createHash } from 'node:crypto';
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'public', 'plates');
const force = process.argv.includes('--force');

const { WORK } = await import('../lib/data/work.ts');

/**
 * A deterministic stream of numbers from the slug.
 *
 * Math.random would give a different plate on every run, which is the whole
 * problem this avoids — so the slug is hashed once and the digest is walked as
 * a source of bytes.
 */
function rng(seed) {
  let bytes = createHash('sha256').update(seed).digest();
  let i = 0;
  return () => {
    if (i >= bytes.length) { bytes = createHash('sha256').update(bytes).digest(); i = 0; }
    return bytes[i++] / 255;
  };
}

/** The brand's own dark register: Forest Green falling into Almost Black. */
const plate = (slug, hue) => {
  const r = rng(slug);
  const n = (lo, hi) => lo + r() * (hi - lo);

  // Horizontal bands, rotated. They read as slats of light across a room,
  // which is what a plate stands in for: a frame from a shoot nobody has done.
  let y = Math.round(n(0, 60));
  const bands = [];
  while (y < 1500) {
    const h = Math.round(n(30, 145));
    bands.push(`<rect x="0" y="${y}" width="1200" height="${h}" fill="#EFECE5" opacity="${n(0.03, 0.15).toFixed(3)}"/>`);
    y += h + Math.round(n(45, 165));
  }

  const rot = n(-16, 16).toFixed(0);
  const cx = Math.round(n(380, 880));
  const cy = Math.round(n(420, 760));
  const horizon = Math.round(n(880, 1180));
  const rule = Math.round(n(80, 150));

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1500" width="1200" height="1500">
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="0.55" y2="1">
<stop offset="0" stop-color="${hue}"/><stop offset="0.55" stop-color="#17231B"/><stop offset="1" stop-color="#1A1A1A"/>
</linearGradient>
<radialGradient id="lite" cx="${(cx / 1200).toFixed(3)}" cy="${(cy / 1500).toFixed(3)}" r="0.62">
<stop offset="0" stop-color="#EFECE5" stop-opacity="0.66"/>
<stop offset="0.35" stop-color="#CDC4B3" stop-opacity="0.20"/>
<stop offset="1" stop-color="#1A1A1A" stop-opacity="0"/></radialGradient>
<clipPath id="cp"><rect width="1200" height="1500"/></clipPath>
<filter id="gr"><feTurbulence type="fractalNoise" baseFrequency="0.95" numOctaves="4"/>
<feColorMatrix type="saturate" values="0"/></filter>
<filter id="soft"><feGaussianBlur stdDeviation="42"/></filter>
</defs>
<g clip-path="url(#cp)">
<rect width="1200" height="1500" fill="url(#bg)"/>
<g transform="rotate(${rot} 600 750)">${bands.join('')}</g>
<ellipse cx="${cx}" cy="${cy}" rx="552" ry="600" fill="url(#lite)" filter="url(#soft)"/>
<rect width="1200" height="1500" filter="url(#gr)" opacity="0.13"/>
<rect x="0" y="${horizon}" width="1200" height="2" fill="#CDC4B3" opacity="0.5"/>
<rect x="${rule}" y="0" width="1" height="1500" fill="#EFECE5" opacity="0.14"/>
</g></svg>`;
};

mkdirSync(OUT, { recursive: true });
let made = 0, kept = 0;
for (const w of WORK) {
  const file = join(OUT, `${w.slug}.svg`);
  if (existsSync(file) && !force) { kept++; continue; }
  writeFileSync(file, plate(w.slug, w.hue));
  console.log(`  drew ${w.slug}.svg`);
  made++;
}
console.log(`\n${made} drawn, ${kept} already there. ${WORK.length} pieces in the archive.`);
