#!/usr/bin/env node
/**
 * What this environment is actually configured to do, printed to a terminal.
 *
 * The table is not reinvented here. `lib/config/check.ts`'s `configReport()`
 * is the single source of truth the `/ops` console panel also reads (via
 * `POST /api/ops/selfcheck`), so this script and the console can never
 * quietly disagree about what a missing variable means or how bad that is.
 *
 * Four wave-1 additions are not yet rows in `configReport()`:
 * `TALENT_SESSION_SECRET`, `WHATSAPP_REMINDER_TEMPLATE`,
 * `META_SELFCHECK_HANDLE`, `NEXT_PUBLIC_CONTACT_PHONE`. `lib/config/check.ts`
 * is not this workstream's file to edit mid-wave, so they are listed here as
 * a second, explicitly-labelled table instead of silently absent — with a
 * comment (and the final report) naming the exact rows that belong in
 * `configReport()` once that file is free to take them, so this list has one
 * place to go stale, not two.
 *
 * Usage:
 *   node --experimental-strip-types --import ./tests/register.mjs scripts/check-env.mjs
 *   npm run check-env
 *
 * Exit code: non-zero only when a `critical` (required) variable is missing.
 * `degraded` (recommended) and `optional` rows are reported, never block —
 * matching the CI wiring, which runs this non-blocking.
 */
import { configReport, configSummary } from '@/lib/config/check';

const has = (k) => !!process.env[k]?.trim();

// Not yet in configReport() — see the header comment.
const SUPPLEMENTARY = [
  {
    key: 'TALENT_SESSION_SECRET', severity: 'optional',
    whatBreaks: 'Talent sessions fall back to SESSION_SECRET, then OPERATOR_KEY — '
      + 'rotating either one signs out every signed-in provider.',
  },
  {
    key: 'WHATSAPP_REMINDER_TEMPLATE', severity: 'optional',
    whatBreaks: 'The day-before booking reminder goes as free text instead of a template, '
      + 'so it only delivers inside an open 24-hour WhatsApp window.',
  },
  {
    key: 'META_SELFCHECK_HANDLE', severity: 'optional',
    whatBreaks: "POST /api/ops/selfcheck defaults to checking Meta's own token health "
      + "against the handle 'instagram' instead of a chosen one.",
  },
  {
    key: 'NEXT_PUBLIC_CONTACT_PHONE', severity: 'optional',
    whatBreaks: 'The public contact number on the site falls back to the unregistered default.',
  },
].map((r) => ({ ...r, present: has(r.key) }));

const SEVERITY_LABEL = { critical: 'required', degraded: 'recommended', optional: 'optional' };

function statusOf(row) {
  if (row.present) return 'OK';
  if (row.severity === 'optional') return `MISSING (no fallback — ${row.whatBreaks})`;
  return `MISSING (${row.whatBreaks})`;
}

function printTable(title, rows) {
  console.log(`\n${title}`);
  console.log('-'.repeat(title.length));
  const width = Math.max(...rows.map((r) => r.key.length), 20);
  for (const row of rows) {
    const tag = `[${SEVERITY_LABEL[row.severity]}]`.padEnd(13);
    console.log(`${row.key.padEnd(width + 2)}${tag}${statusOf(row)}`);
  }
}

const rows = configReport();
printTable('Environment matrix (lib/config/check.ts)', rows);
printTable('Wave-1 additions pending a home in configReport()', SUPPLEMENTARY);

const summary = configSummary(rows);
const supplementaryMissing = SUPPLEMENTARY.filter((r) => !r.present);

console.log(
  `\n${rows.length + SUPPLEMENTARY.length} variables checked — `
  + `${summary.critical.length} required missing, `
  + `${summary.degraded.length} recommended missing, `
  + `${supplementaryMissing.filter((r) => r.severity === 'optional').length} optional missing.\n`,
);

if (summary.critical.length > 0) {
  console.error(`Missing required: ${summary.critical.join(', ')}`);
  process.exit(1);
}
process.exit(0);
