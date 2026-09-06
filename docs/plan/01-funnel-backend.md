# Funnel and backend reliability plan

## Goal
Every handle submitted on the public form must end as a sheet on Khaled's screen or as a
failure he was told about — never as a client sitting in `reading` forever because Cloud Run
throttled the instance after the response flushed. The operator must be told a lead arrived
before the visitor's form even settles, must be able to re-run a read by hand, and must be able
to see from the console which configuration is missing in production. Every API route must be
authenticated, rate limited where it is public, and hold a session that actually expires.

## Current state
`POST /api/lead` writes the client, responds, and does everything else — the "new lead" notice,
the Meta read, the sheet, the status transitions and the "ready" notice — inside Next's
`after()`. On Firebase App Hosting (Cloud Run, `minInstances: 0`, request-based billing) CPU is
throttled to near zero the moment the response is flushed and the instance can be reclaimed, so
`after()` is a best-effort callback, not a guarantee. Nothing sweeps a stalled `reading`, there
is no re-run button, and the console's own re-run (`/api/ops/sheet` action `run`) both wipes the
lead's contact details and drags a `sent`/`won` client back to `ready`. The public endpoint has
no rate limiting at all in front of a ~200-call/hour Meta budget. The ops cookie is a static
`sha256(OPERATOR_KEY)` with `sameSite: 'strict'`, so it never rotates, never expires server-side,
and dies on every link tapped from WhatsApp. Production wires four env vars; the phone number,
the site URL and every notification variable are absent. There is one composite index, for a
collection the live pipeline no longer uses.

---

## Work items — ordered by priority

### 1. Make the read guaranteed: a claim-leased reading queue swept by Cloud Scheduler  [L] [tier: opus]
- **Problem:** `after()` runs after the response is flushed. Cloud Run with request-based
  billing throttles the instance's CPU at that exact point and may reclaim it; there is no
  contract that the callback finishes. A lead can sit in `reading` (or never leave `new`)
  permanently, with no sheet, no failure, and no notice — the exact bug the intake form was
  built to fix, one layer deeper.

  Options weighed:

  | Option | Guaranteed? | Cost | Why not / why |
  |---|---|---|---|
  | `minInstances: 1` | **No.** A warm idle instance still has CPU throttled between requests under request-based billing. It makes `after()` *more likely* to finish, not certain. | ~$5–15/mo | Rejected as a fix. Buys cold-start latency, not correctness. |
  | Await the read inline, longer form wait + honest UI | Yes | $0 | Correct but wrong shape: the visitor's form now takes 3–15s and fails visibly when Meta is throttled. The lead is already saved by then, so the wait buys the visitor nothing. Keep as the *console's* behaviour (it already is), not the public form's. |
  | Cloud Tasks | Yes, with retries and backoff | ~$0 (1M ops/mo free) | The textbook answer. Needs `@google-cloud/tasks`, a queue provisioned out-of-band, a service account, OIDC verification on the worker route. Correct, but two moving parts more than this studio needs today. Named as the upgrade path. |
  | Firestore-triggered Cloud Function | Yes | ~$0 | Needs a second deployable with its own build, its own copy of the secrets, and either a duplicate of `lib/teardown/run.ts` or an HTTP call back into the Next app — which is Cloud Tasks with extra steps and no retry control. Rejected. |
  | **Cron-polled reading queue** | **Yes — the work happens *during* a request, so CPU is allocated by definition** | **$0** (Cloud Scheduler: 3 jobs free) | **Recommended.** One route, one scheduler job, no new npm dependency, no second deployable, and it *is* the stale sweep and the retry engine that items 3 and 5 need anyway. |

- **Change:**
  - `lib/data/clients.ts` — `Client` gains `queuedAt?: string`, `readStartedAt?: string`,
    `readLeaseUntil?: string`, `readAttempts?: number`. Status set is unchanged.
  - `lib/store/clients.ts` — new `claimForRead(id, leaseMs = 10 * 60_000)`: a transaction that
    reads the doc, refuses unless status is `new` or (`reading` and `readLeaseUntil` is in the
    past), then writes `status: 'reading'`, `readStartedAt`, `readLeaseUntil = now + leaseMs`,
    `readAttempts: (prior ?? 0) + 1`. Returns the claimed `Client` or `null`. This one function
    is what lets `after()` and the sweeper both exist without ever double-spending a Meta call.
  - New `lib/teardown/pipeline.ts` — `readAndFile(client)`: the whole body currently inside
    `after()` (run, attach, name, status, `tellOperator('ready'|'failed')`), lifted out so the
    lead route, the sweeper and the operator re-run button all call one function. It assumes the
    claim has already been taken.
  - `app/api/lead/route.ts` — `after()` now: `const claimed = await claimForRead(client.id);
    if (claimed) await readAndFile(claimed);` and nothing else. If the instance dies mid-read the
    lease expires and the sweeper picks it up.
  - New `app/api/cron/read/route.ts` (GET, `runtime: 'nodejs'`, `dynamic: 'force-dynamic'`):
    - Authenticates on `x-pravda-cron` compared to `CRON_SECRET` with `timingSafeEqual`, or a
      verified Cloud Scheduler OIDC token. Unset secret means closed, never open — same rule as
      `OPERATOR_KEY`.
    - Query A: `clients where status == 'new' orderBy queuedAt asc limit 3`.
    - Query B: `clients where status == 'reading' orderBy readLeaseUntil asc limit 3`, filtered
      in code to leases already expired.
    - For each: `claimForRead` (skip if it returns null — someone else has it), then
      `readAndFile`. Cap at **3 reads per invocation** and check the global Meta ceiling (item 5)
      before each, so a leaked `CRON_SECRET` cannot drain the hourly budget.
    - A client whose `readAttempts` has reached 3 is moved to `failed` with the last reason and
      `tellOperator('failed')` rather than retried again.
    - Returns a small JSON summary; logs one line per client.
  - Cloud Scheduler job, created once by hand:
    `gcloud scheduler jobs create http pravda-read-queue --schedule="* * * * *" --uri="$SITE/api/cron/read" --http-method=GET --headers="x-pravda-cron=<secret>"`.
  - `apphosting.yaml` — `CRON_SECRET` as a secret (item 8).
