# PRAVDA — Master plan (synthesised from six workstream plans, 6 Sep 2026)

Source plans: 01-funnel-backend.md, 02-ops-console.md, 03-client-facing.md, 04-engine.md,
05-talent-docs.md, 06-deploy-process.md (same directory). This document is the reconciliation:
the decisions where plans disagreed, the unified data model, and the execution waves.
Execution agents cite item ids below (e.g. B-4, ENG-6) and read the source plan for detail.

## 1. Decisions (where the plans disagreed or deferred)

D1. **The long-form report is retired.** One artefact, `/s`, rendered by one component
    (`components/SheetView.tsx`). The public specimen becomes a real sheet at `/specimen/[lang]`.
    Delete `/r`, `/p`, `ReportView`, `Configurator`, `compose.ts`, `report.ts`, `teardowns.ts`,
    `/api/teardown`, `/api/ops/run`, `/api/ops/save`, `/api/ops/concept`, `/api/proposal`,
    `/ops/[token]`, `Editor.tsx`. Interim: `/api/ops/run` is deleted in wave 0; the other legacy
    routes are fenced with `LEGACY_REPORT=off` → 410 until the deletion wave. `/r/<token>` stays as
    a 410 with a link to `/{lang}/teardown` for one quarter in case a link is live.
    Rationale: no UI feeds it, its pricing model (assemble-your-own) contradicts the locked flat
    offer, and two renderers means every Arabic fix is written twice.

D2. **Session design.** Ops cookie: `sameSite: 'lax'`, value = `v1.<issuedAtMs>.<hmac>` signed
    with `SESSION_SECRET` (falls back to `OPERATOR_KEY`), **30-day rolling** TTL enforced
    server-side, `next=` deep-link preserved on login, auth done once in `app/ops/layout.tsx`.
    A `sameOrigin()` check on every mutating route. The device-cookie + PIN scheme from the ops
    plan is deferred: two operators sharing one key, entered once per device per month, is
    acceptable; revocation = bump `SESSION_SECRET`. Talent cookie: real HMAC, `sessionEpoch` on
    `Talent` folded into the signature, bumped by reissue and "sign out everywhere", 60-day TTL.

D3. **"Opened" beacon.** Client-side `POST /api/s/opened` from a tiny mounted component, never a
    server-render side effect (WhatsApp's crawler and Khaled's own check would stamp it first).
    Unified field names on `Sheet`: `openedAt` (first, write-once), `lastOpenedAt`, `openCount`.
    Rate-limited with the shared module. Not mounted on `/specimen`.

D4. **"Sent" is a human act.** `approve` mints the share link and does NOT set the client to
    `sent`. `action: 'compose-share'` returns the Arabic message + a `wa.me` link prefilled with
    the client's number; `action: 'mark-share-sent'` writes `Sheet.sentAt` and advances the client
    to `sent`. Same two-step pattern (`SendByHand`) for talent bookings in `DealDetail`; the
    current "mark sent on window.open" goes.

D5. **Placeholder people never reach a client or a booking.** `recommend.ts` excludes
    `placeholder: true` (engine owns the line). `approveSheet` refuses `placeholder-cast`.
    `offerBooking` refuses a placeholder id. `DealDetail` and `CastPicker` disable them. The seed
    never downgrades a promoted record. `Sheet.rosterState: 'real' | 'placeholder-only' | 'empty'`.

D6. **Cast overrides are materialised.** `Sheet.castOverrides[n]` becomes `CastPick[]`
    (talentId, bilingual name, discipline, why) — not `string[]` — written by the `cast` action
    after validating each id (active, rate > 0, not placeholder, discipline matches the slot).
    `/s`, the preview, `castPlan` and the proposal all read the override when present.

