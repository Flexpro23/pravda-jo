/**
 * The status machine — forward-only for the engine, absolute for the operator.
 *
 * The bug this exists to prevent had a shape worth remembering: the console's
 * re-read ended with an unconditional `setClientStatus(handle, 'ready')`, so
 * re-reading a client Khaled had already sent a sheet to — or won — dragged them
 * back to `ready` and back into the queue as work to do. A machine finishing a
 * second read is not news about a relationship.
 *
 * The rank table below is the whole rule:
 *   new 0 · reading 1 · failed 1 · ready 2 · sent 3 · won 4 · lost 4
 * An engine transition (`reading`, `ready`, `failed`) applies only while the
 * current rank is 2 or less. An operator transition always applies.
 *
 *   JAVA_HOME=$(/usr/libexec/java_home -v 21) npx firebase-tools emulators:exec \
 *     --only firestore "node --experimental-strip-types --import ./tests/register.mjs tests/status.itest.mts"
 */
process.env.FIRESTORE_COLLECTION_PREFIX = '_itest_';
process.env.GOOGLE_CLOUD_PROJECT = 'pravda-jo';

const C = await import('../lib/store/clients.ts');
const { STATUS_RANK } = await import('../lib/data/clients.ts');
const { store } = await import('../lib/store/firebase.ts');

const db = store();
const PREFIX = process.env.FIRESTORE_COLLECTION_PREFIX ?? '';
if (!PREFIX.startsWith('_itest')) {
  console.error('refusing to run without an _itest_ collection prefix');
  process.exit(2);
}