- **Acceptance:**
  - `tests/queue.itest.mts`: two concurrent `claimForRead` calls on one doc → exactly one
    non-null. A doc with `status: 'reading'` and `readLeaseUntil` in the past is claimable; one
    with a live lease is not. A fourth attempt lands on `failed`, not `reading`.
  - Killing the process immediately after `POST /api/lead` responds leaves a client that the
    sweeper moves to `ready` or `failed` within two minutes.
  - No client older than 15 minutes is ever in `reading` in production.
  - Worst-case latency from submission to sheet: read time + at most 60s.
- **Depends on:** none. Item 3 and item 5's global ceiling build on it.

---

### 2. Send the "new lead" notice synchronously, before the response  [S] [tier: sonnet]
- **Problem:** `tellOperator('new', client)` lives inside `after()`. It is the single most
  time-critical thing the system does — somebody is holding a phone expecting a reply — and it
  is the thing most likely to be dropped when the instance is throttled.
- **Change:** In `app/api/lead/route.ts`, move the `new` notice above the `NextResponse.json`,
  immediately after `openClient` succeeds:
  ```ts
  if (created || !client.notifiedNewAt) {
    await tellOperator('new', client).catch(() => {});
  }
  ```
  `tellOperator` already never throws; the `.catch` is belt-and-braces. Add
  `signal: AbortSignal.timeout(4000)` to the `fetch` in `lib/notify/whatsapp.ts#sendText` and to
  the Telegram/email senders from item 7, so a hung upstream cannot hold the form open. When no
  channel is configured, `deliver()` does zero network I/O and this costs microseconds.
- **Acceptance:** With `WHATSAPP_*`/`TELEGRAM_*` unset, `POST /api/lead` p95 is unchanged. With
  a channel configured and pointed at a black-hole host, the response still returns in <5s and
  the client is written. `notifiedNewAt` is set before the response when the send succeeded.
- **Depends on:** none (item 7 improves what it sends).

---

### 3. Status machine: forward-only transitions, stale detection, and a "Re-run read" button  [M] [tier: opus]
- **Problem:** Three separate faults.
  1. `setClientStatus` is an unconditional `update`. `/api/ops/sheet` action `run` calls
     `setClientStatus(handle, 'ready')` at the end of every console read, so re-reading a client
     Khaled has already sent a sheet to — or won — drags them back to `ready` and back into the
     queue as work to do.
  2. There is no way to detect a client stuck in `reading`, and no way to ask for another read of
     a `failed` one except by typing the handle into `RunHandle`, which is what triggers fault 1.
  3. `unapproveSheet` sets `ready` the same unconditional way, which is correct there but is the
     same unguarded primitive.
- **Change:**
  - `lib/store/clients.ts` — new `advanceClient(id, status, readError?)`, a transaction with an
    explicit rank table:
    ```
    new 0 · reading 1 · failed 1 · ready 2 · sent 3 · won 4 · lost 4
    ```
    Rules: an *engine* transition (`reading`, `ready`, `failed`) applies only if the current rank
    is ≤ 2 — a `sent`/`won`/`lost` client keeps its status while its new sheet is filed
    underneath it. *Operator* transitions (`sent`, `won`, `lost`, and an explicit
    `unapprove`→`ready`) always apply. `setClientStatus` stays, renamed
    `forceClientStatus`, used only by `unapproveSheet`'s caller and by the sweeper.
  - Replace every `setClientStatus(...)` call in `app/api/lead/route.ts`,
    `app/api/ops/sheet/route.ts` and `lib/teardown/pipeline.ts` with `advanceClient`.
  - **Stale detection** is the sweeper's query B from item 1 — no separate mechanism.
    `/ops/clients` gains a visual mark: a `reading` row whose `readLeaseUntil` has passed renders
    as `stalled` (amber) rather than `Reading`, so the console tells the truth before the sweeper
    gets to it.
  - **Re-run:** `app/api/ops/client/route.ts` gains `action: 'rerun'` — `claimForRead(id, lease)`
    with a force flag that ignores the current status, then `after(() => readAndFile(claimed))`
    plus enqueue-fallback (set `queuedAt`, so if the instance dies the sweeper finishes it).
    `components/ops/ClientActions.tsx` gains a "Re-run read" button beside the notices, showing
    `readAttempts` and the last `readError`. It never touches contact details and it never
    changes status past `ready`.
