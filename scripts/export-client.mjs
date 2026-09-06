#!/usr/bin/env node
/**
 * The concrete implementation behind `/{lang}/data`'s export promise.
 *
 * Reads `clients/{handle}`, every sheet the client's own `sheetTokens` list
 * names, the deal it was won into (if any), and every booking against that
 * deal — and prints one JSON object to stdout for a human to attach to an
 * email. Nothing here writes anything.
 *
 * Refuses to run against a staging/test prefix: a PDPL export request is
 * about a real business's real data, and pointing this at `staging_` or
 * `_itest_` by habit would hand somebody a fixture instead of their own
 * record — or, worse, quietly convince the operator the real export works
 * when only the fixture path was ever exercised. `--allow-prefix` lifts the
 * refusal for exactly one purpose: testing this script itself against the
 * emulator before it is ever pointed at a real handle (see docs/RUNBOOK.md).
 *
 * Usage:
 *   node scripts/export-client.mjs <handle>
 *   node scripts/export-client.mjs <handle> --out somewhere.json
 *
 * Needs real Application Default Credentials against the `pravda-jo` project
 * (`gcloud auth application-default login`), matching every other script here.
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { writeFileSync } from 'node:fs';

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'pravda-jo';
const PREFIX = process.env.FIRESTORE_COLLECTION_PREFIX || '';
const ALLOW_PREFIX = process.argv.includes('--allow-prefix'); // test-only, see header

if (PREFIX && !ALLOW_PREFIX) {
  console.error(
    `Refusing to run: FIRESTORE_COLLECTION_PREFIX=${PREFIX} is set.\n`
    + '  A PDPL export is for a real handle in the real project. Unset the prefix,\n'
    + '  or pass --allow-prefix if this is a deliberate test against the emulator.',
  );
  process.exit(1);
}

const args = process.argv.slice(2).filter((a) => a !== '--allow-prefix');
const outIdx = args.indexOf('--out');
const outPath = outIdx > -1 ? args[outIdx + 1] : null;
const handleArg = args.filter((a, i) => a !== '--out' && (outIdx === -1 || i !== outIdx + 1))[0];

if (!handleArg) {
  console.error('Usage: node scripts/export-client.mjs <handle> [--out file.json]');
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
  console.error(`No client found for handle "${id}".`);
  process.exit(1);
}
const client = clientSnap.data();

const sheets = [];
for (const token of client.sheetTokens ?? []) {
  const s = await db.collection(`${PREFIX}sheets`).doc(token).get();
  if (s.exists) sheets.push(s.data());
}

let deal = null;
if (client.dealId) {
  const d = await db.collection(`${PREFIX}deals`).doc(client.dealId).get();
  if (d.exists) deal = d.data();
}
// Defensive: a deal can name this client by handle without the client's own
// `dealId` having been back-filled (an older record, a race). Caught by handle
// too, and de-duplicated against whatever `dealId` already found.
const byHandle = await db.collection(`${PREFIX}deals`).where('clientHandle', '==', id).get();
const deals = [
  ...(deal ? [deal] : []),
  ...byHandle.docs.map((d) => d.data()).filter((d) => d.id !== deal?.id),
];

const bookings = [];
for (const d of deals) {
  const snap = await db.collection(`${PREFIX}bookings`).where('dealId', '==', d.id).get();
  bookings.push(...snap.docs.map((b) => b.data()));
}

const record = {
  exportedAt: new Date().toISOString(),
  client,
  sheets,
  deals,
  bookings,
};

const json = JSON.stringify(record, null, 2);
if (outPath) {
  writeFileSync(outPath, json);
  console.error(`Wrote ${outPath} — ${sheets.length} sheet(s), ${deals.length} deal(s), ${bookings.length} booking(s).`);
} else {
  console.log(json);
}
