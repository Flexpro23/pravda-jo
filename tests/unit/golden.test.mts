/**
 * Two whole sheets, pinned.
 *
 * Every other unit test holds one module to one behaviour. Nothing holds the
 * *composition* — the shape of the document and the exact prose in it — and a
 * refactor can keep all of them green while changing the sentence a business
 * owner actually reads. These two fixtures are that check: a typical prospect
 * and a hard one, composed with a fixed clock and a fixed token, compared byte
 * for byte.
 *
 * The point is not to block a prose change. It is to make one visible: run
 *
 *   UPDATE_GOLDEN=1 npm run test:unit
 *
 * and the diff appears in the pull request where somebody can read it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { composeSheet } from '@/lib/teardown/run';
import { computeSignals } from '@/lib/teardown/signals';
import { parseSite, type SiteRead } from '@/lib/meta/website';
import type { Profile, Media } from '@/lib/meta/discovery';
import type { Talent } from '@/lib/data/deals';
import type { Web } from '@/lib/teardown/findings';
import { mkMedia, ammanIso } from './_mk.mts';

const UPDATE = process.env.UPDATE_GOLDEN === '1';
const NOW_ISO = '2026-09-06T09:00:00.000Z';
const NOW = +new Date(NOW_ISO);

const ROSTER: Talent[] = JSON.parse(
  readFileSync(new URL('../fixtures/roster.json', import.meta.url), 'utf8'));

const PLACEHOLDERS = new Set(ROSTER.filter((t) => t.placeholder).map((t) => t.id));

const site = (file: string): SiteRead => {
  const html = readFileSync(new URL(`../fixtures/sites/${file}`, import.meta.url), 'utf8');
  const finalUrl = 'https://mataam-alnoor.jo/';
  return {
    ...parseSite(html, finalUrl),
    url: finalUrl, finalUrl,
    ok: true, status: 200,
    // Fixed rather than measured: this is a fixture of a read, not a read.
    ms: 1_480, msSamples: [2_310, 1_480, 1_520], msCold: 2_310, ttfbMs: 940,
    bytes: 61_400, truncated: false,
    https: true, scheme: 'https', httpRedirectsToHttps: true,
    hasRobots: true, hasSitemap: false,
  };
};

const profileOf = (p: Partial<Profile> & { username: string; media: Media[] }): Profile => ({
  followers_count: 0, media_count: p.media.length, ...p,
});

/** A restaurant with a real account, a real site, and no pixel on it. */
function typical() {
  const media = [
    ...mkMedia({
      n: 24, from: ammanIso('2026-06-01', 13), everyHours: 30,
      likes: [41, 28, 63, 19, 52, 34], comments: [2, 1, 4, 0, 3, 1],
      type: 'IMAGE',
      caption: [
        'منسف اليوم جاهز 🔥 احجزوا طاولتكم',
        'شاورما على الفحم، من الساعة ١٢',
        'قهوة الصباح عنا',
      ],
      id: 'a',
    }),
    ...mkMedia({
      n: 16, from: ammanIso('2026-07-25', 20), everyHours: 26,
      likes: [88, 120, 74, 96], comments: [6, 9, 4, 7],
      type: 'VIDEO', product: 'REELS',
      caption: [
        'جولة بالمطبخ 👨‍🍳',
        'كيف بنعمل الحمص؟',
        'زبونة بتحكي عن التجربة',
      ],
      id: 'b',
    }),
  ];
  const profile = profileOf({
    username: 'mataam.alnoor',
    name: 'مطعم النور',
    followers_count: 8_400,
    follows_count: 310,
    media_count: 486,
    biography: 'مطعم وكافيه بعمّان · منسف، شاورما، حلويات · توصيل يومي',
    website: 'https://mataam-alnoor.jo',
    profile_picture_url: 'https://scontent.cdninstagram.com/v/alnoor.jpg',
    media,
  });
  const signals = computeSignals(
    profile.username, profile.followers_count, media, 100,
    { biography: profile.biography, website: profile.website, mediaCount: profile.media_count },
    NOW,
  )!;
  return {
    handle: profile.username,
    profile, signals,
    site: site('salla-no-pixel.html'),
    web: { state: 'read' } as Web,
    roster: ROSTER,
    vertical: null,
    website: 'https://mataam-alnoor.jo',
  };
}

/** Hidden like counts, no website at all, and nothing posted since spring. */
function hard() {
  const media = mkMedia({
    n: 14, from: ammanIso('2026-01-08', 22), everyHours: 96,
    likes: null, comments: [3, 0, 1, 5],
    type: 'IMAGE',
    caption: [
      'صالون سمر · حجز مسبق',
      'عرض هذا الشهر على البشرة',
      'مواعيدنا من ١٠ للـ ٨',
    ],
    id: 'h',
  });
  const profile = profileOf({
    username: 'salon.samar.amman',
    name: 'صالون سمر',
    followers_count: 1_950,
    follows_count: 2_400,
    media_count: 14,
    biography: 'صالون تجميل وعناية بالبشرة · عمّان',
    media,
  });
  const signals = computeSignals(
    profile.username, profile.followers_count, media, 100,
    { biography: profile.biography, mediaCount: profile.media_count },
    NOW,
  )!;
  return {
    handle: profile.username,
    profile, signals,
    site: null,
    web: { state: 'no-url' } as Web,
    roster: ROSTER,
    vertical: null,
    website: null,
  };
}

