/**
 * The arithmetic every client-facing sentence rests on.
 *
 * Each case here is a fixture that used to produce a false number: the mean
 * dressed as a median, an absent like count read as zero reactions, a 54-hour
 * burst from 2024 reported as "124 posts a week" in the present tense, six
 * posts out of a hundred driving a recommendation, and a format declared
 * strongest because its runner-up had a median of zero.
 *
 * `now` is passed to every call so a dormancy claim is a computation against a
 * stated instant rather than against the day the suite happens to run.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Media } from '@/lib/meta/discovery';
import { computeSignals, windowsOverlap, RECENT_DAYS } from '@/lib/teardown/signals';
import { mkMedia, ammanIso } from './_mk.mts';

const NOW = +new Date('2026-09-06T09:00:00.000Z');
const DAY = 86_400_000;
const at = (daysAgo: number) => new Date(NOW - daysAgo * DAY).toISOString();

const sig = (
  media: Media[],
  followers = 10_000,
  profile: { biography?: string; website?: string; mediaCount?: number } | null = null,
  requested = 100,
) => {
  const s = computeSignals('acme', followers, media, requested, profile, NOW);
  assert.ok(s, 'expected signals');
  return s;
};

const load = (name: string): Media[] =>
  JSON.parse(readFileSync(`tests/fixtures/media/${name}.json`, 'utf8'));

test('fewer than two placeable posts is not a read', () => {
  assert.equal(computeSignals('acme', 100, [], 100, null, NOW), null);
  assert.equal(computeSignals('acme', 100, mkMedia({ n: 1, from: at(3) }), 100, null, NOW), null);
});

test('stories and ads are not the organic account', () => {
  const media = [
    ...mkMedia({ n: 10, from: at(30), id: 'feed' }),
    ...mkMedia({ n: 40, from: at(30), product: 'STORY', id: 'story' }),
    ...mkMedia({ n: 20, from: at(30), product: 'AD', id: 'ad' }),
  ];
  assert.equal(sig(media).posts, 10);
});

test('a post with no timestamp cannot be placed in time and is dropped', () => {
  const media = mkMedia({ n: 6, from: at(20) });
  media[2] = { ...media[2], timestamp: '' as unknown as string };
  assert.equal(sig(media).posts, 5);
});

test('a heavy tail: the rate is the median rate, the mean is kept apart', () => {
  // 29 posts at 10 reactions and one at 3000, against 10,000 followers. The old
  // mean-of-rates said 1.1%; the median post's rate is 0.1%.
  const media = [
    ...mkMedia({ n: 29, from: at(60), likes: 10, comments: 0, id: 'a' }),
    ...mkMedia({ n: 1, from: at(1), likes: 3000, comments: 0, id: 'b' }),
  ];
  const s = sig(media, 10_000);
  assert.equal(s.medianEngagement, 10);
  assert.ok(Math.abs(s.engagementRate - (10 / 10_000) * 100) < 1e-9);
  assert.ok(s.meanEngagementRate > 1, `mean was ${s.meanEngagementRate}`);
  assert.ok(s.meanEngagementRate > s.engagementRate * 10);
});

test('hidden like counts are absent, not zero', () => {
  const s = sig(load('hidden-likes'), 10_000);
  assert.equal(s.posts, 30);
  assert.equal(s.coverage.likesKnown, 0);
  assert.equal(s.coverage.commentsKnown, 30);
  assert.equal(s.coverage.engagementKnown, 0);
  assert.equal(s.engagementReliable, false);
  assert.equal(s.best, null);
  assert.equal(s.strongest, null);
});

test('coverage at the boundary: 25 of 30 is reliable, and 25 is the denominator', () => {
  const s = sig(load('partial-likes'), 10_000);
  assert.equal(s.coverage.engagementKnown, 25);
  assert.equal(s.engagementReliable, true);
  // The median of the 25 known posts (100…124) is 112 + 2 comments.
  assert.equal(s.medianEngagement, 114);
  assert.ok(Math.abs(s.engagementRate - (114 / 10_000) * 100) < 1e-9);
});

test('a set where nobody reacted is read as such, with no standout', () => {
  const s = sig(load('zero-engagement'), 4_000);
  assert.equal(s.engagementReliable, true);
  assert.equal(s.medianEngagement, 0);
  assert.equal(s.engagementRate, 0);
  assert.equal(s.best, null);
  assert.equal(s.bestWindow, null);
});

test('a burst account is dormant, whatever its in-window cadence says', () => {
  // 40 posts over 54 hours, two years ago.
  const s = sig(mkMedia({ n: 40, from: at(730), everyHours: 54 / 40, likes: 5, comments: 1 }));
  assert.ok(s.spanDays < 3, `spanDays ${s.spanDays}`);
  assert.ok(s.postsPerWeekInWindow > 100);
  assert.equal(s.recentPosts, 0);
  assert.equal(s.postsPerWeek, 0);
  assert.ok(Math.abs(s.daysSinceLast - (730 - (39 * (54 / 40)) / 24)) < 0.01);
  assert.ok(s.activeSpanDays > 729);
});

test('a shallow read says so, and says what share of the account it saw', () => {
  const s = sig(mkMedia({ n: 20, from: at(40), likes: 5, comments: 0 }), 900, { mediaCount: 480 });
  assert.equal(s.shallow, true);
  assert.ok(Math.abs((s.readShare ?? 0) - 20 / 480) < 1e-12);
  assert.equal(sig(mkMedia({ n: 4, from: at(9) }), 900, null).readShare, null);
});

test('hours are Amman hours, across a UTC midnight boundary', () => {
  // 01:00 in Amman is 22:00 UTC the previous day. The naive read is hour 22.
  const s = sig(mkMedia({ n: 12, from: ammanIso('2026-06-02', 1), likes: 4, comments: 0 }));
  assert.equal(s.byHour[1], 12);
  assert.equal(s.byHour[22], 0);
});

test('the peak window wraps around midnight', () => {
  const media = [
    ...mkMedia({ n: 10, from: ammanIso('2026-06-01', 22), likes: 4, comments: 0, id: 'a' }),
    ...mkMedia({ n: 10, from: ammanIso('2026-06-01', 23), likes: 4, comments: 0, id: 'b' }),
  ];
  const s = sig(media);
  assert.equal(s.peakWindow.from, 22);
  assert.equal(s.peakWindow.to, 0);
  assert.equal(s.peakWindow.share, 100);
});

test('six posts out of a hundred do not make a best window', () => {
  const media = [
    ...mkMedia({ n: 94, from: ammanIso('2026-01-01', 9), likes: 10, comments: 0, id: 'a' }),
    ...mkMedia({ n: 6, from: ammanIso('2026-01-01', 21), likes: 1000, comments: 0, id: 'b' }),
  ];
  assert.equal(sig(media).bestWindow, null);
});

test('a real evening window carries its sample size and its margin', () => {
  const media = [
    ...mkMedia({ n: 20, from: ammanIso('2026-05-01', 9), likes: 10, comments: 0, id: 'a' }),
    ...mkMedia({ n: 20, from: ammanIso('2026-05-01', 21), likes: 30, comments: 0, id: 'b' }),
  ];
  const s = sig(media);
  assert.ok(s.bestWindow);
  assert.equal(s.bestWindow.from, 20);
  assert.equal(s.bestWindow.n, 20);
  assert.equal(s.bestWindow.vsRest, 3);
  assert.equal(windowsOverlap(s.peakWindow, s.bestWindow), false);
});

test('two windows an hour apart overlap, and are not a conflict', () => {
  assert.equal(windowsOverlap({ from: 23 }, { from: 0 }), true);
  assert.equal(windowsOverlap({ from: 9 }, { from: 9 }), true);
  assert.equal(windowsOverlap({ from: 22 }, { from: 0 }), false);
  assert.equal(windowsOverlap({ from: 9 }, { from: 20 }), false);
  // All posts at 23:00 and 00:00: the old code called this a conflict.
  const media = [
    ...mkMedia({ n: 12, from: ammanIso('2026-05-01', 23), likes: 20, comments: 0, id: 'a' }),
    ...mkMedia({ n: 12, from: ammanIso('2026-05-01', 0), likes: 20, comments: 0, id: 'b' }),
  ];
  assert.equal(sig(media).bestWindow, null);
});

test('a zero-median runner-up cannot set the bar', () => {
  // 5 Reels at one reaction against 6 images at none.
  const media = [
    ...mkMedia({ n: 5, from: at(30), type: 'VIDEO', product: 'REELS', likes: 1, comments: 0, id: 'r' }),
    ...mkMedia({ n: 6, from: at(29), likes: 0, comments: 0, id: 'i' }),
  ];
  assert.equal(sig(media).strongest, null);
});

test('a real format lead survives a label shuffle, and the p is deterministic', () => {
  const media = [
    // Real engagement has spread; a permutation test on medians is degenerate
    // without it, and deliberately says nothing when every post is identical.
    ...mkMedia({
      n: 20, from: at(60), type: 'VIDEO', product: 'REELS', comments: 0, id: 'r',
      likes: [110, 120, 130, 115, 125, 140, 105, 122, 118, 128],
    }),
    ...mkMedia({
      n: 20, from: at(59), comments: 0, id: 'i',
      likes: [25, 30, 35, 28, 32, 22, 38, 29, 31, 27],
    }),
  ];
  const a = sig(media);
  const b = sig(media);
  assert.ok(a.strongest);
  assert.equal(a.strongest.format, 'REELS');
  assert.ok(a.strongest.p <= 0.05, `p was ${a.strongest.p}`);
  assert.equal(a.strongest.p, b.strongest?.p);
});

test('three posts cannot declare a format, however well they did', () => {
  const media = [
    ...mkMedia({ n: 3, from: at(60), type: 'VIDEO', product: 'REELS', likes: 200, comments: 0, id: 'r' }),
    ...mkMedia({ n: 40, from: at(59), likes: 30, comments: 0, id: 'i' }),
  ];
  assert.equal(sig(media).strongest, null);
});

test('captions: asking, questioning and none are three different counts', () => {
  const media = [
    ...mkMedia({ n: 10, from: at(40), likes: 9, comments: 1, caption: 'للحجز والاستفسار ٠٧٩', id: 'a' }),
    ...mkMedia({ n: 10, from: at(39), likes: 9, comments: 1, caption: 'مين بيحب القهوة؟', id: 'b' }),
    ...mkMedia({ n: 20, from: at(38), likes: 9, comments: 1, caption: null, id: 'c' }),
  ];
  const s = sig(media);
  assert.equal(s.captions.withCaption, 20);
  assert.equal(s.captions.none, 20);
  assert.equal(s.captions.asking, 10);
  assert.equal(s.captions.questioning, 10);
  // The denominator is the captioned posts, not the whole set: 10/20, not 10/40.
  assert.equal(s.captions.askingShare, 50);
});

test('the trailing-90-day cadence is what the account does now', () => {
  const media = [
    ...mkMedia({ n: 30, from: at(400), everyHours: 24, likes: 5, comments: 0, id: 'old' }),
    ...mkMedia({ n: 30, from: at(60), everyHours: 24, likes: 5, comments: 0, id: 'new' }),
  ];
  const s = sig(media);
  assert.equal(s.recentPosts, 30);
  assert.ok(Math.abs(s.postsPerWeek - 30 / (90 / 7)) < 1e-9);
  assert.ok(s.postsPerWeekInWindow < s.postsPerWeek);
  assert.ok(s.daysSinceLast <= 31);
});

test('the bio is carried through only when a profile was read', () => {
  const media = mkMedia({ n: 5, from: at(20), likes: 5, comments: 0 });
  assert.equal(sig(media).bio, undefined);
  assert.deepEqual(
    sig(media, 900, { biography: 'قهوة مختصة', website: 'https://x.jo' }).bio,
    { biography: 'قهوة مختصة', website: 'https://x.jo' },
  );
});

// ── the cadence denominator ─────────────────────────────────────────────────

test('a young account is not divided by more window than it has lived', () => {
  // Thirty posts across the twenty-one days the account has existed. Dividing
  // those by the full ninety-day window read as 2.3 a week and the sheet then
  // withheld a cadence compliment from an account posting daily.
  const s = sig(mkMedia({
    n: 30, from: at(21), everyHours: (21 * 24) / 30, likes: 20, comments: 1,
  }));
  assert.equal(s.recentPosts, 30);
  assert.ok(Math.abs(s.activeSpanDays - 21) < 1e-6, `activeSpanDays ${s.activeSpanDays}`);
  assert.equal(Math.round(s.postsPerWeek * 10) / 10, 10);
  assert.ok(Math.abs(s.postsPerWeek - 30 / (Math.min(RECENT_DAYS, s.activeSpanDays) / 7)) < 1e-9);
  // The old arithmetic, for the record.
  assert.ok(s.postsPerWeek > 30 / (RECENT_DAYS / 7) * 4);
});

test('an account older than the window is still divided by the window', () => {
  const s = sig(mkMedia({ n: 30, from: at(400), everyHours: 24 * 13, likes: 5, comments: 0 }));
  assert.ok(s.activeSpanDays > RECENT_DAYS);
  assert.ok(Math.abs(s.postsPerWeek - s.recentPosts / (RECENT_DAYS / 7)) < 1e-9);
});

test('coverage counts the recent posts whose reactions came back', () => {
  const media = [
    ...mkMedia({ n: 12, from: at(80), everyHours: 24, likes: null, comments: 2, id: 'blind' }),
    ...mkMedia({ n: 12, from: at(40), everyHours: 24, likes: 30, comments: 2, id: 'seen' }),
  ];
  const s = sig(media);
  assert.equal(s.recentPosts, 24);
  assert.equal(s.coverage.recentEngagementKnown, 12);
  assert.equal(s.coverage.engagementKnown, 12);
  assert.equal(s.recentMedianEngagement, 32);
});

test('a format share of the known posts is not a share of the whole set', () => {
  const media = [
    ...mkMedia({ n: 10, from: at(60), type: 'VIDEO', product: 'REELS', likes: 50, comments: 0, id: 'r' }),
    ...mkMedia({ n: 10, from: at(59), likes: 10, comments: 0, id: 'i' }),
    ...mkMedia({ n: 20, from: at(58), likes: null, comments: null, id: 'blind' }),
  ];
  const s = sig(media);
  const reels = s.formats.find((f) => f.format === 'REELS')!;
  assert.equal(reels.sharePosts, 25);   // 10 of 40 posts
  assert.equal(reels.shareKnown, 50);   // 10 of the 20 posts we were given
});