let bad = 0;
const ok = (n: string, c: boolean, x = '') => {
  if (!c) bad++;
  console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}${x ? '  ' + x : ''}`);
};

const clients = db.collection(`${PREFIX}clients`);
const HANDLE = 'iteststatusshop';
const reset = async (status?: string) => {
  await clients.doc(HANDLE).delete().catch(() => {});
  await C.openClient({
    handle: HANDLE, contactName: 'Abu Sami', contactPhone: '0791234567',
    lang: 'ar', source: 'intake',
  });
  if (status) await C.forceClientStatus(HANDLE, status as never);
};
const statusOf = async () => (await C.getClient(HANDLE))?.status;

// ── the table itself ────────────────────────────────────────────────────────
console.log('\n══ the rank table says what it is meant to say ══');

ok('new and reading are behind ready', STATUS_RANK.new < STATUS_RANK.ready
  && STATUS_RANK.reading < STATUS_RANK.ready);
ok('failed sits level with reading — a read that did not finish moves nothing',
  STATUS_RANK.failed === STATUS_RANK.reading);
ok('sent is past everything the engine may set', STATUS_RANK.sent > 2);
ok('won and lost are the far end', STATUS_RANK.won === 4 && STATUS_RANK.lost === 4);

// ── the engine moving an account it is still ahead of ───────────────────────
console.log('\n══ the engine may move an account it is still ahead of ══');

await reset();
await C.advanceClient(HANDLE, 'reading');
ok('new → reading applies', await statusOf() === 'reading');
await C.advanceClient(HANDLE, 'ready');
ok('reading → ready applies', await statusOf() === 'ready');
await C.advanceClient(HANDLE, 'failed', 'unreadable');
ok('ready → failed applies (a re-read that broke)', await statusOf() === 'failed');
ok('  and the reason is written',
  (await C.getClient(HANDLE))?.readError === 'unreadable');
await C.advanceClient(HANDLE, 'ready');
ok('failed → ready applies (a re-read that worked)', await statusOf() === 'ready');
ok('  and the stale failure reason is cleared',
  !(await C.getClient(HANDLE))?.readError,
  String((await C.getClient(HANDLE))?.readError));

// ── the engine may not drag a human's account backwards ─────────────────────
console.log('\n══ a sent client keeps its status while a new sheet is filed under it ══');

await reset('sent');
await C.attachToClient(HANDLE, 'sheet', 'tok-old');
await C.advanceClient(HANDLE, 'reading');
ok('sent is not moved to reading', await statusOf() === 'sent', await statusOf());
await C.attachToClient(HANDLE, 'sheet', 'tok-new');
await C.advanceClient(HANDLE, 'ready');
ok('sent is not moved to ready', await statusOf() === 'sent', await statusOf());
const sentClient = await C.getClient(HANDLE);
ok('  but the new sheet is at the head of the history',
  sentClient?.sheetTokens[0] === 'tok-new', JSON.stringify(sentClient?.sheetTokens));
ok('  and the old one is still there', sentClient?.sheetTokens.includes('tok-old'));

await C.advanceClient(HANDLE, 'failed', 'network');
ok('a failed re-read does not move a sent client either', await statusOf() === 'sent');
ok('  and does not stamp a failure on it',
  !(await C.getClient(HANDLE))?.readError);

console.log('\n══ won and lost are the same, harder ══');

await reset('won');
await C.advanceClient(HANDLE, 'ready');
ok('won is not moved to ready', await statusOf() === 'won', await statusOf());
await reset('lost');
await C.advanceClient(HANDLE, 'reading');
ok('lost is not moved to reading', await statusOf() === 'lost', await statusOf());

// ── the operator always wins ────────────────────────────────────────────────
console.log('\n══ an operator transition always applies ══');

await reset('sent');
await C.advanceClient(HANDLE, 'won');
ok('sent → won applies', await statusOf() === 'won');
await C.advanceClient(HANDLE, 'lost');
ok('won → lost applies — a person may always correct a person',
  await statusOf() === 'lost');

await reset('sent');
const lost = await C.setClientOutcome(HANDLE, 'lost', 'Went with their cousin.');
ok('setClientOutcome writes lost', lost?.status === 'lost', lost?.status);
ok('  and keeps the reason in his own words',
  lost?.lostReason === 'Went with their cousin.', String(lost?.lostReason));

await clients.doc(HANDLE).update({ expiresAt: new Date().toISOString() });
const won = await C.setClientOutcome(HANDLE, 'won');
ok('setClientOutcome writes won', won?.status === 'won', won?.status);
ok('  clears the loss reason', !won?.lostReason, String(won?.lostReason));
ok('  and clears the retention clock — a customer is not an unconverted lead',
  !won?.expiresAt, String(won?.expiresAt));

// ── force is the override, and is named for it ──────────────────────────────
console.log('\n══ forceClientStatus overrides, which is why it is not the default ══');

await reset('sent');
await C.forceClientStatus(HANDLE, 'ready');
ok('force moves a sent client back to ready (unapprove)', await statusOf() === 'ready');

// ── the margin: vertical, notes, contact ────────────────────────────────────
console.log('\n══ what a human knows about them ══');

await reset();
await C.setClientVertical(HANDLE, 'food');
ok('a confirmed vertical is remembered on the account',
  (await C.getClient(HANDLE))?.vertical === 'food');
await C.setClientVertical(HANDLE, null);
ok('  and can be taken back', !(await C.getClient(HANDLE))?.vertical);

await C.addClientNote(HANDLE, 'khaled', 'Called him, wants to think about it.');
await C.addClientNote(HANDLE, 'ali', 'Second call Sunday.');
const noted = await C.getClient(HANDLE);
ok('notes accumulate, oldest first', noted?.notes?.length === 2, String(noted?.notes?.length));
ok('  the first is unchanged',
  noted?.notes?.[0].text === 'Called him, wants to think about it.');
ok('  and each carries who wrote it',
  noted?.notes?.[0].by === 'khaled' && noted?.notes?.[1].by === 'ali');
ok('  with a timestamp', typeof noted?.notes?.[0].at === 'string');

// ── cleanup ─────────────────────────────────────────────────────────────────
await clients.doc(HANDLE).delete().catch(() => {});

console.log(bad ? `\n${bad} failed.` : '\nall good');
process.exit(bad ? 1 : 0);
