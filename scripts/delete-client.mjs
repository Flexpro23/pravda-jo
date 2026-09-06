#!/usr/bin/env node
/**
 * The concrete implementation behind `/{lang}/data`'s "erase everything —
 * permanently, no questions" promise.
 *
 * Deletes `clients/{handle}`, every sheet named in its `sheetTokens` — and
 * every sheet carrying the handle, which is not the same set — the
 * deal it was won into (by `dealId`, and defensively by `clientHandle` too —
 * see `export-client.mjs`'s comment on the same seam), and every booking
 * against those deals. Prints what it deleted before touching anything is
 * not offered — this is irreversible by design, matching the site's own
 * promise, so the operator's record of what happened is the stdout of this
 * command, kept for their own files before replying to the requester.
 *
 * Refuses without the literal `--confirm` flag. No default-yes, no
 * "are you sure? (y/n)" a script running unattended could sail past.
 *
 * Refuses against a staging/test prefix without `--allow-prefix`, for the
 * same reason as `export-client.mjs`: this script must be exercised against
 * `_itest_` data before it is ever pointed at a real handle, and the prefix
 * guard is what makes "against a real handle" the only way it runs by default.
 *
 * Usage:
 *   node scripts/delete-client.mjs <handle> --confirm
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'pravda-jo';
const PREFIX = process.env.FIRESTORE_COLLECTION_PREFIX || '';
const ALLOW_PREFIX = process.argv.includes('--allow-prefix'); // test-only, see header
const CONFIRM = process.argv.includes('--confirm');

if (PREFIX && !ALLOW_PREFIX) {
  console.error(
    `Refusing to run: FIRESTORE_COLLECTION_PREFIX=${PREFIX} is set.\n`
    + '  A PDPL deletion is for a real handle in the real project. Unset the prefix,\n'
    + '  or pass --allow-prefix if this is a deliberate test against the emulator.',
  );
  process.exit(1);
}

const args = process.argv.slice(2).filter((a) => a !== '--allow-prefix' && a !== '--confirm');
const handleArg = args[0];

if (!handleArg) {
  console.error('Usage: node scripts/delete-client.mjs <handle> --confirm');
  process.exit(1);
}
if (!CONFIRM) {
  console.error(
    `Refusing to delete "${handleArg}" without --confirm.\n`
    + '  This is permanent. Re-run with --confirm once you mean it:\n'
    + `    node scripts/delete-client.mjs ${handleArg} --confirm`,
  );
  process.exit(1);
}

initializeApp({ credential: applicationDefault(), projectId: PROJECT });
const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

const { normaliseHandle } = await import('../lib/meta/discovery.ts');

const id = normaliseHandle(handleArg);
if (!id) {
  console.error(`"${handleArg}" does not normalise to a usable Instagram handle.`);
  process.exit(1);
}

const clientSnap = await db.collection(`${PREFIX}clients`).doc(id).get();
if (!clientSnap.exists) {
  console.error(`No client found for handle "${id}". Nothing to delete.`);
  process.exit(1);
}
const client = clientSnap.data();

/**
 * Every sheet, from both ends.
 *
 * `sheetTokens` is the account's own list and is normally complete. Normally is
 * not good enough for a deletion that answers a legal request: `attachToClient`
 * runs after the sheet is written, so a read that died between the two leaves a
 * sheet holding this business's bio, captions and profile picture with nothing
 * on the client pointing at it. Deleting only what the list names would report
 * success and leave that behind. The handle is on the sheet too, so it is asked
 * for directly as well and the two answers are merged.
 */
const byHandleSheets = await db.collection(`${PREFIX}sheets`)
  .where('handle', '==', id).get();
const sheetTokens = [...new Set([
  ...(client.sheetTokens ?? []),
  ...byHandleSheets.docs.map((d) => d.id),
])];

let deal = null;
if (client.dealId) {
  const d = await db.collection(`${PREFIX}deals`).doc(client.dealId).get();
  if (d.exists) deal = d.data();
}
const byHandle = await db.collection(`${PREFIX}deals`).where('clientHandle', '==', id).get();
const deals = [
  ...(deal ? [deal] : []),
  ...byHandle.docs.map((d) => d.data()).filter((d) => d.id !== deal?.id),
];

const bookingIds = [];
for (const d of deals) {
  const snap = await db.collection(`${PREFIX}bookings`).where('dealId', '==', d.id).get();
  bookingIds.push(...snap.docs.map((b) => b.id));
}

const batch = db.batch();
batch.delete(db.collection(`${PREFIX}clients`).doc(id));
for (const token of sheetTokens) batch.delete(db.collection(`${PREFIX}sheets`).doc(token));
for (const d of deals) batch.delete(db.collection(`${PREFIX}deals`).doc(d.id));
for (const bid of bookingIds) batch.delete(db.collection(`${PREFIX}bookings`).doc(bid));
await batch.commit();

console.log(JSON.stringify({
  deletedAt: new Date().toISOString(),
  handle: id,
  deleted: {
    client: 1,
    sheets: sheetTokens.length,
    deals: deals.length,
    bookings: bookingIds.length,
  },
}, null, 2));