- **Acceptance:**
  - `tests/status.itest.mts`: a client at `sent` re-read by the console is still `sent`
    afterwards, and the new sheet token is at the head of `sheetTokens`. A client at `won` is
    still `won`. A `failed` client re-read successfully becomes `ready`.
  - `/ops/clients/[id]` shows "Re-run read"; pressing it on a `failed` client produces a second
    entry in the Reads table without altering `contactName`/`contactPhone`.
  - No row in `/ops/clients` reads `Reading` for more than 15 minutes.
- **Depends on:** 1 (claim/lease), 4 (contact fix, so the re-run path is safe).

---

### 4. The two known corruption bugs: contact overwrite and the strict cookie  [S] [tier: sonnet]
- **Problem:**
  - `openClient` unconditionally writes `contactName: input.contactName` and
    `contactPhone: input.contactPhone`. `/api/ops/sheet` action `run` calls it with
    `str(b?.contactName)` / `str(b?.contactPhone)`, and `RunHandle` sends neither — so both are
    `''`. A console re-read of a real lead erases the name and phone number of the person waiting
    for a reply. The doc comment says "contact details always win"; empty strings are not
    details.
  - The ops cookie is `sameSite: 'strict'`. Every notification links into `/ops/...`; every one
    of those links is tapped from inside WhatsApp, which is a cross-site top-level navigation, so
    the cookie is withheld and Khaled lands on the sign-in gate every single time. It is the
    single highest-friction bug in the operator's day.
