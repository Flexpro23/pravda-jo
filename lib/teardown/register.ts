import { THRESHOLDS } from '@/lib/teardown/findings';
import { arNum } from '@/lib/format/num';
import {
  FORMAT_MIN_POSTS, WINDOW_MIN_POSTS,
} from '@/lib/teardown/signals';
import type { Sheet } from '@/lib/store/sheets';

/**
 * Every test the engine runs, whether or not it had anything to say.
 *
 * A teardown lists what it found. It has never listed what it looked for, and
 * those are different documents: the first is a claim, the second is a method.
 * A business owner reading five findings has no way to know whether five is
 * everything we can see or everything we bothered to check, and no way to tell
 * a clean result from a test that never ran.
 *
 * So this is the register. Twenty-two checks, each with its own outcome for
 * one account: it fired, it ran and found nothing, or it could not run — and
 * when it could not run, the reason, which is nearly always that the data
 * needed for it was not in what Instagram returned.
 *
 * `not-run` is the entry that matters and the one a marketing document would
 * never print. An account with hidden like counts cannot be assessed for
 * reach, and saying so is the difference between an audit and a brochure.
 * Nothing here estimates around a gap.
 *
 * The catalogue is written out rather than derived from `findings.ts`, because
 * a check that fires only under a condition leaves no trace in the code when
 * that condition is false — there is nothing to enumerate. The cost is that
 * the two files must be kept in step; the test at
 * `tests/unit/register.test.mts` fails if `findings.ts` ever emits an id this
 * file does not know about.
 */

export type CheckSource = 'account' | 'website';

export type Check = {
  /** Matches the `Finding.id` this check produces, when it produces one. */
  id: string;
  source: CheckSource;
  /** What it looks at, in one line, for the person being audited. */
  asks: { ar: string; en: string };
  /**
   * The ids that mean this check ran and the answer was good news.
   *
   * Several tests have a positive twin — `web-pixel` and `web-pixel-good` are
   * the same measurement reported twice. Listing the twin here is what lets
   * the register say "checked, and it is fine" rather than leaving a blank
   * that reads like a miss.
   */
  good?: string[];
};

