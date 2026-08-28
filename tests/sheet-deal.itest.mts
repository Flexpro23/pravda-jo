/**
 * A sheet the client said yes to, becoming the job.
 *
 * Runs against _itest_* collections, so it drives the real store code and
 * cannot touch a live deal.
 *
 *   npm run test:sheet-deal
 *
 * Two rules are what this is really guarding. Winning the same sheet twice must
 * produce one job, not two — the second press is nearly always the first one
 * being slow. And the money that reaches the deal must be the money printed on
 * the page the client read, never a re-derivation of it.
 */
process.env.FIRESTORE_COLLECTION_PREFIX = '_itest_';
process.env.GOOGLE_CLOUD_PROJECT = 'pravda-jo';

const S = await import('../lib/store/sheets.ts');
const D = await import('../lib/store/deals.ts');
const V = await import('../lib/store/convert.ts');
const { store } = await import('../lib/store/firebase.ts');

const db = store();
const PREFIX = process.env.FIRESTORE_COLLECTION_PREFIX ?? '';
const C = (n: string) => db.collection(`${PREFIX}${n}`);

if (!PREFIX.startsWith('_itest')) {
  console.error('refusing to run without an _itest_ collection prefix');
  process.exit(2);
}

const TOKEN = 'itestsheet0001';
const VG = 'itest-basil', MD = 'itest-amal';

/**
 * Start from nothing.
 *
 * Deals born here carry random ids, so without this every rerun leaves another
 * behind and the "won once" assertion stops meaning anything. The sheet itself
 * is deleted rather than overwritten, because saveSheet merges — a
 * castOverrides written by the last run would survive into this one's fixture
 * and quietly change what the casting assertions are testing.
 */
const stale = await C('deals').where('sheetToken', '==', TOKEN).get();
const batch = db.batch();
stale.docs.forEach((d) => batch.delete(d.ref));
for (const id of stale.docs.map((d) => (d.data() as { id: string }).id)) {
  const bs = await C('bookings').where('dealId', '==', id).get();
  bs.docs.forEach((d) => batch.delete(d.ref));
}
batch.delete(C('sheets').doc(TOKEN));
await batch.commit();
if (!stale.empty) console.log(`  (cleared ${stale.size} deal(s) from a previous run)`);

let bad = 0;
const ok = (name: string, cond: boolean, extra = '') => {
  if (!cond) bad++;
  console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
};

const nowIso = new Date().toISOString();
await D.saveTalent({ id: VG, name: { ar: 'باسل', en: 'Basil' }, discipline: 'videographer',
  dayRateJOD: 35, phone: '', availability: 'available', active: true, createdAt: nowIso } as never);
await D.saveTalent({ id: MD, name: { ar: 'أمل', en: 'Amal' }, discipline: 'model',
  dayRateJOD: 50, phone: '', availability: 'available', active: true, createdAt: nowIso } as never);

/** Three ideas, one of them cast with the same videographer as another. */
const rec = (n: number, name: string, hook: string, cast: string[]) => ({
  conceptN: n, name, tier: 'light', videos: 6, priceJOD: 900,
  hook, premise: '', format: '',
  because: { ar: '', en: '' }, answers: [], models: 0, needsVoice: false,
  cast: cast.map((id) => ({ talentId: id, name: { ar: '', en: id }, discipline: '', why: { ar: '', en: '' } })),
});

const base = {
  token: TOKEN,
  handle: 'itestbiz',
  clientName: 'Itest Bakery',
  signals: { posts: 40 }, findings: { findings: [], charts: [] },
  recommendations: [
    rec(1, 'Question cards', 'A card with their own question', [VG]),
    rec(2, 'Owner mid-sentence', 'An owner in a back room', [VG, MD]),
    rec(3, 'Price on screen', 'The number, full frame', [VG]),
    rec(4, 'Unpicked', 'Not chosen', [VG]),
  ],
  chosen: [] as number[],
  status: 'draft',
  createdAt: nowIso, updatedAt: nowIso,
} as never;

// ── it refuses anything that is not a sent, complete sheet ──────────────────
await S.saveSheet(base);
ok('a draft sheet cannot be won',
  (await V.winSheet(TOKEN)) as never && (await V.winSheet(TOKEN)).ok === false);
ok('  and says why', ((await V.winSheet(TOKEN)) as { why?: string }).why === 'not-approved');

await S.saveSheet({ ...(base as object), status: 'approved', chosen: [1, 2] } as never);
ok('two chosen is not three', ((await V.winSheet(TOKEN)) as { why?: string }).why === 'pick-three');

await S.saveSheet({
  ...(base as object), status: 'approved', chosen: [1, 2, 3],
  offer: { videos: 0, pricePerVideo: 150, ads: false, adsMonthlyJOD: 0, totalJOD: 0 },
} as never);
ok('an empty offer is not an offer', ((await V.winSheet(TOKEN)) as { why?: string }).why === 'no-offer');

