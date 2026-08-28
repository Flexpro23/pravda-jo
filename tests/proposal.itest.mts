/**
 * The configurator's server half.
 *
 * What it guards: a price is computed from the stored teardown, never taken
 * from the request. The client half is a browser, and a browser is a place we
 * do not control — a submitted total is a number someone else chose.
 *
 *   FIRESTORE_COLLECTION_PREFIX=_itest_ PORT=3110 npx next dev -p 3110
 *   npm run test:proposal
 *
 * The server on $BASE must carry the SAME collection prefix as this file. A
 * server without it reads the live collections, never finds the fixture, and
 * answers every request with a 404 — which shows up as half the suite failing
 * on `undefined` and the other half passing for the wrong reason, because
 * "an unknown token 404s" is true when everything 404s. The preflight below
 * refuses to run in that state rather than reporting it thirteen times.
 */
process.env.FIRESTORE_COLLECTION_PREFIX = '_itest_';
process.env.GOOGLE_CLOUD_PROJECT = 'pravda-jo';

const BASE = process.env.BASE ?? 'http://localhost:3110';
const { saveTeardown } = await import('../lib/store/teardowns.ts');
const { listDeals } = await import('../lib/store/deals.ts');
const { SPECIMEN } = await import('../lib/data/report.ts');

let bad = 0;
const ok = (n: string, c: boolean, x = '') => { if (!c) bad++; console.log(`  ${c?'PASS':'FAIL'}  ${n}${x?'  '+x:''}`); };
const post = (b: unknown) => fetch(`${BASE}/api/proposal`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b),
});

const TOKEN = 'itestproposaltoken01';
await saveTeardown({
  token: TOKEN, handle: 'itest-shop', status: 'ready',
  report: { ...SPECIMEN, token: TOKEN },
  signals: { handle: 'itest-shop', posts: 10 } as never,
  readAt: '2026-08-27T00:00:00Z', createdAt: '2026-08-27T00:00:00Z',
});
// prices: 1500, 600, 1200

// The fixture is written; if the server cannot see it, it is reading a
// different set of collections and nothing below would mean anything.
const probe = await post({ token: TOKEN, contactName: 'probe', contactPhone: 'probe',
  selection: { concepts: [0], perMonth: 0, ads: false } });
if (probe.status === 404) {
  console.error(`\n  ${BASE} cannot see the test fixture.`);
  console.error('  Start it with FIRESTORE_COLLECTION_PREFIX=_itest_ and try again.');
  process.exit(2);
}

console.log('\n══ the price is ours, not the browser\'s ══');
let r = await post({ token: TOKEN, contactName: 'Sami', contactPhone: '+962790000000',
  selection: { concepts: [0, 2], perMonth: 0, ads: false },
  clientTotalJOD: 1, onceJOD: 1 });          // a lie, in two shapes
let j = await r.json();
ok('ignores a submitted total', j.onceJOD === 2700, `got ${j.onceJOD}`);

console.log('\n══ a selection can only name work we offered ══');
r = await post({ token: TOKEN, contactName: 'Sami', contactPhone: '+962790000000',
  selection: { concepts: [0, 99, -1, 2.5], perMonth: 0, ads: false } });
j = await r.json();
ok('drops out-of-range indexes', j.onceJOD === 1500, `got ${j.onceJOD}`);

console.log('\n══ the monthly side ══');
r = await post({ token: TOKEN, contactName: 'Sami', contactPhone: '+962790000000',
  selection: { concepts: [], perMonth: 8, ads: true } });
j = await r.json();
ok('8 videos + ads = 1600/mo', j.monthlyJOD === 1600, `got ${j.monthlyJOD}`);
r = await post({ token: TOKEN, contactName: 'Sami', contactPhone: '+962790000000',
  selection: { concepts: [], perMonth: 7, ads: false } });
j = await r.json();
ok('an unpublished pack size is refused', r.status === 400 || j.monthlyJOD === 0, `got ${j.monthlyJOD}`);

console.log('\n══ what it refuses ══');
ok('the specimen files nothing', (await post({ token: 'sample', contactName: 'a', contactPhone: 'b',
  selection: { concepts: [0], perMonth: 0, ads: false } })).status === 400);
ok('an unknown token 404s', (await post({ token: 'nosuchtokenatall99', contactName: 'a', contactPhone: 'b',
  selection: { concepts: [0], perMonth: 0, ads: false } })).status === 404);
ok('no contact, no proposal', (await post({ token: TOKEN,
  selection: { concepts: [0], perMonth: 0, ads: false } })).status === 400);
ok('an empty basket is refused', (await post({ token: TOKEN, contactName: 'a', contactPhone: 'b',
  selection: { concepts: [], perMonth: 0, ads: false } })).status === 400);

console.log('\n══ one proposal, not a pile ══');
const mine = (await listDeals(200)).filter((d) => d.teardownToken === TOKEN);
ok('four submissions made one deal', mine.length === 1, `got ${mine.length}`);
// The last submission that was ACCEPTED was 8-a-month plus ads; the pack of
// seven after it was refused, so it must not be what ended up stored.
ok('it holds the last accepted selection',
   mine[0].selection?.perMonth === 8 && mine[0].selection?.ads === true
   && mine[0].selection?.concepts.length === 0, JSON.stringify(mine[0].selection));
ok('a refused submission did not overwrite it', mine[0].retainerJOD === 1600, `got ${mine[0].retainerJOD}`);
ok('it carries the contact', mine[0].contactName === 'Sami');
ok('and is marked as coming from the client', mine[0].source === 'configurator');

console.log(bad ? `\n${bad} FAILING` : '\nAll checks pass.');
process.exit(bad ? 1 : 0);