D7. **Vertical.** Never asked on the public form. Inferred by `lib/teardown/vertical.ts` from bio
    + captions (+ site text), stored as `Sheet.verticalGuess {guess, confidence, evidence}`;
    `Sheet.vertical` set only at confidence ≥ 0.7 or by the operator. Operator override on the
    sheet page and on the client page (`Client.vertical`, reused on re-run) calls
    `rerecommend(sheet, roster)` — no Meta call. The client page never shows a guess; `/s` shows
    the vertical label only when operator-confirmed. The recommender scales the bonus by
    confidence.

D8. **Read guarantee.** Claim-leased queue: `claimForRead` transaction + `readAndFile` in
    `lib/teardown/pipeline.ts`; `after()` stays as the fast path; `GET /api/cron/read`
    (`x-pravda-cron: CRON_SECRET`) sweeps `new` and expired-lease `reading` clients, max 3 per
    call, `readAttempts` cap 3 → `failed`. Global Meta ceiling 40 reads/hour enforced in
    `claimForRead` (defers, never drops). The Cloud Scheduler job is a one-line owner action.
    `minInstances` is not raised.

D9. **The "new lead" notice goes before the response**, with a 4s abort on every sender.
    Operator notice cascade: WhatsApp (if configured) → Telegram → Email (Resend) → `wa.me`
    manual. Recommendation to the owner: Telegram permanently for operator notices; WhatsApp
    stays for talent.

D10. **Rate limiting** is one Firestore-backed module `lib/store/ratelimit.ts`
    (`hit(bucket, limit, windowMs)`, hashed keys, `expiresAt` for a TTL policy), used by
    `/api/lead` (5/h, 20/day per IP + honeypot `company` + `elapsedMs ≥ 1200`),
    `/api/t/login` (8 per 10 min per IP, 60/min global), `/api/s/opened`, and the global read
    ceiling. Turnstile is wired but off by default.

D11. **Engine doctrine made true.** `engagementRate` becomes the median-based rate (the mean is
    kept as `meanEngagementRate`, never in copy). Hidden like counts → `ig-likes-hidden`
    (notable), never a critical. Website state is four-valued (`no-url | unreadable | error-page |
    read`); `web-none` fires only on `no-url`; read failures go to `Findings.operatorNotes`.
    Disjoint windows + margin for `ig-window`. A `good` finding always exists (engine invariant,
    capped at 3 shown). Concept #4 is excluded from the shortlist (`headline: false`), shape
    diversity ≤ 2 per shape, distinct `because` per recommendation. Thresholds are named
    constants with stated basis. Site timing = median of samples 2–3, copy says "HTML alone".
    SSRF guard applied per redirect hop; body streamed and capped; `parseSite` is pure.

D12. **Tests.** One harness: `tests/unit/*.test.mts` with `node --test` (no network, injected
    fetch/lookup), itests against the Firestore emulator via `FIRESTORE_EMULATOR_HOST`, `npm test`
    runs both, GitHub Actions runs typecheck → lint → unit → itest (emulator) → build → bundle
    budget. Golden sheet snapshot for composition.

D13. **Digits.** Arabic-Indic on every Arabic surface (site, sheet, docs); Latin only for phone,
    CR, handles, Latin identifiers. One formatter: `lib/format/num.ts` (`arNum`, `num`, `n0`,
    `n1`, `hour`) and `lib/format/date.ts` (`AR_MONTHS`, `EN_MONTHS`, `AR_DAYS`, `fmtDate`,
    `arDate`, `dayOf`, `months`). This reverses the Western-digit choice in `PricingView` —
    flagged as an owner question; proceed with Arabic-Indic unless overruled.

D14. **Booking lifecycle.** `BookingStatus` gains `cancelled`, `no_show`; explicit transition
    table in `lib/data/deals.ts`; `rescheduledFrom/To`, `declineReason`, `conflictWith`,
    `remindedAt[]`. `offerBooking` returns `conflict` on same talent + date unless `force`.
    Reminders are an operator one-tap ("Send reminder"), not a scheduler.