- **Change:**
  - `lib/store/clients.ts#openClient`: `contactName: input.contactName.trim() || prior?.contactName || ''`
    and the same for `contactPhone`. A non-empty value still wins (the typo-correction case the
    comment protects); an empty one no longer destroys.
  - `app/api/ops/sheet/route.ts` action `run`: build the `openClient` input with the contact keys
    **omitted entirely** when blank, rather than passing `''`.
  - `app/api/ops/login/route.ts`: `sameSite: 'lax'`. `lax` still withholds the cookie on
    cross-site POST, so the form-post surface stays protected; it permits the top-level GET
    navigation that a tapped link is. Pair it with the origin check in item 6.
  - `components/ops/RunHandle.tsx`: delete the `j.reused` branch — `/api/ops/sheet` never returns
    `reused` (that field is the legacy `/api/teardown`'s), so it is dead code advertising a
    "Read again" button that does not exist.
- **Acceptance:**
  - `tests/contact.itest.mts`: `openClient` with `contactName: ''` on an existing client leaves
    the stored name intact; with `'Abu Sami'` it replaces it.
  - Tapping an `/ops/clients/{id}` link from WhatsApp on a phone with a live session lands on the
    account page, not the gate.
- **Depends on:** none. Do this first — it is small and it is destroying live data.

---

### 5. Rate limiting and abuse protection on /api/lead  [M] [tier: opus]
- **Problem:** `/api/lead` is the only endpoint a stranger can reach and it is unmetered. Each
  distinct handle spends 1–2 Meta calls out of a ~200/hour app-wide budget and pings Khaled's
  phone. A trivial script exhausts both. The existing "already read → skip" short-circuit only
  helps for *repeat* handles.
- **Change:** Four layers, cheapest first. In-memory alone is wrong here — Cloud Run runs up to
  4 instances and an attacker's requests land round-robin — so **Firestore is the source of
  truth**, with an optional in-memory LRU in front as a tolerant fast-reject.
  - **Honeypot (mandatory, free).** `components/Intake.tsx` renders a visually hidden, non-`aria`
    input named `company` with `tabindex="-1"` and `autocomplete="off"`. `/api/lead` returns
    `{ ok: true }` with no write when it is non-empty — a silent success, so a bot learns
    nothing. Also reject when the client-sent `elapsedMs` (time since mount) is < 1200.
  - **Per-IP fixed windows (Firestore).** New `lib/store/ratelimit.ts`:
    ```ts
    hit(bucket: string, limit: number, windowMs: number): Promise<{ ok: boolean; remaining: number }>
    ```
    Doc id `${bucket}:${Math.floor(now / windowMs)}` in a `ratelimit` collection, incremented with
    `FieldValue.increment(1)` inside a transaction, carrying `expiresAt` for a Firestore TTL
    policy so the collection self-cleans. Two buckets per request: `ip:<sha256(ip).slice(0,16)>`
    at **5/hour** and **20/day**. IP from the first entry of `x-forwarded-for`; it is spoofable
    by a determined attacker, which is exactly why the next layer exists.
  - **Global Meta ceiling (the real backstop).** Bucket `reads:global` at **40 reads/hour**,
    checked in `claimForRead` — not in the lead route. Over the ceiling, the client stays `new`
    with `queuedAt` set and the sweeper picks it up next hour. The lead is never lost; only the
    read is deferred. `tellOperator('new')` still fires. This is the layer that actually protects
    the Meta budget, because it sits on the spend, not on the request.
  - **Turnstile (optional, off by default).** `NEXT_PUBLIC_TURNSTILE_SITE_KEY` +
    `TURNSTILE_SECRET_KEY`; when both are set, `/api/lead` verifies the token server-side against
    `https://challenges.cloudflare.com/turnstile/v0/siteverify` and 403s on failure. When unset,
    the check is skipped entirely. Do not ship the widget until abuse is observed — it costs the
    visitor a step at the highest-value moment on the site.
  - Rate-limited responses: `429` with `{ error: 'too-many' }` and a `Retry-After` header;
    `Intake.tsx` shows a plain sentence in the visitor's language, never a raw error.
- **Acceptance:**
  - `tests/ratelimit.itest.mts`: 5 hits pass and the 6th in the same window fails; a different
    bucket in the same window passes; the window rolls.
  - Posting with `company` filled returns 200 and writes no client doc.
  - With `reads:global` exhausted, `POST /api/lead` still creates the client, still notifies, and
    leaves status `new`; the sweeper reads it once the window rolls.
- **Depends on:** 1 (the global ceiling is enforced in `claimForRead`).

---

### 6. Ops session security: expiring HMAC session, CSRF posture, and a separate talent secret  [M] [tier: opus]
- **Problem:**
  - The ops cookie value is a constant, `sha256(OPERATOR_KEY)`. It never rotates, so every
    session Khaled has ever opened shares one value; and `maxAge` is only a hint to the browser —
    a copied cookie value is valid forever server-side. There is no revocation short of rotating
    `OPERATOR_KEY`.
  - `/api/ops/login` and `/api/ops/logout` are HTML form POSTs with no origin check. With
    `sameSite` moving to `lax` (item 4) that is still safe against cross-site POST, but the JSON
    routes deserve the same explicit check rather than relying on one cookie attribute.
  - Talent cookies are signed with `OPERATOR_KEY` using `sha256(id + ':' + secret)` — a
    home-rolled MAC, not an HMAC.
- **Change:**
  - `lib/ops/auth.ts` — replace `digest()` with a minted, dated session:
    ```ts
    // v1.<issuedAtMs>.<hex 32 of hmac-sha256(secret, `ops:v1:${issuedAt}`)>
    export const mintSession = () => ...
    export const verifySession = (raw: string) => ...  // timingSafeEqual + now - issuedAt < TTL
    ```
    `TTL = 12h`, matching today's `maxAge`, now enforced on the server. Each login produces a
    different value, so the session rotates by construction, and rotating `OPERATOR_KEY`
    invalidates every outstanding session — which is the revocation mechanism, and worth writing
    down. `opsAuthed()` keeps its signature; every caller is unchanged.
  - New `sameOrigin(req: Request): boolean` in `lib/ops/auth.ts` — passes when `Sec-Fetch-Site` is
    `same-origin`/`none`, or when `Origin` matches the request host. Called at the top of every
    mutating ops route (`login`, `logout`, `sheet`, `client`, `booking`, `deal`, `talent`,
    `notify`) and both talent form-post routes, returning `403 { error: 'origin' }`. Cheap,
    explicit, and it survives a future change to the cookie attributes.
  - `lib/talent/auth.ts` — switch to `createHmac('sha256', secret)` and add an issued-at segment
    with a 60-day server-side TTL, mirroring the ops format. **Should `OPERATOR_KEY` also sign
    talent cookies?** It already does, and it is not *unsafe* — the provider never sees the key
    and the format is unambiguous. But it couples two lifecycles that should not be coupled:
    rotating the console key to revoke one operator session signs out every provider on their
    phone, possibly the morning of a shoot. Introduce `SESSION_SECRET`, falling back to
    `OPERATOR_KEY` when unset so nothing breaks on the day of the change, and set it in prod.
- **Acceptance:**
  - `tests/auth.test.mts` (pure, no Firestore): a freshly minted session verifies; one with
    `issuedAt` edited fails; one 12h+1ms old fails; a truncated or padded signature fails.
  - `curl -X POST` to `/api/ops/logout` with an `Origin: https://evil.example` header returns 403.
  - Rotating `OPERATOR_KEY` in Secret Manager and redeploying signs the console out; with
    `SESSION_SECRET` set, talent sessions survive it.
- **Depends on:** 4 (do the `sameSite` change and the origin check in one pass).

---

### 7. Notification channels while WhatsApp Business does not exist  [M] [tier: opus]
- **Problem:** Nothing sends itself today. `tellOperator` composes text and a `wa.me` link, and
  the console shows a lead as un-notified until a human presses "I sent it". That works, but only
  while a human is looking at the console — which is the opposite of what a notification is for.
  And the obvious fix is not available: free-text WhatsApp to Khaled's own number only works
  inside a 24-hour window opened by *him* messaging the business number. Even with `WHATSAPP_*`
  configured, operator notices start silently failing after a quiet day, and the `sent: false`
  will be discovered late.

  | Channel | Time to stand up | Blocked on | Verdict |
  |---|---|---|---|
  | **Telegram bot** | ~10 min (BotFather → token → chat id) | nothing | **Primary interim channel.** No business verification, no message window, no template approval, free, one HTTPS POST from Cloud Run. |
  | Email via **Resend** | ~1 hour after the domain exists | the domain is not registered — both mailboxes in `.env.example` are on an unbought domain | **Second**, once the domain lands. One `fetch`, no dependency. Auditable and searchable, which the others are not. |
  | Email via SMTP | ~1 hour | needs `nodemailer`, and outbound SMTP from Cloud Run is awkward | Rejected in favour of Resend. |
  | WhatsApp Cloud API | days–weeks | Business verification + an approved template | Keep for **talent** (already templated in `notifyOffer`). Do **not** rely on it for operator notices. |
  | `wa.me` manual path | already built | nothing | Keep permanently as the terminal fallback. |

- **Change:**
  - New `lib/notify/telegram.ts` — `sendTelegram(text): Promise<NotifyResult>`, POSTing to
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage` with `chat_id`,
    `disable_web_page_preview: false`. Never throws; 4s timeout.
  - New `lib/notify/email.ts` — `sendEmail(subject, text)` via Resend. Guarded on
    `RESEND_API_KEY` and `NOTIFY_EMAIL_TO`; a no-op returning `{ sent: false, reason:
    'unconfigured' }` otherwise.
  - `lib/notify/operator.ts#deliver` becomes a **cascade**, first success wins:
    `WhatsApp (if WHATSAPP_* set) → Telegram (if TELEGRAM_* set) → Email (if RESEND_* set) → wa.me link, sent: false`.
    `Notice` gains `channel?: 'whatsapp' | 'telegram' | 'email' | 'manual'` and
    `tried?: {channel, reason}[]`. `Client` gains `lastNotifyChannel?: string` written by
    `markNotified`, so `/ops/clients/[id]` can say *how* Khaled was told, not just that he was.
  - **Recommended posture, stated plainly:** point operator notices at **Telegram permanently**
    and leave WhatsApp for talent. That does not work around the 24-hour window — it removes it
    from the operator path entirely, which is better than an approved utility template nobody has
    applied for yet.
  - Env vars: `TELEGRAM_BOT_TOKEN` (secret), `TELEGRAM_CHAT_ID` (value), `RESEND_API_KEY`
    (secret), `NOTIFY_EMAIL_TO`, `NOTIFY_EMAIL_FROM` (values), plus the existing
    `OPERATOR_PHONE`.
  - The console keeps the manual panel unchanged. `ClientActions` shows which channel carried it
    and the reason each earlier one did not.
- **Acceptance:**
  - With only `TELEGRAM_*` set, submitting the public form puts a message in the Telegram chat
    before the browser's response resolves, and `notifiedNewAt` is written.
  - With every channel unset, behaviour is byte-identical to today (compose + `wa.me`, nothing
    marked sent).
  - With `WHATSAPP_TOKEN` set but the window closed, the WhatsApp attempt fails, Telegram
    carries it, and `/ops/clients/[id]` shows `telegram` with the WhatsApp failure recorded
    beside it.
- **Depends on:** 2 (the notice is now on the response path, so timeouts matter).

---

### 8. Production env wiring and a startup self-check in the console  [S] [tier: sonnet]
- **Problem:** `apphosting.yaml` wires four variables. `OPERATOR_PHONE` is absent, so *no*
  notification has a destination in production, in either mode. `NEXT_PUBLIC_SITE_URL` is absent,
  so every link inside every message and every canonical URL falls back to the default in
  `lib/data/company.ts`. Nothing anywhere tells the operator this; the system simply behaves as
  though nobody wants to be told.
- **Change:**
  - `apphosting.yaml` — add, keeping the file's existing "secrets never inline" rule:
    | Variable | Kind | Availability | Why |
    |---|---|---|---|
    | `OPERATOR_PHONE` | secret | RUNTIME | personal number |
    | `CRON_SECRET` | secret | RUNTIME | item 1 |
    | `SESSION_SECRET` | secret | RUNTIME | item 6 |
    | `TELEGRAM_BOT_TOKEN` | secret | RUNTIME | item 7 |
    | `TELEGRAM_CHAT_ID` | value | RUNTIME | not a credential |
    | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID` | secret | RUNTIME | talent sends |
    | `WHATSAPP_TEMPLATE` | value | RUNTIME | a template name |
    | `RESEND_API_KEY` | secret | RUNTIME | item 7, later |
    | `NOTIFY_EMAIL_TO`, `NOTIFY_EMAIL_FROM` | value | RUNTIME | item 7, later |
    | `NEXT_PUBLIC_SITE_URL` | value | **BUILD, RUNTIME** | Next inlines `NEXT_PUBLIC_*` at build; RUNTIME-only would leave the browser bundle with the fallback |
    | `NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_PRIVACY_EMAIL` | value | **BUILD, RUNTIME** | same |
    | `TURNSTILE_SECRET_KEY` / `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | secret / value | RUNTIME / BUILD+RUNTIME | item 5, only if adopted |
  - New `lib/config/check.ts` — `configReport(): { key, present, severity: 'critical' | 'degraded' | 'optional', whatBreaks: string }[]`.
    Critical: `OPERATOR_KEY`, `META_ACCESS_TOKEN`, `META_IG_USER_ID`, a resolvable project id.
    Degraded: no notification channel at all, `NEXT_PUBLIC_SITE_URL` unset, `CRON_SECRET` unset
    (the read queue is not guaranteed). It reports **presence only** — never a value, never a
    prefix, never a length.
  - `app/ops/page.tsx` — a "Configuration" panel above the queue, rendered only when authed, red
    for critical and amber for degraded, each row naming exactly what breaks. Plus a "Check the
    Meta token" button hitting a new `POST /api/ops/selfcheck` that runs `discover(<our own
    handle>, 1)` and reports `ok`/reason and the `x-app-usage` percentage — so an expired token
    is discovered by looking at the console, not by a prospect's read failing.
  - `.env.example` — add every new variable with the same explanatory comments the file already
    uses.
- **Acceptance:** With `OPERATOR_PHONE` and every notify variable unset, `/ops` shows an amber
  "No notification channel is configured — nothing will reach you automatically" row. With
  `META_ACCESS_TOKEN` expired, the self-check button reports `unauthorised` within seconds. No
  secret value appears in any response, page or log.
- **Depends on:** 1, 5, 6, 7 name the variables.

---

### 9. Firestore indexes  [S] [tier: sonnet]
- **Problem:** `firestore.indexes.json` declares one composite, for `teardowns` — the collection
  the live pipeline no longer writes. The queries the new sweeper needs do not exist yet, and
  `/api/proposal` avoids needing an index by scanning: `listDeals(200)` pulled twice per request
  (GET and POST) and filtered in memory, which is 200 document reads to find one deal and is
  silently wrong once there are more than 200 deals.
- **Change:**
  - **Existing queries needing nothing:** every single-field `orderBy`/`where` is served by
    Firestore's automatic single-field indexes — `clients.updatedAt`, `clients.sheetTokens`
    (`array-contains`), `sheets.shareToken`, `sheets.updatedAt`, `deals.updatedAt`,
    `bookings.dealId`, `bookings.talentId`, `talent.name.en`. Nothing to add.
  - **New composites** in `firestore.indexes.json`:
    | Collection | Fields | Serves |
    |---|---|---|
    | `clients` | `status` ASC, `queuedAt` ASC | sweeper query A |
    | `clients` | `status` ASC, `readLeaseUntil` ASC | sweeper query B (stale leases) |
    | `deals` | `teardownToken` ASC, `source` ASC | the `/api/proposal` fix below |
  - **`/api/proposal` scan:** add `dealForTeardown(token)` to `lib/store/deals.ts` —
    `where('teardownToken','==',token).where('source','==','configurator').limit(1)` — and use it
    in both the GET and the POST. 200 reads → 1. **If the long-form report is retired (item 10,
    option B) this query and its index disappear entirely** — build the index only under option A.
  - **Field exemptions** (`fieldOverrides`): disable indexing on `sheets.signals`,
    `sheets.site`, `sheets.findings`, `sheets.recommendations`. Firestore auto-indexes every
    field of every document including deeply nested arrays; a sheet carries per-post signal data
    and five full recommendations, and the 40,000-index-entries-per-document ceiling is reachable
    on a busy account. Nothing queries inside these objects — they are read whole by token.
  - `ratelimit` needs no index (doc-id gets only) but does need a **TTL policy on `expiresAt`**,
    configured with `gcloud firestore fields ttls update expiresAt --collection-group=ratelimit`.
    TTL policies are not expressible in `firestore.indexes.json`; note it in the deploy steps.
- **Acceptance:** `firebase deploy --only firestore:indexes` succeeds. The sweeper's two queries
  run without a `FAILED_PRECONDITION` index error. `/api/proposal` GET performs 1 document read.
  A sheet with 100 posts of signal data writes without an index-entry error.
- **Depends on:** 1 (sweeper queries), 10 (whether the proposal index is needed at all).

---

### 10. Retire or fence the legacy long-form pipeline  [M] [tier: opus]
- **Problem:** `/api/teardown`, `/api/ops/run`, `/api/ops/save`, `/api/ops/concept` and
  `/api/proposal` belong to a pipeline no live UI reaches. `/api/ops/run` is worse than dead: it
  `fetch`es `new URL('/api/teardown', req.url)`, which on App Hosting resolves to the public
  hostname — so the service calls itself out through the internet and back, carrying
  `OPERATOR_KEY` as a bearer token, to run code it could call as a function. Every one of these
  is an authenticated (or, for `/api/proposal`, token-authenticated) write surface that nobody
  tests and nobody watches.
- **Change — both options costed, because the client-facing workstream owns the decision:**

  **Option A — the long-form report survives** (`/{lang}/teardown/sample` keeps rendering it, or
  `/r` stays a deliverable). Backend implications:
  - Delete `app/api/ops/run/route.ts` outright regardless. It is unreachable from any UI
    (`RunHandle` posts to `/api/ops/sheet`) and its self-fetch is a latency and credential
    liability. If a console path back to the long-form pipeline is wanted, it calls the handler's
    logic directly.
  - `/api/teardown` keeps its bearer auth, gains the same global Meta ceiling check from item 5
    (it currently spends the budget with no ceiling at all) and an origin check is *not* needed
    (it is machine-to-machine).
  - `/api/proposal` keeps its token-as-credential model but needs: the `dealForTeardown` query
    and index from item 9, and per-IP rate limiting from item 5 (it is publicly reachable and
    writes a `Deal`).
  - `lib/store/teardowns.ts` and the `teardowns` composite index stay.
  - Cost: roughly a third of the store and API surface stays under maintenance and test.

  **Option B — the long-form report is retired** (recommended, if the client-facing workstream
  agrees `/s` is the only deliverable). Backend implications:
  - Delete: `app/api/teardown/`, `app/api/ops/run/`, `app/api/ops/save/`, `app/api/ops/concept/`,
    `app/api/proposal/`, `app/ops/[token]/`, `components/ops/Editor.tsx`,
    `lib/store/teardowns.ts`, `lib/teardown/compose.ts`, `lib/data/report.ts` (and the
    Configurator + `/r` + `/p` routes, which the client-facing workstream owns).
  - `app/ops/page.tsx`: drop `listTeardowns`, the `counts` block and the Teardowns table.
    `components/ops/OpsNav.tsx`: drop the `queue` tab; `/ops` becomes the sheets queue and the
    config panel.
  - `Client.teardownTokens` — stop writing (it never was), keep the optional field so old
    documents still parse. `attachToClient`'s `'teardown'` branch goes.
  - Drop the `teardowns` composite index; leave the collection in place, unread, and delete it by
    hand once nobody minds.
  - Net: one bearer-authenticated public endpoint and one token-authenticated public write
    surface removed; `OPERATOR_KEY` stops being a bearer credential anywhere, which makes item 6's
    "the key signs sessions" story clean.

  **Interim, safe under either option, ship this week:** delete `/api/ops/run`; add a
  `LEGACY_REPORT` env switch (`off` by default in production) that makes `/api/teardown`,
  `/api/ops/save`, `/api/ops/concept` and `/api/proposal` return `410 Gone` without touching
  their code. Nothing calls them, so nothing breaks, and the surface is closed while the decision
  is made.
- **Acceptance:** With `LEGACY_REPORT=off`, all four routes return 410 and the sheet pipeline is
  unaffected end to end (submit → sweep → sheet → approve → `/s` → win → deal → booking). Under
  option B, `grep -r 'teardowns\|Report\b' app lib components` returns only the deliberate
  historical mentions.
- **Depends on:** the client-facing workstream's decision on the long-form report. The interim
  fence depends on nothing.

---

### 11. Test strategy for this layer  [M] [tier: opus]
- **Problem:** Four itests exist and all four need real Google credentials and a real Firestore
  project (`GOOGLE_CLOUD_PROJECT = 'pravda-jo'`), so they run on one machine and never in CI.
  There is no `npm test`. Every behaviour in this plan — the lease, the status ranks, the rate
  limit windows, the session TTL — is exactly the kind that a future screen breaks silently.
- **Change:**
  - **Use the emulator.** `firebase.json` already declares Firestore on 8080. The Admin SDK
    honours `FIRESTORE_EMULATOR_HOST` and skips credentials entirely when it is set, so the whole
    suite runs offline with no service account. Keep the `_itest_` collection prefix and its
    `process.exit(2)` guard on top — belt and braces, so a mis-set env can never reach live data.
  - `package.json`:
    ```json
    "test": "firebase emulators:exec --only firestore \"npm run test:all\"",
    "test:all": "node --experimental-strip-types --import ./tests/register.mjs --test tests/",
    "test:unit": "node --experimental-strip-types --import ./tests/register.mjs --test tests/*.test.mts"
    ```
    Add `firebase-tools` as a devDependency (or document `npx firebase-tools`). `test:unit` runs
    the credential-free tests alone, which is what a pre-commit hook should call.
  - **New itests (emulator):**
    1. `tests/queue.itest.mts` — `claimForRead` concurrency (one winner), expired-lease reclaim,
       `readAttempts` cap → `failed`, and the sweeper's two queries returning what they should.
    2. `tests/status.itest.mts` — the rank table: `sent`/`won` survive an engine `ready`;
       `failed` → `new` on resubmit; operator transitions always apply.
    3. `tests/contact.itest.mts` — empty contact fields preserve, non-empty replace.
    4. `tests/ratelimit.itest.mts` — window counters, roll-over, bucket isolation, the global
       reads ceiling deferring rather than dropping a lead.
    5. Extend `tests/proposal.itest.mts` — assert `dealForTeardown` finds exactly the deal the
       200-row scan used to, including the "resubmission updates, never duplicates" case (under
       option A only; delete the file under option B).
  - **New pure unit tests (no Firestore, no emulator):**
    6. `tests/auth.test.mts` — ops session mint/verify/expiry/tamper, talent cookie HMAC,
       `sameOrigin` against a table of header combinations, `msisdn`, `normaliseHandle`,
       `usablePhone`.
  - **CI:** a GitHub Actions workflow running `npm ci && npm run test` on push. The emulator needs
    only Java and `firebase-tools`, both available on `ubuntu-latest`. This is what makes the
    suite worth writing.
- **Acceptance:** `npm test` passes on a machine with no Google credentials and no network.
  `npm run test:unit` completes in under two seconds. CI is green on `next-site`.
- **Depends on:** 1, 3, 5, 6 (it tests them), but write the harness change first — the emulator
  switch is independent and unblocks everything else's verification.

---

## Data-model / interface changes other workstreams must know about

- **`Client` (`lib/data/clients.ts`) gains optional fields**, all backward-compatible:
  `queuedAt?`, `readStartedAt?`, `readLeaseUntil?`, `readAttempts?`, `lastNotifyChannel?`.
  The `ClientStatus` union is **unchanged** — no new states.
- **`setClientStatus` is renamed `forceClientStatus`** and a new **`advanceClient(id, status, readError?)`**
  becomes the correct call for every transition except the sweeper's and `unapprove`'s. Any
  screen that moves a client must use `advanceClient` or it will reintroduce the downgrade bug.
- **New `lib/teardown/pipeline.ts#readAndFile(client)`** — the one place a read is filed. A new
  entry point (a bulk importer, a second console button) calls `claimForRead` then this, never
  `runRead` directly.
