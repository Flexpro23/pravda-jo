/**
 * The library's photographs, held to what PDPL requires of them.
 *
 * Two kinds of test live here. The consent rules are pure functions and are
 * tested directly. The last test is different: it asserts something the
 * recommender must NOT do, which no amount of reading its code proves. PDPL
 * Art. 4(c) forbids any consequence for withdrawing consent, so a model who
 * takes her photos off the website must be cast exactly as she was before —
 * and the only reliable way to know that stays true is to run the recommender
 * both ways and compare.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  consentLive, mayShow, coverFor, addMonths, latestConsent,
  type Consent, type TalentImage,
} from '@/lib/data/media';
import { cleanAttributes, fieldsFor, FIELDS } from '@/lib/data/talentFields';
import { DISCIPLINE_RATE, type Talent, type TalentDiscipline } from '@/lib/data/deals';
import { recommend } from '@/lib/teardown/recommend';
import type { Findings } from '@/lib/teardown/findings';

const T0 = new Date('2026-09-13T12:00:00Z');
const day = 86_400_000;
const iso = (d: Date) => d.toISOString();

const grant = (purpose: Consent['purpose'], o: Partial<Consent> = {}): Consent => ({
  purpose,
  grantedAt: iso(new Date(+T0 - day)),
  expiresAt: iso(addMonths(T0, 12)),
  evidence: 'signed release in the drive',
  ...o,
});

const img = (o: Partial<TalentImage> = {}): TalentImage => ({
  id: 'a', path: 'talent/x/a.jpg', contentType: 'image/jpeg', bytes: 1000,
  uploadedAt: iso(T0), ...o,
});

// ── consent ─────────────────────────────────────────────────────────────────

test('no consent on file means no consent', () => {
  assert.equal(consentLive(undefined, 'roster', T0), false);
  assert.equal(consentLive([], 'website', T0), false);
});

test('a live grant is live, and only for its own purpose', () => {
  const c = [grant('roster')];
  assert.equal(consentLive(c, 'roster', T0), true);
  assert.equal(consentLive(c, 'website', T0), false, 'roster consent is not website consent');
});

test('consent expires on its date', () => {
  const c = [grant('website', { expiresAt: iso(new Date(+T0 + day)) })];
  assert.equal(consentLive(c, 'website', T0), true);
  assert.equal(consentLive(c, 'website', new Date(+T0 + 2 * day)), false);
});

test('a withdrawal ends it, from the moment it is recorded', () => {
  const c = [grant('website', { withdrawnAt: iso(T0) })];
  assert.equal(consentLive(c, 'website', new Date(+T0 - 1000)), true, 'live before the withdrawal');
  assert.equal(consentLive(c, 'website', T0), false);
});

test('a renewal supersedes an expired grant', () => {
  const c = [
    grant('website', { grantedAt: iso(new Date(+T0 - 400 * day)), expiresAt: iso(new Date(+T0 - 35 * day)) }),
    grant('website', { grantedAt: iso(new Date(+T0 - day)) }),
  ];
  assert.equal(consentLive(c, 'website', T0), true);
  assert.equal(latestConsent(c, 'website')?.grantedAt, iso(new Date(+T0 - day)));
});

test('a consent dated in the future is not yet live', () => {
  const c = [grant('roster', { grantedAt: iso(new Date(+T0 + day)) })];
  assert.equal(consentLive(c, 'roster', T0), false);
});

// ── who may see a photo ─────────────────────────────────────────────────────

test('the console shows nothing without roster consent', () => {
  assert.equal(mayShow({ consents: [] }, img(), 'roster', T0), false);
  assert.equal(mayShow({ consents: [grant('roster')] }, img(), 'roster', T0), true);
});

test('a client sees a photo only with roster AND clients consent', () => {
  assert.equal(mayShow({ consents: [grant('clients')] }, img(), 'clients', T0), false,
    'clients consent alone is not enough: we must also be allowed to hold the photo');
  assert.equal(mayShow({ consents: [grant('roster'), grant('clients')] }, img(), 'clients', T0), true);
});

test('the website needs consent AND an operator choosing that photo', () => {
  const both = [grant('roster'), grant('website')];
  assert.equal(mayShow({ consents: both }, img(), 'website', T0), false, 'not chosen for the website');
  assert.equal(mayShow({ consents: both }, img({ onWebsite: true }), 'website', T0), true);
  assert.equal(mayShow({ consents: [grant('roster')] }, img({ onWebsite: true }), 'website', T0), false,
    'chosen, but the person never agreed to the website');
});

test('the cover is the chosen one if it may be shown, else the first that may', () => {
  const person = {
    consents: [grant('roster')],
    images: [img({ id: 'a' }), img({ id: 'b', cover: true })],
  };
  assert.equal(coverFor(person, 'roster', T0)?.id, 'b');
  assert.equal(coverFor({ ...person, consents: [] }, 'roster', T0), null);
});

// ── the comp-card fields ────────────────────────────────────────────────────

test('every discipline, including photographer, has a field list', () => {
  for (const d of Object.keys(DISCIPLINE_RATE) as TalentDiscipline[]) {
    assert.ok(Array.isArray(FIELDS[d]), `${d} has no fields`);
    assert.ok(fieldsFor(d).length > 0);
  }
});

test('attributes are cleaned to their declared shape, and out-of-range numbers dropped', () => {
  const a = cleanAttributes('model', {
    heightCm: '160cm', shoeEu: 37, weightKg: 6400, size: 'M', bustCm: '',
    languages: 'Arabic, English', notAField: 'dropped', drone: true,
  });
  assert.equal(a.heightCm, 160, 'units stripped');
  assert.equal(a.shoeEu, 37);
  assert.equal(a.weightKg, undefined, 'a weight of 6400 is a typo, not a value to store');
  assert.equal(a.size, 'M');
  assert.equal(a.bustCm, undefined, 'blank stays absent rather than becoming zero');
  assert.deepEqual(a.languages, ['Arabic', 'English']);
  assert.equal(a.notAField, undefined);
  assert.equal(a.drone, undefined, 'a videographer field does not survive on a model');
});

test('a choice outside its options is refused', () => {
  assert.equal(cleanAttributes('model', { size: 'ENORMOUS' }).size, undefined);
});

test('a photographer has no published rate, so cannot be booked', () => {
  // Zero is the absence of a rate, not a price. The recommender filters on it.
  assert.equal(DISCIPLINE_RATE.photographer, 0);
});

// ── PDPL Art. 4(c): withdrawing consent may carry no consequence ────────────

test('the recommender casts identically with or without photos and consent', () => {
  const roster: Talent[] = JSON.parse(
    readFileSync(new URL('../fixtures/roster.json', import.meta.url), 'utf8'));
  const fx: Findings = {
    findings: ['ig-ask', 'web-none', 'ig-engagement'].map((id) => ({
      id, severity: 'critical', source: 'instagram',
      title: { ar: '', en: '' }, detail: { ar: '', en: '' }, provenance: { ar: '', en: '' },
    })),
    charts: [], read: { posts: 30, site: true, adsChecked: false },
  };

  const bare = recommend(fx, roster, 'food', 5);

  // Everyone gets photos and every consent there is.
  const photographed = roster.map((t) => ({
    ...t,
    images: [img({ id: `${t.id}-1`, cover: true, onWebsite: true }), img({ id: `${t.id}-2` })],
    consents: [grant('roster'), grant('clients'), grant('website')],
  }));
  // And the opposite: every consent withdrawn.
  const withdrawn = photographed.map((t) => ({
    ...t, consents: t.consents.map((c) => ({ ...c, withdrawnAt: iso(T0) })),
  }));
  // And a mix, so a ranking that preferred the photographed would show.
  const mixed = roster.map((t, i) => (i % 2 ? photographed[i] : withdrawn[i]));

  assert.deepEqual(recommend(fx, photographed, 'food', 5), bare,
    'having photos or consent must not change who is cast');
  assert.deepEqual(recommend(fx, withdrawn, 'food', 5), bare,
    'withdrawing consent must not change who is cast');
  assert.deepEqual(recommend(fx, mixed, 'food', 5), bare,
    'a roster half with photos and half without must cast as if none had any');
});

test('the recommender does not read the photo module at all', () => {
  // The structural half of the guarantee above. A behavioural test can only
  // cover the inputs it tries; an import is how a future ranking tweak would
  // start reading consent, so the import is what is forbidden.
  const src = readFileSync(new URL('../../lib/teardown/recommend.ts', import.meta.url), 'utf8');
  assert.ok(!/from '@\/lib\/data\/media'/.test(src), 'recommend.ts must not import lib/data/media');
  assert.ok(!/\bimages\b|\bconsents\b/.test(src), 'recommend.ts must not read images or consents');
});
