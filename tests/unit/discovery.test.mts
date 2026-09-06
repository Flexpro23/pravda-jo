/**
 * Business Discovery, without Meta.
 *
 * Every case here is a failure mode that used to leave a client stuck in
 * `reading` with nothing to show an operator: a socket that reset, a page that
 * arrived at 96% of the app's budget, a cursor that pointed at itself, a typo'd
 * handle reported as our infrastructure failing. The fetch seam is a stub and
 * `globalThis.fetch` is booby-trapped, so a future test cannot quietly start
 * calling the real endpoint.
 */
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { discover, io, type Media } from '@/lib/meta/discovery';

const here = new URL('../fixtures/graph/', import.meta.url);
const fixture = (name: string) => JSON.parse(readFileSync(new URL(name, here), 'utf8'));

const ERRORS = fixture('errors.json') as Record<string, { error: Record<string, unknown> }>;

type Step = {
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
  throws?: boolean;
};

/**
 * A scripted fetch. The last step repeats, so "always throws" is one entry.
 */
function script(steps: Step[]) {
  const calls: string[] = [];
  const fn = async (input: RequestInfo | URL) => {
    calls.push(String(input));
    const s = steps[Math.min(calls.length - 1, steps.length - 1)];
    if (s.throws) throw new Error('ECONNRESET');
    return new Response(JSON.stringify(s.body ?? {}), {
      status: s.status ?? 200,
      headers: { 'content-type': 'application/json', ...(s.headers ?? {}) },
    });
  };
  return { fn: fn as typeof io.fetch, calls };
}

/** `n` posts with a cursor, so a paging test is one line. */
function mediaPage(n: number, after?: string, from = Date.parse('2026-08-01T09:00:00Z')) {
  const data: Media[] = Array.from({ length: n }, (_, i) => ({
    id: `m${i}`,
    caption: 'قهوة الصبح',
    media_type: 'IMAGE',
    media_product_type: 'FEED',
    permalink: `https://www.instagram.com/p/${i}/`,
    timestamp: new Date(from - i * 36e5).toISOString(),
    like_count: 10 + i,
    comments_count: 1,
  }));
  return {
    business_discovery: {
      username: 'ammanleather',
      name: 'Amman Leather',
      followers_count: 8420,
      media_count: 260,
      media: { data, ...(after ? { paging: { cursors: { after } } } : {}) },
    },
  };
}

const usage = (pct: number) => ({ 'x-app-usage': JSON.stringify({ call_count: pct, total_cputime: 3, total_time: 4 }) });

let realFetch: typeof globalThis.fetch;

before(() => {
  process.env.META_IG_USER_ID = '17841400000000000';
  process.env.META_ACCESS_TOKEN = 'test-token';
  realFetch = globalThis.fetch;
  // Anything that reaches for the global instead of the seam fails loudly.
  globalThis.fetch = (() => {
    throw new Error('unit tests must not open a socket');
  }) as typeof globalThis.fetch;
});

beforeEach(() => {
  assert.notEqual(io.fetch, realFetch, 'io.fetch must be the stub, never the real one');
});

test('a socket that resets is a network failure, not a rejected promise', async () => {
  const s = script([{ throws: true }]);
  io.fetch = s.fn;
  const r = await discover('ammanleather');
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.reason, 'network');
  // Three attempts, and then it gives up rather than looping.
  assert.equal(s.calls.length, 3);
});

test('two 500s then a 200 reads the profile', async () => {
  const s = script([
    { status: 500, body: {} },
    { status: 502, body: {} },
    { status: 200, body: fixture('page1.json'), headers: usage(12) },
  ]);
  io.fetch = s.fn;
  const r = await discover('ammanleather', 2);
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.profile.media.length, 2);
  assert.equal(r.ok && r.profile.name, 'Amman Leather');
  assert.equal(r.usage.appPct, 12);
  assert.equal(r.usageWarn, false);
});

test('the budget running out on page two keeps the hundred posts already read', async () => {
  const s = script([
    { status: 200, body: mediaPage(100, 'CURSOR_ONE'), headers: usage(40) },
    { status: 200, body: mediaPage(100, 'CURSOR_TWO'), headers: usage(96) },
  ]);
  io.fetch = s.fn;
  const r = await discover('ammanleather', 200);
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.profile.media.length, 100);
  assert.equal(r.ok && r.truncated, true);
  assert.equal(r.usage.appPct, 96);
  assert.equal(r.usageWarn, true, '96% is well past the soft warning');
});

test('nothing read at all past the ceiling is a throttle', async () => {
  const s = script([{ status: 200, body: mediaPage(50), headers: usage(91) }]);
  io.fetch = s.fn;
  const r = await discover('ammanleather', 100);
  assert.equal(r.ok === false && r.reason, 'throttled');
  assert.equal(r.usageWarn, true);
});

test('a cursor that repeats itself terminates', async () => {
  const s = script([
    { status: 200, body: mediaPage(50, 'SAME') },
    { status: 200, body: mediaPage(50, 'SAME') },
  ]);
  io.fetch = s.fn;
  const r = await discover('ammanleather', 200);
  assert.equal(r.ok, true);
  assert.ok(s.calls.length <= 3, `stopped in ${s.calls.length} calls`);
  assert.equal(r.ok && r.profile.media.length, 100);
});

test('the error map sends each code to the reason an operator can act on', async () => {
  const cases: [string, number, string][] = [
    ['alias-not-found', 400, 'unreadable'],
    ['no-such-object', 400, 'unreadable'],
    ['rate-limited', 403, 'throttled'],
    ['bad-token', 401, 'unauthorised'],
    ['transient-110', 400, 'unreadable'],
  ];
  for (const [key, status, reason] of cases) {
    const s = script([{ status, body: ERRORS[key] }]);
    io.fetch = s.fn;
    const r = await discover('ammanleather');
    assert.equal(r.ok === false && r.reason, reason, `${key} → ${reason}`);
    // 110 is the only one worth retrying; the rest are facts.
    assert.equal(s.calls.length, key === 'transient-110' ? 3 : 1, `${key} attempts`);
  }
});

test('a 200 carrying an error body is still an error', async () => {
  const s = script([{ status: 200, body: ERRORS['bad-token'], headers: usage(80) }]);
  io.fetch = s.fn;
  const r = await discover('ammanleather');
  assert.equal(r.ok === false && r.reason, 'unauthorised');
  assert.equal(r.usageWarn, true, '80% is past the soft warning and below the stop');
});

test('business-use-case usage is parsed alongside the app percentage', async () => {
  const s = script([{
    status: 200,
    body: fixture('page1.json'),
    headers: {
      ...usage(20),
      'x-business-use-case-usage': JSON.stringify({
        '1234': [{ type: 'instagram', call_count: 77, total_cputime: 5, total_time: 6, estimated_time_to_regain_access: 12 }],
      }),
    },
  }]);
  io.fetch = s.fn;
  const r = await discover('ammanleather', 2);
  assert.equal(r.ok, true);
  assert.equal(r.usage.appPct, 20);
  assert.equal(r.usage.businessPct, 77);
  assert.equal(r.usage.regainSec, 720, 'Meta reports minutes; we store seconds');
  assert.equal(r.usageWarn, true);
});
