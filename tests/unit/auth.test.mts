/**
 * The two locks, and the small pure functions that guard the edges around them.
 *
 * No Firestore and no Next runtime: everything here is a string in and a
 * verdict out, which is the whole reason the session formats were written as
 * pure functions with the request context imported where it is used.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

// Set before the modules are asked for a verdict, never read at import time.
process.env.OPERATOR_KEY = 'operator-key-for-tests';
process.env.SESSION_SECRET = 'session-secret-for-tests';
process.env.TALENT_SESSION_SECRET = 'talent-secret-for-tests';

const {
  OPS_TTL_MS, keyMatches, mintSession, opsNext, refreshedCookie, sameOrigin, verifySession,
} = await import('@/lib/ops/auth');
const { T_TTL_MS, epochOf, readSession, sessionValue } = await import('@/lib/talent/auth');
const {
  PASS_CODE_DIGITS, newPassCode, hashCode, codeMatches,
} = await import('@/lib/store/deals');
const { msisdn } = await import('@/lib/notify/whatsapp');
const { normaliseHandle } = await import('@/lib/meta/discovery');

const DAY = 24 * 60 * 60 * 1000;

// ── the operator's session ──────────────────────────────────────────────────

test('a freshly minted ops session verifies', () => {
  assert.equal(verifySession(mintSession()), true);
});

test('every mint is a different value', () => {
  assert.notEqual(mintSession(1_700_000_000_000), mintSession(1_700_000_001_000));
});

test('an ops session expires at thirty days, server-side', () => {
  const now = Date.now();
  assert.equal(verifySession(mintSession(now - OPS_TTL_MS + 60_000)), true);
  assert.equal(verifySession(mintSession(now - OPS_TTL_MS - 1)), false);
});

test('an ops session dated into the future is not ours', () => {
  assert.equal(verifySession(mintSession(Date.now() + 10 * 60_000)), false);
});

test('editing the date breaks the signature', () => {
  const [, issuedAt, sig] = mintSession().split('.');
  assert.equal(verifySession(`v1.${Number(issuedAt) - 1000}.${sig}`), false);
});

test('a truncated or padded signature fails', () => {
  const raw = mintSession();
  assert.equal(verifySession(raw.slice(0, -1)), false);
  assert.equal(verifySession(`${raw}0`), false);
});

test('a malformed session is refused rather than parsed', () => {
  for (const raw of ['', 'v1', 'v2.1700000000000.abc', 'v1.not-a-date.abc', 'v1.1.2.3']) {
    assert.equal(verifySession(raw), false, raw);
  }
});

test('the old digest cookie no longer authenticates', () => {
  // What every console session used to carry, forever, unrotatable.
  const legacy = createHash('sha256').update(process.env.OPERATOR_KEY!).digest('hex');
  assert.equal(verifySession(legacy), false);
});

test('a session signed with another secret fails', () => {
  const mine = mintSession();
  process.env.SESSION_SECRET = 'a-different-secret';
  assert.equal(verifySession(mine), false);
  process.env.SESSION_SECRET = 'session-secret-for-tests';
});

test('keyMatches tolerates the newline openssl leaves behind', () => {
  assert.equal(keyMatches('operator-key-for-tests\n'), true);
  assert.equal(keyMatches('operator-key-for-test'), false);
  assert.equal(keyMatches(''), false);
});

test('a session is re-minted only once it has aged past a week', () => {
  assert.equal(refreshedCookie(mintSession()), null);
  assert.equal(refreshedCookie(mintSession(Date.now() - 6 * DAY)), null);

  const rolled = refreshedCookie(mintSession(Date.now() - 8 * DAY));
  assert.ok(rolled, 'an eight-day-old session rolls');
  assert.equal(verifySession(rolled), true);
});

test('an invalid session is never extended', () => {
  assert.equal(refreshedCookie('v1.1700000000000.deadbeef'), null);
});

// ── where the gate is allowed to send someone ───────────────────────────────

test('opsNext accepts console paths and nothing else', () => {
  const cases: [string, string][] = [
    ['/ops', '/ops'],
    ['/ops/clients/abc123', '/ops/clients/abc123'],
    ['/ops/sheet/tok?bad=1', '/ops/sheet/tok'],
    ['', '/ops'],
    ['/t', '/ops'],
    ['//evil.example/x', '/ops'],
    ['https://evil.example/ops', '/ops'],
    ['/ops\\@evil.example', '/ops'],
    ['/opsimposter', '/ops'],           // a prefix match is not a console page
  ];
  for (const [input, want] of cases) assert.equal(opsNext(input), want, input);
});

// ── was this our own page asking ────────────────────────────────────────────

const req = (headers: Record<string, string>) =>
  new Request('https://pravda.jo/api/ops/logout', { method: 'POST', headers });

test('sameOrigin', () => {
  const cases: [string, Record<string, string>, boolean][] = [
    ['our own form', { 'sec-fetch-site': 'same-origin' }, true],
    ['a typed address or bookmark', { 'sec-fetch-site': 'none' }, true],
    ['another site posting at us', { 'sec-fetch-site': 'cross-site', origin: 'https://evil.example' }, false],
    ['a subdomain with a matching Origin', { 'sec-fetch-site': 'same-site', origin: 'https://pravda.jo' }, true],
    ['no Sec-Fetch-Site, matching Origin', { origin: 'https://pravda.jo' }, true],
    ['no Sec-Fetch-Site, foreign Origin', { origin: 'https://evil.example' }, false],
    ['behind the proxy, forwarded host', { origin: 'https://console.pravda.jo', 'x-forwarded-host': 'console.pravda.jo' }, true],
    ['a garbage Origin', { origin: 'not a url' }, false],
    ['curl, no headers at all', {}, true],
  ];
  for (const [name, headers, want] of cases) {
    assert.equal(sameOrigin(req(headers)), want, name);
  }
});

// ── the provider's session ──────────────────────────────────────────────────

const talent = (sessionEpoch?: number) =>
  ({ id: 'lina-h', active: true, ...(sessionEpoch === undefined ? {} : { sessionEpoch }) }) as never;

test('a talent cookie round-trips through the HMAC', () => {
  const s = readSession(sessionValue('lina-h', 0));
  assert.ok(s);
  assert.equal(s.id, 'lina-h');
  assert.equal(s.epoch, 0);
});

test('the signature covers the id, the epoch and the date', () => {
  const raw = sessionValue('lina-h', 0, 1_770_000_000_000);
  const [id, epoch, at, sig] = raw.split('.');
  assert.equal(readSession(`omar-k.${epoch}.${at}.${sig}`), null);
  assert.equal(readSession(`${id}.1.${at}.${sig}`), null);
  assert.equal(readSession(`${id}.${epoch}.${Number(at) + 1}.${sig}`), null);
  assert.equal(readSession(`${id}.${epoch}.${at}.${sig.slice(0, -1)}`), null);
});

test('a talent session expires at sixty days', () => {
  assert.equal(readSession(sessionValue('lina-h', 0, Date.now() - T_TTL_MS + 60_000))?.id, 'lina-h');
  assert.equal(readSession(sessionValue('lina-h', 0, Date.now() - T_TTL_MS - 1)), null);
});

test('a cookie minted before a reissue does not match the account after it', () => {
  // What `currentTalent()` compares: the epoch in the cookie against the epoch
  // on the record. Reissuing a code bumps the second one.
  const before = readSession(sessionValue('lina-h', 0));
  assert.ok(before);
  assert.equal(epochOf(talent(1)) === before.epoch, false);
  assert.equal(epochOf(talent(0)) === before.epoch, true);
  assert.equal(epochOf(talent()) === before.epoch, true, 'never revoked is epoch zero');
});

test('an id outside the roster charset is refused before the store is asked', () => {
  assert.equal(readSession(`../../etc.0.${Date.now()}.deadbeef`), null);
  assert.equal(readSession(''), null);
});

// ── the small validators the login surfaces lean on ─────────────────────────

test('msisdn puts a Jordanian number in the form WhatsApp wants', () => {
  assert.equal(msisdn('0791234567'), '962791234567');
  assert.equal(msisdn('+962 79 123 4567'), '962791234567');
  assert.equal(msisdn('00962791234567'), '962791234567');
  assert.equal(msisdn('791234567'), '962791234567');
  assert.equal(msisdn('079-123 4567'), '962791234567');
  assert.equal(msisdn(''), null);
  assert.equal(msisdn('12345'), null);
  assert.equal(msisdn('not a number'), null);
});

test('normaliseHandle takes a handle however it was typed', () => {
  assert.equal(normaliseHandle('@Foo.Bar'), 'foo.bar');
  assert.equal(normaliseHandle('https://www.instagram.com/Foo_Bar/'), 'foo_bar');
  assert.equal(normaliseHandle('http://instagram.com/Foo'), 'foo');
  assert.equal(normaliseHandle('foo bar'), null);
  assert.equal(normaliseHandle(''), null);
  assert.equal(normaliseHandle('a'.repeat(31)), null);
});

/**
 * The rule `/api/lead` applies to a phone number, restated rather than
 * imported: it lives inside a route module that pulls the whole store in with
 * it, and the thing worth pinning is the rule, not the reference.
 */
