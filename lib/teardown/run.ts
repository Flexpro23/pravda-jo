import { discover, normaliseHandle, type Profile, type Usage } from '@/lib/meta/discovery';
import {
  readSite, pickWebsite, type SiteRead, type WebsiteSource,
} from '@/lib/meta/website';
import type { Classification } from '@/lib/teardown/classify';
import { computeSignals, type Signals } from '@/lib/teardown/signals';
import { buildFindings, type Web } from '@/lib/teardown/findings';
import { recommend, type Recommendation } from '@/lib/teardown/recommend';
import { inferVertical } from '@/lib/teardown/vertical';
import { VIDEO_JOD_PER } from '@/lib/data/concepts';
import { RETAINER_JOD, type Talent } from '@/lib/data/deals';
import type { Vertical } from '@/lib/data/concepts';
import type { ReadFailure } from '@/lib/data/clients';
import type { Sheet } from '@/lib/store/sheets';

/**
 * Read one business, end to end, and leave a sheet behind.
 *
 * Lifted out of the console's route so the public intake form and an operator
 * typing a handle run the same code. Two entry points computing a report two
 * slightly different ways is the failure this exists to prevent: the client
 * reads one of them and Khaled defends the other.
 *
 * It does not notify anybody and does not touch the client account. Those are
 * the caller's job, because the console wants neither and the intake path wants
 * both — and a function that reads Meta, writes a sheet, updates an account and
 * sends a message is a function nothing can retry safely.
 *
 * The file is in two halves, and the seam matters. `composeSheet` is pure: the
 * same inputs and the same `env` produce byte-identical JSON, which is what
 * lets a golden fixture pin the prose a client actually reads. `runRead` is the
 * half that talks to Meta, to a stranger's web server and to Firestore. The
 * store is therefore loaded on demand *inside* `runRead` rather than at the top
 * of this file: a static `import { saveSheet }` would drag firebase-admin into
 * every process that only wants to compose, and `tests/unit/golden.test.mts`
 * asserts against this file's import lines that it stays that way.
 */

export type RunOk = {
  ok: true;
  sheet: Sheet;
  /** Whether the site read produced anything, and why not when it did not. */
  site: boolean;
  siteProblem?: string;
  /** What Meta says is left of the budget, carried up to the caller's log. */
  usage: Usage;
  /** The read stopped early, so the sheet rests on a prefix of the account. */
  truncated: boolean;
};
export type RunFail = {
  ok: false; reason: ReadFailure; status: number;
  usage: Usage; truncated: boolean;
};

/** HTTP status for each failure, kept here so both callers answer alike. */
const STATUS: Record<ReadFailure, number> = {
  handle: 400, unreadable: 404, throttled: 429,
  unauthorised: 502, 'no-data': 502, network: 502, 'too-few-posts': 422,
};

/** Nothing was read, so nothing is known about the budget either. */
const NO_USAGE: Usage = { appPct: 0 };

/**
 * Above this a guess stands on its own; below it an operator has to say so.
 *
 * `inferVertical` already withholds anything under 0.6 — this is the second,
 * higher bar between "worth showing an operator" and "worth acting on", and it
 * is the one that decides whether `/s` may print a vertical label at all.
 */
export const VERTICAL_CONFIDENT = 0.7;

/**
 * Whether the roster can actually cast this sheet.
 *
 * Three states rather than a boolean because the two failures are different
 * problems: nobody has been added yet, versus the fourteen worked examples the
 * seed writes are still the whole roster. The second one looks fine on every
 * screen in the console and would put invented people on a real prospect's
 * page, so the sheet carries the distinction and `approveSheet` acts on it.
 */
export type RosterState = 'real' | 'placeholder-only' | 'empty';

/**
 * How long a sheet nobody approved lives, matching the client record's own
 * clock exactly (`RETENTION_DAYS` in `lib/store/clients.ts`). The sheet holds
 * strictly more about the business than the client does — the bio, the
 * captions, the site read — so it must not be the thing that outlives it.
 * Computed off `env.now` rather than `Date.now()`, because this function is
 * pure and a golden fixture pins its output byte for byte.
 */
const SHEET_RETENTION_DAYS = 180;

export const rosterStateOf = (roster: Talent[]): RosterState => {
  const hireable = roster.filter((t) => t.active && t.dayRateJOD > 0);
  if (hireable.some((t) => !t.placeholder)) return 'real';
  return hireable.length ? 'placeholder-only' : 'empty';
};

