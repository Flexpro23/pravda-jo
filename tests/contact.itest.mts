/**
 * A lead's name and phone number, which are the only two things on the record
 * that cannot be recomputed.
 *
 * The bug: `openClient` wrote whatever it was handed, so the console re-reading
 * a handle with the contact fields empty — which is exactly what a re-run looks
 * like — erased the name and number a real person had typed into the public
 * form. Everything else on the account can be produced again by running the
 * engine. These two cannot; once they are gone the lead is a handle nobody can
 * answer, and it fails silently, because a client with a blank phone number
 * looks identical to a client who never gave one.
 *
 * The rule, asserted below: a non-empty detail always wins, because somebody
 * filling the form again is usually correcting their own typo. An empty one is
 * never a detail — it is a form nobody filled — and must never overwrite.
 *
 *   JAVA_HOME=$(/usr/libexec/java_home -v 21) npx firebase-tools emulators:exec \
 *     --only firestore "node --experimental-strip-types --import ./tests/register.mjs tests/contact.itest.mts"
 */
process.env.FIRESTORE_COLLECTION_PREFIX = '_itest_';
process.env.GOOGLE_CLOUD_PROJECT = 'pravda-jo';

const C = await import('../lib/store/clients.ts');
const { store } = await import('../lib/store/firebase.ts');

const db = store();
const PREFIX = process.env.FIRESTORE_COLLECTION_PREFIX ?? '';
if (!PREFIX.startsWith('_itest')) {
  console.error('refusing to run without an _itest_ collection prefix');
  process.exit(2);
}

