/**
 * The sentences a stranger reads, and the arithmetic each one is allowed to
 * rest on.
 *
 * Two kinds of test live here. The first kind pins a specific defect that
 * reached a real fixture: a website finding written about a site we never read,
 * a conflict between two windows that shared an hour, "0 reactions against
 * 10,000 followers" printed because Instagram declined to tell us the likes.
 * The second kind is a property swept across every fixture — a `good` finding
 * always exists, no Arabic string carries a Latin digit, no copy carries a
 * half-written `⟦…⟧` placeholder — because those are invariants of the
 * document rather than of any one case.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Media } from '@/lib/meta/discovery';
import type { SiteRead } from '@/lib/meta/website';
import { computeSignals, type Signals } from '@/lib/teardown/signals';
import { RECENT_DAYS } from '@/lib/teardown/signals';
import { arNum } from '@/lib/format/num';
import {
  buildFindings, engagementBasis, THRESHOLDS as T, span, months, clock,
  type Web, type Finding,
} from '@/lib/teardown/findings';
import { mkMedia, ammanIso } from './_mk.mts';

const NOW = +new Date('2026-09-06T09:00:00.000Z');
const DAY = 86_400_000;
const at = (daysAgo: number) => new Date(NOW - daysAgo * DAY).toISOString();

const sig = (
  media: Media[],
  followers = 10_000,
  profile: { biography?: string; website?: string; mediaCount?: number } | null = null,
) => {
  const s = computeSignals('acme', followers, media, 100, profile, NOW);
  assert.ok(s, 'expected signals');
  return s;
};

const load = (name: string): Media[] =>
  JSON.parse(readFileSync(`tests/fixtures/media/${name}.json`, 'utf8'));

/** A site with nothing on it. Each test turns on only the fact it is about. */
const mkSite = (o: Partial<SiteRead> = {}): SiteRead => ({
  url: 'https://acme.jo/', finalUrl: 'https://acme.jo/', ok: true, status: 200,
  ms: 800, bytes: 40_000, https: true, hasArabic: false, mobileReady: false,
  metaPixel: false, googleAnalytics: false, gtm: false, tiktokPixel: false,
  whatsapp: false, telLink: false, mailto: false, form: false, showsPrice: false,
  ogImage: false, ...o,
});

const PERFECT = mkSite({
  metaPixel: true, mobileReady: true, whatsapp: true, showsPrice: true,
  hasArabic: true, lang: 'ar', ms: 600,
});

const READ: Web = { state: 'read' };
const NO_URL: Web = { state: 'no-url' };

const ids = (f: Finding[]) => f.map((x) => x.id);
const by = (f: Finding[], id: string) => f.find((x) => x.id === id);

// ── the fixtures every property is swept across ─────────────────────────────

const HEALTHY = () => sig([
  ...mkMedia({ n: 30, from: at(29), likes: [40, 60, 55, 120, 45], comments: [2, 4, 3, 9, 1], caption: 'للحجز والاستفسار ٠٧٩٥٥٥٤٤٣٣ — منتجاتنا الجديدة وصلت للفرع الجديد وبنستناكم من الصبح' }),
], 12_000);

type Fx = { name: string; s: Signals; site: SiteRead | null; web: Web };