export const CHECKS: Check[] = [
  // ── what the account itself says ──────────────────────────────────────────
  {
    id: 'ig-live', source: 'account',
    asks: { en: 'Whether the account is active at all', ar: 'إذا كان الحساب شغّال أصلًا' },
  },
  {
    id: 'ig-dormant', source: 'account',
    asks: {
      en: `Whether posting has stopped — nothing new for ${THRESHOLDS.DORMANT_DAYS} days`,
      ar: `إذا وقف النشر — ما في إشي جديد من ${arNum(THRESHOLDS.DORMANT_DAYS)} يوم`,
    },
    good: ['ig-live'],
  },
  {
    id: 'ig-cadence', source: 'account',
    asks: {
      en: `Whether you publish often enough to build on — ${THRESHOLDS.CADENCE_MIN_PER_WEEK} a week or more`,
      ar: `إذا بتنشروا كفاية ليكون في إشي ينبنى عليه — ${arNum(THRESHOLDS.CADENCE_MIN_PER_WEEK)} بالأسبوع أو أكتر`,
    },
  },
  {
    id: 'ig-longevity', source: 'account',
    asks: {
      en: `Whether there is an archive behind you — at least ${THRESHOLDS.LONGEVITY_MIN_DAYS} days of it`,
      ar: `إذا في أرشيف وراكم — ${arNum(THRESHOLDS.LONGEVITY_MIN_DAYS)} يوم على الأقل`,
    },
  },
  {
    id: 'ig-likes-hidden', source: 'account',
    asks: {
      en: 'Whether your reaction counts are public, and how many came back',
      ar: 'إذا أرقام التفاعل عندكم ظاهرة، وكم منها رجع',
    },
  },
  {
    id: 'ig-engagement', source: 'account',
    asks: {
      en: 'How many people react to a typical post, against your own follower count',
      ar: 'كم حدا بيتفاعل مع المنشور العادي، مقارنة بعدد متابعينكم',
    },
  },
  {
    id: 'ig-best', source: 'account',
    asks: {
      en: `Whether one post clearly outperformed the rest — by ${THRESHOLDS.BEST_MULTIPLE}× or more`,
      ar: `إذا في منشور طلع أحسن من الباقي بوضوح — ${arNum(THRESHOLDS.BEST_MULTIPLE)} أضعاف أو أكتر`,
    },
  },
  {
    id: 'ig-format', source: 'account',
    asks: {
      en: 'Whether the format you post most is the format that actually performs',
      ar: 'إذا الصيغة اللي بتنشروها أكتر هي نفسها اللي بتنجح',
    },
    good: ['ig-format-strength'],
  },
  {
    id: 'ig-window', source: 'account',
    asks: {
      en: 'Whether the hours you post in are the hours your posts do best in',
      ar: 'إذا الساعات اللي بتنشروا فيها هي نفسها اللي منشوراتكم بتنجح فيها',
    },
  },
  {
    id: 'ig-ask', source: 'account',
    asks: {
      en: 'How many captions actually ask the reader to do something',
      ar: 'كم كابشن فعلًا بيطلب من القارئ يعمل إشي',
    },
  },
  {
    id: 'ig-no-caption', source: 'account',
    asks: {
      en: `Whether posts go out with no words at all — more than ${THRESHOLDS.NO_CAPTION_SHARE}% of them`,
      ar: `إذا في منشورات بتطلع بدون ولا كلمة — أكتر من ${arNum(THRESHOLDS.NO_CAPTION_SHARE)}٪ منها`,
    },
    good: ['ig-captions'],
  },
  {
    id: 'ig-bio-noroute', source: 'account',
    asks: {
      en: 'Whether your bio gives a reader any way to reach you',
      ar: 'إذا البايو بيعطي القارئ أي طريقة يوصلكم فيها',
    },
    good: ['ig-bio-good'],
  },
  {
    id: 'ig-bio-linktree', source: 'account',
    asks: {
      en: 'Whether your one link goes to a page of more links',
      ar: 'إذا الرابط الوحيد عندكم بيودّي على صفحة روابط تانية',
    },
  },

  // ── what the website says ─────────────────────────────────────────────────
  {
    id: 'web-none', source: 'website',
    asks: {
      en: 'Whether there is a website to send advertising to',
      ar: 'إذا في موقع نوجّه عليه الإعلانات',
    },
  },
  {
    id: 'web-unreadable', source: 'website',
    asks: {
      en: 'Whether the site answers when it is asked for',
      ar: 'إذا الموقع بيرد لما نطلبه',
    },
  },
  {
    id: 'web-error-page', source: 'website',
    asks: {
      en: 'Whether the address in your bio reaches a real page',
      ar: 'إذا العنوان اللي بالبايو بيوصل لصفحة حقيقية',
    },
  },
  {
    id: 'web-pixel', source: 'website',
    asks: {
      en: 'Whether a Meta pixel is installed, so advertising can be traced to a sale',
      ar: 'إذا في بكسل ميتا مركّب، عشان الإعلان يتتبّع لحد البيع',
    },
    good: ['web-pixel-good'],
  },
  {
    id: 'web-mobile', source: 'website',
    asks: {
      en: 'Whether the page was built for a phone screen',
      ar: 'إذا الصفحة معمولة لشاشة تلفون',
    },
    good: ['web-mobile-good'],
  },
  {
    id: 'web-slow', source: 'website',
    asks: {
      en: 'How long the page takes to answer, measured from outside Jordan',
      ar: 'كم بتاخد الصفحة لترد، مقاسة من برا الأردن',
    },
    good: ['web-fast'],
  },
  {
    id: 'web-whatsapp', source: 'website',
    asks: {
      en: 'Whether WhatsApp is reachable from the page',
      ar: 'إذا الواتساب موجود على الصفحة',
    },
    good: ['web-whatsapp-good'],
  },
  {
    id: 'web-price', source: 'website',
    asks: {
      en: 'Whether a price appears anywhere a customer can find it',
      ar: 'إذا في سعر مكتوب بمكان الزبون بيلاقيه',
    },
    good: ['web-price-good'],
  },
  {
    id: 'web-arabic', source: 'website',
    asks: {
      en: 'Whether the page is in Arabic, so an Arabic advert lands in Arabic',
      ar: 'إذا الصفحة بالعربي، عشان الإعلان العربي يوصل على عربي',
    },
    good: ['web-arabic'],
  },
];

export type Outcome =
  /** It fired. There is a finding about this on the sheet. */
  | { state: 'flagged'; findingId: string }
  /** It ran and there was nothing wrong, or its positive twin fired. */
  | { state: 'clear' }
  /** It could not run, and this is why. Never estimated around. */
  | { state: 'not-run'; why: { ar: string; en: string } };

export type RegisterRow = Check & { outcome: Outcome };