let bad = 0;
const ok = (n: string, c: boolean, x = '') => {
  if (!c) bad++;
  console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}${x ? '  ' + x : ''}`);
};

const clients = db.collection(`${PREFIX}clients`);
const HANDLE = 'itestcontactshop';
await clients.doc(HANDLE).delete().catch(() => {});

// ── a real person fills the public form ─────────────────────────────────────
console.log('\n══ the lead arrives with a name and a number ══');

const first = await C.openClient({
  handle: `@${HANDLE}`, contactName: 'Abu Sami', contactPhone: '0791234567',
  website: 'abusami.jo', lang: 'ar', source: 'intake',
});
ok('the account opens', !!first);
ok('  with the name', first?.client.contactName === 'Abu Sami', first?.client.contactName);
ok('  and the number', first?.client.contactPhone === '0791234567', first?.client.contactPhone);

// ── the console re-reads the same handle with nothing typed in ──────────────
console.log('\n══ a console re-read with empty fields erases nothing ══');

const rerun = await C.openClient({
  handle: HANDLE, contactName: '', contactPhone: '', lang: 'ar', source: 'operator',
});
ok('the re-read returns the same account', rerun?.client.id === HANDLE);
ok('  and says it is not new', rerun?.created === false);
ok('  the name survived', rerun?.client.contactName === 'Abu Sami',
  `"${rerun?.client.contactName}"`);
ok('  the number survived', rerun?.client.contactPhone === '0791234567',
  `"${rerun?.client.contactPhone}"`);

const stored = await C.getClient(HANDLE);
ok('  and the stored document agrees, not just the returned object',
  stored?.contactName === 'Abu Sami' && stored?.contactPhone === '0791234567',
  `${stored?.contactName} / ${stored?.contactPhone}`);
ok('  the source is not rewritten either — they arrived through the form',
  stored?.source === 'intake', stored?.source);

// Whitespace is not a detail. A field holding two spaces is an empty field.
const blank = await C.openClient({
  handle: HANDLE, contactName: '   ', contactPhone: '  ', lang: 'ar', source: 'operator',
});
ok('a whitespace-only field is treated as empty',
  blank?.client.contactName === 'Abu Sami' && blank?.client.contactPhone === '0791234567',
  `${blank?.client.contactName} / ${blank?.client.contactPhone}`);

// ── they come back and correct their own typo ───────────────────────────────
console.log('\n══ a non-empty detail always wins ══');

const corrected = await C.openClient({
  handle: HANDLE, contactName: 'Abu Sami Odeh', contactPhone: '0797654321',
  lang: 'en', source: 'intake',
});
ok('the corrected name is taken', corrected?.client.contactName === 'Abu Sami Odeh',
  corrected?.client.contactName);
ok('  and the corrected number', corrected?.client.contactPhone === '0797654321',
  corrected?.client.contactPhone);
ok('  the language they came back in is taken too', corrected?.client.lang === 'en');
ok('  and the history is untouched', corrected?.client.createdAt === first?.client.createdAt);

// ── but only while the account is still the engine's ────────────────────────
console.log('\n══ past `ready`, the form no longer owns the contact ══');

// The form is unauthenticated. Anybody who knows a business's Instagram handle
// can submit it, so once Khaled has sent a sheet — and has been calling that
// number — a stranger typing their own phone number into the public page must
// not redirect the conversation. The submission is kept, in the margin, where
// a person decides what it is.
await C.forceClientStatus(HANDLE, 'sent');
const hijack = await C.openClient({
  handle: HANDLE, contactName: 'Somebody Else', contactPhone: '0788888888',
  lang: 'ar', source: 'intake',
});
ok('the stored name stands', hijack?.client.contactName === 'Abu Sami Odeh',
  hijack?.client.contactName);
ok('  and the stored number stands', hijack?.client.contactPhone === '0797654321',
  hijack?.client.contactPhone);

const noted = await C.getClient(HANDLE);
const last = noted?.notes?.[(noted?.notes?.length ?? 1) - 1];
ok('  what was offered is written into the margin instead',
  last?.by === 'system' && !!last?.text.includes('0788888888') && !!last?.text.includes('Somebody Else'),
  JSON.stringify(last));
ok('  and the status did not move', noted?.status === 'sent', noted?.status);

// A resubmission that says nothing new leaves no note behind, or a sent client
// gets a margin entry every time somebody reloads the form.
const before = noted?.notes?.length ?? 0;
await C.openClient({
  handle: HANDLE, contactName: 'Abu Sami Odeh', contactPhone: '0797654321',
  lang: 'ar', source: 'intake',
});
ok('  a resubmission of the same details writes no note',
  (await C.getClient(HANDLE))?.notes?.length === before,
  String((await C.getClient(HANDLE))?.notes?.length));

// Back to the engine's half of the pipeline and the newer detail wins again.
await C.forceClientStatus(HANDLE, 'failed', 'unreadable');
const reopened = await C.openClient({
  handle: HANDLE, contactName: 'Abu Sami Odeh', contactPhone: '0791111111',
  lang: 'ar', source: 'intake',
});
ok('a failed lead takes a corrected number again',
  reopened?.client.contactPhone === '0791111111', reopened?.client.contactPhone);
await C.setClientContact(HANDLE, { contactPhone: '0797654321' });

// ── the operator fixes a number by hand ─────────────────────────────────────
console.log('\n══ the console can fix a number without touching anything else ══');

await C.attachToClient(HANDLE, 'sheet', 'tok-contact');
await C.forceClientStatus(HANDLE, 'sent');

const fixed = await C.setClientContact(HANDLE, { contactPhone: '0790000001' });
ok('the number is fixed', fixed?.contactPhone === '0790000001', fixed?.contactPhone);
ok('  the name is left alone', fixed?.contactName === 'Abu Sami Odeh', fixed?.contactName);
ok('  the status is left alone', fixed?.status === 'sent', fixed?.status);
ok('  and the sheet history is left alone',
  fixed?.sheetTokens[0] === 'tok-contact', JSON.stringify(fixed?.sheetTokens));

const noop = await C.setClientContact(HANDLE, { contactName: '', contactPhone: '' });
ok('an edit with nothing in it changes nothing',
  noop?.contactName === 'Abu Sami Odeh' && noop?.contactPhone === '0790000001',
  `${noop?.contactName} / ${noop?.contactPhone}`);

// ── cleanup ─────────────────────────────────────────────────────────────────
await clients.doc(HANDLE).delete().catch(() => {});

console.log(bad ? `\n${bad} failed.` : '\nall good');
process.exit(bad ? 1 : 0);