const FIXTURES = (): Fx[] => [
  {
    name: 'dull account, monthly, no site',
    s: sig(mkMedia({ n: 10, from: at(270), everyHours: 720, likes: 3, comments: 0, caption: 'صورة من المحل' })),
    site: null, web: NO_URL,
  },
  { name: 'hidden likes', s: sig(load('hidden-likes'), 10_000), site: PERFECT, web: READ },
  {
    name: 'single format',
    s: sig(mkMedia({ n: 30, from: at(120), everyHours: 96, type: 'VIDEO', product: 'REELS', likes: [80, 90, 70, 200], comments: 3 })),
    site: null, web: NO_URL,
  },
  {
    name: 'two-post minimum',
    s: sig(mkMedia({ n: 2, from: at(3), likes: 1, comments: 0 }), 500),
    site: null, web: NO_URL,
  },
  { name: 'healthy, no site', s: HEALTHY(), site: null, web: NO_URL },
  { name: 'error-page site', s: HEALTHY(), site: mkSite({ status: 503 }), web: { state: 'error-page', status: 503 } },
  { name: 'unreadable site', s: HEALTHY(), site: null, web: { state: 'unreadable', reason: 'unreachable' } },
  { name: 'perfect site', s: HEALTHY(), site: PERFECT, web: READ },
  {
    name: 'burst account',
    s: sig(mkMedia({ n: 40, from: at(730), everyHours: 54 / 40, likes: 5, comments: 1, caption: 'من كواليس التصوير' })),
    site: null, web: NO_URL,
  },
  {
    name: 'dormant account',
    s: sig(mkMedia({ n: 20, from: at(240), likes: 30, comments: 2, caption: 'صباح الخير' })),
    site: mkSite({ ms: 6000 }), web: READ,
  },
  {
    name: 'captionless account',
    s: sig(mkMedia({ n: 20, from: at(200), everyHours: 240, likes: [10, 10, 10, 10, 50], comments: 0, caption: null })),
    site: null, web: NO_URL,
  },
  {
    name: 'zero-follower account',
    s: sig(mkMedia({ n: 30, from: at(30), likes: [12, 20, 15, 60], comments: 1, caption: 'اطلبوا من الرابط بالبايو' }), 0),
    site: null, web: NO_URL,
  },
  {
    name: 'one post per quarter',
    s: sig(mkMedia({ n: 6, from: at(540), everyHours: 90 * 24, likes: 8, comments: 0, caption: 'تحديث' })),
    site: null, web: NO_URL,
  },
  {
    name: 'empty bio',
    s: sig(mkMedia({ n: 12, from: at(60), likes: 20, comments: 1 }), 3_000, { biography: '   ' }),
    site: null, web: NO_URL,
  },
];

// ── properties ──────────────────────────────────────────────────────────────

test('every fixture leaves the reader something that is working', () => {
  for (const fx of FIXTURES()) {
    const out = buildFindings(fx.s, fx.site, fx.web);
    const good = out.findings.filter((x) => x.severity === 'good');
    assert.ok(good.length >= 1, `${fx.name}: no good finding — ${ids(out.findings).join(', ')}`);
    assert.ok(good.length <= T.GOOD_MAX, `${fx.name}: ${good.length} good findings`);
  }
});

test('no copy anywhere carries a half-written placeholder', () => {
  for (const fx of FIXTURES()) {
    const out = buildFindings(fx.s, fx.site, fx.web);
    for (const x of out.findings) {
      for (const t of [x.title.ar, x.title.en, x.detail.ar, x.detail.en, x.provenance.ar, x.provenance.en]) {
        assert.ok(!t.includes('⟦'), `${fx.name} · ${x.id}: ${t}`);
        assert.ok(t.trim().length > 0, `${fx.name} · ${x.id}: empty string`);
      }
    }
  }
});

test('Arabic copy carries no Latin digits and no Latin separators between digits', () => {
  for (const fx of FIXTURES()) {
    const out = buildFindings(fx.s, fx.site, fx.web);
    for (const x of out.findings) {
      for (const t of [x.title.ar, x.detail.ar, x.provenance.ar]) {
        assert.ok(!/[0-9]/.test(t), `${fx.name} · ${x.id}: Latin digit in "${t}"`);
        assert.ok(!/[٠-٩][.,][٠-٩]/.test(t), `${fx.name} · ${x.id}: Latin separator in "${t}"`);
      }
      for (const t of [x.title.ar, x.detail.ar, x.provenance.ar, x.title.en, x.detail.en, x.provenance.en]) {
        assert.ok(!/\b0\s+(months|weeks?|شهر|شهور|أسابيع|أسبوع)\b/.test(t), `${fx.name} · ${x.id}: "${t}"`);
        assert.ok(!/٠\s+(شهر|شهور|أسابيع|أسبوع)/.test(t), `${fx.name} · ${x.id}: "${t}"`);
      }
    }
  }
});

