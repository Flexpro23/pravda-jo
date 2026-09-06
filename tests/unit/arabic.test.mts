/**
 * The caption lexicon, against captions a Jordanian business actually writes.
 *
 * The fixture is hand-labelled: somebody read each line and decided whether it
 * asks the reader to do something. That labelling is the only ground truth this
 * engine has for the number carrying its heaviest recommendation weight, so the
 * agreement test is a real test rather than a tautology — the detector is not
 * allowed to define what a request is.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  normaliseAr, hasCta, hasQuestion, CTA_AR, CTA_EN, WA_ROUTE_RE,
} from '@/lib/teardown/arabic';

type Row = { text: string; cta: boolean; question: boolean };
const rows: Row[] = JSON.parse(readFileSync('tests/fixtures/captions.ar.json', 'utf8'));

test('the standard Amman CTAs the old regex missed are all found', () => {
  for (const c of [
    'للحجز والاستفسار',
    'للطلب اتصلوا',
    'راسلنا ع الواتساب',
    'سجل هلأ',
    'الرابط في البايو',
    'إطلب اونلاين',
  ]) assert.equal(hasCta(c), true, c);
});

test('engagement bait is a question, not a request', () => {
  assert.equal(hasCta('مين بيحب القهوة؟'), false);
  assert.equal(hasQuestion('مين بيحب القهوة؟'), true);
});

test('a bare question mark is never a call to action', () => {
  assert.equal(hasCta('؟'), false);
  assert.equal(hasCta('Really?'), false);
});

test('normaliseAr is idempotent', () => {
  for (const r of rows) {
    const once = normaliseAr(r.text);
    assert.equal(normaliseAr(once), once, r.text);
  }
});

test('normaliseAr folds tashkeel, hamza, alif maqsura, ta marbuta', () => {
  assert.equal(normaliseAr('رنّ'), 'رن');
  assert.equal(normaliseAr('إطلب'), 'اطلب');
  assert.equal(normaliseAr('أحجز'), 'احجز');
  assert.equal(normaliseAr('آخر'), 'اخر');
  assert.equal(normaliseAr('مصطفى'), 'مصطفي');
  assert.equal(normaliseAr('قهوة'), 'قهوه');
  assert.equal(normaliseAr('مسؤول'), 'مسوول');
  assert.equal(normaliseAr('  مرحبا   فيكم  '), 'مرحبا فيكم');
});

test('the hand-labelled fixture agrees at 90% or better', () => {
  assert.ok(rows.length >= 40, `only ${rows.length} labelled captions`);
  let agree = 0;
  const misses: string[] = [];
  for (const r of rows) {
    if (hasCta(r.text) === r.cta && hasQuestion(r.text) === r.question) agree++;
    else misses.push(r.text);
  }
  assert.ok(agree / rows.length >= 0.9, `${agree}/${rows.length}: ${misses.join(' | ')}`);
});

test('English inflections are not blocked by a word boundary', () => {
  for (const c of ['Place your orders now', 'Booking is open', 'Slide into our DMs', '200 visits today'])
    assert.equal(hasCta(c), true, c);
});

test('an Arabic word boundary is respected — شاركنا is not شارك', () => {
  assert.equal(hasCta('شاركنا في معرض عمّان'), false);
  assert.equal(hasCta('شاركوا البوست'), true);
  assert.equal(hasCta('القطاع الخاص'), false);
});

test('clitic prefixes attach without a space', () => {
  assert.equal(hasCta('بنرد ع الواتساب'), true);
  assert.equal(hasCta('نظام الحجز شغّال'), true);
});

test('an empty caption asks for nothing', () => {
  assert.equal(hasCta(undefined), false);
  assert.equal(hasCta(''), false);
  assert.equal(hasCta('   '), false);
  assert.equal(hasQuestion(undefined), false);
});

test('the lexicons are reviewable arrays with no duplicates', () => {
  assert.ok(CTA_AR.length >= 40);
  assert.ok(CTA_EN.length >= 20);
  assert.equal(new Set(CTA_AR).size, CTA_AR.length);
  assert.equal(new Set(CTA_EN).size, CTA_EN.length);
  // A term written in an orthography `normaliseAr` never produces can never match.
  for (const t of CTA_AR) assert.equal(normaliseAr(t), t, `unnormalised lexicon entry: ${t}`);
});

test('a WhatsApp route is a link or a Jordanian number, not a mention', () => {
  assert.ok(WA_ROUTE_RE.test('https://wa.me/962791234567'));
  assert.ok(WA_ROUTE_RE.test('0791234567'));
  assert.ok(WA_ROUTE_RE.test('+962 79 123 4567'));
  assert.ok(WA_ROUTE_RE.test('واتساب: تواصلوا معنا'));
  assert.equal(WA_ROUTE_RE.test('مطعم ومقهى في عبدون'), false);
});
