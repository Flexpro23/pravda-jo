/**
 * The recommender, held to the four things a sheet promises.
 *
 * Every one of these tests exists because the behaviour it asserts was once
 * false in production: placeholders were cast, `uncastable` was declared and
 * never assigned, a videographer was taken for a concept with no camera, and
 * five ideas carried two sentences between them.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONCEPTS, VIDEO_JOD_PER } from '@/lib/data/concepts';
import { recommend, crewOf, modelsNeeded, traits } from '@/lib/teardown/recommend';
import type { Findings } from '@/lib/teardown/findings';
import type { Talent } from '@/lib/data/deals';

// Holds the trait band to 15–60% of the library. Imported rather than run on
// its own because `npm run test:unit` globs `*.test.mts`.
import './_traits-measure.mts';

const ROSTER: Talent[] = JSON.parse(
  readFileSync(new URL('../fixtures/roster.json', import.meta.url), 'utf8'));

/** Only the ids matter to `recommend`; the rest of a Finding is copy. */
const fx = (...ids: string[]): Findings => ({
  findings: ids.map((id) => ({
    id, severity: 'critical', source: 'instagram',
    title: { ar: '', en: '' }, detail: { ar: '', en: '' }, provenance: { ar: '', en: '' },
  })),
  charts: [],
  read: { posts: 30, site: true, adsChecked: false },
});

/** Six finding sets, from a clean account to one failing on every axis. */
const SETS: string[][] = [
  ['ig-ask', 'web-price', 'ig-engagement'],
  ['ig-ask', 'web-none', 'ig-format'],
  ['web-pixel', 'web-whatsapp'],
  ['ig-engagement'],
  [],
  ['ig-ask', 'web-none', 'web-price', 'ig-engagement', 'ig-format', 'web-whatsapp'],
];

const bookableIds = (r: Talent[]) =>
  new Set(r.filter((t) => t.active && t.dayRateJOD > 0 && !t.placeholder).map((t) => t.id));

// ── 1. five, always ─────────────────────────────────────────────────────────

test('an empty roster still returns five, every one marked', () => {
  const recs = recommend(fx('ig-ask', 'ig-engagement'), [], null, 5);
  assert.equal(recs.length, 5);
  for (const r of recs) {
    assert.ok(r.uncastable, `#${r.conceptN} carries a reason it cannot be cast`);
    assert.deepEqual(r.cast, [], `#${r.conceptN} names nobody`);
  }
});

test('a roster of nothing but placeholders casts nobody', () => {
  // Item 6 acceptance (a): the seed writes `placeholder: true` on all fourteen,
  // so this is the state a fresh install is actually in.
  const invented = ROSTER.map((t) => ({ ...t, placeholder: true }));
  const recs = recommend(fx('ig-ask', 'ig-format'), invented, null, 5);
  assert.equal(recs.length, 5);
  for (const r of recs) {
    assert.deepEqual(r.cast, []);
    assert.ok(r.uncastable);
  }
});

// ── 2. nobody invented reaches a client ─────────────────────────────────────

test('no placeholder is ever cast, on any finding set', () => {
  const invented = new Set(ROSTER.filter((t) => t.placeholder).map((t) => t.id));
  assert.ok(invented.size > 0, 'the fixture has placeholders to exclude');
  for (const set of SETS) {
    for (const r of recommend(fx(...set), ROSTER, null, 5)) {
      for (const p of r.cast) {
        assert.ok(!invented.has(p.talentId), `${p.talentId} is a placeholder`);
        assert.ok(bookableIds(ROSTER).has(p.talentId), `${p.talentId} is bookable`);
      }
    }
  }
});

test('a roster of nothing but placeholders casts nobody, however it is asked', () => {
  // There is no longer an option that says otherwise. `allowPlaceholders` let
  // the console preview an invented cast, and a preview and a real sheet are
  // the same document — nothing downstream renders the flag differently, so a
  // worked example could reach a prospect's page looking exactly like a person.
  const invented = ROSTER.map((t) => ({ ...t, placeholder: true }));
  const recs = recommend(fx('ig-ask'), invented, null, 5);
  assert.ok(recs.every((r) => r.cast.length === 0), 'nobody invented is named');
  assert.ok(recs.some((r) => !!r.uncastable), 'and the sheet says why');
});

test('inactive and unpaid people are not bookable either', () => {
  const cast = new Set(SETS.flatMap((s) =>
    recommend(fx(...s), ROSTER, null, 5).flatMap((r) => r.cast.map((p) => p.talentId))));
  for (const t of ROSTER) {
    if (!t.active || t.dayRateJOD <= 0) {
      assert.ok(!cast.has(t.id), `${t.id} is not bookable and is not cast`);
    }
  }
});