const WHY = {
  noSite: {
    en: 'No website was given or found, so nothing could be read',
    ar: 'ما في موقع انعطى أو انلقى، فما في إشي ينقرأ',
  },
  siteUnread: {
    en: 'The site did not answer, so its markup could not be read',
    ar: 'الموقع ما رد، فما قدرنا نقرأ كوده',
  },
  noReactions: {
    en: 'Instagram returned reaction counts for too few posts to compute this',
    ar: 'إنستغرام رجّع أرقام تفاعل لمنشورات قليلة، ما بتكفي لحساب هاد',
  },
  tooFewPosts: (n: number, need: number) => ({
    en: `${n} posts were readable; this needs at least ${need}`,
    ar: `${arNum(n)} منشور كانوا مقروئين؛ وهاد بدّه ${arNum(need)} على الأقل`,
  }),
  oneFormat: {
    en: 'Every readable post used the same format, so there was nothing to compare',
    ar: 'كل المنشورات المقروءة بنفس الصيغة، فما في إشي نقارنه',
  },
  noLink: {
    en: 'There is no link in the bio, so there is nothing to follow',
    ar: 'ما في رابط بالبايو، فما في إشي نتبعه',
  },
} as const;

/**
 * One account's answer to every check, in the catalogue's order.
 *
 * Reads the sheet only — no recomputation, no second opinion. What the sheet
 * says is what the client was shown, and a register that disagreed with the
 * page it is bound into would be worse than no register.
 */
export function registerFor(sheet: Sheet): RegisterRow[] {
  const fired = new Map(sheet.findings.findings.map((f) => [f.id, f]));
  const s = sheet.signals;
  const web = sheet.webState?.state ?? 'no-url';
  const siteRead = web === 'read';
  const posts = s?.posts ?? 0;
  // A finding needs complete reaction counts to say anything about reach; the
  // engine already refuses on this, and the register says so out loud.
  const reactionsThin = !s?.engagementReliable
    || (s?.coverage?.engagementKnown ?? 0) < posts;
  const bioLink = !!sheet.profile?.bioLink;

  return CHECKS.map((c): RegisterRow => {
    const hit = fired.get(c.id);
    // A `good` finding is this check running and the answer being fine — the
    // same event as silence, reported. Calling it "flagged" would put "the
    // account is not new" in a list of problems.
    if (hit) {
      return hit.severity === 'good'
        ? { ...c, outcome: { state: 'clear' } }
        : { ...c, outcome: { state: 'flagged', findingId: c.id } };
    }
    for (const g of c.good ?? []) {
      if (fired.has(g)) return { ...c, outcome: { state: 'clear' } };
    }

    const blocked = (why: { ar: string; en: string }): RegisterRow =>
      ({ ...c, outcome: { state: 'not-run', why } });

    // Website checks past the first three need markup, and markup needs a site.
    if (c.source === 'website' && c.id !== 'web-none') {
      if (web === 'no-url') return blocked(WHY.noSite);
      if (web === 'unreadable' || web === 'error-page') return blocked(WHY.siteUnread);
      if (!siteRead) return blocked(WHY.noSite);
    }
    if (c.id === 'ig-bio-linktree' && !bioLink) return blocked(WHY.noLink);
    if ((c.id === 'ig-engagement' || c.id === 'ig-best') && reactionsThin) {
      return blocked(WHY.noReactions);
    }
    if (c.id === 'ig-format') {
      if (posts < FORMAT_MIN_POSTS) return blocked(WHY.tooFewPosts(posts, FORMAT_MIN_POSTS));
      // Comparing formats needs two of them. An account that posts only Reels
      // has not passed this test — there was no comparison to make, and
      // "clear" would read as "your formats are well matched".
      if ((s?.formats?.length ?? 0) < 2) return blocked(WHY.oneFormat);
    }
    if (c.id === 'ig-window' && posts < WINDOW_MIN_POSTS) {
      return blocked(WHY.tooFewPosts(posts, WINDOW_MIN_POSTS));
    }
    return { ...c, outcome: { state: 'clear' } };
  });
}

/** The three counts a reader wants before they read twenty-eight rows. */
export const tallyOf = (rows: RegisterRow[]) => ({
  total: rows.length,
  flagged: rows.filter((r) => r.outcome.state === 'flagged').length,
  clear: rows.filter((r) => r.outcome.state === 'clear').length,
  notRun: rows.filter((r) => r.outcome.state === 'not-run').length,
});
