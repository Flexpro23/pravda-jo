# Deployment, environments, quality gates and operating process plan

## Goal
Two people (Ali and Khaled) can ship a change with confidence instead of hope: a
known branch builds to a known backend, every environment variable this app
reads is accounted for in local/staging/prod, `main` never lands a change that
fails to typecheck, lint, or pass the pure-engine and Firestore-emulator tests,
Cloud Logging shows what a read did and why it failed, `/api/health` proves
Firestore and the Meta token both still work, and there is a written runbook
for the handful of operational tasks (rotate a key, reissue a code, honour a
PDPL export/delete request) that otherwise only live in Ali's head.

## Current state
- **Branches are already reconciled.** `git rev-list --left-right --count
  main...next-site` returns `0 0` and `git rev-parse main next-site` are
  identical (`820e2c8`) — the "main is 4 commits behind" finding in the shared
  context is stale as of this read. The open question is which branch Firebase
  App Hosting's git integration actually watches; that binding lives in the
  Firebase console/GitHub App install, not in any repo file, so it cannot be
  confirmed by reading the repo (see Open questions).
- **One App Hosting backend, one Firestore database, no staging.**
  `apphosting.yaml` declares a single `runConfig` and wires exactly four env
  vars (`META_ACCESS_TOKEN`, `META_IG_USER_ID`, `OPERATOR_KEY`,
  `META_API_VERSION`) as Secret Manager secrets. `.firebaserc` points at one
  project, `pravda-jo`. Every other variable the code reads
  (`NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_CONTACT_EMAIL`,
  `NEXT_PUBLIC_PRIVACY_EMAIL`, `OPERATOR_PHONE`, `NEXT_PUBLIC_CONTACT_PHONE`,
  `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_TEMPLATE`) is absent from
  prod and silently falls back to a placeholder or an unconfigured state.
- **A collection-prefix mechanism already exists** (`FIRESTORE_COLLECTION_PREFIX`,
  read in `lib/store/clients.ts`, `deals.ts`, `sheets.ts`, `teardowns.ts`) and is
  already used by the itests (`_itest_`). This is the natural, already-proven
  seam for a staging environment sharing the one `pravda-jo` project instead of
  provisioning a second Firebase project.
- **No CI, no lint config, no unit tests, no health endpoint.**
  `npx tsc --noEmit` passes clean today (verified). `npx next lint` has no
  `.eslintrc*`/`eslint.config.*` anywhere in the repo, so it drops into its
  interactive "How would you like to configure ESLint?" prompt every time — it
  was run here and declined at the prompt, confirmed nothing was written
  (`git status --short` empty afterwards). `npm audit --omit=dev` reports 8
  vulnerabilities (1 high: PostCSS via `next`'s bundled copy; 7 moderate: `uuid`
  via `firebase-admin`→`@google-cloud/storage`→`teeny-request`/`gaxios`) — no
  fix exists that isn't a breaking major-version bump of `next` or
  `firebase-admin`. `.github/` does not exist. There is no `scripts/check-env.mjs`,
  no `npm test`, no `node --test` unit tests, no husky/pre-push hook. The four
  `test:*` scripts in `package.json` are itests that talk to the *real* `pravda-jo`
  Firestore project via `applicationDefault()` credentials — they need a
  developer's own `gcloud auth application-default login`, not the emulator
  `firebase.json` already declares on port 8080 (`FIRESTORE_EMULATOR_HOST` is
  referenced nowhere in the codebase today).
- **No structured logging anywhere in the read pipeline.** `app/api/lead/route.ts`
  and `lib/teardown/run.ts` contain zero `console.log`/`console.error` calls —
  a stalled or failed read leaves no trace beyond the Firestore `status` field
  the console already shows. `discovery.ts` already documents the two token-
  health failure modes to watch (`unauthorised` = bad token; `no-data` = a
  token past `data_access_expires_at` that still reports `is_valid: true`), but
  nothing surfaces either proactively.
- **`OPERATOR_KEY` is a load-bearing single secret with three uses**, not one:
  it gates `/api/teardown` (bearer), it is hashed into the `pravda_ops` cookie
  (`lib/ops/auth.ts`), and it *signs* every talent session cookie
  (`lib/talent/auth.ts`: `sign(id) = sha256(id:OPERATOR_KEY)`). Rotating it logs
  out every operator session and invalidates every currently-signed-in talent
  session simultaneously — a fact the runbook must say out loud.
- **The privacy pages already make binding promises with no code behind them:**
  `/{lang}/data` commits to "everything within 7 days" and "delete everything
  — permanently, no questions" and a JSON export; `/{lang}/notice` is the PDPL
  Article 9 processing notice. There is no `scripts/export-client.mjs` or
  `scripts/delete-client.mjs` today — those promises are currently fulfilled by
  hand in the Firestore console, if at all.
- **`scripts/seed-content.mjs` is genuinely idempotent and merge-safe** — it
  keys by slug/id, preserves an operator-set day rate, phone, and tags, and
  never invalidates an issued passcode. It reads `GOOGLE_CLOUD_PROJECT` (default
  `pravda-jo`) and `FIRESTORE_COLLECTION_PREFIX` directly, so it already *can*
  target a staging prefix — it just isn't documented as doing so, and nothing
  stops someone running it against prod without the prefix by accident.