test('every ٪ follows its numeral', () => {
  for (const fx of FIXTURES()) {
    const out = buildFindings(fx.s, fx.site, fx.web);
    for (const x of out.findings) {
      for (const t of [x.title.ar, x.detail.ar, x.provenance.ar]) {
        for (let i = 0; i < t.length; i++) {
          if (t[i] === '٪') assert.ok(/[٠-٩]/.test(t[i - 1] ?? ''), `${fx.name} · ${x.id}: "${t}"`);
        }
      }
    }
  }
});

test('findings are ordered critical, then notable, then what works', () => {
  const rank = { critical: 0, notable: 1, good: 2 } as const;
  for (const fx of FIXTURES()) {
    const out = buildFindings(fx.s, fx.site, fx.web);
    const r = out.findings.map((x) => rank[x.severity]);
    assert.deepEqual(r, [...r].sort((a, b) => a - b), fx.name);
  }
});

test('the hours chart always covers all 24 hours', () => {
  for (const fx of FIXTURES()) {
    const out = buildFindings(fx.s, fx.site, fx.web);
    const hours = out.charts.find((c) => c.id === 'hours');
    assert.ok(hours && hours.kind === 'hours');
    assert.equal(hours.byHour.length, 24);
  }
});

// ── the website's four states ───────────────────────────────────────────────

test('web-none fires only when there is no URL at all', () => {
  const s = HEALTHY();
  const states: Web[] = [
    NO_URL, { state: 'unreadable', reason: 'unreachable' },
    { state: 'error-page', status: 503 }, READ,
  ];
  for (const web of states) {
    const site = web.state === 'read' ? PERFECT : web.state === 'error-page' ? mkSite({ status: 503 }) : null;
    const out = buildFindings(s, site, web);
    const noSite = out.findings.some((x) => x.detail.ar.includes('ما في موقع نوصل عليه')
      || x.title.ar.includes('ما في موقع'));
    assert.equal(noSite, web.state === 'no-url', `state ${web.state}`);
    assert.equal(ids(out.findings).includes('web-none'), web.state === 'no-url');
  }
});

test('a site we could not read produces an operator note and no client finding', () => {
  const out = buildFindings(HEALTHY(), null, { state: 'unreadable', reason: 'unreachable' });
  assert.equal(out.findings.filter((x) => x.source === 'website').length, 0);
  assert.equal(out.operatorNotes.length, 1);
  assert.equal(out.operatorNotes[0].id, 'web-unreadable');
  assert.ok(out.operatorNotes[0].en.includes('unreachable'));
  assert.equal(out.read.site, false);
});

test('an error page is not audited as if it were their site', () => {
  const out = buildFindings(HEALTHY(), mkSite({ status: 503 }), { state: 'error-page', status: 503 });
  assert.equal(out.findings.filter((x) => x.source === 'website').length, 0);
  assert.equal(out.operatorNotes[0].id, 'web-error-page');
  assert.ok(out.operatorNotes[0].en.includes('503'));
});

test('a site we did read is audited exactly as before', () => {
  const bare = buildFindings(HEALTHY(), mkSite(), READ);
  const got = ids(bare.findings);
  for (const id of ['web-pixel', 'web-mobile', 'web-whatsapp', 'web-price']) {
    assert.ok(got.includes(id), `missing ${id}`);
  }
  assert.equal(bare.operatorNotes.length, 0);
  assert.equal(bare.read.site, true);
});

// ── hidden likes ────────────────────────────────────────────────────────────

test('an account that hides its likes is not accused of having none', () => {
  const out = buildFindings(sig(load('hidden-likes'), 10_000), PERFECT, READ);
  assert.equal(out.findings.filter((x) => x.severity === 'critical').length, 0,
    ids(out.findings.filter((x) => x.severity === 'critical')).join(', '));
  for (const x of out.findings) assert.ok(!x.detail.en.includes('0 reactions'), x.detail.en);
  assert.ok(ids(out.findings).includes('ig-likes-hidden'));
  assert.equal(by(out.findings, 'ig-likes-hidden')?.severity, 'notable');
  // Nothing that rests on engagement may be said.
  for (const id of ['ig-engagement', 'ig-format', 'ig-window', 'ig-best']) {
    assert.ok(!ids(out.findings).includes(id), `${id} fired on unknown engagement`);
  }
  assert.equal(out.charts.some((c) => c.id === 'formats'), false);
});