export type ComposeInput = {
  handle: string;
  /** Straight off Business Discovery, not a subset of it. */
  profile: Profile;
  signals: Signals;
  /** Parsed markup, when there was any worth parsing. */
  site: SiteRead | null;
  web: Web;
  roster: Talent[];
  /** What the operator said it is. Always beats what the bio implies. */
  vertical?: Vertical | null;
  /** The URL we actually read, already normalised. */
  website?: string | null;
  /** Which of the three places that URL came from. */
  websiteSource?: WebsiteSource | null;
  /**
   * The read's answer to "what is this business", supplied rather than computed.
   *
   * `classify` talks to a language model, and this function is pure — so the
   * classification arrives as an input exactly like the profile and the site
   * read do, and a golden fixture pins the composed sheet by supplying a fixed
   * one. Absent, the lexicon runs inline as it always did, which is what keeps
   * every existing caller and every existing test working unchanged.
   */
  classification?: Classification | null;
};

/**
 * Everything downstream of the read, with no clock and no random number in it.
 *
 * `env` carries the two things that would otherwise make this untestable: the
 * timestamp and the token. Both are supplied by the caller, so a fixture and a
 * fixed `env` reproduce a sheet exactly.
 */
export function composeSheet(
  input: ComposeInput,
  env: { now: string; token: string },
): Sheet {
  const { profile, signals, site, web, roster } = input;

  // The bio is the business stating what it is, the captions are it talking,
  // and the site's own title says it a third time. All three, then the operator
  // gets the last word.
  const captions = (profile.media ?? []).map((m) => m.caption ?? '');
  const siteText = site
    ? [site.title, site.description].filter(Boolean).join(' ')
    : undefined;
  const verticalGuess = input.classification
    ?? inferVertical(profile.biography ?? '', captions, siteText);

  const operatorSaid = input.vertical ?? null;
  const confidentGuess = verticalGuess.confidence >= VERTICAL_CONFIDENT
    ? verticalGuess.guess : null;
  const vertical = operatorSaid ?? confidentGuess;
  // A guess nudges the ranking in proportion to how sure it is; a person
  // saying "this is a dental clinic" is not a guess at all.
  const verticalConfidence = operatorSaid ? 1 : verticalGuess.confidence;

  const findings = buildFindings(signals, site, web);

  return {
    token: env.token,
    handle: input.handle,
    clientName: profile.name || `@${input.handle}`,
    ...(input.website ? { website: input.website } : {}),
    ...(input.websiteSource ? { websiteSource: input.websiteSource } : {}),
    ...(vertical ? { vertical } : {}),
    verticalGuess,
    // Operator-only, and stored rather than recomputed: the console shows it on
    // the sheet and on the client record, and `/s` never reads it.
    ...(input.classification?.summary
      ? { businessSummary: input.classification.summary } : {}),

    // Public business data, kept for the life of the sheet so an operator can
    // read the bio without opening Instagram in another tab. The picture is
    // stored as a URL and never as bytes — under the PDPL this stays a
    // reference to something the business itself published, and it is removed
    // along with the sheet through the rights flow on /{lang}/data.
    profile: {
      ...(profile.name ? { name: profile.name } : {}),
      ...(profile.biography ? { biography: profile.biography } : {}),
      ...(profile.website ? { bioLink: profile.website } : {}),
      followers: profile.followers_count,
      ...(profile.follows_count === undefined ? {} : { follows: profile.follows_count }),
      mediaCount: profile.media_count,
      ...(profile.profile_picture_url
        ? { profilePictureUrl: profile.profile_picture_url } : {}),
      readAt: env.now,
    },

    signals, site, findings,
    webState: web,
    rosterState: rosterStateOf(roster),
    recommendations: recommend(findings, roster, vertical, 5, { verticalConfidence }),
    chosen: [],
    // A sensible starting offer he can change.
    offer: {
      videos: 6, pricePerVideo: VIDEO_JOD_PER, ads: true,
      adsMonthlyJOD: RETAINER_JOD, totalJOD: 6 * VIDEO_JOD_PER,
    },
    status: 'draft',
    createdAt: env.now, updatedAt: env.now,
    // Cleared by approval and by winning — see `Sheet.expiresAt`.
    expiresAt: new Date(+new Date(env.now) + SHEET_RETENTION_DAYS * 86_400_000).toISOString(),
  };
}

