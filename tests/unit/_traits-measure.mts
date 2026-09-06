/**
 * The trait distribution over the real library, held to a band.
 *
 * A trait true of 80% of the thirty concepts is not a trait, it is a constant:
 * the weight attached to it adds the same number to almost every candidate and
 * so decides nothing, while looking in the code like a decision. Measured
 * before this pass, `showsAFace` fired for 24 of 30 and `statesPrice` for 14 —
 * the second partly because "the number" matched titles like *The Forty Fils
 * Number* rather than anything the piece does.
 *
 * So the band is asserted rather than commented: every trait must fire for
 * between 15% and 60% of the library, which is the range in which a +20 is
 * actually a discriminator. It is a test rather than a script because a
 * measurement nobody runs is a measurement that quietly stops being true — a
 * new concept can push a trait out of band, and that should fail a build.
 *
 * Imported by `recommend.test.mts` so it runs under `npm run test:unit`, whose
 * glob only picks up `*.test.mts`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONCEPTS } from '@/lib/data/concepts';
import { traits } from '@/lib/teardown/recommend';

const LO = 0.15;
const HI = 0.60;

/** Hit rate per trait across the whole library. */
export function measureTraits(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const c of CONCEPTS) {
    for (const [k, v] of Object.entries(traits(c))) {
      counts[k] = (counts[k] ?? 0) + (v ? 1 : 0);
    }
  }
  const rates: Record<string, number> = {};
  for (const [k, n] of Object.entries(counts)) rates[k] = n / CONCEPTS.length;
  return rates;
}

test('every trait discriminates: 15–60% of the library', () => {
  const rates = measureTraits();
  assert.equal(Object.keys(rates).length, 5, 'all five traits measured');
  for (const [trait, rate] of Object.entries(rates)) {
    const of30 = Math.round(rate * CONCEPTS.length);
    assert.ok(
      rate >= LO && rate <= HI,
      `${trait} fires for ${of30}/${CONCEPTS.length} (${(rate * 100).toFixed(0)}%), outside 15–60%`,
    );
  }
});

test('statesPrice does not read a concept title', () => {
  // #2 The Forty Fils Number and #16 Out The Door Number both carry "number"
  // in the name; the trait must turn on what the premise and format say.
  const byName = (n: number) => CONCEPTS.find((c) => c.n === n)!;
  for (const n of [2, 16]) {
    const c = byName(n);
    const fromTitleOnly = /\bnumber\b/i.test(c.name)
      && !/\b(price|priced|pricing|how much|fils)\b/i.test(`${c.premise} ${c.format}`);
    if (fromTitleOnly) assert.equal(traits(c).statesPrice, false);
  }
});

test('a concept built on never showing a face does not show a face', () => {
  const noFace = CONCEPTS.find((c) => c.n === 15)!;
  assert.equal(traits(noFace).showsAFace, false, '#15 No Face, Real Proof');
});