- **New collection `ratelimit`** — doc-id keyed, TTL'd, never queried. Never contains PII: the IP
  is hashed.
- **`/api/ops/client` gains `action: 'rerun'`**; `Notice` gains `channel` and `tried`.
- **New routes:** `GET /api/cron/read` (secret-header auth), `POST /api/ops/selfcheck`.
- **New env vars:** `CRON_SECRET`, `SESSION_SECRET`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`,
  `RESEND_API_KEY`, `NOTIFY_EMAIL_TO`, `NOTIFY_EMAIL_FROM`, `LEGACY_REPORT`, and optionally
  `TURNSTILE_SECRET_KEY` / `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.
- **`components/Intake.tsx` gains** a hidden `company` honeypot field and an `elapsedMs` value in
  the POST body — the client-facing workstream must not remove them when it restyles the form.
- **Item 10 is a joint decision.** The client-facing workstream decides whether the long-form
  report survives; this plan implements either, and the interim 410 fence is safe under both.

## Risks and what NOT to change

- **Do not move the client write after the read.** Writing the lead before anything is read is
  the single rule the whole intake exists to enforce. Every change here happens after it.
- **Do not make the public response wait on Meta.** Item 2 puts one bounded notification on the
  response path and nothing else. The read stays off it.
- **Do not raise `minInstances` as a reliability fix.** It costs money monthly and does not give
  post-response CPU. If it is raised, raise it for cold-start latency and say so.