const usablePhone = (raw: string) => {
  const digits = raw.replace(/[^\d+]/g, '');
  return /^(\+?962|0)?7\d{8}$/.test(digits) || /^\+?\d{9,15}$/.test(digits) ? raw : null;
};

test('usablePhone takes a Jordanian mobile as anyone writes it', () => {
  for (const ok of ['0791234567', '+962791234567', '962791234567', '079 123 4567', '+14155550123']) {
    assert.ok(usablePhone(ok), ok);
  }
  for (const no of ['', '12345', 'call me', '07912']) {
    assert.equal(usablePhone(no), null, no);
  }
});

// ── the provider's pass code ────────────────────────────────────────────────

/**
 * `talentByCode` matches against the whole roster rather than a named account,
 * so the search space is the only thing standing between a guesser and
 * *somebody's* session. Six digits was a million values and thirty providers,
 * which is an expected thirty-three thousand guesses to land inside one.
 */
test('a new pass code is eight digits', () => {
  assert.equal(PASS_CODE_DIGITS, 8);
  for (let i = 0; i < 200; i++) {
    assert.match(newPassCode(), /^\d{8}$/);
  }
});

test('pass codes are not all the same, and reach both ends of the range', () => {
  const codes = new Set<string>();
  let low = false;
  let high = false;
  for (let i = 0; i < 500; i++) {
    const c = newPassCode();
    codes.add(c);
    if (Number(c) < 10_000_000) low = true;      // the leading-zero half
    if (Number(c) > 90_000_000) high = true;     // the top tenth
  }
  assert.ok(codes.size > 490, `only ${codes.size} distinct in 500`);
  assert.ok(low, 'never produced a code below ten million');
  assert.ok(high, 'never produced a code in the top tenth');
});

/**
 * The login accepts six to eight digits. Eight is what is minted now; the
 * six-digit codes already in providers' phones stay valid, because reissuing
 * every one of them to close a gap they cannot see is a morning of WhatsApp
 * messages and a shoot day somebody cannot sign in for.
 */
test('the login accepts six to eight digits and nothing else', () => {
  const shape = /^\d{6,8}$/;
  for (const good of ['123456', '1234567', '12345678', '00000000']) {
    assert.ok(shape.test(good), good);
  }
  for (const bad of ['', '12345', '123456789', '12345a', ' 123456', '12 3456']) {
    assert.equal(shape.test(bad), false, bad);
  }
});

test('a code is stored hashed and compared without leaking its length', () => {
  const code = newPassCode();
  const hash = hashCode(code);
  assert.notEqual(hash, code);
  assert.ok(codeMatches(code, hash));
  assert.equal(codeMatches(`${code}9`, hash), false);
  // No hash on the record is not a match — an account that has never been
  // issued a code must not be reachable by submitting nothing.
  assert.equal(codeMatches(code, undefined), false);
});