/**
 * The vertical changed, so the five ideas have to change with it.
 *
 * No Meta call and no site read: the findings are already stored and they are
 * what the recommender actually reads. Everything else on the sheet is carried
 * across untouched, which is the property the caller depends on — an operator
 * correcting "restaurant" to "clinic" must not lose the Arabic he wrote or the
 * offer he composed.
 */
export function rerecommend(sheet: Sheet, roster: Talent[]): Sheet {
  const vertical = sheet.vertical ?? null;
  // A vertical that still matches the guess keeps the guess's confidence; one
  // that does not came from a person, and a person is certain.
  const confidence = vertical && vertical === sheet.verticalGuess?.guess
    ? sheet.verticalGuess.confidence
    : 1;
  const recommendations: Recommendation[] = recommend(
    sheet.findings, roster, vertical, 5, { verticalConfidence: confidence },
  );
  return { ...sheet, recommendations, rosterState: rosterStateOf(roster) };
}

export async function runRead(input: {
  handle: string;
  /** What they typed. Falls back to whatever their own bio points at. */
  website?: string;
  vertical?: Vertical | null;
}): Promise<RunOk | RunFail> {
  const handle = normaliseHandle(input.handle ?? '');
  if (!handle) {
    return {
      ok: false, reason: 'handle', status: STATUS.handle,
      usage: NO_USAGE, truncated: false,
    };
  }

  const read = await discover(handle);
  if (!read.ok) {
    const reason = read.reason as ReadFailure;
    return {
      ok: false, reason, status: STATUS[reason] ?? 502,
      usage: read.usage, truncated: false,
    };
  }

  const signals = computeSignals(
    handle, read.profile.followers_count, read.profile.media, 100,
    {
      biography: read.profile.biography,
      website: read.profile.website,
      mediaCount: read.profile.media_count,
    },
  );
  if (!signals) {
    return {
      ok: false, reason: 'too-few-posts', status: STATUS['too-few-posts'],
      usage: read.usage, truncated: read.truncated,
    };
  }

  // The site they gave us, else the one their link field points at, else one
  // written into the bio text. See `pickWebsite`: the third case exists because
  // an account that spends its single link on WhatsApp used to be told, as a
  // critical finding on a page a client reads, that it had no website at all.
  const picked = pickWebsite(input.website, read.profile.website, read.profile.biography);
  const url = picked?.url ?? null;
  const siteRead = url ? await readSite(url) : null;
  const site = siteRead?.ok ? siteRead.site : null;

  // Four states, not two. "They have no site" and "we could not read their
  // site" are different sentences, and only the first is one a client should
  // ever read — the rest leave an operator note instead. An HTTP error page
  // parses perfectly and would otherwise be audited as if it were their site.
  const web: Web = !url
    ? { state: 'no-url' }
    : siteRead && !siteRead.ok
      ? { state: 'unreadable', reason: siteRead.reason }
      : site && site.status >= 400
        ? { state: 'error-page', status: site.status }
        : { state: 'read' };

  // See the file docstring: the store arrives here and nowhere higher up.
  const { saveSheet, mintToken } = await import('@/lib/store/sheets');
  const { listTalent } = await import('@/lib/store/deals');

  // A roster we cannot read is an empty roster, which makes every concept
  // uncastable rather than taking the whole read down. The sheet says so.
  // Classified in parallel with it: the two share no inputs, and a language
  // model that takes a second must not add that second to a person's wait.
  const { classify } = await import('@/lib/teardown/classify');
  const [roster, classification] = await Promise.all([
    listTalent().catch(() => [] as Talent[]),
    classify({
      handle,
      name: read.profile.name,
      bio: read.profile.biography,
      captions: (read.profile.media ?? []).map((m) => m.caption ?? ''),
      siteText: site
        ? [site.title, site.description].filter(Boolean).join(' ')
        : undefined,
      // `classify` never rejects — this catch is for an import that failed, not
      // for the model, and it still leaves the lexicon to answer.
    }).catch(() => null),
  ]);

  const sheet = composeSheet(
    {
      handle, profile: read.profile, signals, site, web, roster,
      vertical: input.vertical ?? null,
      website: url,
      websiteSource: picked?.source ?? null,
      classification,
    },
    { now: new Date().toISOString(), token: mintToken() },
  );
  await saveSheet(sheet);

  return {
    ok: true,
    sheet,
    site: !!site,
    siteProblem: siteRead && !siteRead.ok ? siteRead.reason : undefined,
    usage: read.usage,
    truncated: read.truncated,
  };
}
