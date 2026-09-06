/**
 * What trade is this, and how sure are we.
 *
 * `Vertical` was threaded through the whole engine and never once set, so this
 * is the first test of a signal the recommender has always had a weight for.
 * The fixtures are labelled by hand — sixteen bios, two per vertical, written
 * the way an Amman business actually writes one: mixed Arabic and English,
 * hamza and tashkeel typed inconsistently, and the trade named in passing
 * rather than declared.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inferVertical, LEXICON } from '@/lib/teardown/vertical';
import { VERTICAL_LABEL, type Vertical } from '@/lib/data/concepts';

type Fixture = { id: string; vertical: Vertical; bio: string; captions: string[] };

const BIOS: Fixture[] = JSON.parse(
  readFileSync(new URL('../fixtures/bios/bios.json', import.meta.url), 'utf8'));

test('the fixture set covers every vertical, twice', () => {
  assert.ok(BIOS.length >= 16, `${BIOS.length} labelled bios`);
  for (const v of Object.keys(VERTICAL_LABEL) as Vertical[]) {
    assert.ok(BIOS.filter((b) => b.vertical === v).length >= 2, `${v} has two fixtures`);
  }
});

test('every labelled bio is read correctly', () => {
  for (const b of BIOS) {
    const g = inferVertical(b.bio, b.captions);
    assert.equal(g.guess, b.vertical, `${b.id}: guessed ${g.guess}`);
  }
});

test('confidence is a probability and the evidence names real terms', () => {
  for (const b of BIOS) {
    const g = inferVertical(b.bio, b.captions);
    assert.ok(g.confidence >= 0 && g.confidence <= 1, `${b.id}: ${g.confidence}`);
    assert.ok(g.evidence.length > 0, `${b.id} shows its working`);
    for (const e of g.evidence) {
      const lex = LEXICON[e.vertical];
      assert.ok([...lex.ar, ...lex.en].includes(e.term), `${e.term} is in the lexicon`);
      assert.ok(e.hits > 0);
    }
    if (g.runnerUp) assert.notEqual(g.runnerUp, g.guess);
  }
});

test('an empty bio guesses nothing', () => {
  const g = inferVertical('', []);
  assert.equal(g.guess, null);
  assert.equal(g.confidence, 0);
  assert.equal(g.runnerUp, null);
  assert.deepEqual(g.evidence, []);
  assert.equal(inferVertical('', [], '').guess, null);
});

test('one word is not enough to name somebody\'s trade', () => {
  // A single hit clears the confidence bar trivially — there is nothing to
  // compete with it — which is exactly when a guess is worth least.
  const g = inferVertical('مطعم', []);
  assert.equal(g.guess, null);
  assert.equal(g.evidence.length, 1);
});

test('a genuinely mixed bio is withheld rather than guessed', () => {
  // A place that is half gym and half clinic: neither side clears 0.6.
  const g = inferVertical('نادي وتمرين وعيادة تجميل', []);
  assert.ok(g.confidence < 0.6, `confidence ${g.confidence}`);
  assert.equal(g.guess, null);
  assert.ok(g.runnerUp, 'but it says what the other candidate was');
});

test('the bio outweighs the captions', () => {
  const bio = 'عيادة أسنان وتجميل';
  const offTopic = ['شقة للبيع في عبدون', 'عقارات وأراضي', 'للإيجار ١٥٠ متر'];
  assert.equal(inferVertical(bio, offTopic).guess, 'body');
  // The same words, with nothing in the bio, read the other way.
  assert.equal(inferVertical('', [bio, ...offTopic]).guess, 'property');
});

test('site text is read when it is given', () => {
  const withSite = inferVertical('', [], 'Our dental clinic in Amman · dermatology and skin care');
  assert.equal(withSite.guess, 'body');
  assert.equal(inferVertical('', []).guess, null);
});

test('orthography does not decide it: hamza, tashkeel and ta marbuta fold', () => {
  const plain = inferVertical('عيادة اسنان وتجميل', []);
  const dressed = inferVertical('عِيادَة أسنان وتَجميل', []);
  const heh = inferVertical('عياده اسنان وتجميل', []);
  assert.equal(plain.guess, 'body');
  assert.equal(dressed.guess, 'body');
  assert.equal(heh.guess, 'body');
  assert.equal(dressed.confidence, plain.confidence);
  assert.equal(heh.confidence, plain.confidence);
});

test('English and Arabic count the same', () => {
  assert.equal(inferVertical('Dental clinic and skin care', []).guess, 'body');
  assert.equal(inferVertical('عيادة أسنان وبشرة', []).guess, 'body');
});

test('it is pure: the same input reads the same way twice', () => {
  for (const b of BIOS.slice(0, 4)) {
    assert.deepEqual(inferVertical(b.bio, b.captions), inferVertical(b.bio, b.captions));
    // and the caller's arrays are not touched
    const captions = [...b.captions];
    inferVertical(b.bio, captions);
    assert.deepEqual(captions, b.captions);
  }
});

test('the lexicon holds a term for every vertical, in both scripts', () => {
  for (const v of Object.keys(VERTICAL_LABEL) as Vertical[]) {
    assert.ok(LEXICON[v].ar.length >= 5, `${v} Arabic terms`);
    assert.ok(LEXICON[v].en.length >= 4, `${v} English terms`);
    for (const t of LEXICON[v].ar) {
      assert.ok(!/[أإآٱىةؤئً-ْ]/.test(t),
        `${t} is stored in its normalised form or it can never match`);
    }
    for (const t of LEXICON[v].en) assert.equal(t, t.toLowerCase());
  }
});