// ── 3. what the roster cannot fill, it says ─────────────────────────────────

test('uncastable is set, with a reason, when a discipline is missing', () => {
  const noVideographers = ROSTER.filter((t) => t.discipline !== 'videographer');
  const recs = recommend(fx('ig-ask', 'ig-engagement'), noVideographers, null, 5);
  const marked = recs.filter((r) => r.uncastable);
  assert.ok(marked.length > 0, 'something needed a camera');
  for (const r of marked) {
    assert.match(r.uncastable!, /videographer|model|voiceover|bookable|understood/);
    assert.deepEqual(r.cast, []);
  }
});

test('a day needing more models than exist is marked, never cast short', () => {
  // Item 6 acceptance (d): #26 Room Full At Six wants eight; the fixture has
  // three bookable. Either it is absent or it is present and marked.
  const twoModels = ROSTER.filter((t) =>
    t.discipline !== 'model' || ['laith', 'dana'].includes(t.id));
  for (const set of SETS) {
    const hit = recommend(fx(...set), twoModels, null, 5).find((r) => r.conceptN === 26);
    if (!hit) continue;
    assert.ok(hit.uncastable, '#26 is marked');
    assert.match(hit.uncastable, /needs 8 models, 2 bookable/);
  }
  // And directly, so the case is proven even when #26 never ranks in.
  assert.equal(modelsNeeded(CONCEPTS.find((c) => c.n === 26)!), 8);
});

test('a voiceover nobody can cover is marked', () => {
  const noVoices = ROSTER.filter((t) => t.discipline !== 'voiceover');
  const recs = recommend(fx('ig-ask', 'web-price'), noVoices, null, 5);
  for (const r of recs) {
    if (crewOf(CONCEPTS.find((c) => c.n === r.conceptN)!).voices > 0) {
      assert.equal(r.uncastable, 'needs a voiceover, none bookable');
    }
  }
});

// ── 4. the library's own crew, not an assumed one ───────────────────────────

test('a concept with no videographer in its crew casts none', () => {
  // #4 The Thread is the original offender — screen-recorded, `crew: "editor"`,
  // `location: "none"`, and cast a videographer every time.
  const thread = CONCEPTS.find((c) => c.n === 4)!;
  const crew = crewOf(thread);
  assert.equal(crew.videographers, 0);
  assert.deepEqual(crew.notes, ['editor']);

  // #9 Status Thirty is the same shape of problem and does reach a shortlist.
  const status = CONCEPTS.find((c) => c.n === 9)!;
  assert.equal(crewOf(status).videographers, 0);
  const hit = SETS
    .flatMap((s) => recommend(fx(...s), ROSTER, null, 5))
    .find((r) => r.conceptN === 9);
  assert.ok(hit, '#9 reaches a shortlist');
  assert.equal(hit.cast.filter((p) => p.discipline === 'videographer').length, 0);
  assert.ok(hit.crewNotes.includes('editor'));
});

test('crew the roster does not book is noted rather than dropped', () => {
  const recs = recommend(fx('ig-ask', 'ig-engagement'), ROSTER, null, 5);
  for (const r of recs) {
    const c = CONCEPTS.find((x) => x.n === r.conceptN)!;
    assert.deepEqual(r.crewNotes, crewOf(c).notes);
    for (const note of r.crewNotes) {
      assert.ok(!/^(videographer|voice actor)$/i.test(note), `${note} is cast, not noted`);
    }
  }
  const withNotes = recs.filter((r) => r.crewNotes.length);
  assert.ok(withNotes.length > 0, 'every concept in the library names an editor at least');
});

test('a cast line nobody can parse is unknown, not one model', () => {
  const odd = { ...CONCEPTS[0], production: { ...CONCEPTS[0].production, cast: 'the whole family' } };
  assert.equal(modelsNeeded(odd), null);
  assert.equal(modelsNeeded(CONCEPTS.find((c) => c.n === 21)!), 2);
  assert.equal(modelsNeeded(CONCEPTS.find((c) => c.n === 1)!), 0);
});

// ── 5. five ideas that are five ideas ───────────────────────────────────────

test('concept 4 is never shortlisted', () => {
  for (const set of SETS) {
    for (const v of [null, 'food', 'body'] as const) {
      const recs = recommend(fx(...set), ROSTER, v, 5);
      assert.ok(!recs.some((r) => r.conceptN === 4), `#4 absent under ${set.join('+')}/${v}`);
    }
  }
});

test('the library keeps its own non-headline entries off the sheet', () => {
  const forbidden = new Set(CONCEPTS.filter((c) => !c.headline).map((c) => c.n));
  assert.ok(forbidden.has(4) && forbidden.size >= 2);
  for (const set of SETS) {
    for (const r of recommend(fx(...set), ROSTER, null, 5)) {
      assert.ok(!forbidden.has(r.conceptN), `#${r.conceptN} is not a headline concept`);
    }
  }
});