D15. **Staging** = same project, second App Hosting backend with `FIRESTORE_COLLECTION_PREFIX=staging_`
    and its own `OPERATOR_KEY`/`SESSION_SECRET`. Reserved prefixes: `staging_`, `_itest_`.

D16. **Retention.** `expiresAt` on `clients`/`sheets` for unconverted leads, cleared on win;
    N = 180 days default pending owner sign-off. `scripts/export-client.mjs` and
    `scripts/delete-client.mjs --confirm` back the promises on `/{lang}/data`.

## 2. Unified data-model changes (additive unless stated)

- `Client`: `+queuedAt, readStartedAt, readLeaseUntil, readAttempts, lastNotifyChannel, vertical,
  notes[{at,by,text}], lostReason, expiresAt`. `setClientStatus` → `forceClientStatus`; new
  `advanceClient(id, status, readError?)` with rank table
  `new 0 · reading 1 · failed 1 · ready 2 · sent 3 · won 4 · lost 4`
  (engine transitions apply only when current rank ≤ 2).
- `Sheet`: `+sentAt, openedAt, lastOpenedAt, openCount, profile{name,biography,bioLink,followers,
  follows,mediaCount,profilePictureUrl,readAt}, verticalGuess, vertical (operator-editable),
  webState, rosterState, expiresAt`. `castOverrides: Record<string, CastPick[]>` (CHANGED type).
  `approveSheet` outcomes: `pick-three | no-offer | placeholder-cast`.
- `Deal`: `+lostReason`.
- `Booking`: status `+cancelled, no_show`; `+declineReason, conflictWith, rescheduledFrom,
  rescheduledTo, remindedAt[]`.
- `Talent`: `+availableFrom, sessionEpoch, portfolioUrl, legalName, idNumber, note`. Tags and
  placeholder become editable.
- `Signals`: `+coverage, engagementReliable, meanEngagementRate, recentEngagementRate, recentPosts,
  daysSinceLast, activeSpanDays, postsPerWeekInWindow, readShare, captions.questioning,
  captions.none, bestWindow.n, bestWindow.vsRest, strongest.p`. `engagementRate` CHANGES MEANING.
- `Findings`: `+operatorNotes[]`. `buildFindings(signals, site, web)` — third param is the web
  state object (CHANGED signature).
- `Recommendation`: `+crewNotes[]`; `uncastable` actually populated.
- `ConceptSource`: `+shape, headline`.
- `DiscoveryResult`: `+usage`, `+truncated`. `SiteRead`: many new facts, `+truncated, scheme,
  msSamples, ttfbMs`; `SiteFailure` `+not-html`. `readSite` (I/O) / `parseSite` (pure).
- New collections: `ratelimit` (TTL on `expiresAt`). Indexes: `clients(status,queuedAt)`,
  `clients(status,readLeaseUntil)`, `bookings(status)`; fieldOverrides disabling indexing on
  `sheets.signals/site/findings/recommendations`. Drop the `teardowns` index.
- New routes: `GET /api/cron/read`, `POST /api/ops/selfcheck`, `POST /api/s/opened`,
  `GET /api/t/ics`, `GET /api/health`, `/specimen/[lang]`, `/ops/sheet/[token]/preview`,
  `/s/[token]/lang` (cookie redirect). `/api/ops/client` `+rerun, status, note, contact, vertical`;
  `/api/ops/sheet` `+compose-share, mark-share-sent, vertical`; `/api/ops/booking` `+force,
  remind`; `/api/ops/talent update` accepts names/discipline/tags/placeholder/new fields.
- New env: `SESSION_SECRET, CRON_SECRET, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, RESEND_API_KEY,
  NOTIFY_EMAIL_TO, NOTIFY_EMAIL_FROM, LEGACY_REPORT, WHATSAPP_REMINDER_TEMPLATE,
  TURNSTILE_SECRET_KEY, NEXT_PUBLIC_TURNSTILE_SITE_KEY`; wire `OPERATOR_PHONE, WHATSAPP_*,
  NEXT_PUBLIC_SITE_URL (BUILD+RUNTIME), NEXT_PUBLIC_CONTACT_EMAIL, NEXT_PUBLIC_PRIVACY_EMAIL`.
