/**
 * Push the seed archive and roster into Firestore.
 *
 * Idempotent: documents are keyed by slug and by key, so re-running updates
 * rather than duplicating. Safe to run against a populated store — but it will
 * overwrite a record whose id matches, so once real work exists, edit it in the
 * database rather than here.
 *
 *   node scripts/seed-content.mjs
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'pravda-jo';
initializeApp({ credential: applicationDefault(), projectId: PROJECT });
const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

const { WORK } = await import('../lib/data/work.ts');
const { ROSTER } = await import('../lib/data/roster.ts');

const put = async (collection, rows, id) => {
  const batch = db.batch();
  for (const r of rows) batch.set(db.collection(collection).doc(id(r)), r);
  await batch.commit();
  console.log(`  ${collection}: ${rows.length} written`);
};

console.log(`seeding ${PROJECT}`);
await put('work', WORK, (w) => w.slug);
await put('cast', ROSTER, (m) => m.key);

const placeholders = [...WORK, ...ROSTER].filter((r) => r.placeholder).length;
console.log(`\n${placeholders} of ${WORK.length + ROSTER.length} records are placeholders.`);
console.log('The archive and roster pages say so while any remain.');
process.exit(0);