- **Build hygiene is mostly already solved and documented in README**: the
  `.next`/`.next-prod` split (`NEXT_DIST_DIR`), `next-env.d.ts` is gitignored
  (correct — Next regenerates it; it is *not* committed, matching Next's own
  convention), and `tsconfig.json` already includes both `.next/types/**/*.ts`
  and `.next-prod/types/**/*.ts`. `experimental.optimizePackageImports` is set
  for `three`/`gsap`. What's missing is any automated *check* of the documented
  budgets (245 kB WebGL routes, 109–111 kB text routes, ≤150 kB `/r`) — today
  they are hand-verified numbers in prose. Separately, `next lint` printed a
  workspace-root warning because `/Users/aliodat/package-lock.json` (one level
  above the repo) is a second lockfile Next's root-inference trips on — worth
  one line of guidance, not a repo change.
- **README describes a delivery surface (`/r`, `/p`) that the live flow no
  longer uses.** Per the shared context, the real path today is `/s/[token]`
  (`app/s/[token]/page.tsx`) built from a Sheet, with `/r` and `/p` now only
  reachable through the legacy `/api/teardown` → `/ops/[token]` editor path
  that no UI links to. README's Routes table, its "entity block" section, and
  its budgets table all still speak only of `/r`/`/p`.
- **There is no repo-root `CLAUDE.md`.** Every convention an agent must not
  violate — bilingual AR/EN with `/ar` canonical, the four RTL rules, "PRAVDA
  is always the connector" schema rule, "only what we can prove", no PDF
  libraries, the `.next`/`.next-prod` split, the token/cookie trust model — is
  currently scattered across README prose and code comments, discoverable only
  by reading the whole tree.

## Work items — ordered by priority