- **Do not loosen `firestore.rules`.** Everything here is Admin SDK. A rule that needs loosening
  means a token has moved into client code.
- **Do not let the sweeper re-notify.** `notifiedNewAt` gates the `new` notice; the sweeper must
  check it, or a stuck lead pings Khaled once a minute forever.
- **Do not change `mintToken`'s format or length.** Live `shareToken` links are in prospects'
  hands.
- **Do not change `normaliseHandle`.** It is the document id. A change re-keys the whole
  `clients` collection.
- **Cron is a new caller that is not a human.** A leaked `CRON_SECRET` is a Meta-budget drain, so
  the per-invocation cap and the global ceiling are load-bearing, not decoration.
- **The emulator switch changes what the existing itests touch.** Run them against the real
  project once, before the switch, to confirm they still pass — then switch, so a failure after
  the switch is attributable.

## Open questions for the owner

1. **Does the long-form report survive?** Item 10's two options differ by roughly a third of the
   API and store surface, and item 9's third index depends on the answer. The interim 410 fence
   is safe either way and does not need this answered.
2. **Which branch does App Hosting build?** `main` is four commits behind `next-site`. Every
   deploy-dependent item in this plan — the cron job, the new secrets, the index deploy — is
   unverifiable until this is known.
3. **Will Khaled accept notices on Telegram?** If operator notices must be WhatsApp, item 7's
   recommendation inverts and the 24-hour window becomes a real constraint requiring an approved
   utility template — which is weeks of Meta review, and the manual `wa.me` path stays primary
   until then.
4. **Is a second GCP surface acceptable?** Cloud Scheduler is free and one job, but it is a
   service nobody is currently watching. If not, item 1 falls back to Cloud Tasks (same cost, one
   npm dependency) or, worst case, to awaiting the read inline with an honest UI.
