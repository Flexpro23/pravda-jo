/**
 * The commercial model, exercised against real Firestore.
 *
 * It runs against _itest_* collections rather than the live ones, so it drives
 * the actual store code instead of a reimplementation of it, and still cannot
 * touch a real deal. Document ids are fixed, so a rerun overwrites rather than
 * accumulating.
 *
 *   npm run test:deals
 *
 * What it is really guarding is one rule: a provider never learns what the
 * client paid, and learns who the client is only once the money has arrived.
 * That rule is worth a test rather than a comment because every future screen
 * is a chance to break it.
 */
process.env.FIRESTORE_COLLECTION_PREFIX = '_itest_';
process.env.GOOGLE_CLOUD_PROJECT = 'pravda-jo';

const D = await import('../lib/store/deals.ts');
const { store } = await import('../lib/store/firebase.ts');

const db = store();
const PREFIX = process.env.FIRESTORE_COLLECTION_PREFIX ?? '';
const C = (n: string) => db.collection(`${PREFIX}${n}`);

/**
 * Reset this run's fixtures.
 *
 * Bookings are created with random ids, so without this the second run counts
 * the first run's crew twice and every arithmetic assertion drifts. Guarded on
 * the prefix: with an empty one this would be clearing live bookings, so it
 * refuses to run at all rather than trusting the caller.
 */
if (!PREFIX.startsWith('_itest')) {
  console.error('refusing to run without an _itest_ collection prefix');
  process.exit(2);
}
const stale = await C('bookings').where('dealId', '==', 'itest-deal-1').get();
if (!stale.empty) {
  const batch = db.batch();
  stale.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  console.log(`  (cleared ${stale.size} fixture booking(s) from a previous run)`);
}
let bad = 0;
const ok = (name: string, cond: boolean, extra = '') => {
  if (!cond) bad++;
  console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
};

// fixed ids so a rerun overwrites rather than accumulates
const A = 'itest-amal', B = 'itest-basil', DEAL = 'itest-deal-1';
const nowIso = new Date().toISOString();

const code = D.newPassCode();
await D.saveTalent({ id: A, name: { ar: 'أمل', en: 'Amal' }, discipline: 'model',
  dayRateJOD: 50, phone: '', availability: 'available',
  passCodeHash: D.hashCode(code), active: true, createdAt: nowIso });
await D.saveTalent({ id: B, name: { ar: 'باسل', en: 'Basil' }, discipline: 'videographer',
  dayRateJOD: 35, phone: '', availability: 'available',
  passCodeHash: D.hashCode(D.newPassCode()), active: true, createdAt: nowIso });

await D.saveDeal({ id: DEAL, clientName: 'Zeitouna Optics', clientTotalJOD: 1500,
  concepts: [{ conceptN: 1, name: 'The Inbox Twelve', priceJOD: 1500 }],
  status: 'proposed', createdAt: nowIso, updatedAt: nowIso });

console.log('\n══ the margin rule ══');
const b1 = await D.offerBooking({ dealId: DEAL, talentId: A, date: '2026-09-10',
  feeJOD: 50, brief: 'On camera, one setup' });
ok('booking carries no client price', !('clientTotalJOD' in b1) && !JSON.stringify(b1).includes('1500'));
ok('booking hides the client before payment', b1.clientName === undefined);

console.log('\n══ what a provider can see ══');
const amalSees = await D.bookingsForTalent(A);
const basilSees = await D.bookingsForTalent(B);
ok('Amal sees her own day', amalSees.length === 1);
ok('Basil sees none of Amal\'s', basilSees.length === 0);
const leak = JSON.stringify(amalSees);
ok('nothing a provider reads contains the client total', !leak.includes('1500'));

console.log('\n══ one provider cannot answer for another ══');
ok('Basil cannot accept Amal\'s day', (await D.respondToBooking(b1.id, B, 'accepted')) === false);
ok('Amal can accept her own', (await D.respondToBooking(b1.id, A, 'accepted')) === true);
ok('and cannot accept it twice', (await D.respondToBooking(b1.id, A, 'declined')) === false);

console.log('\n══ payment is what reveals the client ══');
let fresh = (await C('bookings').doc(b1.id).get()).data()!;
ok('still no client name while unpaid', fresh.clientName === undefined);
await D.advanceDeal(DEAL, 'paid');
fresh = (await C('bookings').doc(b1.id).get()).data()!;
ok('client name appears once paid', fresh.clientName === 'Zeitouna Optics');
ok('client total still absent after payment', !('clientTotalJOD' in fresh));

console.log('\n══ a booking made after payment ══');
const b2 = await D.offerBooking({ dealId: DEAL, talentId: B, date: '2026-09-11',
  feeJOD: 35, brief: 'Shoot and cut' });
ok('carries the client immediately', b2.clientName === 'Zeitouna Optics');

console.log('\n══ the spread, operator side only ══');
const all = await D.bookingsForDeal(DEAL);
const deal = (await D.getDeal(DEAL))!;
const { spreadJOD } = await import('../lib/data/deals.ts');
ok('1500 client − 85 crew = 1415 kept', spreadJOD(deal, all) === 1415,
   `got ${spreadJOD(deal, all)}`);

console.log('\n══ sign-in ══');
ok('the right code finds the right person', (await D.talentByCode(code))?.id === A);
ok('a wrong code finds nobody', (await D.talentByCode('000000')) === null);

console.log(bad ? `\n${bad} FAILING` : '\nAll checks pass.');
console.log('(test records live in _itest_* collections; production untouched)');
process.exit(bad ? 1 : 0);
