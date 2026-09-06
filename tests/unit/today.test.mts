/**
 * The queue that decides what either operator does next.
 *
 * Worth a test of its own because every rule in it is a claim about time —
 * "older than ten minutes", "unopened for two days" — and a wrong comparison
 * produces a console that looks calm while a lead rots. The clock is injected,
 * so the boundaries are asserted rather than waited for.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildToday, readStuck, TASK_ORDER, ago,
  CHASE_UNOPENED_MINS, CHASE_UNANSWERED_MINS,
  type Task,
} from '@/lib/ops/today';
import type { Client } from '@/lib/data/clients';
import type { Booking, Deal, Talent } from '@/lib/data/deals';
import type { Sheet } from '@/lib/store/sheets';

const NOW = Date.parse('2026-09-06T12:00:00.000Z');
const at = (minsAgo: number) => new Date(NOW - minsAgo * 60_000).toISOString();

const client = (over: Partial<Client> = {}): Client => ({
  id: 'shop', handle: 'shop', contactName: 'Rana', contactPhone: '0791234567',
  source: 'intake', status: 'new', sheetTokens: [], lang: 'ar',
  notifiedNewAt: at(1), createdAt: at(30), updatedAt: at(30), ...over,
});

const sheet = (over: Partial<Sheet> = {}): Sheet => ({
  token: 't1', handle: 'shop', clientName: 'Shop',
  signals: { posts: 40 } as unknown as Sheet['signals'],
  findings: { findings: [], charts: [], operatorNotes: [], read: { posts: 40, site: false, adsChecked: false } },
  recommendations: [], chosen: [], status: 'draft',
  createdAt: at(20), updatedAt: at(20), ...over,
});

const deal = (over: Partial<Deal> = {}): Deal => ({
  id: 'd1', clientName: 'Shop', concepts: [], clientTotalJOD: 900,
  status: 'proposed', createdAt: at(60), updatedAt: at(60), ...over,
});

const booking = (over: Partial<Booking> = {}): Booking => ({
  id: 'b1', dealId: 'd1', talentId: 'omar', date: '2026-09-10',
  feeJOD: 35, status: 'offered', brief: 'shoot', createdAt: at(60),
  notifiedAt: at(59), ...over,
});

const omar = { id: 'omar', name: { ar: 'عمر', en: 'Omar' } } as Talent;

const kinds = (t: Task[]) => t.map((x) => x.kind);

const build = (over: Partial<Parameters<typeof buildToday>[0]> = {}) => buildToday({
  clients: [], sheets: [], deals: [], bookings: [],
  talentById: { omar }, at: NOW, ...over,
});

test('an account that owes nothing produces nothing', () => {
  assert.deepEqual(build({ clients: [client({ status: 'sent' })] }), []);
});

test('every one of the eleven kinds can be produced, in the plan’s order', () => {
  const tasks = build({
    clients: [
      client({ id: 'a', handle: 'a', status: 'failed', readError: 'unreadable' }),
      client({ id: 'b', handle: 'b', notifiedNewAt: undefined }),
      client({ id: 'c', handle: 'c', status: 'reading', readLeaseUntil: at(5), updatedAt: at(1) }),
      client({ id: 'd', handle: 'd', status: 'ready' }),
    ],
    sheets: [
      sheet({ token: 'draft', handle: 'e' }),
      sheet({ token: 'appr', handle: 'f', status: 'approved', approvedAt: at(60) }),
      sheet({ token: 'cold', handle: 'g', status: 'approved', sentAt: at(CHASE_UNOPENED_MINS + 10) }),
    ],
    deals: [deal({ status: 'signed', signedAt: at(90) })],
    bookings: [
      booking({ id: 'b-new', notifiedAt: undefined }),
      booking({ id: 'b-old', status: 'accepted', date: '2026-09-01' }),
      booking({ id: 'b-done', status: 'done', date: '2026-09-01' }),
    ],
  });

  assert.deepEqual(kinds(tasks), [
    'read-failed', 'tell-new', 'read-stuck', 'tell-ready',
    'review-sheet', 'send-sheet', 'chase-sheet',
    'collect', 'tell-booking', 'mark-done', 'pay-crew',
  ]);
  assert.equal(TASK_ORDER.length, 11);
  // Every href resolves somewhere in the console rather than to a token.
  for (const t of tasks) assert.match(t.href, /^\/ops\//);
});

test('a read is stuck once its lease has passed, and not before', () => {
  const live = client({ status: 'reading', readLeaseUntil: at(-5), updatedAt: at(2) });
  const dead = client({ status: 'reading', readLeaseUntil: at(1), updatedAt: at(2) });
  assert.equal(readStuck(live, NOW), false);
  assert.equal(readStuck(dead, NOW), true);
});

test('a read with no lease is stuck only after ten minutes of silence', () => {
  assert.equal(readStuck(client({ status: 'reading', updatedAt: at(9) }), NOW), false);
  assert.equal(readStuck(client({ status: 'reading', updatedAt: at(11) }), NOW), true);
});

test('a sheet is chased at 48 hours unopened, not at 47', () => {
  const s = (mins: number) => build({
    sheets: [sheet({ status: 'approved', sentAt: at(mins) })],
  });
  assert.deepEqual(kinds(s(CHASE_UNOPENED_MINS - 60)), []);
  assert.deepEqual(kinds(s(CHASE_UNOPENED_MINS + 60)), ['chase-sheet']);
});

test('an opened sheet with no deal is chased at five days, and never both ways', () => {
  const s = (mins: number) => build({
    sheets: [sheet({
      status: 'approved', sentAt: at(mins + 100),
      openedAt: at(mins), lastOpenedAt: at(mins), openCount: 2,
    })],
  });
  assert.deepEqual(kinds(s(CHASE_UNANSWERED_MINS - 60)), []);
  assert.deepEqual(kinds(s(CHASE_UNANSWERED_MINS + 60)), ['chase-sheet']);
});

test('a won or lost account leaves the queue entirely, sheet and all', () => {
  const c = client({ notifiedNewAt: undefined, status: 'lost', lostReason: 'Price' });
  const tasks = build({ clients: [c], sheets: [sheet({ handle: 'shop' })] });
  assert.deepEqual(kinds(tasks), []);
});

test('within a kind, the oldest debt is first', () => {
  const tasks = build({
    clients: [
      client({ id: 'young', handle: 'young', notifiedNewAt: undefined, createdAt: at(10) }),
      client({ id: 'old', handle: 'old', notifiedNewAt: undefined, createdAt: at(600) }),
    ],
  });
  assert.deepEqual(tasks.map((t) => t.clientId), ['old', 'young']);
});

test('a booking task names the person rather than their id', () => {
  const [t] = build({ bookings: [booking({ notifiedAt: undefined })] });
  assert.match(t.title, /Omar/);
});

test('a future accepted day is not yet a question about whether it happened', () => {
  const tasks = build({ bookings: [booking({ status: 'accepted', date: '2026-12-01' })] });
  assert.deepEqual(kinds(tasks), []);
});

test('ago says something a person would say', () => {
  assert.equal(ago(0), 'just now');
  assert.equal(ago(45), '45m ago');
  assert.equal(ago(90), '1h ago');
  assert.equal(ago(60 * 24 * 3), '3d ago');
});
