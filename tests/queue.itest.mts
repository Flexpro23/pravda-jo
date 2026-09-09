/**
 * The claim-leased read queue — the thing that turns "the read probably ran"
 * into "the read ran, or somebody was told it did not".
 *
 * `after()` on the lead route is a best-effort callback: Cloud Run throttles the
 * instance's CPU the instant the response flushes and may reclaim it outright.
 * Everything below guards the four properties that make that survivable.
 *
 * One claim wins. Two code paths — the fast path and the sweeper — can want the
 * same account in the same millisecond, and exactly one of them may spend the
 * Meta call.
 *
 * A dead instance is recoverable. A claim whose lease has expired is claimable
 * again; a live one is not, or the sweeper would read every account twice.
 *
 * A hopeless read stops. Three attempts and the account is retired to `failed`
 * with a reason, rather than burning an hour's Meta budget one minute at a time.
 *
 * And the ceiling defers rather than drops. Over forty reads an hour the account
 * keeps its status, gets a place in the queue, and waits — the lead is never
 * lost, only the read is postponed.
 *
 * Runs against _itest_* collections, so it drives the real store code and cannot
 * touch a live lead:
 *
 *   JAVA_HOME=$(/usr/libexec/java_home -v 21) npx firebase-tools emulators:exec \
 *     --only firestore "node --experimental-strip-types --import ./tests/register.mjs tests/queue.itest.mts"
 */
process.env.FIRESTORE_COLLECTION_PREFIX = '_itest_';
process.env.GOOGLE_CLOUD_PROJECT = 'pravda-jo';

const C = await import('../lib/store/clients.ts');
const { outOfAttempts, leaseExpired, MAX_READ_ATTEMPTS } = await import('../lib/data/clients.ts');
const { store } = await import('../lib/store/firebase.ts');
const { Timestamp } = await import('firebase-admin/firestore');

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
const HANDLES = ['itestqueueone', 'itestqueuetwo', 'itestqueuethree', 'itestqueuefour'];
for (const h of HANDLES) await clients.doc(h).delete().catch(() => {});

const open = (handle: string) => C.openClient({
  handle, contactName: 'Abu Sami', contactPhone: '0791234567',
  lang: 'ar', source: 'intake',
});

/** Push a lease into the past without touching anything else. */
const expireLease = (id: string) =>
  clients.doc(id).update({ readLeaseUntil: new Date(Date.now() - 1_000).toISOString() });

// ── a new account is queued the moment it is opened ─────────────────────────
console.log('\n══ opening an account puts it in the queue ══');

const first = await open(HANDLES[0]);
ok('the account exists', !!first);
ok('  it starts as new', first?.client.status === 'new', first?.client.status);
ok('  and carries a queuedAt, so the sweeper can order it',
  typeof first?.client.queuedAt === 'string', String(first?.client.queuedAt));
ok('  nothing has claimed it yet', first?.client.readAttempts === undefined);

// ── two claims at once, one winner ──────────────────────────────────────────
console.log('\n══ two claims race and exactly one wins ══');

const [a, b] = await Promise.all([
  C.claimForRead(HANDLES[0]),
  C.claimForRead(HANDLES[0]),
]);
const winners = [a, b].filter(Boolean);
ok('exactly one claim came back non-null', winners.length === 1,
  `${a ? 'a' : '-'}${b ? 'b' : '-'}`);
ok('  the winner holds a lease', typeof winners[0]?.readLeaseUntil === 'string');
ok('  and counted its attempt', winners[0]?.readAttempts === 1, String(winners[0]?.readAttempts));

const claimed = await C.getClient(HANDLES[0]);
ok('the account is now reading', claimed?.status === 'reading', claimed?.status);
ok('  with a lease in the future', !leaseExpired(claimed!));
ok('  and readStartedAt written', typeof claimed?.readStartedAt === 'string');

// ── a live lease is not claimable ───────────────────────────────────────────
console.log('\n══ a live lease is nobody else\'s to take ══');

