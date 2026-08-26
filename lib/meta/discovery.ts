/**
 * Instagram Business Discovery — the whole cold-read surface.
 *
 * This is the only Meta endpoint that returns anything about a business that
 * has not authorised us, and it needs no App Review: `business_discovery` is a
 * field on our OWN Instagram User node, so the query always authenticates as
 * PRAVDA and the prospect is nothing but a string parameter. Business and
 * Consumer apps get Standard Access to their own app users automatically.
 *
 * What it will not give, at any access tier, so that nothing downstream waits
 * for it:
 *   · comment TEXT — the comments edge is Standard rather than Public.
 *     `comments_count` is public; the words are not.
 *   · audience composition — no demographics for a non-consenting account.
 *   · anything paid — the Ad Library API returns non-EU ads only when they
 *     concern social issues, elections or politics, which excludes all of Jordan.
 *
 * Permissions the token must carry: instagram_basic, instagram_manage_insights,
 * pages_read_engagement — plus ads_read or ads_management, because PRAVDA's
 * Page role came through Business Manager. Without that last one every call
 * 403s, and the error does not mention ads.
 */

const VERSION = process.env.META_API_VERSION || 'v21.0';
const GRAPH = 'https://graph.facebook.com';

/** Per-post fields, all of them public on the business_discovery edge. */
const MEDIA_FIELDS = [
  'id', 'caption', 'media_type', 'media_product_type', 'permalink',
  'timestamp', 'like_count', 'comments_count',
].join(',');

/** Profile fields confirmed public. Anything tagged Standard is left out. */
const PROFILE_FIELDS = ['username', 'followers_count', 'media_count', 'biography', 'website'];

export type Media = {
  id: string;
  caption?: string;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  /** FEED | REELS | STORY | AD — the honest format signal; media_type is not. */
  media_product_type?: 'FEED' | 'REELS' | 'STORY' | 'AD';
  permalink: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
};

export type Profile = {
  username: string;
  followers_count: number;
  media_count: number;
  biography?: string;
  website?: string;
  media: Media[];
};

export type DiscoveryFailure =
  | { ok: false; reason: 'unreadable' }   // personal, typo, renamed, deleted — indistinguishable
  | { ok: false; reason: 'throttled' }
  | { ok: false; reason: 'unauthorised' } // our token, not their account
  | { ok: false; reason: 'network'; detail: string };

export type DiscoveryResult = { ok: true; profile: Profile } | DiscoveryFailure;

/** A handle as typed by a human: @name, a profile URL, or bare. */
export function normaliseHandle(input: string): string | null {
  const s = input.trim().replace(/^@/, '')
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/[/?#].*$/, '')
    .trim();
  // Instagram's own rule: letters, digits, period, underscore, max 30.
  return /^[A-Za-z0-9._]{1,30}$/.test(s) ? s.toLowerCase() : null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * One page of the read. Business Discovery caps media at 25 per call and pages
 * with a cursor, so a hundred posts is four round trips against a budget of
 * roughly 200 calls an hour.
 */
async function page(igUserId: string, token: string, handle: string, after?: string) {
  const media = `media.limit(25)${after ? `.after(${after})` : ''}{${MEDIA_FIELDS}}`;
  const fields = `business_discovery.username(${handle}){${PROFILE_FIELDS.join(',')},${media}}`;
  const url = `${GRAPH}/${VERSION}/${igUserId}`
    + `?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(token)}`;

  const res = await fetch(url, { cache: 'no-store' });
  const body = await res.json().catch(() => null);
  return { res, body };
}

/**
 * Read a prospect. `posts` is a ceiling, not a promise — a young account simply
 * has fewer, and the analysis says so rather than padding.
 */
export async function discover(handle: string, posts = 100): Promise<DiscoveryResult> {
  const igUserId = process.env.META_IG_USER_ID;
  const token = process.env.META_ACCESS_TOKEN;
  if (!igUserId || !token) return { ok: false, reason: 'unauthorised' };

  const clean = normaliseHandle(handle);
  if (!clean) return { ok: false, reason: 'unreadable' };

  let profile: Profile | null = null;
  let after: string | undefined;

  while (!profile || profile.media.length < posts) {
    let attempt = await page(igUserId, token, clean, after);

    // Code 110 / subcode 2207013 fires intermittently on accounts that are
    // perfectly readable, and `is_transient: false` on it is simply wrong. One
    // retry before we tell anyone their account cannot be read.
    const err = attempt.body?.error;
    if (err?.code === 110 || err?.error_subcode === 2207013) {
      await sleep(700);
      attempt = await page(igUserId, token, clean, after);
    }

    const { res, body } = attempt;
    if (!res.ok) {
      const e = body?.error;
      if (e?.code === 4 || e?.code === 17 || e?.code === 32 || e?.code === 613) {
        return { ok: false, reason: 'throttled' };
      }
      if (e?.code === 190 || e?.code === 10 || e?.code === 200) {
        return { ok: false, reason: 'unauthorised' };
      }
      if (e?.code === 110 || e?.error_subcode === 2207013) {
        // Still failing after a retry. Personal account, typo, renamed and
        // deleted are genuinely indistinguishable here, so we never guess which.
        return { ok: false, reason: 'unreadable' };
      }
      return { ok: false, reason: 'network', detail: e?.message ?? `HTTP ${res.status}` };
    }

    const bd = body?.business_discovery;
    if (!bd) return { ok: false, reason: 'unreadable' };

    const batch: Media[] = bd.media?.data ?? [];
    if (!profile) {
      profile = {
        username: bd.username,
        followers_count: bd.followers_count ?? 0,
        media_count: bd.media_count ?? 0,
        biography: bd.biography,
        website: bd.website,
        media: batch,
      };
    } else {
      profile.media.push(...batch);
    }

    after = bd.media?.paging?.cursors?.after;
    if (!after || batch.length === 0) break;
  }

  profile.media = profile.media.slice(0, posts);
  return { ok: true, profile };
}
