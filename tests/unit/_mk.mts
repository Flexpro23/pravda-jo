/**
 * A scenario in three lines instead of a hundred objects.
 *
 * Every engine test needs a `Media[]` that differs from the last one in one
 * respect — the hour, the format, whether like counts came back — and hand-
 * writing those arrays hides the one field that matters inside ninety-nine that
 * do not. `mkMedia` takes the differences and generates the rest.
 *
 * Two conventions worth knowing:
 *
 * `null` means the field is absent, not zero. That distinction is the whole
 * point of the hidden-likes work: `likes: null` omits `like_count` exactly as
 * Business Discovery does, while `likes: 0` states that nobody reacted.
 *
 * Arrays cycle. `likes: [10, 3000]` alternates, `caption: [a, b, c]` rotates —
 * enough to build a heavy tail or a mixed caption set without a loop.
 */

import type { Media } from '@/lib/meta/discovery';

export type MkOpts = {
  /** How many posts. */
  n: number;
  /** ISO timestamp of the first (oldest) post. */
  from: string;
  /** Hours between consecutive posts. Default 24. */
  everyHours?: number;
  /** A number, a cycling array, or `null` to omit the field entirely. */
  likes?: number | number[] | null;
  comments?: number | number[] | null;
  type?: Media['media_type'];
  product?: Media['media_product_type'];
  caption?: string | string[] | null;
  /** Prefix for the generated ids, so two calls can be concatenated safely. */
  id?: string;
};

const pick = <T>(v: T | T[], i: number): T => (Array.isArray(v) ? v[i % v.length] : v);

export function mkMedia(o: MkOpts): Media[] {
  const step = (o.everyHours ?? 24) * 3_600_000;
  const t0 = +new Date(o.from);
  const out: Media[] = [];
  for (let i = 0; i < o.n; i++) {
    const ts = new Date(t0 + i * step).toISOString();
    const m: Media = {
      id: `${o.id ?? 'm'}${i}`,
      media_type: o.type ?? 'IMAGE',
      media_product_type: o.product ?? 'FEED',
      permalink: `https://instagram.com/p/${o.id ?? 'm'}${i}/`,
      timestamp: ts,
    };
    if (o.likes !== null && o.likes !== undefined) m.like_count = pick(o.likes, i);
    if (o.comments !== null && o.comments !== undefined) m.comments_count = pick(o.comments, i);
    const c = o.caption === null || o.caption === undefined ? undefined : pick(o.caption, i);
    if (c !== undefined) m.caption = c;
    // A generated post with no timestamp is a bug in the generator, not a
    // scenario: the engine drops those and the test would silently pass.
    if (!m.timestamp) throw new Error('mkMedia produced a post with no timestamp');
    out.push(m);
  }
  return out;
}

/**
 * The UTC instant at which it is `hourLocal` in Amman on `date`.
 *
 * Jordan has been permanently UTC+3 since October 2022, so this is arithmetic
 * rather than a lookup — but it must be done as arithmetic on the instant, not
 * as string surgery on the hour, or `ammanIso('2026-03-01', 1)` lands on the
 * wrong UTC day and the test asserts against a fiction.
 */
export const ammanIso = (date: string, hourLocal: number) =>
  new Date(+new Date(`${date}T00:00:00Z`) + (hourLocal - 3) * 3_600_000).toISOString();