const third = await C.claimForRead(HANDLES[0]);
ok('a third claim on a live lease is refused', third === null);
const untouched = await C.getClient(HANDLES[0]);
ok('  and the attempt count did not move', untouched?.readAttempts === 1,
  String(untouched?.readAttempts));

// ── an expired lease is ─────────────────────────────────────────────────────
console.log('\n══ an expired lease is the sweeper\'s to reclaim ══');

await expireLease(HANDLES[0]);
const stale = await C.getClient(HANDLES[0]);
ok('the lease now reads as expired', leaseExpired(stale!));
ok('  and expiredLeases() finds it',
  (await C.expiredLeases(10)).some((c) => c.id === HANDLES[0]));

const second = await C.claimForRead(HANDLES[0]);
ok('the expired claim is reclaimable', second !== null);
ok('  and this is attempt two', second?.readAttempts === 2, String(second?.readAttempts));

// ── three strikes ───────────────────────────────────────────────────────────
console.log('\n══ the fourth attempt is a failure, not another read ══');

await expireLease(HANDLES[0]);
const thirdClaim = await C.claimForRead(HANDLES[0]);
ok('a third attempt is still allowed', thirdClaim?.readAttempts === 3,
  String(thirdClaim?.readAttempts));
ok(`  and now it is out of attempts (max ${MAX_READ_ATTEMPTS})`, outOfAttempts(thirdClaim!));

// What the sweeper does with one that is out of attempts: retire it with the
// last reason attached, rather than claim it a fourth time.
await expireLease(HANDLES[0]);
const forRetirement = await C.getClient(HANDLES[0]);
ok('the sweeper would see it as out of attempts, not as work', outOfAttempts(forRetirement!));
await C.forceClientStatus(HANDLES[0], 'failed', 'unreadable');
const retired = await C.getClient(HANDLES[0]);
ok('  retiring it lands on failed', retired?.status === 'failed', retired?.status);
ok('  with the reason kept', retired?.readError === 'unreadable', String(retired?.readError));
ok('  and it is out of the reading sweep',
  !(await C.expiredLeases(10)).some((c) => c.id === HANDLES[0]));

// ── the queue serves the longest wait first ─────────────────────────────────
console.log('\n══ the queue is ordered by how long somebody has waited ══');

await open(HANDLES[1]);
await clients.doc(HANDLES[1]).update({ queuedAt: new Date(Date.now() - 90_000).toISOString() });
await open(HANDLES[2]);
await clients.doc(HANDLES[2]).update({ queuedAt: new Date(Date.now() - 30_000).toISOString() });

const queue = (await C.queuedForRead(10)).map((c) => c.id);
const iOne = queue.indexOf(HANDLES[1]);
const iTwo = queue.indexOf(HANDLES[2]);
ok('both waiting accounts are in the queue', iOne >= 0 && iTwo >= 0, JSON.stringify(queue));
ok('  the one that waited longer comes first', iOne < iTwo, JSON.stringify(queue));

// An account written before queuedAt existed must still be reachable.
await clients.doc(HANDLES[2]).update({ queuedAt: null });
const legacy = (await C.staleUnqueued(10)).map((c) => c.id);
ok('a `new` account with no queuedAt is caught by the backstop',
  legacy.includes(HANDLES[2]), JSON.stringify(legacy));
ok('  and one that has a queuedAt is not', !legacy.includes(HANDLES[1]));

// ── the global ceiling defers, it never drops ───────────────────────────────
console.log('\n══ over the hourly ceiling the read waits and the lead survives ══');

const CEILING_WINDOW_MS = 60 * 60_000;
const windowIndex = Math.floor(Date.now() / CEILING_WINDOW_MS);
const ceilingDoc = db.collection(`${PREFIX}ratelimit`).doc(`reads:global:${windowIndex}`);
await ceilingDoc.set({
  count: 40,
  // A Timestamp, the shape `hit` itself writes — a TTL policy only ever
  // deletes a timestamp-valued field, so a fixture written as a string would
  // be a window document that outlives every real one.
  expiresAt: Timestamp.fromMillis(Date.now() + 2 * CEILING_WINDOW_MS),
});

