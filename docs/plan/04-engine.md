# Teardown engine plan

## Goal
Every number and every sentence the engine emits must be arithmetically correct, sourced from
something a stranger could check, and defensible on a phone call — and each of those claims must be
provable by a test that runs with `npm test` and no network. Concretely: no finding may fire on data
that was never returned, no severity may rest on an undocumented magic constant, no sheet may name a
person who does not exist, and the recommendation for a business must depend on that business rather
than being the same five ideas with the same one sentence attached to each.

## Current state
The pure engine (`signals.ts` → `findings.ts` → `recommend.ts`, glued by `run.ts`) is well-factored
and its docstrings state the right doctrine. The code does not always keep it. Verified by running
the real modules over synthetic fixtures:

- **The engagement sentence is arithmetically false.** 29 posts at 10 engagement + 1 at 3000, 10k
  followers → `A typical post draws 10 reactions against 10,000 followers — 1.1%.` 10/10,000 is
  0.1%. `engagementRate` is the mean of per-post rates; the sentence pairs it with the median count.
  `signals.ts`'s own header says "Median, not mean."
- **An account that hides its like counts is called a failure.** Business Discovery omits
  `like_count` for those accounts; `engagementOf` coerces `undefined → 0`. Result: rate 0%,
  severity `critical`, `Your account reaches a fraction of its own followers … 0 reactions`.
- **`ig-window` fabricates a conflict.** 20 posts, all at 23:00 and 00:00 Amman → peak
  `{from:23,to:1,share:100}`, best `{from:0,to:2}` → `100% of your posts go out between 11pm–1am.
  Your best-performing ones land between 12am–2am.` Same posts, two windows, an accusation invented
  by a one-hour shift of overlapping windows.
- **"There must always be a good finding" is not enforced.** A 10-post account posting monthly with
  no standout post and no site produces `ig-engagement:critical ig-ask:critical` and nothing else.
- **`vertical` is always `null` in production.** `app/api/lead/route.ts` calls
  `runRead({handle, website})`; nothing ever sets it, so the `+18` vertical weight never fires.
- **`uncastable` is never assigned anywhere.** With an empty roster, `recommend` still returns five
  concepts with `cast: []` and no marker.
- **Placeholder talent are recommended.** `recommend` filters `active && dayRateJOD > 0` only;
  `scripts/seed-content.mjs` writes `placeholder: true` on all 14.
- **`because` collapses.** Across the shortlist for a typical read, five concepts carried two
  distinct reasons; for a clean account, five identical ones — the exact degeneracy the docstring
  claims `rarest()` fixed.
- No unit tests exist for any of it; `package.json` has no `test` script.

Everything below is scoped to the sheet pipeline. The legacy `compose.ts` path is touched only where
it duplicates logic that is being fixed.

## Work items — ordered by priority

### 1. Absent engagement is not zero engagement  [S] [tier: opus]
- **Problem:** `engagementOf` in `lib/teardown/signals.ts:94` reads
  `(m.like_count ?? 0) + (m.comments_count ?? 0)`. Business Discovery omits `like_count` entirely
  for accounts that have hidden like counts (an increasingly common setting), and omits both on
  some media types. The engine cannot distinguish "no reactions" from "not told". Verified: a
  30-post fixture with `like_count` undefined yields `engagementRate: 0`, `medianEngagement: 0`,
  `best: null`, and a `critical` finding stating `0 reactions against 10,000 followers`. That
  sentence is defamatory and unprovable, and it is the first thing the prospect reads.
- **Change:**
  - `signals.ts`: add `const likesKnown = (m: Media) => typeof m.like_count === 'number'`. Add to
    `Signals` a block `coverage: { likesKnown: number; commentsKnown: number; engagementKnown: number }`
    counting posts where the field was actually present, and a derived
    `engagementReliable: boolean` = `engagementKnown / posts >= 0.8`.
  - Compute `engagementRate`, `medianEngagement`, `best`, `formats[].medianEngagement`,
    `formats[].shareEngagement` and `bestWindow` **only over posts where engagement is known**, and
    record the denominator used in `coverage`.
  - `discovery.ts`: change `Media.like_count`/`comments_count` to stay optional (already are) and add
    a comment stating the hidden-likes case, so nobody re-introduces `?? 0` upstream.
  - `findings.ts`: gate `ig-engagement`, `ig-format`, `ig-best`, `ig-window` and the `formats` chart on
    `s.engagementReliable`. When it is false, emit a single `notable` finding `ig-likes-hidden`:
    Arabic/English copy saying the account hides its like counts, so nothing about reach can be
    computed from outside — and that comment counts alone are what the rest of the sheet rests on.
    Never a `critical`.
- **Acceptance:** unit test `hidden-likes.test.mts`: 30 posts, `like_count` undefined,
  `comments_count: 0` → `buildFindings` contains no finding whose severity is `critical` and no
  finding whose `detail.en` contains the string `0 reactions`; contains `ig-likes-hidden`. Second
  test: 30 posts where 25 have likes → `engagementReliable === true`, `coverage.engagementKnown === 25`,
  and `engagementRate` computed over 25 not 30.
- **Depends on:** none.

### 2. One engagement rate, and it is the median  [S] [tier: sonnet]
- **Problem:** `engagementRate` (`signals.ts:218`) is `Σ(e_i/followers)/n` — the mean. `findings.ts:100`
  and `compose.ts:97` both pair it with `medianEngagement` in one sentence. Measured divergence on a
  realistic heavy-tailed fixture: stated 1.1%, true median rate 0.1% — an 11× overstatement, in the
  direction that flatters the prospect and undercuts the pitch. Separately, `followers` is today's
  snapshot applied to posts up to years old, which understates old posts on a growing account.
- **Change:**
  - `signals.ts`: rename the existing field to `meanEngagementRate` and add
    `engagementRate = pct(medianEngagement, followers)` as the primary. Add
    `recentEngagementRate` computed over posts in the trailing 90 days only, plus
    `recentPosts: number`, and prefer it in copy when `recentPosts >= 8`.
  - `findings.ts` `ig-engagement`: use the median-based rate; provenance line states the window and
    the count (`محسوب من N منشور خلال آخر ٩٠ يوم`).
  - `compose.ts:93-99`: same substitution, so the legacy specimen cannot disagree with `/s`.
- **Acceptance:** unit test asserting for the heavy-tail fixture that
  `Math.abs(rate - median/followers*100) < 1e-9`, and a string test that the `ig-engagement`
  `detail.en` percentage equals `median/followers` recomputed from the same `Signals` object.
  A grep test asserting `meanEngagementRate` appears in no `findings.ts`/`compose.ts` template literal.
- **Depends on:** 1.

### 3. "No site" vs "we could not read the site"  [M] [tier: opus]
- **Problem:** three distinct states collapse into two, and both mappings are wrong in the case that
  matters most.
  - `run.ts:64-68` computes `siteAsked = !!url`. A prospect who gave no URL **and whose bio has no
    link** gets `siteAsked === false` → **no website finding at all**. `findings.ts`'s own docstring
    says not having a site "is itself the strongest finding in the set" — and that is precisely the
    case where it is silently dropped.
  - When a URL existed and the read failed (timeout, our UA blocked, TLS error, 5xx), `web-none`
    fires: *"There is no site to send anyone to."* The site may be fine. `run.ts` captures
    `siteProblem` and then throws it away — it never reaches `buildFindings`.
  - `readSite` returns `ok: true` for an HTTP 404/500 (`website.ts:154` sets `site.ok = res.ok`).
    `findings.ts` never reads `site.ok` or `site.status`, so an error page is audited: no pixel, no
    viewport, no price → three findings, two of them `critical`, all fabricated.