// ── the engagement sentence ─────────────────────────────────────────────────

test('the stated percentage is the median rate, recomputed from the same signals', () => {
  const s = sig([
    ...mkMedia({ n: 29, from: at(300), likes: 10, comments: 0, id: 'a' }),
    ...mkMedia({ n: 1, from: at(200), likes: 3000, comments: 0, id: 'b' }),
  ], 10_000);
  const out = buildFindings(s, null, NO_URL);
  const e = by(out.findings, 'ig-engagement');
  assert.ok(e);
  // recentPosts is 0 here, so the window figure is the one shown.
  const want = (s.medianEngagement / s.followers) * 100;
  assert.ok(e.detail.en.includes(`${Math.round(want * 10) / 10}%`), e.detail.en);
  assert.ok(!e.detail.en.includes('1.1%'));
});

test('findings.ts never puts the mean rate into a sentence', () => {
  const src = readFileSync('lib/teardown/findings.ts', 'utf8');
  assert.equal(src.includes('meanEngagementRate'), false);
});

test('no severity in findings.ts turns on a bare numeric literal', () => {
  const src = readFileSync('lib/teardown/findings.ts', 'utf8');
  for (const line of src.split('\n')) {
    if (!/^\s*severity:/.test(line)) continue;
    assert.ok(!/\d/.test(line), `numeric literal in a severity gate: ${line.trim()}`);
  }
});

// ── thresholds ──────────────────────────────────────────────────────────────

const patch = (s: Signals, p: Partial<Signals>): Signals => ({ ...s, ...p });
const asking = (s: Signals, share: number): Signals =>
  ({ ...s, captions: { ...s.captions, askingShare: share, withCaption: 20, asking: 4 } });

test('the ask severity flips exactly at its thresholds', () => {
  const s = HEALTHY();
  const at_ = (share: number) => by(buildFindings(asking(s, share), null, NO_URL).findings, 'ig-ask');
  assert.equal(at_(T.ASK_CRITICAL_SHARE - 0.001)?.severity, 'critical');
  assert.equal(at_(T.ASK_CRITICAL_SHARE)?.severity, 'notable');
  assert.equal(at_(T.ASK_NOTABLE_SHARE - 0.001)?.severity, 'notable');
  assert.equal(at_(T.ASK_NOTABLE_SHARE), undefined);
});

test('the engagement severity flips exactly at its threshold', () => {
  const base = patch(HEALTHY(), { recentPosts: 0 });
  const at_ = (med: number) =>
    by(buildFindings(patch(base, { medianEngagement: med }), null, NO_URL).findings, 'ig-engagement');
  assert.equal(at_(T.ENGAGEMENT_MIN_MEDIAN - 1)?.severity, 'critical');
  assert.equal(at_(T.ENGAGEMENT_MIN_MEDIAN)?.severity, 'notable');
});

test('the site timing severity flips exactly at the Core Web Vitals boundaries', () => {
  const s = HEALTHY();
  const at_ = (ms: number) => by(buildFindings(s, mkSite({ ms }), READ).findings, 'web-slow');
  assert.equal(at_(T.SITE_MS_NOTABLE), undefined);
  assert.equal(at_(T.SITE_MS_NOTABLE + 1)?.severity, 'notable');
  assert.equal(at_(T.SITE_MS_CRITICAL)?.severity, 'notable');
  assert.equal(at_(T.SITE_MS_CRITICAL + 1)?.severity, 'critical');
});

test('dormancy flips exactly at its threshold', () => {
  const s = HEALTHY();
  const at_ = (d: number) =>
    by(buildFindings(patch(s, { daysSinceLast: d }), null, NO_URL).findings, 'ig-dormant');
  assert.equal(at_(T.DORMANT_DAYS - 0.001), undefined);
  assert.equal(at_(T.DORMANT_DAYS)?.severity, 'critical');
});

// ── windows, cadence, clock words ───────────────────────────────────────────