const fresh = await open(HANDLES[3]);
ok('a fresh account is new', fresh?.client.status === 'new');
await clients.doc(HANDLES[3]).update({ queuedAt: null });

const deferred = await C.claimForRead(HANDLES[3]);
ok('the claim is refused once the ceiling is spent', deferred === null);
const waiting = await C.getClient(HANDLES[3]);
ok('  the account keeps its status', waiting?.status === 'new', waiting?.status);
ok('  nothing was counted against it', waiting?.readAttempts === undefined,
  String(waiting?.readAttempts));
ok('  and it is queued for the sweeper', typeof waiting?.queuedAt === 'string',
  String(waiting?.queuedAt));

await ceilingDoc.delete().catch(() => {});
const afterWindow = await C.claimForRead(HANDLES[3]);
ok('with the ceiling cleared it reads normally', afterWindow !== null);
ok('  as attempt one', afterWindow?.readAttempts === 1, String(afterWindow?.readAttempts));

// ── force may re-read, but it may not walk a settled account ────────────────
console.log('\n══ a forced re-read borrows a status, and never takes a settled one ══');

await clients.doc(HANDLES[1]).delete().catch(() => {});
await open(HANDLES[1]);

// Won and lost are refused outright. The bug this replaces: force claimed the
// account, `readAndFile` advanced it to `ready`, and a customer reappeared in
// the console as a lead to chase.
for (const settled of ['won', 'lost'] as const) {
  await C.forceClientStatus(HANDLES[1], settled);
  const refused = await C.claimForRead(HANDLES[1], undefined, { force: true });
  ok(`a forced claim on a ${settled} account is refused`, refused === null);
  ok(`  and it is still ${settled}`,
    (await C.getClient(HANDLES[1]))?.status === settled,
    String((await C.getClient(HANDLES[1]))?.status));
}

// `sent` is borrowed instead: the read is allowed, and the status comes back.
await C.forceClientStatus(HANDLES[1], 'sent');
const borrowed = await C.claimForRead(HANDLES[1], undefined, { force: true });
ok('a forced claim on a sent account is granted', borrowed !== null);
ok('  it reads while it holds the lease',
  (await C.getClient(HANDLES[1]))?.status === 'reading');
ok('  and it wrote down what it borrowed',
  (await C.getClient(HANDLES[1]))?.resumeStatus === 'sent',
  String((await C.getClient(HANDLES[1]))?.resumeStatus));

// What `readAndFile` does once the sheet is filed. `advanceClient('ready')`
// applies — the account genuinely is `reading` by now — and the restore is
// what puts it back where the human left it.
await C.advanceClient(HANDLES[1], 'ready');
ok('  filing the sheet would otherwise leave it ready',
  (await C.getClient(HANDLES[1]))?.status === 'ready');
const resumed = await C.resumeAfterRead(HANDLES[1]);
ok('  the borrowed status is handed back', resumed === 'sent', String(resumed));
const restored = await C.getClient(HANDLES[1]);
ok('  the account is sent again', restored?.status === 'sent', restored?.status);
ok('  and the marker is gone, so it cannot fire twice',
  restored?.resumeStatus === undefined, String(restored?.resumeStatus));
ok('  a second restore does nothing', (await C.resumeAfterRead(HANDLES[1])) === null);

// An ordinary claim on a `new` account borrows nothing at all.
await clients.doc(HANDLES[1]).delete().catch(() => {});
await open(HANDLES[1]);
const plain = await C.claimForRead(HANDLES[1]);
ok('an ordinary claim writes no resumeStatus',
  plain !== null && (await C.getClient(HANDLES[1]))?.resumeStatus === undefined);

// ── cleanup ─────────────────────────────────────────────────────────────────
for (const h of HANDLES) await clients.doc(h).delete().catch(() => {});
await ceilingDoc.delete().catch(() => {});

console.log(bad ? `\n${bad} failed.` : '\nall good');
process.exit(bad ? 1 : 0);
