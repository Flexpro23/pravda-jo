#!/usr/bin/env node
/**
 * Enforces the budgets documented in README's "Budgets" table against the
 * per-route "First Load JS" column `next build` prints to stdout.
 *
 * There is no machine-readable manifest of this number worth depending on —
 * `next build`'s own JSON manifests store per-chunk bytes, not the computed
 * "First Load JS" figure, and that computation is internal to the CLI's
 * printTreeView. Parsing the table Next already prints is the stable
 * contract: it is what a human reads today, and it is what changes the day
 * the number does.
 *
 * Usage:
 *   node scripts/check-bundle.mjs --from <file>   # a saved `next build` stdout
 *   node scripts/check-bundle.mjs                 # reads <dist>/build-output.log
 *
 * `<dist>` is `$NEXT_DIST_DIR` or `.next`, matching the build/start scripts'
 * own convention. There is nothing to read until something captures the
 * build's stdout there — `npm run build | tee .next/build-output.log`, which
 * is what CI does before calling this script.
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const DEFAULT_BUDGET_KB = 250;
// `/[lang]` and its teardown route carry the WebGL flight; same ceiling as
// every other route today (README: 245 kB actual against a 250 kB target),
// named separately because a future tightening is likely to apply to these
// two first.
const WEBGL_ROUTES = new Set(['/[lang]', '/[lang]/teardown']);
const WEBGL_BUDGET_KB = 250;
// `/s/[token]` is cold traffic's landing page and carries no canvas at all —
// held to the old `/r` ceiling.
const SHEET_ROUTE = '/s/[token]';
const SHEET_BUDGET_KB = 150;

function budgetFor(route) {
  if (route === SHEET_ROUTE) return SHEET_BUDGET_KB;
  if (WEBGL_ROUTES.has(route)) return WEBGL_BUDGET_KB;
  return DEFAULT_BUDGET_KB;
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--from') out.from = argv[++i];
  }
  return out;
}

function stripAnsi(s) {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}

/** "17.3 kB" | "191 B" | "1 kB" -> kilobytes as a number. */
function toKB(text) {
  const m = text.trim().match(/^([\d.]+)\s*(kB|B)$/);
  if (!m) return null;
  const n = Number(m[1]);
  return m[2] === 'B' ? n / 1000 : n;
}

/**
 * One row of the tree view is a border glyph, an optional route-type symbol,
 * the route itself, then "Size" and "First Load JS" as the last two
 * size-looking tokens on the line. Nested rows (a static param under its
 * parent, e.g. "├   ├ /ar") carry no size at all and are skipped by the
 * absence of a match rather than by name.
 */
function parseRoutes(text) {
  const routes = [];
  for (const rawLine of text.split('\n')) {
    const line = stripAnsi(rawLine);
    const m = line.match(/^[│├└┌]\s*[○●ƒ◐]?\s*(\/\S*)\s+(.+)$/);
    if (!m) continue;
    const [, route, rest] = m;
    const sizes = [...rest.matchAll(/([\d.]+\s*(?:kB|B))/g)].map((x) => x[1]);
    if (sizes.length < 2) continue; // no "First Load JS" column on this line
    const firstLoadKB = toKB(sizes[1]);
    if (firstLoadKB === null) continue;
    routes.push({ route, firstLoadKB });
  }
  return routes;
}

function main() {
  const { from } = parseArgs(process.argv.slice(2));
  const distDir = process.env.NEXT_DIST_DIR || '.next';
  const logPath = from || path.join(distDir, 'build-output.log');

  if (!existsSync(logPath)) {
    console.error(`check-bundle: no captured build output at ${logPath}.`);
    console.error('Run `next build` piped to that file first, e.g.:');
    console.error(`  NEXT_DIST_DIR=${distDir} npm run build | tee ${logPath}`);
    console.error('or pass --from <file> with a saved `next build` stdout.');
    process.exit(2);
  }

  const text = readFileSync(logPath, 'utf8');
  const routes = parseRoutes(text);
  if (routes.length === 0) {
    console.error(`check-bundle: found no "First Load JS" rows in ${logPath}.`);
    console.error('Is this really a `next build` stdout capture?');
    process.exit(2);
  }

  const rows = routes.map(({ route, firstLoadKB }) => {
    const budget = budgetFor(route);
    return { route, firstLoadKB, budget, over: firstLoadKB > budget };
  });

  const routeWidth = Math.max(...rows.map((r) => r.route.length), 'Route'.length);
  const header = `${'Route'.padEnd(routeWidth)}  First Load JS   Budget   Status`;
  console.log(header);
  console.log('-'.repeat(header.length));
  for (const r of rows) {
    const size = `${r.firstLoadKB.toFixed(1)} kB`.padStart(11);
    const budget = `${r.budget} kB`.padStart(7);
    const status = r.over ? 'OVER' : 'ok';
    console.log(`${r.route.padEnd(routeWidth)}  ${size}   ${budget}   ${status}`);
  }

  const failures = rows.filter((r) => r.over);
  if (failures.length > 0) {
    console.error(`\n${failures.length} route(s) over budget:`);
    for (const r of failures) {
      console.error(`  ${r.route}: ${r.firstLoadKB.toFixed(1)} kB > ${r.budget} kB`);
    }
    process.exit(1);
  }

  console.log(`\nAll ${rows.length} routes within budget.`);
}

main();