- New shared modules: `lib/format/num.ts`, `lib/format/date.ts`, `lib/store/ratelimit.ts`,
  `lib/teardown/pipeline.ts`, `lib/teardown/arabic.ts`, `lib/teardown/vertical.ts`,
  `lib/notify/telegram.ts`, `lib/notify/email.ts`, `lib/config/check.ts`, `lib/ops/today.ts`,
  `lib/ops/errors.ts`, `components/SheetView.tsx`, `components/ops/{SignIn,CastPicker,SendByHand,
  NextAction,Timeline,Toast}.tsx`, `lib/data/specimenSheet.ts`.

## 3. Execution waves (file-partitioned so parallel agents never collide)

Every agent: no `git stash/reset/checkout/commit`; only the orchestrator commits. Each wave ends
with `npx tsc --noEmit`, `npm run test:unit`, and a grep-sentinel check by the orchestrator.

### Wave 0 — foundations (parallel: A, B, C)
- **A. Harness + lint + CI** [sonnet] — `.eslintrc.json`; `tests/unit/` + `node --test` wiring;
  `FIRESTORE_EMULATOR_HOST` branch in `lib/store/firebase.ts`; `npm test`, `test:unit`,
  `test:itest` scripts (explicit file list); `.github/workflows/ci.yml`; `scripts/check-bundle.mjs`.
  Files: package.json, .eslintrc.json, tests/register.mjs, lib/store/firebase.ts, .github/**,
  scripts/check-bundle.mjs. (06-1, 06-3, 06-10, 01-11 harness half, 04-19 harness half)
- **B. Hot fixes** [sonnet] — ops cookie `lax` (login route only); `openClient` empty-contact
  merge; `/api/ops/sheet run` omits blank contact keys and only moves `new|reading|failed` →
  `ready`; `SheetReview` copy in state + offer blur/600ms debounce; delete `RunHandle` `reused`
  branch; delete `app/api/ops/run`; `error.tsx` uses `CO.phone`; `LEGACY_REPORT` 410 fence on
  `/api/teardown`, `/api/ops/save`, `/api/ops/concept`, `/api/proposal`. Files: those only.
  (01-4, 02-4, 01-10 interim, 03-12 error.tsx)
- **C. Shared formatters + rate-limit module** [sonnet] — `lib/format/num.ts`, `lib/format/date.ts`
  replacing every copy of `arNum/AR_MONTHS/AR_DAYS/hour/n0/n1` (findings.ts, compose.ts,
  app/s page, proposal, invoice, Portal.tsx, whatsapp.ts, Configurator); `lib/store/ratelimit.ts`
  with its itest; `firestore.indexes.json` (new composites, fieldOverrides, drop teardowns).
  (04-22, 03-6 formatter half, 01-5 module, 01-9)

### Wave 1 — core (parallel: D1, D2, D3, E1, E2, F, G1, G2)
- **D1. Signals + findings** [opus] — 04-1, 04-2, 04-3 (findings side + web state type),
  04-4, 04-5, 04-7, 04-8, 04-9 (`arabic.ts`), 04-12, 04-13 (findings side), 04-17 (copy side)
  + unit tests + fixtures. Files: lib/teardown/signals.ts, findings.ts, arabic.ts,
  tests/unit/{signals,findings,arabic}.test.mts, tests/fixtures/**. Does NOT touch run.ts.
- **D2. Recommend + concepts + vertical** [opus] — 04-6, 04-10 (`vertical.ts`), 04-11,
  04-21 (recommend side + seed script). Files: lib/teardown/recommend.ts, vertical.ts,
  lib/data/concepts.ts (add shape/headline to all 30), scripts/seed-content.mjs,
  tests/unit/{recommend,vertical}.test.mts. Does NOT touch run.ts.
- **D3. Discovery + website** [opus] — 04-14, 04-15, 04-16, 04-17 (measurement side), injected
  fetch/lookup seams. Files: lib/meta/discovery.ts, website.ts, tests/unit/{discovery,website}.test.mts,
  tests/fixtures/{graph,sites}/**.
- **E1. Queue, status machine, lead route, notifications, config** [opus] — 01-1, 01-2, 01-3,
  01-5 (lead-route side), 01-7, 01-8; 03-8 (`sheetUrl` in lead response); 06-2 (config table),
  06-6 (structured logs). Files: lib/data/clients.ts, lib/store/clients.ts, lib/teardown/pipeline.ts,
  app/api/lead/route.ts, app/api/cron/read/route.ts, app/api/ops/client/route.ts (rerun/status/
  note/contact/vertical), lib/notify/{operator,telegram,email,whatsapp(sendText timeout)}.ts,
  lib/config/check.ts, app/api/ops/selfcheck/route.ts, apphosting.yaml, .env.example,
  tests/{queue,status,contact}.itest.mts. Consumes the honeypot/elapsedMs contract from G2.
- **E2. Auth** [opus] — D2 above: lib/ops/auth.ts (mint/verify/sameOrigin), lib/talent/auth.ts
  (HMAC + epoch), app/api/ops/{login,logout}, app/api/t/{login (rate limit + `?code=` prefill
  handling), logout}, app/ops/layout.tsx (single gate + `SignIn`), remove per-page gates,
  tests/unit/auth.test.mts. (01-6, 02-1 minus PIN, 05-1, 05-2, 05-7 login half)
- **F. Booking model + talent portal + invoice** [opus] — 05-3, 05-4, 05-5 (store side), 05-6,
  05-8, 05-9, 05-10, 05-11, 05-12, 05-15 (model + talent route), 05-16. Files: lib/data/deals.ts,
  lib/store/deals.ts (+`listOpenBookings`), app/api/t/{respond,availability,ics}, app/api/ops/
  {booking,notify,talent}/route.ts, lib/notify/whatsapp.ts (compose/remind/template doc only),
  components/t/Portal.tsx, app/doc/invoice/**, tests/deals.itest.mts, tests/unit/whatsapp.test.mts.
  Does NOT touch DealDetail/TalentManager (wave 2).
- **G1. The sheet** [opus] — 03-1 (SheetView extraction, specimen route + SPECIMEN_SHEET, sample
  redirect, sitemap), 03-2 (s.css), 03-3 (content defects incl. castOverrides read, DISCIPLINE_LABEL,
  dateline), 03-4 (og, sticky CTA, print, main), 03-5 (`Opened.tsx` + `/api/s/opened`), 03-6
  (lang cookie), 03-10 (proposal `share-<token>` route + sheet-derived content), 03-12 defects.
  Files: app/s/**, app/specimen/**, components/SheetView.tsx, components/s/Opened.tsx,
  app/api/s/opened/route.ts, lib/data/specimenSheet.ts, lib/store/sheets.ts (new fields, getShared
  unchanged), app/doc/proposal/**, app/doc/doc.css, app/sitemap.ts, app/robots.ts,
  app/[lang]/teardown/sample/page.tsx. Does NOT delete legacy files (wave 2).
- **G2. Marketing + intake + honesty** [sonnet] — 03-7 (Intake: steps, reassurance, wa.me on
  failure, focus, `company` honeypot + `elapsedMs`, returning → `sheetUrl`), 03-9 (scenes copy,
  sitemap filter, PieceView/WorkRows demoNote + noindex, `anyPlaceholder` reuse), 03-11 (MastNav
  finish, teardown page artefact section, pricing card), 03-13, i18n keys (`tdDeliver`,
  `specimen*`). Files: components/{Intake,TeardownView,MastNav,PieceView,WorkRows,WorkFlow,
  CastFlow,PricingView}.tsx, lib/i18n.ts, lib/data/scenes.ts, app/[lang]/globals.css (additive
  only), docs/rtl-qa.md.

### Wave 2 — integration + console (after wave 1)
- **H1. Engine integration** [opus] — 04-18 `composeSheet` + `rerecommend` in run.ts, 04-3/13
  run.ts side (web state, profile), 04-21 rosterState, `approveSheet` placeholder gate, 04-20
  golden sheets, `/api/ops/sheet` `vertical` + `cast` (materialised CastPick[]) actions,
  `castPlan` reading CastPick[]. Files: lib/teardown/run.ts, lib/store/{sheets,convert}.ts,
  app/api/ops/sheet/route.ts, tests/unit/golden.test.mts, tests/fixtures/golden/**.
- **H2. Ops console rewrite** [opus] — 02-2 (Today queue, `lib/ops/today.ts`), 02-3 (client hub:
  NextAction, Timeline, ClientActions actions incl. re-run with vertical), 02-5 (CastPicker,
  answers chips), 02-6 (compose-share / mark-share-sent, prefilled wa.me, preview route),
  02-7 (DealDetail: SendByHand, timeline, lost reason, conflict confirm, reminders, declined
  visibility, invoice links; deals list via listOpenBookings), 02-8 (TalentManager inline edit,
  tags, placeholder, availability age, owed), legacy deletion (D1 list), OpsNav Today/Clients/
  Deals/Roster, config panel + selfcheck button + health warning on `/ops`. Files: app/ops/**,
  components/ops/**, lib/ops/today.ts, lib/ops/errors.ts, deleted legacy files, globals.css
  legacy CSS removal.
- **H3. Process + docs** [sonnet] — 06-5 `/api/health`, 06-9 runbook + `scripts/export-client.mjs`
  + `scripts/delete-client.mjs`, 06-11 CLAUDE.md, 06-12 README, 06-8 retention `expiresAt` +
  TTL commands, `sameOrigin()` sweep across every mutating route (after E2), README routes table.
  Files: app/api/health/route.ts, scripts/*, README.md, CLAUDE.md, docs/**, every api route
  (sameOrigin one-liner only).

### Wave 3 — polish + verification
- **I. Phone ergonomics + dir=auto + toasts** [sonnet] — 02-9, 02-10, 02-11 across app/ops/**.
- **J. Verification** [orchestrator + code-reviewer on opus] — `npm test`, `npm run build`,
  bundle budgets, browser QA at 390×844 and 1440×900 in ar/en on: `/ar`, `/ar/teardown`,
  `/specimen/ar`, `/s/<token>` (emulator-seeded), `/ops` pages, `/t`, `/doc/*` print preview;
  adversarial review of auth, rate limit, SSRF, booking transitions, placeholder gates.

Owner actions that code cannot do (collected): create the Cloud Scheduler job; set the new
secrets in Secret Manager; enable Firestore TTL policies (`ratelimit.expiresAt`,
`clients.expiresAt`, `sheets.expiresAt`); enable managed daily backups; create the Telegram bot;
create the staging backend; confirm which branch App Hosting builds.

## 4. Open questions for the owner (answers change the work; defaults in brackets)
1. Retire the long-form report and is any `/r/<token>` link live in a real thread? [retire; 410
   for a quarter]
2. Telegram for operator notices? [yes — cascade is built either way]
3. Cloud Scheduler acceptable for the read sweep? [yes]
4. Arabic-Indic digits on every Arabic surface, including the pricing page? [yes]
5. Retention window for unconverted leads? [180 days]
6. Proposal payment terms (deposit %, balance due, cancellation)? [omit the section until given]
7. Engagement rate shown = median-based (harsher, correct)? [yes]
8. Concept #4 "The Thread": exclude from the shortlist, or keep as a priced add-on? [exclude]
