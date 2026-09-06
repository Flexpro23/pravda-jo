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
 *   node scripts/seed-content.mjs --promote rana
 *
 * The rate argument exists because there is no published voiceover rate. PRAVDA
 * sets rates and talent never proposes them, so this script will not invent
 * one: without the argument the voiceover record is seeded inactive, which
 * keeps them off the booking list rather than letting someone be offered a day
 * at nothing a day.
 *
 * `--promote <key>` says a seeded person is a real one. Everybody here starts
 * invented, because everybody here IS invented until somebody has met them,
 * and `recommend` refuses to put an invented person on a client's sheet. That
 * flag is the only thing that clears it, and it clears it for one person at a
 * time on purpose.
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createHash, randomBytes } from 'node:crypto';

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'pravda-jo';
const PREFIX = process.env.FIRESTORE_COLLECTION_PREFIX || '';
const rateArg = process.argv.indexOf('--voiceover-rate');
const VO_RATE = rateArg > -1 ? Number(process.argv[rateArg + 1]) || 0 : 0;
const promoteArg = process.argv.indexOf('--promote');
const PROMOTE = promoteArg > -1 ? (process.argv[promoteArg + 1] || '').trim() : '';
const FORCE = process.argv.includes('--force');

// A seed is a development tool that happens to hold production credentials.
// Without a prefix it writes straight over the live collections, and the one
// place that is never what somebody meant is a production shell.
if (process.env.NODE_ENV === 'production' && !PREFIX && !FORCE) {
  console.error(
    'Refusing to seed: NODE_ENV=production and no FIRESTORE_COLLECTION_PREFIX.\n'
    + '  This would overwrite live records. Set a prefix (staging_) or pass --force\n'
    + '  if rewriting production is genuinely what you mean.',
  );
  process.exit(1);
}

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
    // What they are cast for. The roster card is the source, because that is
    // the list a person edits — a bookable record edited in the console keeps
    // whatever it was given, so a hand-tuned set is not overwritten by a rerun.
    tags: prior?.tags?.length ? prior.tags : (m.suits ?? []),
    passCodeHash,
    // Only a record that was already bookable keeps its own answer; one that
    // was held back for want of a rate is released as soon as there is one.
    active: wasUnbookable ? bookable : prior.active,
    // Never downgrade somebody an operator has promoted. This was an
    // unconditional `true` inside a `{merge: true}` set, so a rerun re-flagged
    // a real person as invented — and `recommend` refuses to cast an invented
    // person, which means a rerun could quietly empty a live sheet's cast.
    //
    // A record that has never been seen before is invented. A record that
    // already exists is not mentioned at all: `prior.placeholder ?? true` still
    // wrote `true` onto anyone whose flag had been deleted rather than set to
    // false, which is the same downgrade by a different route. `undefined` is
    // dropped by `put`'s merge, so saying nothing leaves the record's own
    // answer exactly where it was.
    placeholder: m.key === PROMOTE ? false : (prior ? prior.placeholder : true),
    createdAt: prior?.createdAt ?? new Date().toISOString(),
  };
});
if (PROMOTE && !talent.some((t) => t.id === PROMOTE)) {
  console.error(`--promote ${PROMOTE}: no roster key by that name.`);
  console.error(`  Keys: ${talent.map((t) => t.id).join(', ')}`);
  process.exit(1);
}
await put('talent', talent, (t) => t.id);
if (PROMOTE) console.log(`  promoted ${PROMOTE} — no longer a placeholder.`);

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

// The number that actually gates a sheet. `recommend` casts nobody who is
// still flagged, so a roster that is bookable on paper and entirely
// placeholder produces five ideas marked "cast to confirm" and no names —
// which is correct, and is worth seeing at the end of every seed rather than
// discovering on a client's sheet.
const bookablePlaceholders = talent.filter((t) => t.active && t.dayRateJOD > 0 && t.placeholder);
const bookableTotal = talent.filter((t) => t.active && t.dayRateJOD > 0).length;
console.log(
  `\n${bookablePlaceholders.length} of ${bookableTotal} bookable talent are still placeholders.`,
);
if (bookablePlaceholders.length) {
  console.log('  No sheet will name them until each is promoted:');
  console.log(`    node scripts/seed-content.mjs --promote ${bookablePlaceholders[0].id}`);
}
process.exit(0);