test('at most two recommendations share a shape', () => {
  for (const set of SETS) {
    const recs = recommend(fx(...set), ROSTER, null, 5);
    const byShape = new Map<string, number>();
    for (const r of recs) byShape.set(r.shape, (byShape.get(r.shape) ?? 0) + 1);
    for (const [shape, n] of byShape) {
      assert.ok(n <= 2, `${n} × ${shape} under ${set.join('+') || '(clean)'}`);
    }
  }
});

test('at least four distinct reasons across every finding set', () => {
  for (const set of SETS) {
    const recs = recommend(fx(...set), ROSTER, null, 5);
    const en = new Set(recs.map((r) => r.because.en));
    const ar = new Set(recs.map((r) => r.because.ar));
    assert.ok(en.size >= 4, `${en.size} distinct English reasons for ${set.join('+') || '(clean)'}`);
    assert.equal(ar.size, en.size, 'the Arabic does not collapse where the English does not');
  }
});

test('at most one recommendation falls back to the generic sentence', () => {
  for (const set of SETS) {
    const recs = recommend(fx(...set), ROSTER, null, 5);
    const generic = recs.filter((r) => /^Fits their trade/.test(r.because.en));
    assert.ok(generic.length <= 1, `${generic.length} generic reasons`);
  }
});

test('Arabic reasons carry Arabic-Indic digits, never Latin ones', () => {
  for (const set of SETS) {
    for (const r of recommend(fx(...set), ROSTER, null, 5)) {
      assert.ok(!/[0-9]/.test(r.because.ar), r.because.ar);
    }
  }
});

// ── 6. the arithmetic, and the vertical ─────────────────────────────────────

test('price is videos × the published rate, every time', () => {
  for (const set of SETS) {
    for (const r of recommend(fx(...set), ROSTER, null, 5)) {
      assert.equal(r.priceJOD, r.videos * VIDEO_JOD_PER);
      assert.equal(r.videos, CONCEPTS.find((c) => c.n === r.conceptN)!.economics.originations);
    }
  }
});

test('a vertical changes the shortlist', () => {
  const set = fx('ig-ask', 'ig-engagement');
  const none = recommend(set, ROSTER, null, 5).map((r) => r.conceptN);
  const food = recommend(set, ROSTER, 'food', 5).map((r) => r.conceptN);
  assert.notDeepEqual(none, food, 'the +18 actually fires');
});

test('confidence scales the vertical bonus, and zero confidence is no vertical', () => {
  const set = fx('ig-ask', 'ig-engagement');
  const none = recommend(set, ROSTER, null, 5).map((r) => r.conceptN);
  const sure = recommend(set, ROSTER, 'food', 5, { verticalConfidence: 1 }).map((r) => r.conceptN);
  const unsure = recommend(set, ROSTER, 'food', 5, { verticalConfidence: 0 }).map((r) => r.conceptN);
  assert.deepEqual(recommend(set, ROSTER, 'food', 5).map((r) => r.conceptN), sure,
    'no option means fully confident, which is what run.ts passed before');
  assert.deepEqual(unsure, none, 'a guess worth nothing decides nothing');
});

// ── 7. the same inputs, the same sheet ──────────────────────────────────────

test('the shortlist does not depend on roster order', () => {
  for (const set of SETS) {
    const a = recommend(fx(...set), ROSTER, 'food', 5);
    const b = recommend(fx(...set), [...ROSTER].reverse(), 'food', 5);
    assert.deepEqual(b.map((r) => r.conceptN), a.map((r) => r.conceptN));
    assert.deepEqual(
      b.map((r) => r.cast.map((p) => p.talentId)),
      a.map((r) => r.cast.map((p) => p.talentId)),
      'and neither does the cast',
    );
  }
});

test('the shortlist does not depend on the order of the library', () => {
  const before = SETS.map((s) => recommend(fx(...s), ROSTER, 'food', 5).map((r) => r.conceptN));
  const original = CONCEPTS.slice();
  CONCEPTS.reverse();
  try {
    const after = SETS.map((s) => recommend(fx(...s), ROSTER, 'food', 5).map((r) => r.conceptN));
    assert.deepEqual(after, before);
  } finally {
    CONCEPTS.length = 0;
    CONCEPTS.push(...original);
  }
});

test('traits are stable and read the concept, not its title', () => {
  const forty = CONCEPTS.find((c) => c.n === 2)!;
  assert.equal(traits(forty).statesPrice, traits({ ...forty, name: 'Untitled' }).statesPrice);
});
