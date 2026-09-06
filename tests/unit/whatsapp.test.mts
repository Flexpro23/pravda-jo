/**
 * The pure half of the notification path, and the Arabic plural.
 *
 * None of this needs Firestore or a network, and all of it is the kind of code
 * that regresses silently: a phone number that stays a valid-looking string of
 * digits after a bad normalisation still "sends", it just never arrives, and a
 * plural that loses its dual form reads as a machine wrote it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { msisdn, compose, composeReminder, waLink } from '@/lib/notify/whatsapp';
import { days } from '@/lib/format/date';
import type { Booking, Talent } from '@/lib/data/deals';

const T: Talent = {
  id: 'omar', name: { ar: 'عمر', en: 'Omar' }, discipline: 'videographer',
  dayRateJOD: 35, phone: '0791234567', availability: 'available',
  active: true, createdAt: '2026-01-01T00:00:00.000Z',
};

const B: Booking = {
  id: 'bk1', dealId: 'd1', talentId: 'omar', date: '2026-09-10',
  feeJOD: 35, status: 'offered', brief: 'تصوير المحل',
  location: 'جبل عمان', callTime: '09:00',
  createdAt: '2026-09-01T00:00:00.000Z',
};

// ── msisdn ──────────────────────────────────────────────────────────────────

test('msisdn: the local 07 form becomes dialable', () => {
  assert.equal(msisdn('0791234567'), '962791234567');
});

test('msisdn: a bare 7xxxxxxxx gets the country code', () => {
  assert.equal(msisdn('791234567'), '962791234567');
});

test('msisdn: a + prefix is dropped, not treated as a digit', () => {
  assert.equal(msisdn('+962791234567'), '962791234567');
});

test('msisdn: the 00 international prefix is stripped', () => {
  // The one that silently fails without this branch: it stays a plausible
  // string of digits and WhatsApp rejects the send.
  assert.equal(msisdn('00962791234567'), '962791234567');
});

test('msisdn: spaces, dashes and brackets are noise', () => {
  assert.equal(msisdn('+962 (79) 123-4567'), '962791234567');
});

test('msisdn: too short, empty and non-numeric all return null', () => {
  assert.equal(msisdn('12345'), null);
  assert.equal(msisdn(''), null);
  assert.equal(msisdn('not a number'), null);
  assert.equal(msisdn('07912345678901234'), null);   // too long once prefixed
});

test('waLink is null rather than a broken link when the number is unusable', () => {
  assert.equal(waLink('12345', 'hi'), null);
  assert.ok(waLink('0791234567', 'hi')?.startsWith('https://wa.me/962791234567?text='));
});

// ── compose ─────────────────────────────────────────────────────────────────

test('compose: the offer has the shape the operator reads back', () => {
  const lines = compose(B, T, 'https://pravda.jo').split('\n');
  assert.ok(lines[0].includes('عمر'), 'greets them by name');
  assert.equal(lines[1], '', 'the deliberate blank line survives the filter');
  assert.ok(lines[2].includes('٠٩:٠٠') || lines[2].includes('09:00'), 'the call time is on the date line');
  assert.ok(lines.some((l) => l.startsWith('📍 جبل عمان')));
  assert.ok(lines.some((l) => l.startsWith('الشغل: تصوير المحل')));
  assert.ok(lines.some((l) => l.includes('٣٥')), 'the fee is Arabic-Indic');
  assert.equal(lines.at(-1), 'https://pravda.jo/t', 'the portal link is the last thing');
});

test('compose: absent facts drop out rather than printing empty lines', () => {
  const bare: Booking = { ...B, location: undefined, callTime: undefined, brief: '' };
  const lines = compose(bare, T, 'https://pravda.jo').split('\n');
  assert.equal(lines.filter((l) => l === '').length, 2, 'only the two deliberate blanks');
  assert.ok(!lines.some((l) => l.startsWith('📍')));
  assert.ok(!lines.some((l) => l.startsWith('الشغل:')));
});

test('compose: the client price cannot reach the message, because it is not on the booking', () => {
  assert.ok(!compose(B, T, 'https://pravda.jo').includes('1500'));
});

// ── composeReminder ─────────────────────────────────────────────────────────

test('composeReminder: reminds rather than offers, and keeps the same facts', () => {
  const text = composeReminder(B, T, 'https://pravda.jo');
  assert.ok(text.startsWith('تذكير عمر'));
  assert.ok(!text.includes('الأجرة'), 'a reminder is not a re-offer of the fee');
  assert.ok(text.includes('📍 جبل عمان'));
  assert.ok(text.includes('09:00'));
  assert.equal(text.split('\n').at(-1), 'https://pravda.jo/t');
});

test('composeReminder: a day with no location still reads as a sentence', () => {
  const lines = composeReminder({ ...B, location: undefined }, T, 'https://pravda.jo').split('\n');
  assert.ok(!lines.some((l) => l.startsWith('📍')));
});

// ── the Arabic plural, all five shapes ──────────────────────────────────────

test('days: English is two shapes', () => {
  assert.equal(days(1, false), '1 day');
  assert.equal(days(2, false), '2 days');
  assert.equal(days(0, false), '0 days');
});

test('days: one is the noun alone', () => {
  assert.equal(days(1, true), 'يوم واحد');
});

test('days: two has its own dual form', () => {
  assert.equal(days(2, true), 'يومين');
});

test('days: three to ten take the plural', () => {
  assert.equal(days(3, true), '٣ أيام');
  assert.equal(days(10, true), '١٠ أيام');
});

test('days: eleven up returns to the accusative singular', () => {
  assert.equal(days(11, true), '١١ يومًا');
  assert.equal(days(30, true), '٣٠ يومًا');
});

test('days: zero takes the plural, not the singular', () => {
  assert.equal(days(0, true), '٠ أيام');
});
