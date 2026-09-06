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

/**
 * `offerBooking` returns a union now — a booking, or a reason there isn't one.
 * Most of this file wants the booking and treats anything else as a broken
 * fixture rather than an assertion, so unwrap loudly and stop.
 */
type Offer = Awaited<ReturnType<typeof D.offerBooking>>;
const must = (r: Offer) => {
  if (!r.ok) { console.error('  fixture failed to book:', JSON.stringify(r)); process.exit(2); }
  return r.booking;
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
const b1 = must(await D.offerBooking({ dealId: DEAL, talentId: A, date: '2026-09-10',
  feeJOD: 50, brief: 'On camera, one setup' }));
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

console.log('\n══ a deal moves along its own table, and no other way ══');
// `paid` is the transition that writes the client's name onto every booking on
// the job, so a proposal nobody has signed may not reach it in one press.
ok('a proposal cannot jump straight to paid',
  (await D.advanceDeal(DEAL, 'paid')) === false);
ok('  and nothing moved', (await D.getDeal(DEAL))?.status === 'proposed');
ok('a deal that does not exist does not move',
  (await D.advanceDeal('itest-deal-nonexistent', 'signed')) === false);
ok('proposed → signed is allowed', (await D.advanceDeal(DEAL, 'signed')) === true);
ok('  and it is signed', (await D.getDeal(DEAL))?.status === 'signed');

console.log('\n══ payment is what reveals the client ══');
let fresh = (await C('bookings').doc(b1.id).get()).data()!;
ok('still no client name while unpaid', fresh.clientName === undefined);
ok('signed → paid is allowed', (await D.advanceDeal(DEAL, 'paid')) === true);
fresh = (await C('bookings').doc(b1.id).get()).data()!;
ok('client name appears once paid', fresh.clientName === 'Zeitouna Optics');
ok('client total still absent after payment', !('clientTotalJOD' in fresh));
ok('a paid deal cannot be un-signed', (await D.advanceDeal(DEAL, 'signed')) === false);
ok('  nor lost — the money has arrived', (await D.advanceDeal(DEAL, 'lost')) === false);

console.log('\n══ a booking made after payment ══');
const b2 = must(await D.offerBooking({ dealId: DEAL, talentId: B, date: '2026-09-11',
  feeJOD: 35, brief: 'Shoot and cut' }));
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

/* Everything below is added after the spread assertion on purpose: it books
   more days against the same deal, and the margin arithmetic above is pinned
   to exactly the two that came before it. */

console.log('\n══ a day already spoken for ══');
const same = {
  dealId: DEAL, talentId: A, date: '2026-09-10',
  feeJOD: 50, brief: 'A second job, the same day',
};
const clash = await D.offerBooking(same);
ok('a second offer for the same person and day is refused',
   clash.ok === false && clash.reason === 'conflict');
ok('  and names the booking it clashes with',
   clash.ok === false && clash.reason === 'conflict'
   && clash.conflict.id === b1.id && clash.conflict.status === 'accepted');
ok('  and wrote nothing',
   (await C('bookings').where('talentId', '==', A).where('date', '==', '2026-09-10').get()).size === 1);

const forced = must(await D.offerBooking({ ...same, force: true }));
ok('force books it anyway — a backup on a spoken-for day is legitimate',
   forced.status === 'offered');
ok('  and leaves a trail to the other side of the double-booking',
   forced.conflictWith === b1.id, `got ${forced.conflictWith}`);

console.log('\n══ who cannot be offered a day ══');
const PH = 'itest-placeholder', OFF = 'itest-inactive';
await D.saveTalent({ id: PH, name: { ar: 'اسم', en: 'Placeholder' }, discipline: 'model',
  dayRateJOD: 50, phone: '', availability: 'available', active: true,
  placeholder: true, createdAt: nowIso });
await D.saveTalent({ id: OFF, name: { ar: 'سابق', en: 'Former' }, discipline: 'model',
  dayRateJOD: 50, phone: '', availability: 'available', active: false, createdAt: nowIso });

const ph = await D.offerBooking({ dealId: DEAL, talentId: PH, date: '2026-09-20',
  feeJOD: 50, brief: 'A day that does not exist' });
ok('an invented person cannot be offered a real day',
   ph.ok === false && ph.reason === 'placeholder');
const off = await D.offerBooking({ dealId: DEAL, talentId: OFF, date: '2026-09-20',
  feeJOD: 50, brief: 'Someone off the roster' });
ok('nor can somebody off the roster', off.ok === false && off.reason === 'inactive');
const nobody = await D.offerBooking({ dealId: DEAL, talentId: 'itest-nobody',
  date: '2026-09-20', feeJOD: 50, brief: 'Nobody at all' });
ok('nor an id belonging to nobody', nobody.ok === false && nobody.reason === 'no-talent');
ok('and none of the three wrote a booking',
   (await C('bookings').where('date', '==', '2026-09-20').get()).empty);

console.log('\n══ the transition table ══');
const cancelled = must(await D.offerBooking({ dealId: DEAL, talentId: B, date: '2026-10-01',
  feeJOD: 35, brief: 'The client moved the shoot' }));
ok('offered → cancelled', (await D.markBooking(cancelled.id, 'cancelled')) === true);
ok('  and cancelled is the end of it', (await D.markBooking(cancelled.id, 'done')) === false);

const noShow = must(await D.offerBooking({ dealId: DEAL, talentId: B, date: '2026-10-02',
  feeJOD: 35, brief: 'Accepted, then nobody came' }));
await D.respondToBooking(noShow.id, B, 'accepted');
ok('accepted → no_show', (await D.markBooking(noShow.id, 'no_show')) === true);
ok('  and a no-show is never paid', (await D.markBooking(noShow.id, 'paid')) === false);

const worked = must(await D.offerBooking({ dealId: DEAL, talentId: B, date: '2026-10-03',
  feeJOD: 35, brief: 'A day that actually happened' }));
await D.respondToBooking(worked.id, B, 'accepted');
ok('accepted → done → paid is the ordinary road',
   (await D.markBooking(worked.id, 'done')) === true
   && (await D.markBooking(worked.id, 'paid')) === true);
ok('a paid day cannot be walked back to offered',
   (await D.markBooking(worked.id, 'offered')) === false);
ok('  nor can an offered day skip straight to paid',
   (await D.markBooking(forced.id, 'paid')) === false);
ok('and marking a booking that does not exist is false, not a throw',
   (await D.markBooking('itest-no-such-booking', 'done')) === false);

console.log('\n══ saying no, and saying why ══');
const declined = must(await D.offerBooking({ dealId: DEAL, talentId: B, date: '2026-10-04',
  feeJOD: 35, brief: 'A day they cannot make' }));
ok('a decline carries the reason when one is given',
   (await D.respondToBooking(declined.id, B, 'declined', 'مسافر')) === true);
const declinedDoc = (await C('bookings').doc(declined.id).get()).data()!;
ok('  and the reason is stored', declinedDoc.declineReason === 'مسافر');

const quiet = must(await D.offerBooking({ dealId: DEAL, talentId: B, date: '2026-10-05',
  feeJOD: 35, brief: 'Declined without explanation' }));
ok('declining without a reason still works — it is a courtesy, not a form',
   (await D.respondToBooking(quiet.id, B, 'declined')) === true);
ok('  and stores no empty reason',
   (await C('bookings').doc(quiet.id).get()).data()!.declineReason === undefined);

console.log('\n══ everything still in play ══');
const finished = must(await D.offerBooking({ dealId: DEAL, talentId: B, date: '2026-10-06',
  feeJOD: 35, brief: 'Worked, not yet paid' }));
await D.respondToBooking(finished.id, B, 'accepted');
await D.markBooking(finished.id, 'done');

const open = await D.listOpenBookings();
const ids = new Set(open.map((x) => x.id));
ok('an accepted day is open', ids.has(b1.id));
ok('an offered day is open', ids.has(forced.id));
ok('a finished but unpaid day is open — that is the one that gets forgotten',
   ids.has(finished.id));
ok('a cancelled day is not', !ids.has(cancelled.id));
ok('a declined day is not', !ids.has(declined.id));
ok('a paid day is not', !ids.has(worked.id));
ok('a no-show is not', !ids.has(noShow.id));

console.log('\n══ availability with an end to it ══');
ok('a return date that is not a date is refused',
   (await D.setAvailability(A, 'busy', '2026-13-40')) === false);
ok('a real one is accepted', (await D.setAvailability(A, 'busy', '2026-09-25')) === true);
ok('  and round-trips', (await D.getTalent(A))?.availableFrom === '2026-09-25');
await D.setAvailability(A, 'available');
ok('coming back clears it rather than leaving a stale promise',
   (await D.getTalent(A))?.availableFrom === undefined);

console.log('\n══ signing every device out ══');
const epochBefore = (await D.getTalent(A))?.sessionEpoch ?? 0;
ok('bumping the epoch increments it', (await D.bumpSessionEpoch(A)) === epochBefore + 1);
ok('  and it is on the record', ((await D.getTalent(A))?.sessionEpoch ?? 0) === epochBefore + 1);
ok('bumping nobody is null, not a throw', (await D.bumpSessionEpoch('itest-nobody')) === null);

console.log(bad ? `\n${bad} FAILING` : '\nAll checks pass.');
console.log('(test records live in _itest_* collections; production untouched)');
process.exit(bad ? 1 : 0);