// ── the real thing ─────────────────────────────────────────────────────────
await S.saveSheet({
  ...(base as object),
  status: 'approved',
  chosen: [1, 2, 3],
  // A discount, so the test cannot pass by accidentally reading the published rate.
  offer: { videos: 8, pricePerVideo: 140, ads: true, adsMonthlyJOD: 400, totalJOD: 1120 },
  copy: { '2': { name: 'صاحب المحل بنص جملة', hook: 'صاحب المحل بغرفة ورا، بيحكي عن سعره' } },
} as never);

const won = await V.winSheet(TOKEN);
ok('an approved, complete sheet is won', won.ok === true);
const dealId = (won as { dealId: string }).dealId;
ok('  and it created a deal', (won as { created: boolean }).created === true);

const deal = await D.getDeal(dealId);
ok('the deal exists', !!deal);
ok('it charges what the client read, not a re-derivation',
  deal?.clientTotalJOD === 1120, `got ${deal?.clientTotalJOD}`);
ok('the discounted rate survived', deal?.clientTotalJOD !== 8 * 150);
ok('the retainer came across', deal?.retainerJOD === 400);
ok('it is signed, not paid', deal?.status === 'signed' && !!deal?.signedAt && !deal?.paidAt);
ok('it knows where it came from', deal?.source === 'sheet' && deal?.sheetToken === TOKEN);
ok('three ideas were sold', deal?.concepts.length === 3);
ok('no idea carries a price of its own',
  (deal?.concepts ?? []).every((c) => c.priceJOD === undefined));
ok('the Arabic he wrote is the name on the job',
  deal?.concepts.find((c) => c.conceptN === 2)?.name === 'صاحب المحل بنص جملة');
ok('the unchosen idea did not come along',
  !deal?.concepts.some((c) => c.conceptN === 4));

const marked = await S.getSheet(TOKEN);
ok('the sheet points at its deal', marked?.dealId === dealId && !!marked?.wonAt);

// ── pressing it twice ──────────────────────────────────────────────────────
const again = await V.winSheet(TOKEN);
ok('winning it again opens the same deal',
  again.ok === true && (again as { dealId: string }).dealId === dealId);
ok('  and creates nothing', (again as { created: boolean }).created === false);
const all = await C('deals').where('sheetToken', '==', TOKEN).get();
ok('one sheet, one job', all.size === 1, `found ${all.size}`);

// ── a pointer at a deal that is not there ──────────────────────────────────
// The write order makes this the recoverable failure: the sheet is marked
// first, so a deal write that never landed leaves a dangling id rather than an
// orphaned job. Pressing again must heal it.
await C('sheets').doc(TOKEN).update({ dealId: 'itest-nonexistent-deal' });
const healed = await V.winSheet(TOKEN);
ok('a dangling deal id heals rather than sticks',
  healed.ok === true && (healed as { created: boolean }).created === true);
ok('  and the sheet now points at the new one',
  (await S.getSheet(TOKEN))?.dealId === (healed as { dealId: string }).dealId);

// ── the casting that carries across ────────────────────────────────────────
const plan = V.castPlan((await S.getSheet(TOKEN))!);
ok('every cast slot on every chosen idea is a slot', plan.length === 4, `got ${plan.length}`);
ok('the same videographer on three ideas is three days, not one',
  plan.filter((p) => p.talentId === VG).length === 3);
ok('the unchosen idea cast nobody', plan.every((p) => p.conceptN !== 4));
ok('a brief the crew can read is the Arabic he wrote',
  plan.find((p) => p.conceptN === 2)?.brief.startsWith('صاحب المحل بنص جملة'));
ok('an idea he left in English stays English, not machine-translated',
  plan.find((p) => p.conceptN === 1)?.brief === 'Question cards — A card with their own question');

await S.saveSheet({ ...((await S.getSheet(TOKEN)) as object), castOverrides: { '1': [MD] } } as never);
const overridden = V.castPlan((await S.getSheet(TOKEN))!);
ok('an override replaces the suggestion rather than adding to it',
  overridden.filter((p) => p.conceptN === 1).map((p) => p.talentId).join() === MD);

// ── the rule the whole system rests on ─────────────────────────────────────
const slot = plan.find((p) => p.talentId === MD)!;
const rate = (await D.getTalent(MD))!.dayRateJOD;
const booking = await D.offerBooking({
  dealId: (healed as { dealId: string }).dealId, talentId: slot.talentId,
  date: '2026-09-15', feeJOD: rate, brief: slot.brief,
});
ok('a booking made from a cast slot pays the roster rate', booking.feeJOD === 50);
ok('  and carries no client price',
  !Object.prototype.hasOwnProperty.call(booking, 'clientTotalJOD')
  && !JSON.stringify(booking).includes('1120'));
ok('  and does not name the client before the money',
  booking.clientName === undefined);

await C('bookings').doc(booking.id).delete();

console.log(bad === 0 ? '\nall good' : `\n${bad} failed`);
process.exit(bad === 0 ? 0 : 1);