- **Change:**
  - Replace the `siteAsked: boolean` parameter of `buildFindings` with
    `web: { state: 'no-url' | 'unreadable' | 'error-page' | 'read'; reason?: SiteFailure['reason']; status?: number }`.
  - `run.ts`: derive that state — `no-url` when neither the typed website nor `read.profile.website`
    yields a `normaliseUrl`; `unreadable` when `readSite` returns `ok:false`; `error-page` when
    `site.status >= 400`; else `read`. Pass it through and persist it on the sheet as
    `Sheet.webState` so `/s` and `/ops` can render it.
  - `findings.ts`: `web-none` (critical) fires **only** on `no-url`. On `unreadable` and
    `error-page`, emit no client-facing website finding; instead return them on a new
    `Findings.operatorNotes: {id: string; en: string}[]` that `/s` never renders and `/ops` does.
  - Gate the whole `if (site)` block on `state === 'read'`.
- **Acceptance:** four unit tests, one per state. `no-url` → `web-none` present, no other
  `source: 'website'` finding. `unreadable` → zero `source: 'website'` findings, one
  `operatorNotes` entry naming the reason. `error-page` (status 503) → zero website findings.
  `read` → the pixel/viewport/price findings behave as today. Plus a test that no finding in any of
  the four states has `detail.ar` containing `ما في موقع` unless the state is `no-url`.
- **Depends on:** none.

### 4. The two-hour window: overlap, margin, and confounds  [M] [tier: opus]
- **Problem:** `signals.ts:168-189` slides 24 overlapping two-hour windows and takes the argmax of a
  median over each. Four defects:
  1. **Overlap.** Adjacent windows share an hour of posts, so `bestWindow.from !== peakWindow.from`
     is satisfied by a one-hour shift over the *same* posts. Verified: all posts at 23:00/00:00 →
     `peak {23,1}`, `best {0,2}`, and `ig-window` prints *"100% of your posts go out between
     11pm–1am. Your best-performing ones land between 12am–2am."*
  2. **No margin.** `bestWindow` is the argmax by construction, so its median is `>=` the peak
     window's; the finding fires on a difference of one reaction.
  3. **Multiple comparisons.** Selecting the maximum of 24 correlated medians biases the winner
     upward; the reported number is not an unbiased estimate of that window's performance.
  4. **Confound.** A window that happens to hold the Reels looks "best" because of format, not hour.
  Wrap-around itself is *correct* — `to = (h+2)%24`, `count = byHour[h] + byHour[(h+1)%24]`, and
  h=22 → `{from:22,to:0}` renders "10pm–12am". The one cosmetic defect is `hour(0)` rendering as
  `١٢ الصبح`; Arabic wants `منتصف الليل`.
  `bestWindow`'s sample rule `pool.length >= Math.max(3, posts.length * 0.06)` means 6 posts out of
  100 — a median of six observations driving a recommendation.
- **Change:**
  - `signals.ts`: require windows to be **disjoint** for the comparison — evaluate the 12 windows
    `[0,2) [2,4) … [22,24)` for `bestWindow`, keep the sliding scan for `peakWindow` (which is a
    descriptive statistic, not a comparison).
  - Raise the sample rule to `pool.length >= Math.max(8, posts.length * 0.10)` and store
    `bestWindow.n` (the sample size) and `bestWindow.vsRest` (window median ÷ median of all posts
    outside it).
  - Emit `bestWindow` only when `vsRest >= 1.3` **and** the windows do not overlap
    (`!windowsOverlap(peakWindow, bestWindow)`). Export `windowsOverlap` for testing.
  - `findings.ts` `ig-window`: additionally require `s.peakWindow.share >= 20` (there is a habit to
    contradict) and put `n` and the ratio in `provenance` (`محسوب من N منشور بهاي الساعة`).
  - `findings.ts` `hour()`: `h === 0 → 'منتصف الليل'` / `'midnight'`, `h === 12 → 'الضهر'` / `'noon'`.
- **Acceptance:** unit tests — (a) all posts at 23:00/00:00 → `ig-window` absent; (b) posts split
  evenly 09:00 vs 21:00 with 3× engagement at 21:00 and n≥10 → `ig-window` present, `from` in the
  evening window, provenance contains the sample count; (c) a 1-reaction margin → absent;
  (d) `windowsOverlap({from:23,to:1},{from:0,to:2}) === true`; (e) `span(22,0,true)` renders
  `منتصف الليل` and `span(22,0,false)` renders `10pm–midnight`.
- **Depends on:** 1 (window medians must use known-engagement posts only).

### 5. A teardown that only takes  [M] [tier: sonnet]
- **Problem:** `findings.ts`'s header asserts a `good` finding must always exist. The code has three
  candidates and all three can be absent: `ig-best` needs `multiple >= 2`, `ig-cadence` needs
  `postsPerWeek >= 2`, `web-pixel-good` needs a site with a pixel. Verified: a 10-post account
  posting monthly, no standout, no site → `[ig-engagement:critical, ig-ask:critical]` and nothing
  else. That sheet is unanswerable.
