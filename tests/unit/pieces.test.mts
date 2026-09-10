import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arPieces, enPieces } from '@/lib/format/num';

/**
 * Counting a noun, in a language that has four ways to do it.
 *
 * A client's page read "1 pieces from one day" and, in Arabic, "١ مقاطع".
 * Four call sites — two in the sheet, two in the proposal — each interpolated
 * a bare number in front of a plural noun. English needs one rule; Arabic
 * needs a dual, a plural of paucity, and a return to the singular above ten.
 */
test('English pluralises, and one is not "1 pieces"', () => {
  assert.equal(enPieces(1), '1 piece');
  assert.equal(enPieces(6), '6 pieces');
  assert.equal(enPieces(1, 'finished piece'), '1 finished piece');
  assert.equal(enPieces(10, 'finished piece'), '10 finished pieces');
});

test('Arabic counts with the dual and the plural of paucity', () => {
  // The four rules, each one a different shape. A client reading "١ مقاطع"
  // is reading something no Arabic speaker would write.
  assert.equal(arPieces(1), 'مقطع واحد');
  assert.equal(arPieces(2), 'مقطعين');
  assert.equal(arPieces(6), '٦ مقاطع');
  assert.equal(arPieces(10), '١٠ مقاطع');
  assert.equal(arPieces(11), '١١ مقطع');
  // Digits stay Arabic-Indic throughout, per the site-wide rule.
  assert.ok(!/[0-9]/.test(arPieces(11)), 'no Western digits on an Arabic surface');
});