### 1. Add `.eslintrc.json` (next/core-web-vitals + typescript) so `next lint` stops prompting  [S] [tier: sonnet]
- Problem: There is no ESLint config in the repo at all. `next lint` was
  verified interactively today: it prints the deprecation notice, warns about
  the stray `/Users/aliodat/package-lock.json` lockfile, then blocks on "How
  would you like to configure ESLint? Strict / Base / Cancel" — every
  invocation (a developer's, a pre-push hook's, a future CI job's) either hangs
  waiting for stdin or silently no-ops. This is the single highest-leverage
  fix in this workstream because every other quality-gate item depends on lint
  actually running non-interactively.
- Change: Add `.eslintrc.json` at repo root:
  ```json
  { "extends": ["next/core-web-vitals", "next/typescript"] }
  ```
  (Next 15.5's built-in `eslint-config-next` covers both; no new devDependency
  is required since `next lint` bundles its own ESLint unless one is present —
  verify with `npx next lint` after adding the file that it now runs and exits
  non-interactively. If `eslint` itself is not a resolvable devDependency,
  add `eslint` pinned to the version `next lint` expects, plus
  `eslint-config-next`, matching the installed `next@15.5.24`.)
- Acceptance: `npx next lint` exits 0 or with a finite list of findings and
  never prints an interactive prompt; `git status --short` after running it is
  unchanged (no config file rewritten by the tool itself); CI item 3 uses this
  same command.
- Depends on: none.

### 2. `scripts/check-env.mjs` — a printed, per-environment self-check  [S] [tier: sonnet]
- Problem: There is no single place that says what variable is required, what
  is optional-with-a-silent-fallback, and what the fallback actually is. Every
  fallback today is buried in the module that reads it (`lib/data/company.ts`,
  `lib/notify/operator.ts`, `lib/notify/whatsapp.ts`, `lib/meta/discovery.ts`,
  `lib/store/firebase.ts`). A misconfigured prod deploy (e.g. the documented
  gap: `OPERATOR_PHONE`/`WHATSAPP_*`/`NEXT_PUBLIC_SITE_URL` absent today) is
  invisible until someone notices a wa.me link pointing nowhere.
- Change: New `scripts/check-env.mjs` (plain Node, no deps) that:
  - Defines a table of every `process.env.*` read found in `lib/` and `app/`
    (full grep list under "Environment matrix" below), each marked
    `required` | `recommended` | `optional`, with its fallback value if any.
  - Prints a colour-free report: `OK`, `MISSING (using fallback: …)`, or
    `MISSING (no fallback — feature X is degraded)` per variable.
  - Exits non-zero only if a `required` variable is missing (today: none are
    hard-required for the app to boot — `OPERATOR_KEY` unset just closes the
    console per its own doc comment — so the initial cut can exit 0 always and
    just report, matching the "reliably observable" goal over "reliably
    blocking").
  - Add a `"check-env": "node scripts/check-env.mjs"` script in `package.json`.
  - Wire a lightweight version of the same table into a server-side console
    surface: extend the existing `/ops` shell (e.g. a small panel in
    `app/ops/layout.tsx` or the `/ops` index page) that calls the same table at
    request time and shows which optional channels (WhatsApp, contact phone,
    site URL) are configured — this is what makes the check "the console
    shows" per the brief, not just a CLI a developer remembers to run.
- Acceptance: `node scripts/check-env.mjs` runs with zero env vars set and
  prints a complete, accurate table without throwing; running it with
  `.env.local` populated shows all rows `OK`; the `/ops` panel renders for an
  authed operator and reflects the same data live in prod.
- Depends on: none.

### 3. GitHub Actions workflow: typecheck, lint, unit, itest-on-emulator, build  [M] [tier: sonnet]
- Problem: No `.github/` directory exists. Nothing stops a broken build, a
  type error, or a regression in the pure engine (`signals.ts`/`findings.ts`/
  `recommend.ts`/`msisdn`/`normaliseHandle`) from landing on the branch App
  Hosting builds. The four existing `test:*` scripts need live GCP credentials
  and hit the real `pravda-jo` project (guarded only by the `_itest_` prefix
  check inside each file) — unrunnable in CI without provisioning a service
  account, and risky to run against the real project from a shared runner.
- Change:
  - **New unit tests** (item 3a below) exercise the pure engine with
    `node --test`, no credentials, no network.
  - **New itest wiring for CI**: add a `FIRESTORE_EMULATOR_HOST` branch to
    `lib/store/firebase.ts`'s `app()` — when `FIRESTORE_EMULATOR_HOST` is set,
    skip both the `FIREBASE_SERVICE_ACCOUNT` and `applicationDefault()` paths
    and call `initializeApp({ projectId: 'pravda-jo-emulator' })`, which the
    Admin SDK correctly points at the emulator once the env var is present
    (this is the standard firebase-admin emulator contract — no code changes
    needed in `getFirestore()` itself, only in ensuring `app()` doesn't try to
    resolve real ADC when the emulator var is set, since `applicationDefault()`
    can fail hard in a credential-less CI runner even though the emulator
    doesn't need it).
  - Add `"test:unit": "node --test tests/unit/"` and keep the four `test:*.itest.mts`
    scripts as `test:itest:lead` etc., or add one `"test:itest": "node --experimental-strip-types --import ./tests/register.mjs tests/*.itest.mts"` runner — confirm glob expansion works with the existing `register.mjs` loader (it likely needs an explicit file list, since shells and Node's own arg parsing don't glob `.mts` reliably across environments; enumerate the four files explicitly in the script rather than relying on `*`).
  - New `.github/workflows/ci.yml`:
    ```yaml
    name: CI
    on: [push, pull_request]
    jobs:
      quality:
        runs-on: ubuntu-latest
        steps:
          - uses: actions/checkout@v4
          - uses: actions/setup-node@v4
            with: { node-version: 20 }
          - run: npm ci
          - run: npx tsc --noEmit
          - run: npx next lint
          - run: npm run test:unit
          - name: Start Firestore emulator
            run: npx firebase-tools@latest emulators:start --only firestore --project pravda-jo-emulator &
          - run: sleep 5
          - name: Run itests against emulator
            env:
              FIRESTORE_EMULATOR_HOST: localhost:8080
              FIRESTORE_COLLECTION_PREFIX: _itest_
              GOOGLE_CLOUD_PROJECT: pravda-jo-emulator
            run: npm run test:itest
          - run: npm run build
    ```
    (Firestore emulator needs no auth, matching the brief's "no credentials"
    requirement; `firebase-tools` needs a Java runtime, present on
    `ubuntu-latest` runners by default — confirm during implementation, add
    `actions/setup-java` if not.)
  - The `build` step in CI should NOT require the real Meta/Firebase secrets —
    verify `next build` doesn't eagerly call `store()` or `discover()` at
    build time (App Router build only *statically analyses* route handlers;
    confirm no top-level `store()` call executes during `next build` — a quick
    grep of module-level code in `lib/store/*.ts` shows `db` is lazily
    initialized inside `store()`, called only per-request, so this should be
    safe, but verify with a `npm run build` in CI without any secrets set).
- Acceptance: A PR with a deliberate type error fails the `typecheck` step; a
  PR with a deliberate lint violation fails `lint`; `npm run test:unit` and
  `npm run test:itest` both pass green against the emulator with zero GCP
  credentials configured on the runner; `npm run build` succeeds with no env
  vars set (falling back to documented defaults).
- Depends on: 1 (lint config must exist first), 3a (unit tests must exist).

### 3a. Unit tests for the pure engine with `node --test`  [M] [tier: sonnet]
- Problem: `signals.ts`, `findings.ts`, `recommend.ts`, `normaliseHandle`
  (`lib/meta/discovery.ts`), and the msisdn/phone normalisation logic
  (`lib/notify/whatsapp.ts` and the `usablePhone` regex in
  `app/api/lead/route.ts`) are pure functions with zero test coverage today.
  These are exactly the functions a future refactor is most likely to break
  silently (the shared context already flags one real bug here: "findings.ts
  mixes mean rate with median count").
- Change: New `tests/unit/` directory, one file per module
  (`signals.test.mts`, `findings.test.mts`, `recommend.test.mts`,
  `normalise-handle.test.mts`, `msisdn.test.mts`), using `node:test` +
  `node:assert/strict`, run via
  `node --experimental-strip-types --import ./tests/register.mjs tests/unit/*.test.mts`
  (reusing the existing `@/` alias loader). Cover: `normaliseHandle` accepting
  `@handle`, a full profile URL, and rejecting invalid characters/length>30;
  `computeSignals` returning `null` below the post-count floor; `recommend`
  filtering out `placeholder:true` and `rate<=0` talent (the audit's flagged
  bug about placeholder talent being bookable is a *recommend/cast* boundary —
  this test should assert the filter holds so a regression is caught, without
  attempting to fix the underlying cast-plan bug, which belongs to another
  workstream); the engagement-rate mean/median mixing bug already identified
  in the shared context (write a test that currently *fails*, documenting the
  bug for whichever workstream owns `findings.ts`, or fix it here if that
  workstream hasn't claimed it — coordinate before fixing).
- Acceptance: `node --test` reports all new tests passing (or the one
  documenting-a-known-bug test explicitly marked `test.todo` / skipped with a
  comment pointing at the audit finding, not silently green).
- Depends on: none.

### 4. `FIRESTORE_COLLECTION_PREFIX`-based staging environment  [M] [tier: sonnet]
- Problem: There is one App Hosting backend and one set of Firestore
  collections. Any change tested "in production" is tested against real
  prospects' data, and there is no way to demo a change to Khaled without
  either running it locally (which he can't) or risking a live client record.
- Change:
  - Create a second App Hosting backend (`pravda-staging`, via `firebase
    apphosting:backends:create` — a console/CLI action, not a repo file) bound
    to the same GitHub repo but tracking a `staging` branch (or the same
    branch with manual promotion — see Open questions on which App Hosting
    supports for this project's plan tier).
  - Give the staging backend its own `apphosting.staging.yaml` (App Hosting
    supports per-backend config files) with the same secret *names* but each
    pointed at a `-staging` suffixed Secret Manager secret where the value
    must differ (a staging `OPERATOR_KEY` so staging ops sessions can't replay
    against prod, and vice versa) — `META_ACCESS_TOKEN`/`META_IG_USER_ID` can
    be shared (staging reads the same public Instagram data prod would; it's
    read-only against Meta) but `OPERATOR_KEY` must NOT be shared, given
    finding above that it also signs talent sessions.
  - Add one new env var, `FIRESTORE_COLLECTION_PREFIX=staging_`, to the
    staging backend only. No code change needed — every store module already
    reads this var. Confirm `lib/store/teardowns.ts`, `clients.ts`, `deals.ts`,
    `sheets.ts` all consistently prefix (verified: they do, independently,
    each with `const P = process.env.FIRESTORE_COLLECTION_PREFIX ?? ''`).
  - Seed staging once via `FIRESTORE_COLLECTION_PREFIX=staging_ GOOGLE_CLOUD_PROJECT=pravda-jo node scripts/seed-content.mjs` from a developer machine with real ADC (documented in the runbook, item 5c).
  - Firestore *rules* (`firestore.rules`) deny all client access regardless of
    prefix, so no rules change is needed — the isolation is entirely
    server-side via the prefix, which is consistent with the existing
    itest pattern.
  - Document in README (or the new CLAUDE.md, item 7b) that `staging_` and
    `_itest_` are reserved prefixes and must never collide with a real
    business's handle-as-doc-id (extremely unlikely given handles are
    Instagram usernames, but worth a one-line note).
- Acceptance: Visiting the staging backend's URL and submitting a teardown
  writes to `staging_clients`/`staging_teardowns`/etc., confirmed by checking
  the Firestore console; the production `clients` collection is untouched;
  staging's `OPERATOR_KEY` cookie does not authenticate against prod's
  `/api/teardown` and vice versa.
- Depends on: none, but should land before item 6 (itest emulator wiring)
  changes `lib/store/firebase.ts`, to avoid touching that file twice.

### 5. `/api/health` — Firestore + Meta token check, no budget spent  [M] [tier: sonnet]
- Problem: The only signal that Meta's token has expired or Firestore is
  unreachable today is a prospect's read silently failing and Khaled getting a
  `composeFailed` WhatsApp message *if* the failure happens to occur during a
  live read — there is no way to check token health proactively, before a
  prospect hits it.
- Change: New `app/api/health/route.ts`:
  - Firestore check: a cheap `db.collection('_health').doc('ping').get()`
    (or read the smallest existing collection) wrapped in a try/catch with a
    short timeout; report `ok`/`error` + latency ms.
  - Meta token check: call Graph's `debug_token` endpoint
    (`GET /debug_token?input_token={META_ACCESS_TOKEN}&access_token={META_ACCESS_TOKEN}`
    — self-inspection, a single free metadata call, not a `business_discovery`
    call, so it does not spend from the ~200/hr read budget) and surface
    `is_valid`, `expires_at` (long-lived token, 60-day horizon), and
    `data_access_expires_at` (90-day horizon, the one `discovery.ts` already
    documents as the silent-failure mode behind the `no-data` reason). Compute
    days-remaining for both and return a `warning` field when either is under
    7 days.
  - Response shape: `{ ok: boolean, firestore: {...}, meta: {...}, checkedAt }`.
    Return 200 even on a degraded check (the caller reads the body), 503 only
    if Firestore itself is unreachable (matching the existing `503` convention
    in `app/api/lead/route.ts` for a store failure).
  - No auth required for the endpoint to be pingable by an external uptime
    monitor, but do NOT leak the token itself or secret values in the
    response — only booleans/timestamps/counts.
  - Surface the same warning in `/ops` (reuse the panel from item 2) so a
    human sees "Meta token expires in 4 days" without needing to curl the
    endpoint.
- Acceptance: `curl $SITE/api/health` returns 200 with accurate Firestore
  latency and Meta token expiry fields against the real token; deliberately
  passing a garbage `META_ACCESS_TOKEN` locally makes `meta.ok` false without
  throwing; the endpoint completes in well under a second server side (no
  `business_discovery` call is ever made by it).
- Depends on: none.

### 6. Structured logs for the read pipeline  [S] [tier: sonnet]
- Problem: Zero logging exists in `app/api/lead/route.ts` or
  `lib/teardown/run.ts`. Cloud Run/App Hosting captures stdout/stderr into
  Cloud Logging automatically — this item is purely "start writing the
  right lines," not new infrastructure.
- Change: Add single-line JSON `console.log`/`console.error` calls (Cloud
  Logging parses a JSON-shaped stdout line into structured fields
  automatically — no library needed) at the key transitions inside the
  `after()` block in `app/api/lead/route.ts` and inside `runRead` in
  `lib/teardown/run.ts`:
  - `{ msg: 'read.start', handle, clientId }`
  - `{ msg: 'read.done', handle, clientId, durationMs, outcome: 'ok'|'failed', reason?, siteRead: boolean, metaCallsUsed: 1 }`
    (metaCallsUsed is always 1 per read today — `discover()` makes one
    `business_discovery` call — but logging it as a field, not a comment,
    is what lets a Logs-based metric later chart Meta budget usage % against
    the ~200/hr ceiling the shared context already established).
  - `{ msg: 'notify.sent'|'notify.skipped', event, reason? }` around each
    `tellOperator` call.
  - Never log `contactPhone`, `contactName`, or `META_ACCESS_TOKEN` — handle
    and outcome only, matching the PDPL-conscious posture the rest of the app
    already takes (this list is deliberately data-minimal).
- Acceptance: Triggering a real (or staging) teardown produces a `read.start`
  and `read.done` line visible in `firebase apphosting:logs` / Cloud Logging,
  with `durationMs` populated and `outcome` correct on both a success and a
  forced failure (e.g. submit an unreadable handle); grepping Cloud Logging
  for `"msg":"read.done"` and `"outcome":"failed"` is how Khaled or Ali finds
  a stuck lead without opening `/ops`.
- Depends on: none.

### 7. Firestore scheduled export (backup)  [S] [tier: sonnet]
- Problem: No backup exists. `clients`, `teardowns`, `sheets`, `deals`,
  `talent` are the entire business record — a bad migration, an accidental
  bulk delete from the console, or a bug in `openClient`'s merge logic has no
  recovery path today.
- Change: This is a GCP-console/`gcloud` config action, not a repo file change
  (Firestore managed export has no equivalent in `firebase.json`). Document
  the setup as a runbook step (item 9) and, optionally, add a
  `scripts/README` note:
  ```
  gcloud firestore export gs://pravda-jo-backups/$(date +%Y%m%d) --project=pravda-jo
  ```
  scheduled via Cloud Scheduler + a Cloud Function/Cloud Run job, or the
  simpler route: Google Cloud Console → Firestore → Backups → enable *managed
  daily backups* (a native Firestore feature, no code, no Cloud Function
  needed, retained for a configurable window) — prefer this over hand-rolled
  export/Scheduler unless point-in-time recovery beyond the managed retention
  window is required.
- Acceptance: A daily backup exists and is visible in the Firestore console's
  Backups tab (or a `gs://` bucket has a dated export); a restore drill is run
  once (into a scratch project or a new database instance, never into
  `pravda-jo` directly) and documented as having worked.
- Depends on: none.

### 8. Data-retention TTL for unconverted prospects  [M] [tier: opus]
- Problem: `/{lang}/data` publicly promises the six PDPL rights including
  deletion, but nothing *automatically* ages out a teardown for a prospect who
  never replied. Every handle ever submitted sits in Firestore indefinitely.
  This is a judgment call about what counts as a reasonable default retention
  period for a lead that never converts — the kind of decision that should not
  be made silently inside a script, hence `opus` tier and an explicit open
  question below rather than a hard default baked in.
- Change:
  - Add a `firestore` native TTL policy (Firestore supports TTL policies on a
    timestamp field, deleting documents automatically with no Cloud Function)
    on `clients` and `sheets` collections keyed off a new field, e.g.
    `expiresAt`, set at write time in `lib/store/clients.ts`'s `openClient` to
    `now + N days` — but ONLY for clients whose status never progresses past
    `ready`/`failed` (a `signed` Deal must clear/never-set `expiresAt`, since a
    live client's records must not expire). This needs a small addition to
    `lib/store/clients.ts` and `lib/store/convert.ts` (clear `expiresAt` on
    `winSheet`) plus a `gcloud firestore fields ttls update` command to enable
    the TTL policy (a one-time console/CLI action, documented in the runbook).
  - Decide N (the shared context and privacy page do not state a number — the
    `/{lang}/data` "within 7 days" promise is about *responding* to a request,
    not about automatic aging; suggest 180 days as a starting default for an
    unconverted lead, but this is genuinely the owner's call — see Open
    questions).
- Acceptance: A test client document seeded with `expiresAt` in the past is
  confirmed removed by Firestore's TTL sweep (can take up to 24h in reality;
  for verification, use the Firestore console's TTL policy status page rather
  than waiting on a real document); a `signed` Deal's client document is
  confirmed to have no `expiresAt` set and survives past the window.
- Depends on: none, but touches `lib/store/clients.ts` and
  `lib/store/convert.ts` — coordinate with whichever workstream owns the
  client/deal lifecycle before editing those files.

### 9. Operational runbook (README section or `docs/RUNBOOK.md`)  [M] [tier: sonnet]
- Problem: None of the following exist anywhere in writing: how to rotate
  `OPERATOR_KEY`, how to reissue a Meta token, how to reissue a talent code,
  how to re-run a failed read, how to export/delete a client's data on a PDPL
  request. Each is currently "ask Ali."
- Change: Add a `## Runbook` section to README (or a separate `docs/RUNBOOK.md`
  linked from README — prefer inline in README given the project's existing
  single-file-of-truth style) covering, concretely:
  - **Rotate `OPERATOR_KEY`**: `firebase apphosting:secrets:set OPERATOR_KEY`
    on the affected backend; **warn explicitly** that this invalidates every
    active `/ops` session (cookie digest mismatch) and every currently
    signed-in talent session (`sign(id)` uses the old key) simultaneously —
    do this outside business hours or notify Khaled and any talent mid-flow.
  - **Reissue a Meta token**: Meta long-lived Page tokens expire in 60 days;
    `data_access_expires_at` (silently, per `discovery.ts`'s `no-data`
    documentation) in 90. Steps: regenerate via Graph API Explorer or Business
    Settings → System Users → Generate New Token, extend to long-lived via
    the `oauth/access_token?grant_type=fb_exchange_token` call, then
    `firebase apphosting:secrets:set META_ACCESS_TOKEN`. Cross-reference the
    new `/api/health` endpoint (item 5) as the way to confirm the new token's
    expiry dates before relying on it.
  - **Reissue a talent code**: already has a code path —
    `POST /api/ops/talent { action: 'reissue', id }` (confirmed in
    `app/api/ops/talent/route.ts`) generates a new code and overwrites
    `passCodeHash`; document that this is exposed via the `/ops/talent` UI, or
    if not yet wired to a button, note that as a UI gap for another workstream.
  - **Re-run a failed read**: today there is no console button (the shared
    context flags this as a known gap: "no stale sweep; no re-run button").
    Until that UI exists, document the manual path:
    `POST /api/teardown` with `Authorization: Bearer $OPERATOR_KEY` and
    `{ handle }` re-runs `runRead` directly (confirmed against
    `app/api/teardown/route.ts`), but note this writes to the *legacy* Report
    path, not the live Sheet path — flag clearly that this is a stop-gap, not
    the same as the intake flow's `runRead` call, and cross-link to whichever
    workstream owns adding a proper re-run button to `/ops/clients/[id]`.
  - **Export a client's data (PDPL right #1/#6)**: new
    `scripts/export-client.mjs <handle>` — reads `clients/{handle}`,
    `teardowns` where `handle==`, `sheets` where `handle==`, any `deals`
    referencing that client, serialises to one JSON file, printed to stdout or
    written to a local file for a human to email. Must run with real ADC
    against `pravda-jo` (guard: refuse to run if
    `FIRESTORE_COLLECTION_PREFIX` is set, so it's never accidentally pointed
    at staging test data for a real request).
  - **Delete a client's data on request (PDPL right #3)**: new
    `scripts/delete-client.mjs <handle> --confirm` — deletes the `clients`
    doc, every `teardowns`/`sheets` doc for that handle, and any `deals`
    referencing it; requires the literal `--confirm` flag (no default-yes);
    logs what was deleted to stdout for the operator's own record before
    replying to the requester. This is the concrete implementation behind the
    site's existing "we erase... permanently, no questions" promise — until
    this script exists, that promise is unfulfillable without hand-editing
    Firestore.
- Acceptance: Each runbook step is followed once, verbatim, by someone who
  did not write it (Khaled or a fresh read of this section) and works; the
  export/delete scripts are tested against `_itest_`-prefixed data before ever
  being run against a real handle.
- Depends on: 5 (health check informs the token-reissue step), 4 (staging
  prefix is what makes safe dry-runs of export/delete possible).

### 10. Bundle-budget check in CI  [S] [tier: sonnet]
- Problem: README states hard budgets (≤250 kB WebGL/text routes, ≤150 kB for
  `/r`) as "Actual" measured numbers, but nothing enforces them going forward
  — a future dependency bump could silently blow the budget and nobody would
  notice until Lighthouse or a slow phone did.
- Change: Add a `scripts/check-bundle.mjs` that runs after `next build`,
  reads `.next/build-manifest.json` (or `.next-prod/build-manifest.json`
  depending on `NEXT_DIST_DIR`) plus the per-route First Load JS numbers Next
  already prints to stdout during `next build` — either parse that stdout
  table (fragile) or read `.next/app-build-manifest.json` /
  `next build --debug`'s machine-readable output if available in 15.5.24;
  simplest robust option: shell out to `next build` capturing stdout, regex
  the "First Load JS" column per route, and fail if any WebGL/text route
  exceeds its budget or `/r` exceeds 150 kB. Wire as a step in the CI workflow
  (item 3) after `npm run build`.
- Acceptance: Running `node scripts/check-bundle.mjs` after a normal build
  passes silently; artificially importing a large unused library into a
  budgeted route and rebuilding causes it to fail with a clear message naming
  the route and the overage.
- Depends on: 3 (needs the CI build step to run against).

### 11. Repo-root `CLAUDE.md`  [M] [tier: opus]
- Problem: No `CLAUDE.md` exists at repo root. An agent working on any single
  workstream currently has to re-derive every cross-cutting rule (bilingual
  AR/EN, the four RTL rules, "PRAVDA is always the connector" schema
  invariant, "only say what we can prove", no PDF libraries by design, the
  `.next`/`.next-prod` distDir split, the OPERATOR_KEY-signs-both-cookie-types
  trust model, the token-trust boundary between client SDK absence and
  Firestore rules denying everything) by reading scattered README prose and
  code comments. This is exactly the failure mode CLAUDE.md files exist to
  prevent.
- Change: Write `/Users/aliodat/Pravda/CLAUDE.md` covering, tersely (link to
  README/code rather than duplicating prose):
  - Stack one-liner + "read README.md first."
  - Bilingual/RTL: `/ar` canonical, both locales required for every page, the
    four `globals.css` rules (no letter-spacing, no text-transform, no faux
    italic, ragged right), Arabic type scale is forked not derived.
  - The connector invariant: a client never learns a provider's rate, a
    provider never learns what a client paid — enforced by schema absence on
    `Booking`, not by a runtime check; never add a field that would let one
    side compute the other's number.
  - "Only what we can prove": every number in a teardown must be computed
    from public Meta/website data; anything the engine can't justify is
    `⟦placeholder⟧`, never invented prose.
  - No PDF libraries by design — `/doc/*` are print stylesheets; do not add
    `puppeteer`/`react-pdf`/etc. even if asked, without flagging the tension.
  - `firebase-admin` only, no client Firestore SDK, ever — `firestore.rules`
    denies all client access by design; if a change seems to need client-side
    Firestore access, that is a sign the architecture is being violated, not
    a sign the rules need loosening.
  - The dist-dir split (`npm run build` → `.next`, `npm run build:local` →
    `.next-prod`) and why (documented at length in README already — one
    paragraph pointer here is enough).
  - `OPERATOR_KEY` triple-duty warning (bearer auth + ops cookie digest +
    talent cookie signature) from item 9, so no future change treats it as a
    single-purpose secret.
  - Pointer to the new Runbook section (item 9) and `/api/health` (item 5).
  - A short "routes that must never appear in the sitemap" list (`/r`, `/p`,
    `/s`, `/ops`, `/t`, `/doc`) matching `robots.ts`, so a future new route
    under one of these prefixes is disallowed by habit, not by remembering to
    check `robots.ts`.
- Acceptance: A fresh agent session reading only `CLAUDE.md` + README can
  correctly answer "can I add a client-side Firestore read for X" (no),
  "should teardown copy include a claim we can't compute" (no), "what happens
  if I rotate OPERATOR_KEY" (logs everyone out) without searching the codebase.
- Depends on: 9 (references the runbook), 5 (references health check).

### 12. README updates for staleness  [S] [tier: sonnet]
- Problem: README's Routes table lists `/r/[token]` and `/p/[token]` as *the*
  delivery surfaces and describes the entity-block/budget sections purely in
  terms of them, but per the shared context the live flow's actual delivery
  surface is `/s/[token]`, with `/r`/`/p` now legacy-only (reachable solely
  through `/api/teardown` → `/ops/[token]`, which no UI links to). A reader
  learning the system from README today would misunderstand which route is
  live.
- Change: Update README's Routes table to add `/s/[token]` as the current,
  linked delivery surface (client-facing, per-recipient, noindex — same
  treatment as `/r`/`/p`), and add a one-line note that `/r`/`/p` are the
  *legacy* format still reachable via the operator-only `/api/teardown` path
  and are not what a real prospect receives today (matching the shared
  context's finding nearly verbatim, since it's already precisely stated
  there). Update the `robots.ts`-derived disallow list mention if README
  quotes it anywhere to include `/s`. Leave the WebGL/budget sections alone —
  those are about `/r` specifically holding to a stricter budget, which
  remains true regardless of which route real traffic uses; just add a note
  that `/s` should be held to at least as strict a budget if not stricter,
  since it's now the one that's actually live (flag as an open question for
  the client-facing workstream to size, not something to compute here).
- Acceptance: A reader of README's Routes table correctly identifies `/s` as
  where a real prospect's teardown lives today, without needing the shared
  planning context to know that.
- Depends on: none. Coordinate with the workstream that owns `/s` and
  `components/ops/SheetReview.tsx` before editing, since README wording
  there may need to match terminology that workstream is also touching.

## Data-model / interface changes other workstreams must know about
- Item 8 (retention TTL) adds an `expiresAt` field to `clients` (and
  `sheets`) documents, cleared on `winSheet` in `lib/store/convert.ts`. Any
  workstream touching client lifecycle state (`openClient`, `setClientStatus`,
  `winSheet`) must preserve/clear this field correctly or a converted client's
  records could be TTL-deleted out from under an active Deal.
- Item 6 (structured logs) does not change any schema, but establishes a log
  line vocabulary (`read.start`, `read.done`, `notify.sent`, `notify.skipped`)
  — other workstreams adding new pipeline stages should extend this
  vocabulary rather than inventing a parallel one, so a single Cloud Logging
  query still finds every read.
- Item 4 (staging prefix) means any workstream writing a new
  `lib/store/*.ts` module must read `FIRESTORE_COLLECTION_PREFIX` the same
  way the existing four do, or that module will silently write to prod from a
  staging deploy.
- Item 9's runbook documents that `OPERATOR_KEY` rotation invalidates talent
  sessions too — any workstream building new talent-facing features should
  not assume a talent session is durable across an operator-initiated key
  rotation.

## Risks and what NOT to change
- Do NOT touch `firestore.rules` — it correctly denies all client access by
  design; the staging isolation (item 4) is achieved entirely through the
  collection-prefix convention, not through per-environment rules.
- Do NOT run `npm audit fix --force` — both available fixes are breaking
  major-version bumps (`next@16`, `firebase-admin@10`, a *downgrade* from the
  currently pinned `14.3.0`) that are out of scope for this workstream and
  would need their own migration plan; flag the audit findings, do not act on
  them here.
- Do NOT change `lib/store/firebase.ts`'s existing ADC/service-account
  fallback logic beyond adding the `FIRESTORE_EMULATOR_HOST` branch (item 3) —
  the existing guard against an unpinned Admin SDK silently reading the wrong
  GCP project (via the `GOOGLE_CLOUD_PROJECT`/`GCLOUD_PROJECT`/
  `FIREBASE_PROJECT_ID` fallback chain) is deliberate and documented; do not
  simplify it.
- Do NOT delete or "clean up" `/r`, `/p`, `/api/teardown`, or `/ops/[token]`
  as part of the README update (item 12) — the shared context is explicit
  that this is a live-but-legacy path, and removing it is a decision for
  whichever workstream owns the delivery-flow consolidation, not this one.
- Do NOT set a default retention TTL (item 8) without owner sign-off on the
  number of days — this is a genuine business/legal decision (see Open
  questions), not an engineering default to pick unilaterally.
- Be careful with item 9's `scripts/delete-client.mjs`: it is destructive and
  irreversible by design (matching the site's own "permanently, no questions"
  promise) — the `--confirm` flag and the staging-prefix test-first
  requirement are not optional safety theatre, they are the only guard against
  an operator fat-fingering a real handle.

## Open questions for the owner
1. **Which branch does the App Hosting backend actually build from?** This
   binding lives in the Firebase console / GitHub App installation, not in
   any repo file, so it cannot be confirmed by reading the repo. Given `main`
   and `next-site` are currently identical, this is low-urgency today, but
   the answer determines whether `main` or `next-site` is the one that must
   pass CI (item 3) before every deploy, and whether `next-site` should be
   retired now that it has caught up.
2. **What retention window (N days) should an unconverted prospect's data get
   before automatic deletion (item 8)?** The `/{lang}/data` page promises
   deletion *on request* but says nothing about automatic aging; 180 days is
   proposed as a starting default in item 8, but this is a business/legal
   call, not an engineering one — Jordan's PDPL data-minimisation principle
   argues for shorter, commercial patience for a slow-to-convert lead argues
   for longer.
3. **Does the Firebase project's plan/tier support multiple App Hosting
   backends for staging (item 4), and is the added Cloud Run cost (even at
   `minInstances: 0`) acceptable** for a studio this early? If not, the
   fallback is a single backend with prefix-based staging reached at a
   different *path* rather than a different *backend* — feasible but loses
   the clean secret-isolation item 4 relies on for `OPERATOR_KEY`.
4. **Who is the on-call for the Meta-token-expiring-in-N-days warning
   (item 5)?** The `/ops` panel surfaces it to whoever is logged in, but with
   two people and no monitoring service yet, is a WhatsApp ping to
   `OPERATOR_PHONE` via the existing `tellOperator`-style mechanism worth
   adding now, or is "check `/ops` occasionally" sufficient at this scale?