test('two windows an hour apart are not a conflict worth printing', () => {
  const s = sig([
    ...mkMedia({ n: 12, from: ammanIso('2026-08-01', 23), likes: 20, comments: 1, id: 'a' }),
    ...mkMedia({ n: 12, from: ammanIso('2026-08-01', 0), likes: 20, comments: 1, id: 'b' }),
  ]);
  assert.ok(!ids(buildFindings(s, null, NO_URL).findings).includes('ig-window'));
});

test('a real evening window is printed, with its sample count', () => {
  const s = sig([
    ...mkMedia({ n: 20, from: ammanIso('2026-06-01', 9), likes: 10, comments: 0, id: 'a' }),
    ...mkMedia({ n: 20, from: ammanIso('2026-06-01', 21), likes: 30, comments: 0, id: 'b' }),
  ]);
  const w = by(buildFindings(s, null, NO_URL).findings, 'ig-window');
  assert.ok(w, 'ig-window missing');
  assert.ok(w.detail.en.includes('8pm–10pm'), w.detail.en);
  assert.ok(w.provenance.en.includes('20 posts'), w.provenance.en);
  assert.ok(/[٠-٩]/.test(w.provenance.ar));
});

test('midnight and noon have their own words', () => {
  assert.equal(clock(0, false), 'midnight');
  assert.equal(clock(12, false), 'noon');
  assert.equal(clock(0, true), 'منتصف الليل');
  assert.equal(clock(12, true), 'الضهر');
  assert.equal(span(22, 0, false), '10pm–midnight');
  assert.ok(span(22, 0, true).includes('منتصف الليل'));
});

test('a burst two years ago is dormant, not consistent', () => {
  const s = sig(mkMedia({ n: 40, from: at(730), everyHours: 54 / 40, likes: 5, comments: 1 }));
  const out = buildFindings(s, null, NO_URL);
  assert.ok(!ids(out.findings).includes('ig-cadence'));
  const d = by(out.findings, 'ig-dormant');
  assert.ok(d);
  assert.equal(d.severity, 'critical');
  assert.ok(d.detail.en.includes(`${Math.round(s.daysSinceLast)} days`), d.detail.en);
});

test('a healthy cadence is a compliment, and says no "0 months"', () => {
  const c = by(buildFindings(HEALTHY(), null, NO_URL).findings, 'ig-cadence');
  assert.ok(c);
  assert.equal(c.severity, 'good');
  assert.ok(!/\b0\b/.test(c.detail.en), c.detail.en);
});

test('months() counts weeks below two months and never prints zero', () => {
  assert.equal(months(20, false), '3 weeks');
  assert.equal(months(1, false), '1 week');
  assert.equal(months(0, false), '1 week');
  assert.equal(months(70, false), '2 months');
  assert.equal(months(365, false), '12 months');
  assert.equal(months(20, true), '٣ أسابيع');
  assert.equal(months(70, true), 'شهرين');
  for (const d of [0, 1, 7, 20, 45, 59, 60, 120, 365, 900]) {
    assert.ok(!months(d, false).startsWith('0'), `${d}`);
    assert.ok(!months(d, true).startsWith('٠'), `${d}`);
  }
});

// ── the bio ─────────────────────────────────────────────────────────────────

const bioOf = (biography?: string, website?: string) =>
  ids(buildFindings(
    sig(mkMedia({ n: 12, from: at(60), likes: 20, comments: 1 }), 3_000, { biography, website }),
    null, NO_URL,
  ).findings);

test('a bio with nowhere to go is a critical finding', () => {
  const got = bioOf('قهوة مختصة في عمّان');
  assert.ok(got.includes('ig-bio-noroute'));
  assert.ok(!got.includes('ig-bio-good'));
});

test('a bio with a link and a WhatsApp route is a good finding', () => {
  const got = bioOf('قهوة مختصة · wa.me/962791234567', 'https://acme.jo');
  assert.ok(got.includes('ig-bio-good'));
  assert.ok(!got.includes('ig-bio-noroute'));
});

test('a link aggregator is a link without being a route', () => {
  const got = bioOf('قهوة مختصة', 'https://linktr.ee/acme');
  assert.ok(got.includes('ig-bio-linktree'));
  assert.ok(!got.includes('ig-bio-noroute'));
  assert.ok(!got.includes('ig-bio-good'));
});

