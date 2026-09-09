/**
 * The rate limiter — the one thing standing between the public lead form and
 * a script that never stops.
 *
 * Runs against _itest_* collections, so it drives the real store code and
 * cannot touch a live counter.
 *
 *   node --experimental-strip-types --import ./tests/register.mjs tests/ratelimit.itest.mts
 *
 * Against the Firestore emulator when FIRESTORE_EMULATOR_HOST is set, or
 * against the real project under the _itest_ prefix otherwise — same
 * convention as tests/lead.itest.mts.
 */
process.env.FIRESTORE_COLLECTION_PREFIX = '_itest_';
process.env.GOOGLE_CLOUD_PROJECT = 'pravda-jo';

const { hit, ipKey, clientIp } = await import('../lib/store/ratelimit.ts');
const { store } = await import('../lib/store/firebase.ts');
const { Timestamp } = await import('firebase-admin/firestore');

const db = store();
const PREFIX = process.env.FIRESTORE_COLLECTION_PREFIX ?? '';
if (!PREFIX.startsWith('_itest')) {
  console.error('refusing to run without an _itest_ collection prefix');
  process.exit(2);
}

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.log('FIRESTORE_EMULATOR_HOST is not set — running against the real project under _itest_.');
}

const BUCKET = `itest-ratelimit-${Date.now()}`;
const WINDOW_MS = 60_000; // one fixed window, long enough that the test cannot cross it

// Clean up whatever this bucket's current window doc might already hold.
const windowIndex = Math.floor(Date.now() / WINDOW_MS);
await db.collection(`${PREFIX}ratelimit`).doc(`${BUCKET}:${windowIndex}`).delete().catch(() => {});