- **Change:**
  - Add computed `good` candidates, each provable from data already in `Signals`/`SiteRead`:
    `ig-longevity` (posting for N months — `s.spanDays`), `ig-format-strength` (the leading format
    carries X% of engagement, framed as an asset rather than a failure — only when `ig-format` did
    **not** fire), `ig-captions` (`medianWords >= 15` — they write, they just do not ask),
    `web-arabic` (`site.lang?.startsWith('ar') || site.hasArabic`), `web-whatsapp-good`,
    `web-price-good`, `web-fast` (`ms < 1500`), `web-mobile-good`.
  - At the end of `buildFindings`, assert the invariant in code: if
    `!f.some(x => x.severity === 'good')`, push the strongest available fallback (`ig-longevity`
    always qualifies once `spanDays >= 30`; below that, `ig-live` — "the account is active, N posts
    in the window"). Never push an empty or placeholder-bearing finding.
  - Cap the good findings shown to 3 so the sheet does not turn into a compliment.
- **Acceptance:** property test over ≥12 fixtures (dull account, hidden likes, single-format,
  two-post minimum, no site, error-page site, perfect site, burst account, dormant account,
  captionless account, zero-follower account, one-post-per-quarter account): for every one,
  `findings.some(f => f.severity === 'good')` is true, and no `good` finding's copy contains `⟦`.
- **Depends on:** 1, 3.

### 6. Nobody real is on this roster  [M] [tier: opus]
- **Problem:** three separate leaks.
  1. `recommend.ts:88` filters `t.active && t.dayRateJOD > 0`. `scripts/seed-content.mjs:95` writes
     `placeholder: true` on every seeded talent. A real prospect's sheet therefore names Omar, Rana,
     Zaid — invented people — and `convert.ts` will book them.
  2. `Recommendation.uncastable` is declared (`recommend.ts:48`) and assigned nowhere. With an empty
     roster, `recommend` returns five recommendations with `cast: []` and no marker; `/s` renders
     five ideas with no cast and no explanation.
  3. `castFor` (`recommend.ts:279`) takes a videographer **unconditionally**, for every concept.
     Concept 4 ("The Thread") has `crew: "editor"`, `location: "none"` and no camera; verified it is
     cast with a videographer. Concepts asking for `producer`, `photographer`, `motion designer`,
     `sound operator`, `AI operator`, `crew driver` and `female videographer` (17 distinct crew
     strings across the library) are silently uncast, so the cast block understates the crew every
     time. `modelsNeeded` defaults to `1` for any unrecognised cast string.
- **Change:**
  - `recommend.ts`: add `.filter(t => !t.placeholder)` to `bookable`, behind an explicit
    `allowPlaceholders` option that only `/ops` may pass (so the console can still preview).
  - Derive required disciplines from `c.production.crew` rather than assuming: parse the
    comma-separated list, map `videographer|second videographer|female videographer → videographer`,
    `voice actor → voiceover`, and treat `editor|producer|photographer|motion designer|sound
    operator|AI operator|crew driver` as **noted but not cast** — return them on
    `Recommendation.crewNotes: string[]` so the sheet can say what a day needs without pretending
    the roster covers it. A concept whose crew has no videographer casts none.
  - Set `uncastable` whenever a required discipline cannot be filled, with the reason
    (`'no videographer on the roster'`, `'needs 3 models, 2 bookable'`, `'needs a voiceover, none
    bookable'`). Keep the existing hard filters, but when **fewer than `want`** concepts survive
    them, fill the remainder with the next-best uncastable ones so the sheet is never short — and
    mark them.
  - `modelsNeeded`: return `null` (unknown) rather than `1` for an unrecognised cast string, and
    treat unknown as uncastable rather than as one model.
- **Acceptance:** unit tests — (a) roster of 14 all `placeholder: true` → every recommendation has
  `cast: []` and a non-empty `uncastable`; (b) mixed roster → no `CastPick.talentId` belongs to a
  placeholder; (c) concept 4 → `cast` contains no videographer, `crewNotes` contains `editor`;
  (d) roster with 2 models → concept 26 (8 models) either absent or present with
  `uncastable` set; (e) `recommend(fx, roster, null, 5).length === 5` for an empty roster.
- **Depends on:** 21.

### 7. Cadence, span and dormancy  [S] [tier: sonnet]
- **Problem:** `spanDays` (`signals.ts:121`) is first-post to last-post **within the read window**,
  which is the last ~100 posts. Verified on a burst fixture (40 posts over 54 hours, two years ago):
  `spanDays 2.25`, `postsPerWeek 124.4`, and `ig-cadence` fires as a **`good`** finding reading
  *"124.4 posts a week across 0 months. Volume is not your problem."* — `n0(spanDays/30)` rounds to
  zero, the present tense is false, and the account has not posted since 2024. There is no dormancy
  signal anywhere in `Signals`.
- **Change:**
  - `signals.ts`: add `daysSinceLast = (Date.now() - +new Date(last)) / 86_400_000` and
    `activeSpanDays = Math.max(1, (Date.now() - +new Date(first)) / 86_400_000)`. Compute
    `postsPerWeek` over the trailing 90 days (`recentPosts / (90/7)`), keeping the read-window
    figure as `postsPerWeekInWindow` for the provenance line.
  - `findings.ts`: `ig-cadence` requires `daysSinceLast <= 21`; replace `n0(spanDays/30)` with a
    `months()` helper that says weeks below 60 days (`٦ أسابيع` / `6 weeks`) and never prints `0`.
    Add `ig-dormant` (`critical`) when `daysSinceLast >= 45`: *"the account has not posted in N
    days"*, with the last post's date.
  - `compose.ts:109` uses the same `postsPerWeek` field, so it moves with it.
- **Acceptance:** unit tests — burst fixture → `ig-cadence` absent, `ig-dormant` present with the
  correct day count; a healthy 3/week account → `ig-cadence` present and its `detail.en` contains no
  ` 0 ` token; a fixture with `spanDays === 20` → copy reads "3 weeks", not "0 months". A regression
  test asserting no finding's `detail.en` or `detail.ar` matches `/\b0\s+(months|شهر)\b/`.
- **Depends on:** none.

### 8. "Strongest format" needs a real test  [M] [tier: opus]
- **Problem:** `signals.ts:141-146`: `lead.posts >= 3 && (!runnerUp || lead.median >= runnerUp.median * 1.5)`.
  - When `runnerUp.medianEngagement === 0`, the threshold is `0` and any non-zero lead wins.
    Verified: 5 Reels at 1 reaction vs 5 images at 0 → REELS declared strongest with
    `shareEngagement: 100`. If the image count were 6, `ig-format` would fire as `critical` and tell
    a business that "Reels carry 100% of all engagement" on the strength of five reactions.
  - No minimum sample on the *runner-up*; a single-post format can set the bar.
  - `1.5` is undocumented and compares only the top two medians, not the lead against the rest.
  - No absolute floor: the whole comparison can rest on single-digit engagement.
- **Change:**
  - `signals.ts`: require `lead.posts >= Math.max(5, posts.length * 0.10)`,
    `runnerUp.posts >= 3`, `lead.medianEngagement >= 5` (an absolute floor, so nothing is declared on
    noise), and `lead.medianEngagement >= Math.max(runnerUp.medianEngagement * 1.5, overallMedian * 1.25)`.
  - Add a distribution-free confirmation rather than a bare ratio: a two-sample permutation test on
    the medians (shuffle format labels `2000×`, count how often the observed median difference is
    matched). Store `strongest.p` and require `p <= 0.05`. It is ~30 lines, deterministic with a
    seeded PRNG, and it is the difference between "Reels do better" and "Reels do better and we can
    say why we believe it".
  - Store the constants as named exports (`FORMAT_MIN_POSTS`, `FORMAT_MIN_MEDIAN`, `FORMAT_RATIO`,
    `FORMAT_ALPHA`) with a comment on each stating what it is protecting against.
  - `findings.ts`: `ig-format` provenance carries the post counts of both formats.
  - `charts.formats`: `floor = Math.min(...)` becomes `Math.max(1, Math.min(...))` and the note says
    the bars are relative to the weakest format, which is already true but not obvious when a floor
    of 0 silently becomes 1.
- **Acceptance:** unit tests — 5 Reels @1 vs 6 images @0 → `strongest === null`, no `ig-format`;
  20 Reels @120 vs 20 images @30 → `strongest.format === 'REELS'`, `p <= 0.05`; 3 Reels @200 vs 40
  images @30 → `strongest === null` (sample floor); permutation test is deterministic across two
  runs on the same input.
- **Depends on:** 1.

### 9. What a Jordanian caption actually asks  [M] [tier: opus]
- **Problem:** `asks()` (`signals.ts:97-102`) drives the heaviest recommendation weight (`ig-ask`,
  +30) and a `critical` finding, on a regex that misses most real Jordanian CTAs and over-counts in
  the other direction.
  - **Arabic misses, all common in Amman business captions:**
    `للحجز` and `الحجز` (does not contain `احجز` — this is *the* standard booking caption, usually
    `للحجز والاستفسار`), `للطلب` (does not contain `اطلب`), `استفسار` / `للاستفسار`, `اتصل` /
    `اتصلوا` / `كلمنا` / `رقمنا`, `راسلنا` / `راسلونا` / `ابعتلنا` / `بعتلنا`, `احكيلنا`,
    `سجل` / `التسجيل` / `سجلوا` (the whole `edu` vertical), `اشترك` / `الاشتراك` (gyms),
    `جرب` / `جربوا`, `تابعنا` / `تابعونا`, `متوفر` / `متوفر عنا`, `بنستناكم` / `بانتظاركم`,
    `واتساب` / `وتس`, `الرابط في البايو` and `لينك بالبايو` (only `الرابط بالبايو` is listed),
    `لا تفوّت`, `عرض لفترة محدودة`.
  - **Orthography:** `رنّ` is written with shadda; an unshaddaed `رن` misses. Hamza variants
    (`إطلب`, `أحجز`) miss `اطلب`/`احجز`. No normalisation of tashkeel, `أإآ→ا`, `ى→ي`, `ة→ه`.
  - **English misses:** plurals and inflections are blocked by `\b` (`orders`, `booking`, `DMs`,
    `visits`); missing `message`, `whatsapp`, `shop`, `sign up`, `register`, `reserve`, `click`,
    `save this`, `try`, `available now`, `inbox`, `chat`, `buy`.
  - **Over-count:** a bare `؟` counts as an ask, so rhetorical engagement bait ("مين بيحب القهوة؟")
    is scored as a call to action while a real CTA in dialect is missed — errors in both directions
    on the same number.
  - **Wrong denominator:** `askingShare = pct(asking, posts.length)` while the finding guards on
    `withCaption > 0`. A set where half the posts have no caption halves the share for a reason the
    copy never mentions.
- **Change:**
  - New `lib/teardown/arabic.ts`: `normaliseAr(s)` (strip `ً-ْـ`, `أإآٱ→ا`, `ى→ي`,
    `ة→ه`, `ؤ→و`, `ئ→ي`, collapse whitespace) and a `CTA_AR` / `CTA_EN` lexicon exported as arrays
    so the list is reviewable and testable rather than buried in a regex literal. Build the regexes
    from the arrays.
  - `signals.ts`: split into `captions.asking` (a CTA is present) and `captions.questioning` (a `؟`
    or `?` is present), report both, and base `ig-ask` on **CTA presence only**. Denominator becomes
    `withCaption`; add `captions.none` (posts with no caption at all) and a separate finding
    `ig-no-caption` when `none / posts >= 0.25`.
  - `findings.ts` `ig-ask`: copy becomes `N من M منشور فيهم طلب واضح` where M is `withCaption`, and
    the provenance says how many posts carried no caption.
- **Acceptance:** a fixture file of ≥40 real-shaped Arabic captions, each labelled `cta: true|false`
  by hand, checked into `tests/fixtures/captions.ar.json`. Test asserts ≥90% agreement, and asserts
  specifically that `للحجز والاستفسار`, `للطلب اتصلوا`, `راسلنا ع الواتساب`, `سجل هلأ`,
  `الرابط في البايو`, `إطلب اونلاين` all return true, and that `مين بيحب القهوة؟` returns
  `cta: false, question: true`. Plus a test that `normaliseAr` is idempotent.
- **Depends on:** none.

### 10. The engine does not know what business it is reading  [L] [tier: opus]
- **Problem:** `Vertical` reaches `recommend` only through `runRead(input.vertical)`, and
  `app/api/lead/route.ts:83` calls `runRead({handle, website})`. Verified by grep: nothing in
  `app/`, `components/` or `lib/store/` ever sets it. So `score += 18` at `recommend.ts:111` never
  fires, `shortlist(v)` is never called with a vertical, and the five ideas offered to a dental
  clinic and to a shawarma shop are chosen by the same tie-breaks. Meanwhile `profile.biography` —
  the single best vertical signal available — is fetched by `discovery.ts` and discarded.
- **Change:**
  - New `lib/teardown/vertical.ts`, pure: `inferVertical(bio: string, captions: string[], siteText?: string)`
    → `{ guess: Vertical | null; confidence: number; runnerUp: Vertical | null; evidence: {vertical: Vertical; term: string; hits: number}[] }`.
    Implementation: a per-vertical AR+EN keyword lexicon (`food`: مطعم، كافيه، قهوة، شاورما، حلويات،
    delivery, menu; `body`: عيادة، تجميل، أسنان، ليزر، بشرة، clinic, dermatology; `fitness`: جيم،
    نادي، اشتراك، تمرين، coach; `property`: شقة، للبيع، للإيجار، عقار، متر; `auto`: سيارة، صيانة،
    تأمين، كوشوك، detailing; `edu`: دورة، تدريب، كورس، تسجيل، شهادة; `retail`: متجر، توصيل، مقاسات،
    تشكيلة، collection; `pro`: محاماة، محاسبة، استشارات، خدمات). Score = normalised hits, weighting
    the bio 3× a caption. `confidence = topScore / (topScore + runnerUpScore)`, `null` below 0.6 or
    below a minimum absolute hit count. Run every input through `normaliseAr` from item 9.
  - `run.ts`: call it with `read.profile.biography ?? ''` and the read captions; store
    `Sheet.verticalGuess = {guess, confidence, evidence}` **always**, and set `Sheet.vertical` from
    the guess only when `confidence >= 0.7`. `input.vertical` (operator-supplied) always wins.
  - `recommend.ts`: scale the vertical bonus by confidence — `score += Math.round(18 * confidence)` —
    so a weak guess nudges rather than decides.
  - Operator override: `Sheet.vertical` becomes settable from `/ops/sheet/[token]` (a select of the
    eight `VERTICAL_LABEL` entries plus "unknown"), and changing it **re-runs `recommend` against the
    stored `findings` and roster** without re-reading Meta. Expose that as a small
    `rerecommend(sheet, roster)` helper in `run.ts` so the route does not re-implement it.
  - `/s` renders `VERTICAL_LABEL[vertical]` only when it was operator-confirmed; a guess is never
    shown to the client.
- **Acceptance:** unit tests over ≥16 labelled bio fixtures (two per vertical) asserting the guess
  and that `confidence` is in `[0,1]`; a test that an empty bio returns `guess: null`; a test that
  `recommend` with `vertical: 'food'` and with `null` produce different concept sets for the same
  findings (verified today that they do: `#9, #11` enter the shortlist under `food`). Integration
  check: `rerecommend` on a stored sheet changes `recommendations` and touches nothing else.
- **Depends on:** 9 (`normaliseAr`), 11.

### 11. Five ideas that are actually five ideas  [M] [tier: opus]
- **Problem:** measured over the real `CONCEPTS` array:
  - **`because` degenerates.** For a typical read the five recommendations carried two distinct
    reasons (3 × *"Because it is the format already working for them"*, 2 × *"Because it asks the
    viewer for something"*); for a clean account, five identical ones. `rarest()` sorts by frequency
    across the shortlist and ties break on array order, so the whole shortlist lands on the same
    minimum. This is the exact failure the docstring at `recommend.ts:198-206` claims to have fixed.
  - **The traits are not discriminating.** `showsAFace` is true for 24 of 30 concepts (80%), so
    `ig-engagement`'s +20 is almost a constant. `statesPrice` is true for 14 of 30, partly because
    `the number` matches concept titles like *The Forty Fils Number*. `isShortVideo` is 14 of 30.
    `answersQuestions` is the only genuinely selective one (7 of 30).
  - **Near-duplicates fill the list.** `#1 The Inbox Twelve`, `#2 The Forty Fils Number`,
    `#3 We Say No To This`, `#9 Status Thirty`, `#12 What 95K Buys` are all client-fronted,
    one-setup, talking-head pieces. Three of five in the measured shortlist were the same shape.
  - **The library forbids one of them and the engine sells it anyway.** `#4 The Thread`'s own `why`
    says it "must never be priced like a shot video … never one of three headline concepts in a
    Teardown". Verified in the shortlist at 8 videos × 150 = **1200 JOD**.
- **Change:**
  - `lib/data/concepts.ts`: add two fields to `ConceptSource` — `shape: 'talking-head' | 'ugc' |
    'screen-record' | 'product' | 'observational' | 'documentary' | 'graphics'` and
    `headline: boolean` (false for `#4`, and for anything else whose `why` says retainer filler).
    Populate all 30 by reading each entry's `format`/`premise`.
  - `recommend.ts`: filter `c.headline !== false` out of the shortlist pool (keep them available to
    the console as add-ons). Enforce diversity after scoring: greedy selection with **at most 2 per
    `shape`** and **at most 2 sharing an identical `answers` set**, taking the next-best candidate
    when a bucket is full.
  - Fix `rarest`: compute the deciding answer as the one with the lowest shortlist frequency
    **that has not already been used as a reason by an earlier recommendation**; keep a `usedReasons`
    set. Fall back to the honest generic sentence rather than repeating. Add a post-condition: at
    most one recommendation may carry the generic fallback.
  - Sharpen `traits`: drop `the number` from `statesPrice` (title bleed); match `statesPrice` against
    `premise` and `format` only, not `name`; make `showsAFace` require `modelsNeeded > 0 ||
    /talking.head|to camera|straight to lens/`, dropping the bare `owner|staff|principal` which
    appears in almost every `premise`. Re-measure the trait distribution after the change and check
    each trait fires for between 15% and 60% of the library.
  - Keep `want = 5`. It is right: `approveSheet` requires exactly 3 chosen, and 5 gives a real
    choice without making the review page a scroll — but 5 is only defensible once the diversity
    constraint above holds, which is the actual problem.
- **Acceptance:** unit tests — (a) for each of 6 finding-set fixtures, `new Set(recs.map(r =>
  r.because.en)).size >= 4`; (b) no recommendation has `conceptN === 4`; (c) no more than 2
  recommendations share a `shape`; (d) a re-measurement script asserting every trait's hit rate over
  `CONCEPTS` is within `[0.15, 0.60]`; (e) determinism — `recommend` over a reversed roster and a
  reversed concept array produces the same `conceptN` sequence (today it is already stable under a
  roster shuffle; that must survive the change).
- **Depends on:** none.

### 12. Say where every threshold came from  [S] [tier: sonnet]
- **Problem:** three severity gates are magic numbers presented with the authority of measurement.
  `rate < 1` → `critical` (`findings.ts:92`); `askingShare < 25` → `critical` (line 151);
  `site.ms > 3000` → `notable` (line 275). The 1% is an industry rule of thumb, which the module
  header explicitly forbids ("no benchmark, no estimate"); the 25% is unsourced; the 3000ms has a
  defensible neighbour it is not using.
- **Change:**
  - Hoist all thresholds to a named, exported `THRESHOLDS` object at the top of `findings.ts`, each
    with a one-line comment naming its basis and the date it was set.
  - `rate`: keep the gate but re-base it as **self-referential** — `critical` when the median rate is
    below the account's own 25th-percentile post rate over the trailing 90 days, or simply when
    `medianEngagement < 10` in absolute terms. Never state or imply a sector benchmark in the copy;
    the current title ("reaches a fraction of its own followers") is already self-referential and
    should stay.
  - `askingShare`: `critical` below 10%, `notable` below 30%. Document that the split is an editorial
    judgement about what a sheet should lead with, not a measurement — and say so in the code, not
    in the client copy.
  - `site.ms`: adopt Google's published Core Web Vitals boundaries as the cited basis — `notable`
    above 2500ms, `critical` above 4000ms — and cite them in the comment. See item 17 for why the
    *copy* must change too.
  - Add a test-only export `THRESHOLDS` so the tests assert against the constant, not a literal.
- **Acceptance:** a test importing `THRESHOLDS` and asserting each finding flips severity exactly at
  the boundary (`value = T`, `T - ε`, `T + ε`). A grep test asserting no numeric literal appears in a
  severity ternary in `findings.ts`.
- **Depends on:** 2, 17.

### 13. The bio is read and thrown away  [M] [tier: sonnet]
- **Problem:** `discovery.ts:41-44` requests `name`, `biography`, `website`, `follows_count`,
  `media_count`, `profile_picture_url`, `ig_id` and verifies they return. `run.ts` uses `name` and
  `website` and discards the rest. Consequences:
  - No finding about the bio, which for a DM-first market is the cheapest and highest-leverage fix
    on the whole sheet: a business with no link and no WhatsApp route in its bio has no path from a
    profile visit to a conversation.
  - `Signals.shallow` says "fewer than we asked for" but `media_count` — which would let the sheet say
    *"we read 100 of your 480 posts"* — is not stored, so the shallow provenance line in
    `compose.ts:227` cannot be made accurate.
  - The operator opening `/ops/sheet/[token]` cannot see the bio text, the follower/following ratio,
    or the bio link, and has to open Instagram in another tab.
- **Change:**
  - `sheets.ts`: add `Sheet.profile?: { name?: string; biography?: string; bioLink?: string;
    followers: number; follows?: number; mediaCount: number; profilePictureUrl?: string; readAt: string }`.
    Do **not** store `profile_picture_url` bytes, only the URL, and add a comment noting the PDPL
    position: this is public business data, stored for the life of the sheet, deletable through the
    `/{lang}/data` rights flow.
  - `run.ts`: populate it from `read.profile`.
  - `signals.ts`: accept `mediaCount` and expose `readShare = posts / mediaCount`.
  - `findings.ts`: new `ig-bio-noroute` (`critical`) when the bio contains no URL **and** no
    WhatsApp/phone route — copy: a stranger who opens the profile has nowhere to go. New
    `ig-bio-good` (`good`) when both a link and a WhatsApp route are present. Detection uses the same
    lexicon module from item 9 plus a `wa.me|api.whatsapp|07\d{8}|\+962` scan.
  - `/ops/sheet/[token]`: render the bio verbatim, the follower/following ratio, and
    `read N of M posts`.
- **Acceptance:** unit tests over bio fixtures — empty bio → `ig-bio-noroute` critical; bio with
  `wa.me/9627…` → `ig-bio-good`; bio with a linktree URL → neither `noroute` nor `good` (a link but
  no direct route → `notable` `ig-bio-linktree`). Sheet-shape test asserting `profile.biography` is
  persisted and that `profile` contains no field not on the declared type.
- **Depends on:** 9.

### 14. Discovery: the failure modes that leave a client stuck  [M] [tier: opus]
- **Problem:**
  - **`page()` has no try/catch and no timeout** (`discovery.ts:114-123`). A TCP reset or DNS failure
    throws out of `discover()`, out of `runRead`, into the `after()` block in
    `app/api/lead/route.ts` — which catches it and writes `failed/network`, so the lead survives, but
    the read is lost with no detail and no retry. A *hung* connection has no `AbortSignal` at all and
    holds the Cloud Run request until the platform kills it.
  - **Pagination discards work on a budget check.** `if (attempt.usage >= 95) return throttled` runs
    *after* a successful fetch, so a second page that lands at 96% throws away the 100 posts already
    in `profile`. Returning a shallow-but-real profile is strictly better.
  - **No page cap.** The loop's only exits are `!after`, `batch.length === 0`, and
    `media.length >= posts`. A cursor that repeats would spin.
  - **Retry is too narrow and too blunt.** Only `code === 110 || error_subcode === 2207013` retries,
    once, after a fixed 700ms with no jitter. Graph's classic transients — `code 1`, `code 2`, and
    bare HTTP 500/502/503 with no error body — do not retry at all.
  - **Error map gaps:** `803` (alias not found) and `100`/subcode `33` (object does not exist or no
    permission) are the ordinary shapes of a typo'd or renamed handle and both currently map to
    `network` (502) rather than `unreadable` (404). A 200 response carrying `body.error` is not
    checked at all.
  - **Usage is never surfaced.** `appUsage` is computed and used for one comparison; nobody can see
    that the app is at 80%. `x-business-use-case-usage` (which carries
    `estimated_time_to_regain_access`) is not parsed.
- **Change:**
  - Wrap the `fetch` in `page()` in try/catch returning `{res: null, body: null, usage: 0, threw: e}`;
    add `signal: AbortSignal.timeout(15_000)`.
  - Add `retry(fn, {attempts: 3, baseMs: 400, jitter: true})` and apply it to `110/2207013`,
    `code 1`, `code 2`, thrown errors, and HTTP `429/500/502/503`. Cap total time at ~8s.
  - Move the usage check: when `usage >= 95` **and** `profile` already has media, break out and
    return the partial profile with `truncated: true` rather than `throttled`. Only return
    `throttled` when nothing was read.
  - Add `let pages = 0; if (++pages > Math.ceil(posts / PAGE) + 1) break;` and a guard that the new
    `after` cursor differs from the previous one.
  - Extend the error map: `803`, `100` (and `100`/`33`) → `unreadable`; check `body?.error` even when
    `res.ok`; keep everything else.
  - Add `usage: { appPct: number; businessPct?: number; regainSec?: number }` to `DiscoveryResult`
    (both branches), parsing `x-app-usage` and `x-business-use-case-usage`. `run.ts` puts it on
    `RunOk`/`RunFail`; `/ops` shows it. Lower the hard stop to 90 and add a soft warning at 75.
  - Persist `name`/`biography`/`website` on the sheet — covered by item 13. Answer to the brief's
    question: **yes**, and the bio in particular, because it is the operator's fastest read of the
    business and the input to the vertical inference.
- **Acceptance:** unit tests against a fake `fetch` injected via a module-level
  `export const _fetch = { impl: globalThis.fetch }` seam (no network): (a) `fetch` throws →
  `{ok:false, reason:'network'}`, never a rejected promise; (b) two 500s then a 200 → `ok:true`;
  (c) `x-app-usage` at 96 on page 2 with 100 posts already read → `ok:true` with 100 posts and
  `truncated: true`; (d) a repeated `after` cursor terminates within 3 calls; (e) error codes
  `803`, `100/33`, `4`, `190`, `110`-twice each map to the documented reason; (f) a 200 carrying
  `body.error.code === 190` → `unauthorised`.
- **Depends on:** none.

### 15. The SSRF guard is bypassed by a redirect  [M] [tier: opus]
- **Problem:** `website.ts:83-109` resolves the hostname and rejects private ranges, and its
  docstring claims the SSRF shape is defended. Then `readSite` calls `fetch(url, {redirect: 'follow'})`
  — so a public host that 302s to `http://169.254.169.254/` is followed, unchecked. The guard also
  validates only the first address returned by `lookup()` while `fetch` re-resolves independently
  (a DNS-rebinding TOCTOU). Separately, `const html = (await res.text()).slice(0, 800_000)` buffers
  the **entire** body before slicing, so the size cap protects the parser and not the process; and
  `bytes: Buffer.byteLength(html)` reports the *sliced* length, so `bytes` is wrong for any page
  above the cap. There is no `content-type` check, so a 300MB video linked as a "website" is fully
  downloaded.
- **Change:**
  - `redirect: 'manual'`, follow at most 5 hops in a loop, running `resolvable()` on each hop's
    hostname before fetching it, and refusing a hop that changes scheme from https to http.
  - Reject early on `content-length > 5_000_000` and on a `content-type` that is not
    `text/html`/`application/xhtml+xml` (return a new `SiteFailure` reason `not-html`).
  - Stream the body: read `res.body` with a byte counter, stop and cancel at 800 KB, and report
    `bytes` as the **true** byte count when `content-length` is present, else the bytes read plus a
    `truncated: true` flag.
  - Add a `lookup` injection seam so `resolvable` is unit-testable without DNS.
- **Acceptance:** unit tests with an injected fetch and lookup — (a) a 302 to `169.254.169.254`
  returns `{ok:false, reason:'blocked'}` and the second fetch is never issued; (b) 6 hops →
  `unreachable`; (c) `content-type: video/mp4` → `not-html`; (d) a 2 MB HTML body is truncated at
  800 KB, `truncated: true`, and the parser still returns; (e) `content-length: 9_000_000` → refused
  before any body is read.
- **Depends on:** none.

### 16. What else the page will tell us for free  [L] [tier: sonnet]
- **Problem:** `readSite` extracts 20 facts and stops well short of what is cheap, unambiguous and
  directly saleable by an agency that runs the ads.
- **Change:** extract the parsing half of `readSite` into a pure exported
  `parseSite(html: string, finalUrl: string): SiteFacts` (this is also what makes item 19's tests
  possible), and add:
  - **Language routing:** all `<link rel="alternate" hreflang="…">` values as `hreflangs: string[]`;
    `hasArabicRoute = hreflangs.some(h => h.startsWith('ar'))`. A site with no Arabic route in Amman
    is a finding (`notable`) — it is also unambiguous, which the current `hasArabic` scan is not
    (one Arabic word in a footer sets it today).
  - **Structured data:** parse every `<script type="application/ld+json">`, collect `@type` values.
    Report `schemaTypes: string[]`, `hasLocalBusiness`, `hasProductOffers`, `hasOpeningHours`,
    `hasPostalAddress`, `hasAggregateRating`. Wrap each `JSON.parse` in try/catch — malformed JSON-LD
    is common and must not take the read down.
  - **Indexability:** `canonical` (and `canonicalMatchesFinalUrl`), `<meta name="robots">` content,
    `noindex: boolean`. A live commercial site accidentally carrying `noindex` is the single most
    valuable free finding available and costs one regex.
  - **More pixels:** Snap (`sc-static.net`, `snaptr(`), Google Ads conversion
    (`googleadservices.com/pagead/conversion`), Meta CAPI hint (`fbevents.js` present without
    `fbq('init'`), and **extract the pixel id** via `fbq\(\s*['"]init['"]\s*,\s*['"](\d{15,16})['"]`
    → `metaPixelId?: string`, so the operator can confirm it is a real id rather than a pasted
    placeholder.
  - **Platform fingerprint:** `platform?: 'shopify'|'woocommerce'|'wix'|'squarespace'|'salla'|'zid'|'wordpress'|'webflow'|'custom'`
    from well-known markers. This changes the pitch materially — "your Salla store has no pixel" is a
    different conversation from "your site has no pixel".
  - **Booking widgets:** `booking?: string` from Calendly, Fresha, Booksy, SimplyBook, Setmore,
    Acuity, Zoho Bookings.
  - **How the sale actually closes:** keep `whatsapp` (a click-to-chat link) but add
    `whatsappNumber?: string` (extracted from `wa.me/(\d+)` and validated with the existing
    `msisdn()` from `lib/notify/whatsapp.ts`), and add `phoneInText: boolean` — a `07…`/`+962…`
    pattern in the visible copy with no `tel:` and no `wa.me`. That is exactly the claim the current
    `web-whatsapp` copy already makes ("the site gives a number but no WhatsApp link") and cannot
    currently support. Branch the copy on it: no number at all is a different, worse finding.
  - **HTTP→HTTPS:** `normaliseUrl` forces `https://` on a bare domain, so an HTTP-only site currently
    reads as `unreachable`. Try https; on a TLS/connection failure retry `http://` and record
    `scheme: 'https' | 'http-only'`; separately issue one `HEAD http://host/` to record
    `httpRedirectsToHttps: boolean`. An HTTP-only checkout in 2026 is a `critical`.
  - **`robots.txt` / `sitemap.xml`:** two cheap `HEAD`s (subject to the same redirect guard),
    reported as `hasRobots` / `hasSitemap`.
  - Corresponding findings in `findings.ts`, each with a provenance line naming the markup it read.
    Keep the rule: every new finding turns on a boolean or a number this function returns.
- **Acceptance:** `tests/fixtures/sites/*.html` — 10 fixtures (Shopify with pixel, Salla without,
  WordPress noindex, HTTP-only, Arabic-only, hreflang pair, JSON-LD LocalBusiness, malformed JSON-LD,
  wa.me link, bare phone number in copy). A table-driven test asserts the expected `SiteFacts` for
  each, with `parseSite` called directly and no network. A test asserting malformed JSON-LD does not
  throw.
- **Depends on:** 15.

### 17. Say honestly what `ms` measured  [S] [tier: opus]
- **Problem:** `site.ms` is the wall time of one cold `fetch` of the HTML document from a Cloud Run
  instance in an unstated region: one TCP+TLS handshake, no connection reuse, no cache, no
  subresources, no JavaScript, no render. `findings.ts:283` calls it *"The page took N seconds to
  load for us, on a good connection"*, which describes a page load. It is not one — it is
  time-to-HTML, it is a single noisy sample, and "on a good connection" is an assertion about
  network conditions we did not measure. For a site behind Cloudflare the first request is also the
  worst one we will ever see.
- **Change:**
  - Take **three sequential samples** of the final URL, discard the first (cold connection), and
    report `ms` as the **median of the remaining two**, alongside `msSamples: number[]`,
    `msCold: number`, `ttfbMs: number` (time to headers, measured separately from time to full body)
    and `bytes`.
  - Rewrite the copy to describe exactly the measurement:
    AR: `الصفحة (HTML بس، بدون صور) وصلتنا بـ N ثانية من ثلاث محاولات — قبل ما تحمّل أي صورة.`
    EN: `Your HTML alone — before a single image — took N seconds to reach us across three requests.`
    Provenance: `مقاس من خارج الأردن · ثلاث قراءات · وسيط` / `Measured from outside Jordan · three
    reads · median`.
  - Severity from the CWV boundaries in item 12, with the comment stating that this is a document
    fetch and **not** LCP, so the boundary is being used as a conservative proxy.
  - Note in the module docstring that a real LCP number would need PageSpeed Insights (one extra
    external dependency and an API key) and is deliberately out of scope for the cold read.
- **Acceptance:** unit test with an injected fetch returning 100/900/1100ms → `ms === 1000`,
  `msCold === 100`, `msSamples.length === 3`. A copy test asserting the `web-slow` `detail.en`
  contains `HTML` and does not contain the bare phrase `to load`.
- **Depends on:** 15, 12.

### 18. A sheet that can be built without a clock or a random number  [S] [tier: sonnet]
- **Problem:** `runRead` mixes I/O (Meta, the site, Firestore) with pure composition, and reaches for
  `mintToken()` (`randomBytes`) and `new Date()` inline. Nothing downstream of the read can be
  snapshot-tested.
- **Change:** extract from `run.ts` a pure
  `composeSheet(input: { handle; profile; signals; site; web; roster; vertical }, env: { now: string; token: string }): Sheet`.
  `runRead` becomes: read → compose → `saveSheet`. Add the `rerecommend(sheet, roster)` helper from
  item 10 alongside it.
- **Acceptance:** `composeSheet` imports nothing from `lib/store/*` or `node:crypto` (assert with a
  test that reads the file's import list). Given identical inputs and `env`, two calls produce
  byte-identical JSON.
- **Depends on:** 3, 6, 10.

### 19. Unit tests, fixtures, and `npm test`  [L] [tier: sonnet]
- **Problem:** the pure engine — the part where every client-facing number is decided — has no tests
  at all. The four `tests/*.itest.mts` files need live Firestore credentials and are not run by
  anything. `package.json` has no `test` script.
- **Change:**
  - `tests/unit/` with `node:test` + `node:assert/strict`, reusing the existing
    `tests/register.mjs` alias loader. Node here is v22.22, so `--experimental-strip-types` works on
    `.mts` directly. Scripts:
    ```
    "test":      "NODE_OPTIONS='--experimental-strip-types --import ./tests/register.mjs' node --test tests/unit/",
    "test:unit": "npm test",
    "test:itest":"node --experimental-strip-types --import ./tests/register.mjs tests/lead.itest.mts"
    ```
    (`NODE_OPTIONS` rather than bare flags, because `node --test` runs each file in a child process.)
  - **Fixture shapes**, all checked in under `tests/fixtures/`:
    - `media/*.json` — `Media[]`, one file per scenario. Written by a tiny generator helper
      `tests/unit/_mk.mts` exporting `mkMedia({n, from, everyHours, likes, comments, type, product, caption})`
      so a scenario is three lines, not 100 objects. Hand-written JSON only where the exact values
      matter (hidden likes, zero engagement).
    - `profiles/*.json` — `{username, name, biography, website, followers_count, follows_count, media_count}`.
    - `sites/*.html` — raw HTML fixtures for `parseSite` (item 16).
    - `captions.ar.json` — `{text, cta: boolean, question: boolean}[]`, ≥40 rows (item 9).
    - `roster.json` — `Talent[]`, including placeholders, an inactive member, and a zero-rate member.
    - `graph/*.json` — Graph API response bodies and header maps for the `discover` fake-fetch tests.
  - **Named cases, per module:**
    - `signals.test.mts` (12): fewer-than-two-posts → `null`; stories and ads excluded; missing
      timestamp excluded; heavy tail median vs mean; hidden likes (`coverage`); zero-engagement set;
      burst account (`spanDays`, `daysSinceLast`); shallow read (`posts < requested`, `readShare`);
      DST-free Amman hour mapping across a UTC midnight boundary; wrap-around peak window at 22–24;
      `bestWindow` sample floor rejects 6-of-100; format `strongest` rejected on a zero-median
      runner-up.
    - `findings.test.mts` (12): a `good` finding always exists (12-fixture sweep); `web-none` only on
      `no-url`; no website findings on `unreadable`; none on an `error-page`; severity boundaries at
      each `THRESHOLDS` value; Arabic strings contain **no** Latin digits, `.` or `,` between digits
      (currently passes — lock it in); `٪` follows the numeral in every Arabic percentage;
      `ig-window` absent for the overlapping-window fixture; `ig-cadence` absent for a dormant
      account; no `detail` contains `⟦`; `charts.hours.byHour.length === 24`; findings sorted
      critical → notable → good.
    - `recommend.test.mts` (10): five returned for an empty roster; no placeholder is ever cast;
      `uncastable` set when a discipline is missing; concept 4 never shortlisted; `because` has ≥4
      distinct values; ≤2 recommendations share a `shape`; determinism under roster reversal
      (already true — keep it true); concept-4-style editor-only crew casts no videographer;
      `priceJOD === videos * 150` for every recommendation; the vertical bonus changes the shortlist.
    - `msisdn.test.mts` (8): `0791234567` → `962791234567`; `+962 79 123 4567` → same;
      `00962791234567` → same; `791234567` → same; `+1 415 555 0123` passes through;
      `07912` → `null`; empty → `null`; a 16-digit string → `null`.
    - `normalise.test.mts` (8): `@name`, a profile URL with a query string, a URL with a trailing
      slash, uppercase → lowercase, a 31-char handle → `null`, a handle with a hyphen → `null`,
      `normaliseUrl('example.com')` → `https://example.com/`, `normaliseUrl('ftp://x.com')` → `null`.
    - `website.test.mts` (10): the 10 fixtures from item 16, plus the redirect/size/content-type
      cases from item 15.
    - `arabic.test.mts` (10): the caption lexicon cases from item 9.
  - **No network anywhere.** `discover` and `readSite` get an injected fetch; `resolvable` gets an
    injected `lookup`. Add a CI-style assertion in the test setup that `globalThis.fetch` is the
    stub, so a future test cannot silently start making calls.
- **Acceptance:** `npm test` runs green from a clean checkout with no environment variables, no
  credentials and no network (verify by running with `--network-family-autoselection` irrelevant —
  simply assert the stub-installed check fires). ≥70 assertions. Total runtime under 10 seconds.
- **Depends on:** 1–17 land alongside their tests; this item is the harness, the fixtures and the
  wiring.

### 20. A golden sheet  [M] [tier: sonnet]
- **Problem:** the unit tests above pin each module. Nothing pins the *composition* — the shape and
  the exact prose of the document a client reads. A refactor can keep every unit test green and
  still change the sentence on the page.
- **Change:** `tests/unit/golden.test.mts` calls `composeSheet` (item 18) with a checked-in profile,
  media set, site fixture and roster, and `env: {now: '2026-09-06T09:00:00.000Z', token: 'GOLDEN'}`,
  then compares `JSON.stringify(sheet, null, 2)` to `tests/fixtures/golden/sheet.json`. Two goldens:
  one "typical prospect" (site with no pixel, low engagement, Arabic bio) and one "hard case"
  (hidden likes, no site, dormant). Update with `UPDATE_GOLDEN=1 npm test`, and require the diff to
  be reviewed in the PR — the point is that a prose change becomes visible, not that it is blocked.
- **Acceptance:** both goldens are byte-stable across two consecutive runs; deliberately flipping
  `THRESHOLDS.slowMs` makes the test fail with a readable diff; the golden JSON contains no `⟦`, no
  Latin digits inside any `ar` field, and no `talentId` belonging to a placeholder.
- **Depends on:** 18, 19.

### 21. Placeholder policy, and what the seed should stop doing  [S] [tier: sonnet]
- **Problem:** `scripts/seed-content.mjs:95` writes `placeholder: true` **unconditionally**, inside a
  `{merge: true}` set. So a rerun after an operator has added a real person re-flags that person as
  invented. Meanwhile nothing consuming `talent` reads the flag — `recommend` does not, `convert.ts`
  does not — so the flag is written everywhere and honoured nowhere. All 14 roster entries in
  `lib/data/roster.ts` carry `placeholder: true`, and `DISCIPLINE_RATE` gives all three disciplines a
  rate, so all 14 pass `active && dayRateJOD > 0`.
- **Change:**
  - Seed: `placeholder: prior ? (prior.placeholder ?? true) : true` — never downgrade a record an
    operator has promoted. Add a `--promote <key>` flag that clears the flag for one person, and
    print a closing summary line naming how many bookable talent are still placeholders.
  - Seed: refuse to run against a project without `FIRESTORE_COLLECTION_PREFIX` when
    `NODE_ENV === 'production'` unless `--force` is passed, so a rerun cannot rewrite live records by
    accident.
  - `recommend.ts` honours the flag (item 6). `/ops/talent` shows a "placeholder" badge and a
    "this is a real person" action that clears it.
  - `run.ts`: when the bookable non-placeholder roster is empty, every recommendation carries
    `uncastable`, and `/s` renders "cast confirmed before the shoot" rather than names. Add a
    `Sheet.rosterState: 'real' | 'placeholder-only' | 'empty'` so `/ops` can warn before approval,
    and have `approveSheet` refuse when `rosterState !== 'real'` **and** the sheet names cast.
- **Acceptance:** a test that a second `seed` pass over a record with `placeholder: false` leaves it
  false (run against the Firestore emulator in the itest suite, not the unit suite). Unit test that
  `approveSheet` returns `{ok:false, why:'placeholder-cast'}` for a sheet whose picks name a
  placeholder. Manual: `node scripts/seed-content.mjs` prints the placeholder count.
- **Depends on:** none.

### 22. One Arabic numeral formatter  [S] [tier: sonnet]
- **Problem:** `findings.ts:56-58` and `compose.ts:27-31` contain the same `ar()` implementation,
  copied. `compose.ts` exports it; `findings.ts` re-declares it privately. They will drift, and the
  thousands-separator behaviour is already inconsistent in use: `ar(s.followers.toLocaleString('en-US'))`
  gets `٬` separators while `ar(med)` on a five-digit median gets none, inside the same sentence.
- **Change:** move `ar`, `AR_DIGITS`, `n0`, `n1` and a new `num(x)` (`toLocaleString('en-US')` then
  `ar`) into `lib/teardown/format.ts`; import from both. Replace every bare `ar(x)` on a number with
  `num(x)`. Keep `hour`/`span`/`range` in one place too — `findings.ts` and `compose.ts` currently
  have two near-identical implementations of the same clock rendering with different Arabic output
  (`span` vs `range`).
- **Acceptance:** a test asserting `num(12345) === '١٢٬٣٤٥'`, `num(0.5) === '٠٫٥'`, and that
  `grep -c 'AR_DIGITS' lib/` returns 1. A findings test asserting both numbers in the
  `ig-engagement` Arabic sentence are formatted the same way.
- **Depends on:** none.

## Data-model / interface changes other workstreams must know about
- **`Signals`** gains `coverage`, `engagementReliable`, `meanEngagementRate`, `recentEngagementRate`,
  `recentPosts`, `daysSinceLast`, `activeSpanDays`, `postsPerWeekInWindow`, `readShare`,
  `captions.questioning`, `captions.none`, `bestWindow.n`, `bestWindow.vsRest`, `strongest.p`.
  `engagementRate` **changes meaning** from mean-of-rates to median-based — any consumer that
  displays it must be re-read. `compose.ts` and the `/s` and `/ops` renderers are the consumers.
- **`buildFindings` signature changes**: the third parameter `siteAsked: boolean` becomes a
  `web: {state, reason?, status?}` object. `run.ts` is the only caller today.
- **`Findings`** gains `operatorNotes[]` — rendered by `/ops`, **never** by `/s`.
- **`Recommendation`** gains `crewNotes: string[]` and now actually populates `uncastable`. `/s` must
  render an uncastable recommendation without naming anyone; `convert.ts` must refuse to book one.
- **`Sheet`** gains `profile`, `verticalGuess`, `webState`, `rosterState`. `vertical` becomes
  operator-editable, and editing it must call `rerecommend`, not a fresh `runRead`.
- **`ConceptSource`** gains `shape` and `headline`. Anything iterating `CONCEPTS` should tolerate
  both; `toReportConcept` is unaffected.
- **`DiscoveryResult`** gains `usage` on both branches and `truncated` on the ok branch.
- **`SiteRead`** gains ~15 fields (item 16) plus `truncated`, `scheme`, `msSamples`, `ttfbMs`; and a
  new `SiteFailure` reason `not-html`. `readSite` splits into `readSite` (I/O) and `parseSite` (pure).
- **New modules:** `lib/teardown/format.ts`, `lib/teardown/arabic.ts`, `lib/teardown/vertical.ts`.
- **New npm scripts:** `test`, `test:unit`, `test:itest`. The existing `test:*` itest scripts stay.

## Risks and what NOT to change
- **Do not touch the `⟦…⟧` placeholder convention.** `needsWriting` and the console's approval gate
  both key off the literal `⟦`. Every new copy string must be complete or absent — never a
  half-written placeholder that reads as prose.
- **Do not put a benchmark in client-facing copy.** Item 12 uses a CWV boundary and a self-referential
  engagement gate *internally*. The sentence a prospect reads must stay a statement about their own
  account. Every finding that compares must compare the account to itself.
- **Do not weaken the `Booking` schema.** Nothing in this workstream may add `clientTotalJOD`,
  `priceJOD` or the client's name to a booking. `crewNotes` is operator-and-client-side; it never
  reaches a talent document.
- **Do not change `VIDEO_JOD_PER`, `RETAINER_JOD` or `DISCIPLINE_RATE`.** The rate card is locked; if
  item 11's diversity constraint changes which concepts appear, the prices follow from
  `originations × 150` and nothing else.
- **Changing `engagementRate`'s meaning will move every existing sheet's headline number** — usually
  downward, often by an order of magnitude. Old sheets are stored, not recomputed, so a client who
  already received one and a new one generated after the fix will see different figures for the same
  account. Decide whether to re-run stored draft sheets (safe — they are unapproved) and leave
  approved ones alone (they were sent).
- **The permutation test in item 8 must be seeded.** An unseeded PRNG makes the golden sheet flaky
  and makes a client-facing claim non-reproducible, which is worse than not having the test.
- **`normaliseHandle` lowercases.** Instagram handles are case-insensitive, and `clients.ts` uses the
  handle as a document id, so this must not change — a case change would orphan every existing client.
- The `after()` background-read fragility, the `/api/lead` rate limiting and the ops cookie are
  **other workstreams**. This plan assumes `runRead` is called; it does not fix when.
- Item 16 adds up to 5 extra HTTP requests per read (redirect hops, three timing samples, robots,
  sitemap). That is fine for a prospect's own site but must not be pointed at anything else; keep the
  redirect guard from item 15 on every one of them.

## Open questions for the owner
1. **Should the engagement rate shown to a prospect be the median rate (0.1% in the measured example)
   or the mean (1.1%)?** The median is correct and is what the module's own doctrine demands. It is
   also a much harsher number to put in front of a stranger. I have planned for the median; confirm
   that is the read you want to defend on a call.
2. **Do we tell a prospect their like counts are hidden?** Item 1 makes the engine say "we cannot
   compute reach from outside". The alternative is to fall back to comments-only engagement and say
   so. Comments-only is a thinner but still honest number; hidden-likes accounts may be a meaningful
   share of the target list.
3. **Concept 4 ("The Thread") — exclude from the shortlist entirely, or keep it as a visible
   retainer add-on with its own price?** The library forbids it as a headline pick; the engine
   currently sells it at 1200 JOD. Excluding it is the safe read; keeping it as an add-on is the
   commercially better one, but needs a price rule that is not `originations × 150`.
4. **What happens when the vertical inference is confident and wrong?** Item 10 requires operator
   confirmation before approval. Confirm you want that as a hard gate in `approveSheet`, or as a
   warning Khaled can click past.
