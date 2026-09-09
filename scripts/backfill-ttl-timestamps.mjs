#!/usr/bin/env node
/**
 * Rewrite every string-valued `expiresAt` as a Firestore `Timestamp`.
 *
 * A TTL policy deletes a document only when its TTL field holds a timestamp.
 * A field of any other type is not an error and not a warning — the sweep
 * passes the document over in silence and it lives forever. Every `expiresAt`
 * this codebase wrote before `lib/store/ttl.ts` landed was an ISO string, so
 * the three retention promises (`clients`, `sheets`, `ratelimit`) were being
 * kept by nobody, and enabling the policies in docs/RUNBOOK.md §7 over those
 * documents would create three policies that can never fire. New writes are
 * already timestamps; this is the one-off pass over what is already there.
 *
 * It reads the whole of each collection rather than querying for the string
 * shape, because Firestore cannot filter on a field's *type* — an inequality
 * against a string returns only string-valued fields in a way that depends on
 * type-ordering, which is precisely the subtlety this script exists to correct
 * and the wrong thing to bet the pass on. A document whose `expiresAt` is
 * absent, already a timestamp, or `null` is left exactly as it is: absence is
 * how `approveSheet` and `winSheet` say the retention clock has stopped, and
 * writing a field onto those would put a deletion date on a customer's record.
 *
 * A dry run by default. Nothing is written without `--apply`, because a script
 * that mutates every document in three collections should be a thing somebody
 * asked for twice.
 *
 * Honours `FIRESTORE_COLLECTION_PREFIX`, so the same command corrects staging
 * or an emulator run as well as production — unlike the PDPL scripts beside
 * it, a prefix here is ordinary rather than a mistake, since the shape being
 * fixed is wrong wherever it was written.
 *
 * Usage:
 *   node scripts/backfill-ttl-timestamps.mjs            # dry run, changes nothing
 *   node scripts/backfill-ttl-timestamps.mjs --apply    # writes
 *
 * Needs real Application Default Credentials against the `pravda-jo` project
 * (`gcloud auth application-default login`), matching every other script here.
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'pravda-jo';
const PREFIX = process.env.FIRESTORE_COLLECTION_PREFIX || '';
const APPLY = process.argv.includes('--apply');

const COLLECTIONS = ['clients', 'sheets', 'ratelimit'];

// The emulator issues no credential and rejects one; the same script has to
// run against it, because that is the only honest way to exercise this before
// it is pointed at production.
initializeApp(process.env.FIRESTORE_EMULATOR_HOST
  ? { projectId: PROJECT }
  : { credential: applicationDefault(), projectId: PROJECT });
const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

// Firestore refuses a batch larger than 500 writes, and a lead-heavy `clients`
// collection will pass that on its own eventually.
const BATCH_LIMIT = 400;

const report = [];

for (const name of COLLECTIONS) {
  const path = `${PREFIX}${name}`;
  const snap = await db.collection(path).get();

  const stale = [];
  let alreadyTimestamp = 0;
  let noField = 0;

  for (const doc of snap.docs) {
    const value = doc.get('expiresAt');
    if (typeof value === 'string' && value) {
      const ms = +new Date(value);
      // An unparseable date cannot become a timestamp, and guessing one would
      // invent a deletion date. Reported and skipped, for a human to look at.
      if (Number.isFinite(ms)) stale.push({ ref: doc.ref, id: doc.id, value, ms });
      else report.push({ collection: path, id: doc.id, unparseable: value });
    } else if (value instanceof Timestamp) {
      alreadyTimestamp++;
    } else {
      noField++;
    }
  }

  console.log(
    `${path}: ${snap.size} document(s) — ${stale.length} to rewrite, `
    + `${alreadyTimestamp} already a Timestamp, ${noField} with no expiresAt.`,
  );

  if (!APPLY || !stale.length) continue;

  for (let i = 0; i < stale.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    for (const d of stale.slice(i, i + BATCH_LIMIT)) {
      // `update`, not `set`: the only field this script has any business
      // touching is the one it came for.
      batch.update(d.ref, { expiresAt: Timestamp.fromMillis(d.ms) });
    }
    await batch.commit();
  }
  console.log(`  wrote ${stale.length} Timestamp(s) to ${path}.`);
}

for (const r of report) {
  console.error(`  skipped ${r.collection}/${r.id}: expiresAt "${r.unparseable}" is not a date.`);
}

if (!APPLY) {
  console.log('\nDry run — nothing was written. Re-run with --apply once the counts look right.');
}