let bad = 0;
const ok = (n: string, c: boolean, x = '') => {
  if (!c) bad++;
  console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}${x ? '  ' + x : ''}`);
};

// ── five hits, all inside the same window ──────────────────────────────────
console.log('\n══ five hits pass, and remaining counts down ══');

const seen: number[] = [];
for (let i = 1; i <= 5; i++) {
  const r = await hit(BUCKET, 5, WINDOW_MS);
  seen.push(r.remaining);
  ok(`hit ${i} of 5 passes`, r.ok === true, JSON.stringify(r));
  ok(`  remaining is ${5 - i}`, r.remaining === 5 - i, String(r.remaining));
}
ok('remaining counted down monotonically', seen.every((v, i) => i === 0 || v < seen[i - 1]),
  JSON.stringify(seen));

// ── the sixth hit in the same window fails ─────────────────────────────────
console.log('\n══ the sixth hit fails, with a retry hint ══');

const sixth = await hit(BUCKET, 5, WINDOW_MS);
ok('the 6th hit is refused', sixth.ok === false, JSON.stringify(sixth));
ok('  remaining is 0', sixth.remaining === 0, String(sixth.remaining));
ok('  retryAfterSec is positive', sixth.retryAfterSec > 0, String(sixth.retryAfterSec));

// ── a different bucket, same window, is untouched ──────────────────────────
console.log('\n══ a different bucket is a different counter ══');

const other = await hit(`${BUCKET}-other`, 5, WINDOW_MS);
ok('a different bucket still passes', other.ok === true, JSON.stringify(other));
ok('  starts at remaining 4', other.remaining === 4, String(other.remaining));

// ── expiresAt is set, for the TTL policy ───────────────────────────────────
console.log('\n══ expiresAt is written, for the Firestore TTL policy ══');

const doc = await db.collection(`${PREFIX}ratelimit`).doc(`${BUCKET}:${windowIndex}`).get();
const data = doc.data();
ok('the window document exists', doc.exists);
// A TTL policy deletes only a timestamp-valued field and ignores every other
// type without saying so, so the stored shape is the whole assertion here: a
// string would pass any "it carries an expiry" test and still never be swept.
ok('  it carries an expiresAt Timestamp, not a string',
  data?.expiresAt instanceof Timestamp, JSON.stringify(data?.expiresAt));
ok('  expiresAt is a valid, future date', (() => {
  const t = data?.expiresAt instanceof Timestamp ? +data.expiresAt.toDate() : NaN;
  return Number.isFinite(t) && t > Date.now();
})());
ok('  count reached 6', data?.count === 6, String(data?.count));

// ── ipKey never carries the raw IP ─────────────────────────────────────────
console.log('\n══ ipKey hashes, and never leaks the address ══');

const k1 = ipKey('203.0.113.5');
const k2 = ipKey('203.0.113.5');
const k3 = ipKey('203.0.113.9');
ok('ipKey is deterministic for the same IP', k1 === k2, k1);
ok('  a different IP hashes to a different key', k1 !== k3);
ok('  the key is prefixed and never contains the raw IP', k1.startsWith('ip:') && !k1.includes('203.0.113.5'), k1);

// ── clientIp reads the first x-forwarded-for entry ─────────────────────────
console.log('\n══ clientIp reads the first x-forwarded-for entry ══');

const req = new Request('https://example.com/api/lead', {
  headers: { 'x-forwarded-for': '198.51.100.7, 10.0.0.1, 10.0.0.2' },
});
ok('the first entry wins', clientIp(req) === '198.51.100.7', clientIp(req));
ok('a request with no header falls back to "unknown"',
  clientIp(new Request('https://example.com/api/lead')) === 'unknown');

// ── a store that cannot answer ─────────────────────────────────────────────
console.log('\n══ fail-open is the default, fail-closed is the option ══');

// A bucket name with a slash in it makes an invalid document path, so the
// store throws exactly where a real outage would — inside the try, on the
// write. It is the only way to exercise the catch without an outage.
const BROKEN = `${BUCKET}/broken`;
const openHit = await hit(BROKEN, 5, WINDOW_MS);
ok('a store failure lets the public form through', openHit.ok === true, JSON.stringify(openHit));
ok('  and says nothing was counted', openHit.remaining === -1, String(openHit.remaining));

const closedHit = await hit(BROKEN, 5, WINDOW_MS, { failClosed: true });
ok('a failClosed bucket refuses instead', closedHit.ok === false, JSON.stringify(closedHit));
ok('  with a retry hint the caller can pass on', closedHit.retryAfterSec > 0,
  String(closedHit.retryAfterSec));

// failClosed changes nothing at all while the store is healthy.
const healthyClosed = await hit(`${BUCKET}-closed`, 2, WINDOW_MS, { failClosed: true });
ok('failClosed is not a stricter limit, only a stricter failure',
  healthyClosed.ok === true && healthyClosed.remaining === 1, JSON.stringify(healthyClosed));

// ── the window eventually rolls ─────────────────────────────────────────────
console.log('\n══ a fresh window is a fresh counter ══');

const shortBucket = `${BUCKET}-short`;
const shortWindowMs = 1_000;
const first = await hit(shortBucket, 1, shortWindowMs);
ok('the first hit in a short window passes', first.ok === true, JSON.stringify(first));
await new Promise((r) => setTimeout(r, 1_100));
const rolled = await hit(shortBucket, 1, shortWindowMs);
ok('the next window starts fresh', rolled.ok === true, JSON.stringify(rolled));

// ── cleanup ──────────────────────────────────────────────────────────────
for (const b of [BUCKET, `${BUCKET}-other`, `${BUCKET}-closed`]) {
  await db.collection(`${PREFIX}ratelimit`).doc(`${b}:${windowIndex}`).delete().catch(() => {});
}
const shortWindowIndex = Math.floor(Date.now() / shortWindowMs);
for (let i = shortWindowIndex - 2; i <= shortWindowIndex; i++) {
  await db.collection(`${PREFIX}ratelimit`).doc(`${shortBucket}:${i}`).delete().catch(() => {});
}

console.log(bad ? `\n${bad} failed.` : '\nall good');
process.exit(bad ? 1 : 0);