test('no bio read means no bio finding, rather than an empty one', () => {
  const got = ids(buildFindings(HEALTHY(), null, NO_URL).findings);
  for (const id of ['ig-bio-noroute', 'ig-bio-good', 'ig-bio-linktree']) assert.ok(!got.includes(id));
});

// ── the timing sentence ─────────────────────────────────────────────────────

test('web-slow describes a document fetch, not a page load', () => {
  const one = by(buildFindings(HEALTHY(), mkSite({ ms: 5000 }), READ).findings, 'web-slow');
  assert.ok(one);
  assert.ok(one.detail.en.includes('HTML'), one.detail.en);
  assert.ok(!one.detail.en.includes('to load'), one.detail.en);
  assert.ok(one.detail.en.includes('single cold request'), one.detail.en);

  const many = by(buildFindings(
    HEALTHY(),
    { ...mkSite({ ms: 5000 }), msSamples: [100, 900, 1100] } as SiteRead,
    READ,
  ).findings, 'web-slow');
  assert.ok(many);
  assert.ok(many.detail.en.includes('HTML'));
  assert.ok(many.detail.en.includes('3 requests'), many.detail.en);
  assert.ok(many.provenance.en.includes('median'));
});

test('a quick site is a good finding', () => {
  const got = ids(buildFindings(HEALTHY(), mkSite({ ms: 400 }), READ).findings);
  assert.ok(got.includes('web-fast'));
});

// ── the engagement basis ────────────────────────────────────────────────────

test('a recent window that is mostly known is quoted, and never as 0%', () => {
  // Eighty recent posts carrying reactions and twenty that do not: 80% coverage
  // is exactly reliable, the recent figure is allowed, and the numerator has
  // eighty posts under it rather than the nothing that used to print "0%".
  const s = sig([
    ...mkMedia({ n: 80, from: at(80), everyHours: 12, likes: [40, 55, 48, 61], comments: 2, id: 'k' }),
    ...mkMedia({ n: 20, from: at(30), everyHours: 12, likes: null, comments: null, id: 'u' }),
  ], 10_000);
  assert.equal(s.recentPosts, 100);
  assert.equal(s.coverage.recentEngagementKnown, 80);
  assert.equal(s.engagementReliable, true);

  const b = engagementBasis(s);
  assert.equal(b.fresh, true);
  assert.ok(b.rate > 0, `rate was ${b.rate}`);

  const e = by(buildFindings(s, null, NO_URL).findings, 'ig-engagement');
  assert.ok(e);
  for (const t of [e.figure?.en ?? '', e.detail.en]) assert.ok(!t.includes('0%'), t);
  // The header tile on the sheet reads `engagementBasis`, so the two agree by
  // construction — this asserts the construction.
  assert.equal(e.figure?.en, `${Math.round(b.rate * 10) / 10}%`);
  assert.ok(e.detail.en.includes(`${Math.round(b.rate * 10) / 10}%`), e.detail.en);
  assert.ok(e.detail.en.includes(`${Math.round(b.median)} reactions`), e.detail.en);
  // …and the provenance says which window it is, with the window's own length.
  assert.ok(e.provenance.en.includes(`${b.known} posts`), e.provenance.en);
  assert.ok(e.provenance.en.includes(`last ${RECENT_DAYS} days`), e.provenance.en);
});

test('a recent window with almost no reactions falls back rather than printing 0%', () => {
  // Thirty recent posts, three of which carried counts: `recentPosts` says the
  // sample is fine and `median([])`-adjacent arithmetic says 0%. It is not.
  const s = sig([
    ...mkMedia({ n: 90, from: at(600), everyHours: 48, likes: 90, comments: 5, id: 'old' }),
    ...mkMedia({ n: 3, from: at(80), everyHours: 24, likes: 1, comments: 0, id: 'few' }),
    ...mkMedia({ n: 17, from: at(60), everyHours: 24, likes: null, comments: null, id: 'blind' }),
  ], 10_000);
  assert.equal(s.recentPosts, 20);
  assert.equal(s.engagementReliable, true);
  assert.equal(s.coverage.recentEngagementKnown, 3);
  const b = engagementBasis(s);
  assert.equal(b.fresh, false);
  assert.equal(b.median, s.medianEngagement);
  const e = by(buildFindings(s, null, NO_URL).findings, 'ig-engagement');
  assert.ok(e);
  assert.notEqual(e.figure?.en, '0%');
  assert.ok(!e.provenance.en.includes('last'), e.provenance.en);
});