const CASES = [
  { name: 'typical', input: typical(), token: 'GOLDENTYPICAL' },
  { name: 'hard', input: hard(), token: 'GOLDENHARDCASE' },
];

/**
 * Every `ar` string in the document, with the things that are legitimately
 * Latin taken out first.
 *
 * A URL, an Instagram handle and a bare domain are Latin identifiers wherever
 * they appear — D13 says so — and stripping them is what stops this check from
 * being a check on whether anybody mentioned a website.
 */
function arabicStrings(node: unknown, out: string[] = []): string[] {
  if (Array.isArray(node)) {
    for (const v of node) arabicStrings(v, out);
  } else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (k === 'ar' && typeof v === 'string') out.push(v);
      else arabicStrings(v, out);
    }
  }
  return out;
}

const stripLatinIdentifiers = (s: string) => s
  .replace(/https?:\/\/\S+/g, ' ')
  .replace(/@[A-Za-z0-9_.]+/g, ' ')
  .replace(/\b[A-Za-z0-9-]+\.(?:com|jo|net|org|co)\b/g, ' ');

/**
 * The `ar` strings the engine itself writes, which is a narrower set than every
 * `ar` string in the document.
 *
 * A concept name and its hook reach the sheet in English by design — the sheet
 * isolates them with `dir` and `lang` rather than translating them — so a
 * blanket "no Latin letters in Arabic" sweep would fail on the one place Latin
 * is correct. The ledger and the charts are ours end to end, and a Latin word
 * in one of those is a formatter that was never given an Arabic register:
 * "45d" for a dormancy, "3 months" on an Arabic chip, "%" for ٪.
 */
function ledgerArabic(sheet: { findings: { findings: unknown[]; charts: unknown[] } }): string[] {
  return arabicStrings([sheet.findings.findings, sheet.findings.charts]);
}

for (const { name, input, token } of CASES) {
  const file = new URL(`../fixtures/golden/${name}.json`, import.meta.url);

  test(`golden: ${name}`, () => {
    const sheet = composeSheet(input, { now: NOW_ISO, token });
    const json = `${JSON.stringify(sheet, null, 2)}\n`;

    if (UPDATE) {
      mkdirSync(new URL('../fixtures/golden/', import.meta.url), { recursive: true });
      writeFileSync(file, json);
    }
    const expected = readFileSync(file, 'utf8');
    assert.equal(json, expected,
      `the composed sheet changed. If that was deliberate: UPDATE_GOLDEN=1 npm run test:unit`);
  });

  test(`golden: ${name} is stable across two calls`, () => {
    const a = JSON.stringify(composeSheet(input, { now: NOW_ISO, token }));
    const b = JSON.stringify(composeSheet(input, { now: NOW_ISO, token }));
    assert.equal(a, b);
  });

  test(`golden: ${name} carries no half-written prose`, () => {
    const json = JSON.stringify(composeSheet(input, { now: NOW_ISO, token }));
    // `⟦…⟧` is the repo's mark for copy a human still owes. A finding is
    // either finished or absent; it is never a placeholder on a client's page.
    assert.ok(!json.includes('⟦'), 'a ⟦placeholder⟧ reached the sheet');
  });

  test(`golden: ${name} writes Arabic in Arabic digits`, () => {
    const sheet = composeSheet(input, { now: NOW_ISO, token });
    for (const s of arabicStrings(sheet)) {
      const bare = stripLatinIdentifiers(s);
      assert.ok(!/[0-9]/.test(bare), `Latin digits in an Arabic string: ${s}`);
    }
  });

  test(`golden: ${name} writes the ledger in Arabic words, not English ones`, () => {
    const sheet = composeSheet(input, { now: NOW_ISO, token });
    for (const s of ledgerArabic(sheet)) {
      const bare = stripLatinIdentifiers(s);
      assert.ok(!/[A-Za-z]/.test(bare), `Latin letters in an Arabic string: ${s}`);
      assert.ok(!bare.includes('%'), `a Latin % where ٪ belongs: ${s}`);
    }
  });

  test(`golden: ${name} casts nobody who does not exist`, () => {
    const sheet = composeSheet(input, { now: NOW_ISO, token });
    for (const r of sheet.recommendations) {
      for (const c of r.cast) {
        assert.ok(!PLACEHOLDERS.has(c.talentId),
          `#${r.conceptN} cast the placeholder ${c.talentId}`);
      }
    }
  });
}

/**
 * The seam that makes all of the above possible.
 *
 * `composeSheet` lives in the same file as `runRead`, which does talk to Meta,
 * to a stranger's web server and to Firestore — so the guarantee has to be
 * asserted rather than assumed. Value imports only: `import type` is erased
 * before anything runs and pulls in no code, and `node:crypto` is refused
 * either way because a random token is the other half of what makes a sheet
 * unreproducible.
 */
test('composeSheet is composed with no store and no clock', () => {
  const src = readFileSync(new URL('../../lib/teardown/run.ts', import.meta.url), 'utf8');
  const specs = [...src.matchAll(/^import\b([^;]*?)from\s+'([^']+)';/gm)]
    .map(([, clause, spec]) => ({ typeOnly: /^\s*type\b/.test(clause), spec }));

  assert.ok(specs.length > 0, 'no import statements were found — the regex is wrong');
  for (const { typeOnly, spec } of specs) {
    assert.notEqual(spec, 'node:crypto', 'run.ts reaches for a random number');
    if (!typeOnly) {
      assert.ok(!spec.startsWith('@/lib/store'),
        `run.ts imports the store at load time: ${spec}`);
    }
  }
});
