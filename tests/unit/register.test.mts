import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CHECKS, registerFor, tallyOf } from '@/lib/teardown/register';
import { SPECIMEN_SHEET } from '@/lib/data/specimenSheet';
import type { Sheet } from '@/lib/store/sheets';

/**
 * The register is a promise that the document lists every test the engine
 * runs. A finding id that exists in `findings.ts` and not in the catalogue
 * breaks that promise silently: the check still fires, the client still sees
 * the finding, and the register quietly under-reports what was looked at.
 *
 * `findings.ts` cannot be enumerated at runtime — a check that fires only
 * under a condition leaves nothing behind when the condition is false — so
 * the catalogue is hand-written and this reads the source to keep it honest.
 */

const SRC = readFileSync(new URL('../../lib/teardown/findings.ts', import.meta.url), 'utf8');

/** Every `id: '...'` that findings.ts can emit, charts excluded. */
const emitted = [...SRC.matchAll(/\bid: '([a-z0-9-]+)'/g)].map((m) => m[1]);

/** The positive twins, which the catalogue carries under `good` rather than as rows. */
const twins = new Set(CHECKS.flatMap((c) => c.good ?? []));
const known = new Set([...CHECKS.map((c) => c.id), ...twins]);

/** Charts are not tests and have their own ids in the same file. */
const CHART_IDS = new Set(['formats', 'hours']);

test('every finding the engine can emit is a row in the register', () => {
  const missing = [...new Set(emitted)]
    .filter((id) => !known.has(id) && !CHART_IDS.has(id));
  assert.deepEqual(missing, [],
    `findings.ts can emit ${missing.join(', ')}, which lib/teardown/register.ts does not know about. `
    + 'Add a Check (or list it as a `good` twin) so the audit document keeps listing every test.');
});

test('the catalogue names no check the engine cannot produce', () => {
  const emittedSet = new Set(emitted);
  const ghosts = CHECKS.map((c) => c.id).filter((id) => !emittedSet.has(id));
  assert.deepEqual(ghosts, [], `the register advertises ${ghosts.join(', ')}, which nothing emits`);
});

test('check ids are unique', () => {
  const ids = CHECKS.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('every check is written in both languages', () => {
  for (const c of CHECKS) {
    assert.ok(c.asks.en.trim().length > 10, `${c.id} has no English`);
    assert.ok(c.asks.ar.trim().length > 5, `${c.id} has no Arabic`);
    assert.ok(!/[⟦⟧]/.test(c.asks.ar + c.asks.en), `${c.id} carries a placeholder`);
  }
});

test('the Arabic side never prints a Western digit', () => {
  // Arabic-Indic on every Arabic surface — the site-wide rule. These strings
  // interpolate thresholds, which is exactly where a Latin digit sneaks in.
  for (const c of CHECKS) {
    assert.ok(!/[0-9]/.test(c.asks.ar), `${c.id}: “${c.asks.ar}” has Western digits`);
  }
});

test('every row gets exactly one outcome, and the tally adds up', () => {
  const rows = registerFor(SPECIMEN_SHEET);
  assert.equal(rows.length, CHECKS.length);
  const tally = tallyOf(rows);
  assert.equal(tally.flagged + tally.clear + tally.notRun, tally.total);
});

test('a good finding reads as clear, never as a problem', () => {
  const rows = registerFor(SPECIMEN_SHEET);
  const goodIds = new Set(
    SPECIMEN_SHEET.findings.findings.filter((f) => f.severity === 'good').map((f) => f.id));
  for (const r of rows) {
    if (goodIds.has(r.id)) {
      assert.equal(r.outcome.state, 'clear',
        `${r.id} is good news and must not be listed as a problem`);
    }
  }
});

test('with no website, every website test past the first says why it could not run', () => {
  const noSite: Sheet = { ...SPECIMEN_SHEET, webState: { state: 'no-url' } };
  const rows = registerFor(noSite).filter((r) => r.source === 'website' && r.id !== 'web-none');
  assert.ok(rows.length > 0);
  for (const r of rows) {
    assert.equal(r.outcome.state, 'not-run', `${r.id} cannot be clear with no site`);
    if (r.outcome.state === 'not-run') {
      assert.ok(r.outcome.why.en.length > 10, `${r.id} gives no reason`);
      assert.ok(r.outcome.why.ar.length > 5, `${r.id} gives no Arabic reason`);
    }
  }
});
