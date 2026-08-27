/**
 * Seed the archive, the roster, and the bookable talent.
 *
 * Idempotent: documents are keyed by slug and by key, so a rerun updates rather
 * than duplicating. Safe against a populated store — but it overwrites a record
 * whose id matches, so once real work exists, edit it in the database and not
 * here.
 *
 *   node scripts/seed-content.mjs
 *   node scripts/seed-content.mjs --voiceover-rate 40
 *
 * The rate argument exists because there is no published voiceover rate. PRAVDA
 * sets rates and talent never proposes them, so this script will not invent
 * one: without the argument the voiceover record is seeded inactive, which
 * keeps them off the booking list rather than letting someone be offered a day
 * at nothing a day.
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createHash, randomBytes } from 'node:crypto';

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'pravda-jo';
const PREFIX = process.env.FIRESTORE_COLLECTION_PREFIX || '';
const rateArg = process.argv.indexOf('--voiceover-rate');
const VO_RATE = rateArg > -1 ? Number(process.argv[rateArg + 1]) || 0 : 0;

initializeApp({ credential: applicationDefault(), projectId: PROJECT });
const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

const { WORK } = await import('../lib/data/work.ts');
const { ROSTER } = await import('../lib/data/roster.ts');
const { DISCIPLINE_RATE } = await import('../lib/data/deals.ts');

const put = async (name, rows, id) => {
  const batch = db.batch();
  for (const r of rows) batch.set(db.collection(`${PREFIX}${name}`).doc(id(r)), r, { merge: true });
  await batch.commit();
  console.log(`  ${name}: ${rows.length} written`);
};

console.log(`seeding ${PROJECT}${PREFIX ? ` (prefix ${PREFIX})` : ''}`);
await put('work', WORK, (w) => w.slug);
await put('cast', ROSTER, (m) => m.key);

// ── bookable talent, derived from the roster ────────────────────────────────
// The public roster and the bookable list are different things: one is a page,
// the other carries a day rate and a sign-in. They are seeded from the same
// people so the two cannot start out disagreeing about who exists.
const existing = new Map(
  (await db.collection(`${PREFIX}talent`).get()).docs.map((d) => [d.id, d.data()]),
);
const issued = [];
const reactivated = [];
const talent = ROSTER.map((m) => {
  const prior = existing.get(m.key);
  // The card is the source. The flag is only an override, and only when given
  // — reading it as the source meant a published rate was replaced by the
  // flag's own default of zero the moment nobody passed the flag.
  const rate = (m.discipline === 'voiceover' && VO_RATE > 0)
    ? VO_RATE : DISCIPLINE_RATE[m.discipline];
  const bookable = rate > 0;
  // A code is issued once and only shown once. A rerun must not silently
  // invalidate a code somebody is already using.
  let passCodeHash = prior?.passCodeHash;
  if (!passCodeHash) {
    const code = String(randomBytes(4).readUInt32BE() % 1_000_000).padStart(6, '0');
    passCodeHash = createHash('sha256').update(code).digest('hex');
    issued.push([m.name.en, code]);
  }
  // A rate an operator set by hand is kept; a stored ZERO is not a decision,
  // it is the absence of one, and must not block the rate that replaces it.
  // `??` alone got this wrong — it only falls back on null and undefined, so a
  // stored 0 survived a real rate and a stored false survived activation.
  const keptRate = prior?.dayRateJOD > 0 ? prior.dayRateJOD : rate;
  const wasUnbookable = !prior || !prior.active || !(prior.dayRateJOD > 0);
  if (prior && wasUnbookable && bookable) {
    reactivated.push(`${m.name.en} — now ${keptRate} JOD/day`);
  }
  return {
    id: m.key,
    name: m.name,
    discipline: m.discipline,
    dayRateJOD: keptRate,
    phone: prior?.phone ?? '',
    availability: prior?.availability ?? 'available',
    passCodeHash,
    // Only a record that was already bookable keeps its own answer; one that
    // was held back for want of a rate is released as soon as there is one.
    active: wasUnbookable ? bookable : prior.active,
    placeholder: true,
    createdAt: prior?.createdAt ?? new Date().toISOString(),
  };
});
await put('talent', talent, (t) => t.id);

if (reactivated.length) {
  console.log('\nReleased for booking:');
  for (const r of reactivated) console.log(`  ${r}`);
}

if (issued.length) {
  console.log('\nSign-in codes — shown once, stored hashed. Reissue if lost:');
  for (const [who, code] of issued) console.log(`  ${who.padEnd(10)} ${code}`);
}

const unbookable = talent.filter((t) => !t.active);
if (unbookable.length) {
  console.log(`\n${unbookable.length} seeded inactive, so they cannot be offered a day:`);
  for (const t of unbookable) {
    console.log(`  ${t.name.en} (${t.discipline}) — no published day rate.`);
  }
  console.log('  Set one:  node scripts/seed-content.mjs --voiceover-rate <JOD>');
}

const ph = [...WORK, ...ROSTER].filter((r) => r.placeholder).length;
console.log(`\n${ph} of ${WORK.length + ROSTER.length} archive and roster records are placeholders.`);
console.log('Both pages say so while any remain.');
process.exit(0);
