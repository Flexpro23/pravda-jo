/**
 * The client account — the record every other thing now hangs off.
 *
 * Runs against _itest_* collections, so it drives the real store code and
 * cannot touch a live lead.
 *
 *   npm run test:lead
 *
 * Three rules are what this is really guarding, and all three are the kind that
 * a future screen breaks without noticing.
 *
 * One business is one account. The handle is the document id, so a second
 * submission from the same shop cannot produce a second client no matter which
 * code path it arrives through — and the history the first one accumulated must
 * survive the second intact.
 *
 * A lead is never lost. It is written before anything is read, so a read that
 * fails leaves an account with a reason on it rather than nothing at all.
 *
 * And a notice is recorded only when it was actually sent. An un-notified lead
 * is a job somebody can finish in one tap; a lead marked notified that never
 * was is invisible, which is the exact failure the old intake form had.
 */
process.env.FIRESTORE_COLLECTION_PREFIX = '_itest_';
process.env.GOOGLE_CLOUD_PROJECT = 'pravda-jo';

const C = await import('../lib/store/clients.ts');
const { owesNotice, currentSheet } = await import('../lib/data/clients.ts');
const { store } = await import('../lib/store/firebase.ts');

const db = store();
const PREFIX = process.env.FIRESTORE_COLLECTION_PREFIX ?? '';
if (!PREFIX.startsWith('_itest')) {
  console.error('refusing to run without an _itest_ collection prefix');
  process.exit(2);
}

const HANDLE = 'itestleadshop';
await db.collection(`${PREFIX}clients`).doc(HANDLE).delete().catch(() => {});

let bad = 0;
const ok = (n: string, c: boolean, x = '') => {
  if (!c) bad++;
  console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}${x ? '  ' + x : ''}`);
};

// ── a stranger submits the form ────────────────────────────────────────────
console.log('\n══ the lead is written before anything is read ══');

const first = await C.openClient({
  handle: `@${HANDLE}`, contactName: 'Abu Sami', contactPhone: '0791234567',
  lang: 'ar', source: 'intake',
});
ok('a submission opens an account', !!first);
ok('  and says it is new', first?.created === true);
ok('  the handle is normalised into the id', first?.client.id === HANDLE);
ok('  it starts with nothing read', first?.client.sheetTokens.length === 0);
ok('  and nobody has been told', owesNotice(first!.client));

// ── the same shop, again ───────────────────────────────────────────────────
console.log('\n══ one business is one account ══');

await C.attachToClient(HANDLE, 'sheet', 'itestsheetA');
await C.setBusinessName(HANDLE, 'Sami & Sons');
await C.markNotified(HANDLE, 'new');

const again = await C.openClient({
  // The same shop typed as a full profile URL this time, with a corrected number.
  handle: `https://instagram.com/${HANDLE}/`,
  contactName: 'Abu Sami', contactPhone: '0799999999',
  lang: 'en', source: 'intake',
});
ok('a second submission is not a second account', again?.created === false);
ok('  it is the same document', again?.client.id === HANDLE);

const after = await C.getClient(HANDLE);
ok('  the corrected phone number wins', after?.contactPhone === '0799999999',
  after?.contactPhone);
ok('  the read it already had survived', after?.sheetTokens.length === 1);
ok('  the business name survived', after?.businessName === 'Sami & Sons');
ok('  and it is still marked as told', !!after?.notifiedNewAt);

// ── a read that fails ──────────────────────────────────────────────────────
console.log('\n══ a failed read leaves a reason, not a gap ══');

await C.setClientStatus(HANDLE, 'failed', 'unreadable');
const failed = await C.getClient(HANDLE);
ok('the failure is on the record', failed?.status === 'failed');
ok('  with the engine’s own reason', failed?.readError === 'unreadable');
ok('  and it owes a second notice', owesNotice({ ...failed!, status: 'ready' }));

// A failed account is the one state a re-submission may reset, so it is tried
// again rather than sitting failed forever.
const retried = await C.openClient({
  handle: HANDLE, contactName: 'Abu Sami', contactPhone: '0799999999', lang: 'ar',
});
ok('re-submitting a failed lead puts it back in the queue',
  retried?.client.status === 'new');
ok('  and clears the stale reason', !retried?.client.readError);

// ── but a client already moving is not dragged backwards ───────────────────
console.log('\n══ a live account is not reset by a form ══');

await C.setClientStatus(HANDLE, 'sent');
const resubmit = await C.openClient({
  handle: HANDLE, contactName: 'Abu Sami', contactPhone: '0799999999', lang: 'ar',
});
ok('a sent client stays sent', resubmit?.client.status === 'sent',
  resubmit?.client.status);

// ── the history accumulates ────────────────────────────────────────────────
console.log('\n══ two reads on one account ══');

await C.attachToClient(HANDLE, 'sheet', 'itestsheetB');
const twice = await C.getClient(HANDLE);
ok('both reads are kept', twice?.sheetTokens.length === 2, String(twice?.sheetTokens.length));
ok('  newest first', twice?.sheetTokens[0] === 'itestsheetB');
ok('  and that is the one a screen opens', currentSheet(twice!) === 'itestsheetB');

await C.attachToClient(HANDLE, 'sheet', 'itestsheetB');
const dedup = await C.getClient(HANDLE);
ok('re-attaching the same read does not double it', dedup?.sheetTokens.length === 2,
  String(dedup?.sheetTokens.length));

// ── found from either end ──────────────────────────────────────────────────
console.log('\n══ a sheet knows whose it is ══');

const byToken = await C.clientForSheet('itestsheetA');
ok('a sheet token resolves back to the account', byToken?.id === HANDLE);

// ── the notice, and only when it went ──────────────────────────────────────
console.log('\n══ a notice is recorded only when it was sent ══');

const beforeReady = await C.getClient(HANDLE);
ok('the ready notice is outstanding', !beforeReady?.notifiedReadyAt);
await C.markNotified(HANDLE, 'ready');
const told = await C.getClient(HANDLE);
ok('  and recorded once it goes', !!told?.notifiedReadyAt);
ok('  which settles the account', !owesNotice(told!));

// ── the deal ───────────────────────────────────────────────────────────────
console.log('\n══ won ══');

await C.linkDeal(HANDLE, 'itest-deal-lead');
const won = await C.getClient(HANDLE);
ok('the account points at the job', won?.dealId === 'itest-deal-lead');
ok('  and reads as won', won?.status === 'won');

// ── what it refuses ────────────────────────────────────────────────────────
console.log('\n══ what it refuses ══');

ok('a handle that is not one opens nothing',
  (await C.openClient({
    handle: 'not a handle at all', contactName: 'x', contactPhone: '0791111111', lang: 'ar',
  })) === null);
ok('and cannot be read back either', (await C.getClient('../escape')) === null);

console.log(bad ? `\n${bad} failed.` : '\nall good');
process.exit(bad ? 1 : 0);