test('no engagement sentence is written when nothing was returned', () => {
  const s = sig(load('hidden-likes'), 10_000);
  assert.equal(engagementBasis(s).sayable, false);
  assert.ok(!ids(buildFindings(s, PERFECT, READ).findings).includes('ig-engagement'));
});

// ── the coverage sentence ───────────────────────────────────────────────────

test('missing comments are not described as hidden likes', () => {
  // Every like came back; the comments did not. The account hides nothing.
  const s = sig([
    ...mkMedia({ n: 24, from: at(60), everyHours: 24, likes: 40, comments: null, id: 'a' }),
    ...mkMedia({ n: 6, from: at(30), everyHours: 24, likes: 40, comments: 3, id: 'b' }),
  ], 10_000);
  assert.equal(s.coverage.likesKnown, s.posts);
  const h = by(buildFindings(s, null, NO_URL).findings, 'ig-likes-hidden');
  assert.ok(h);
  assert.ok(!h.title.en.toLowerCase().includes('hides'), h.title.en);
  assert.ok(!h.title.ar.includes('مخفي'), h.title.ar);
  // The figure is the posts with *both* counts, not the ones with likes.
  assert.equal(h.figure?.en, `${s.coverage.engagementKnown}/${s.posts}`);
  assert.notEqual(h.figure?.en, `${s.coverage.likesKnown}/${s.posts}`);
});

test('an account that really does hide its likes is still told so', () => {
  const h = by(buildFindings(sig(load('hidden-likes'), 10_000), PERFECT, READ).findings,
    'ig-likes-hidden');
  assert.ok(h);
  assert.ok(h.title.en.includes('hides its like counts'), h.title.en);
  assert.equal(h.figure?.en, '0/30');
  assert.equal(h.figure?.ar, '٠/٣٠');
});

// ── the format chart ────────────────────────────────────────────────────────

const bars = (out: ReturnType<typeof buildFindings>) =>
  out.charts.find((c) => c.id === 'formats');

test('a weakest format of zero does not turn the bars into raw counts', () => {
  // Six images at no reactions against sixteen Reels at about thirty. The old
  // floor of one made every bar the raw count, so the chart read "30×".
  const s = sig([
    ...mkMedia({ n: 16, from: at(70), everyHours: 24, type: 'VIDEO', product: 'REELS', likes: [28, 33, 30, 31], comments: 0, id: 'r' }),
    ...mkMedia({ n: 6, from: at(50), everyHours: 24, likes: 0, comments: 0, id: 'i' }),
  ], 10_000);
  const c = bars(buildFindings(s, null, NO_URL));
  assert.ok(c && c.kind === 'bars');
  for (const b of c.series) {
    assert.ok(b.value <= 5, `a bar of ${b.value}× is a raw count, not a ratio`);
    const f = s.formats.find((x) => x.label === undefined && false);
    assert.equal(f, undefined);
  }
  // Every bar is the format's median against the account's own typical post.
  for (const x of s.formats) {
    const b = c.series.find((y) => y.label.en === (x.format === 'REELS' ? 'Reels' : 'single images'));
    if (!b) continue;
    assert.equal(b.value, Math.round((x.medianEngagement / s.medianEngagement) * 10) / 10);
  }
  assert.ok(c.note?.en.includes('your own typical post'), c.note?.en);
});

test('a format with too few known posts is left off the chart', () => {
  const s = sig([
    ...mkMedia({ n: 30, from: at(70), everyHours: 24, likes: [20, 26, 22, 30], comments: 1, id: 'i' }),
    ...mkMedia({ n: 12, from: at(60), everyHours: 24, type: 'CAROUSEL_ALBUM', likes: [40, 48, 44], comments: 1, id: 'c' }),
    ...mkMedia({ n: 2, from: at(50), everyHours: 24, type: 'VIDEO', product: 'REELS', likes: 900, comments: 9, id: 'r' }),
  ], 10_000);
  const c = bars(buildFindings(s, null, NO_URL));
  assert.ok(c && c.kind === 'bars');
  assert.equal(c.series.length, 2);
  assert.ok(!c.series.some((b) => b.label.en === 'Reels'), 'a two-post format was plotted');
});

test('an account with no typical post gets no format chart', () => {
  const s = sig([
    ...mkMedia({ n: 20, from: at(70), everyHours: 24, likes: 0, comments: 0, id: 'i' }),
    ...mkMedia({ n: 20, from: at(60), everyHours: 24, type: 'CAROUSEL_ALBUM', likes: 0, comments: 0, id: 'c' }),
  ], 10_000);
  assert.equal(s.medianEngagement, 0);
  assert.equal(bars(buildFindings(s, null, NO_URL)), undefined);
});

test('the hours chart draws no best band on an unreliable read', () => {
  const s = patch(sig([
    ...mkMedia({ n: 20, from: ammanIso('2026-08-01', 9), likes: 10, comments: 0, id: 'a' }),
    ...mkMedia({ n: 20, from: ammanIso('2026-08-01', 21), likes: 30, comments: 0, id: 'b' }),
  ]), { engagementReliable: false });
  assert.ok(s.bestWindow, 'the fixture needs a best window to withhold');
  const h = buildFindings(s, null, NO_URL).charts.find((c) => c.id === 'hours');
  assert.ok(h && h.kind === 'hours');
  assert.equal(h.best, undefined);
});

// ── the ask headline ────────────────────────────────────────────────────────

test('"never ask" is only said when nobody asked', () => {
  const s = HEALTHY();
  const never = by(buildFindings(
    { ...s, captions: { ...s.captions, asking: 0, askingShare: 0, withCaption: 30 } },
    null, NO_URL).findings, 'ig-ask');
  assert.ok(never?.title.en.includes('never ask'), never?.title.en);
  const rarely = by(buildFindings(asking(s, 20), null, NO_URL).findings, 'ig-ask');
  assert.ok(rarely?.title.en.includes('rarely ask'), rarely?.title.en);
  assert.ok(!rarely?.title.ar.includes('وما بتطلب'), rarely?.title.ar);
});

// ── figures are copy, in both languages ─────────────────────────────────────

test('every figure is bilingual, and the Arabic half is written in Arabic', () => {
  for (const fx of FIXTURES()) {
    const out = buildFindings(fx.s, fx.site, fx.web);
    for (const x of out.findings) {
      if (!x.figure) continue;
      assert.equal(typeof x.figure.ar, 'string', `${fx.name} · ${x.id}`);
      assert.equal(typeof x.figure.en, 'string', `${fx.name} · ${x.id}`);
      assert.ok(x.figure.ar.trim().length > 0, `${fx.name} · ${x.id}: empty Arabic figure`);
      assert.ok(!/[0-9]/.test(x.figure.ar), `${fx.name} · ${x.id}: Latin digit in "${x.figure.ar}"`);
      assert.ok(!/[A-Za-z]/.test(x.figure.ar), `${fx.name} · ${x.id}: Latin word in "${x.figure.ar}"`);
      assert.ok(!x.figure.ar.includes('%'), `${fx.name} · ${x.id}: Latin % in "${x.figure.ar}"`);
    }
  }
});

test('the trailing window is interpolated, never typed out', () => {
  const src = readFileSync('lib/teardown/findings.ts', 'utf8');
  assert.ok(!/آخر ٩٠ يوم/.test(src), 'a hard-coded ٩٠ in the Arabic copy');
  assert.ok(!/last 90 days/.test(src), 'a hard-coded 90 in the English copy');
  const c = by(buildFindings(HEALTHY(), null, NO_URL).findings, 'ig-cadence');
  assert.ok(c?.detail.en.includes(`last ${RECENT_DAYS} days`), c?.detail.en);
  assert.ok(c?.detail.ar.includes(`آخر ${arNum(RECENT_DAYS)} يوم`), c?.detail.ar);
});
