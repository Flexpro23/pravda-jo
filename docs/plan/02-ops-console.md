# Operator console (/ops) plan

## Goal
Two people run the whole business out of this console: Khaled on a phone, arriving from a WhatsApp
link, and Ali at a desk. "100% functional" means a lead can go from first notice to a paid, delivered
job without anyone remembering anything — the console tells them what is owed, to whom, right now,
and every act that touches a human (a message, a link, a booking) is recorded only when a human
confirms it happened. Nothing in it may show work as handled that was not.

## Current state
Four tabs: Clients / Teardowns (the legacy long-form queue, and the default landing page) / Deals /
Talent. The live pipeline — client → sheet → share link → deal → bookings — is spread across those
tabs and reachable mostly by remembering a token. `/ops` itself leads with the dead pipeline.
Everything is a `<table>` inside `.scroll-x`, tuned for a desktop; the session cookie is
`sameSite:'strict'` with a 12-hour life, so a WhatsApp tap lands on a login gate asking for a 43-char
random key. `SheetReview` posts the offer on every keystroke and sends stale Arabic copy; the
`castOverrides` field has a route but no UI; placeholder (invented) talent are castable and
approvable. Errors are inline `msg` paragraphs at the bottom of long pages.

## Work items — ordered by priority

### 1. A session that survives a phone, and links that land where they point  [M] [tier: opus]
- Problem: `app/api/ops/login/route.ts` sets `sameSite:'strict'`, so a tap from WhatsApp sends no
  cookie and every notification link becomes a login gate. `maxAge` is 12h, and the login form asks
  for `OPERATOR_KEY` verbatim — a long random string Khaled has to fish out of a password manager on
  a phone, several times a day. The cookie value is a static `sha256(OPERATOR_KEY)` that never
  rotates and cannot be revoked without changing the key everywhere. Every page also re-implements
  its own gate (`opsAuthed()` + a bespoke `.gate` block in seven files), and the gates drop the
  destination — signing in always dumps you on `/ops`, never on the client you were opening.
- Change:
  - `app/api/ops/login/route.ts`: `sameSite:'lax'`; `maxAge` 30 days; honour a `next` form field and
    redirect there (validate it is a same-origin path starting `/ops`).
  - Split the credential in two, coordinated with the backend workstream (it owns `lib/ops/auth.ts`):
    a **device cookie** (`pravda_ops_device`, 90 days, `sameSite:'lax'`, holding a random per-device
    id recorded server-side) and a **session cookie** (`pravda_ops`, 30 days, rolling). Enrolling a
    device costs one `OPERATOR_KEY` entry; after that the gate asks for a 6-digit PIN
    (`OPERATOR_PIN`, rate-limited, 5 attempts then the device is unenrolled). Cookie value becomes
    `HMAC(secret, deviceId + issuedAt)` rather than a digest of the key itself, so revoking is
    bumping a secret version rather than rotating the key in Secret Manager and in two heads.
  - `app/ops/layout.tsx`: do the auth check once in the layout; render `<SignIn next={pathname} />`
    instead of children when unauthenticated. Delete the seven copies of the `.gate` block from
    `app/ops/page.tsx`, `clients/page.tsx`, `clients/[id]/page.tsx`, `deals/page.tsx`,
    `deals/[id]/page.tsx`, `sheet/[token]/page.tsx`, `talent/page.tsx`.
  - New `components/ops/SignIn.tsx`: PIN input (`inputMode="numeric"`, `autoComplete="one-time-code"`),
    a hidden `next`, and a "this is a new device" link that reveals the `OPERATOR_KEY` field.
- Acceptance: tapping `https://…/ops/clients/<id>` from a WhatsApp thread on iOS Safari and on
  Android Chrome opens the client page, not a gate. After a fresh enrolment the console is reachable
  the next morning without re-entering anything but a PIN. `curl -b pravda_ops=<sha256 of key>` no
  longer authenticates. Signing in from a deep link returns to that link.
- Depends on: backend workstream (owns `lib/ops/auth.ts`, the device store, and the PIN rate limit).
  Nothing else in this plan is usable on a phone until this ships.

### 2. Replace the landing page with one "today" queue  [L] [tier: opus]
- Problem: `/ops` leads with `listTeardowns(100)` — the legacy pipeline no UI feeds any more — and
  the live work is scattered: un-notified leads are a badge on another tab, sheets awaiting review
  are a second table on the same page, un-notified bookings are inside one deal each. There is no
  screen that answers "what do I do next", which is the only question Khaled asks on a phone.
- Change:
  - New `lib/ops/today.ts`: pure assembly over `listClients(200)`, `listSheets(60)`, `listDeals(100)`
    and a new `listOpenBookings()` (below). Exports `type Task = { kind, urgency, clientId?,
    sheetToken?, dealId?, bookingId?, title, sub, href, ageMins }` and `buildToday(...)` returning
    tasks grouped in this fixed order:
    1. `read-failed` — `client.status === 'failed'` (carries `FAILURE_NOTE[readError].do_`).
    2. `tell-new` — `!client.notifiedNewAt`.
    3. `read-stuck` — `status === 'reading'` and `updatedAt` older than 10 minutes.
    4. `tell-ready` — `status === 'ready' && !notifiedReadyAt`.
    5. `review-sheet` — sheet `status === 'draft'` (sub: `chosen.length}/3 chosen`).
    6. `send-sheet` — sheet `status === 'approved' && !sentAt` (item 6).
    7. `chase-sheet` — sheet sent, `!openedAt`, older than 48h; or opened, no deal, older than 5 days.
    8. `collect` — deal `status === 'signed'` (money owed to us).
    9. `tell-booking` — booking `!notifiedAt`.
    10. `mark-done` — booking `status === 'accepted'` and `date` is in the past.
    11. `pay-crew` — booking `status === 'done'`.
  - New `listOpenBookings(limit = 200)` in `lib/store/deals.ts`:
    `where('status','in',['offered','accepted','done']).limit(limit)` — needed because the console
    today can only reach bookings one deal at a time.
  - Rewrite `app/ops/page.tsx` as the Today queue: one card list, newest-owed first, each card a
    single tap to the thing that fixes it. No tables. A single "All clear" empty state.
  - `components/ops/OpsNav.tsx`: tabs become **Today / Clients / Deals / Roster**. The `waiting`
    badge moves to Today and counts every task, not just un-notified leads. Legacy moves to a
    `/ops/legacy` route (move `app/ops/page.tsx`'s teardown table and keep `app/ops/[token]/page.tsx`
    + `components/ops/Editor.tsx` reachable from there only) and is linked from a small footer line,
    not a tab.
  - Each card carries an inline primary action where one exists (Tell / Review / Send / Mark done),
    so the common case is one tap, not two.
- Acceptance: with seeded data covering all eleven kinds, `/ops` lists exactly those tasks in that
  order and each `href` resolves. A client that has been told about and whose sheet is reviewed and
  sent appears nowhere. `/ops` issues no more than four Firestore queries. The word "teardown" does
  not appear in the nav.
- Depends on: 1 (for it to be openable on a phone); item 6 for `sentAt`/`openedAt` — until those
  exist, kinds 6 and 7 are omitted rather than faked.

### 3. The client account page becomes the hub  [L] [tier: opus]
- Problem: `app/ops/clients/[id]/page.tsx` is a read-only record with one action panel (the two
  notices). It cannot re-run a read, cannot mark a client lost, cannot take a note, has no timeline,
  and has no phone or WhatsApp action beyond a bare `tel:` link. It never states what to do next. And
  the recommender takes a `vertical` that nothing in the product ever sets — the public intake does
  not ask, `RunHandle` does not offer it, so every sheet is scored with `vertical = null` and loses
  the 18-point trade bonus that makes a shortlist feel chosen rather than generic.
- Change:
  - `Client` gains (backend workstream owns `lib/data/clients.ts` / `lib/store/clients.ts`):
    `vertical?: Vertical`, `notes?: { at: string; by: 'ali' | 'khaled'; text: string }[]`,
    `lostReason?: string`.
  - New `components/ops/NextAction.tsx`: one sentence at the top of the page derived from the same
    `lib/ops/today.ts` rules — "Nobody has told Khaled about this lead" / "The sheet is waiting for
    three ideas" / "Sent 6 days ago, never opened" — with the button that does it.
  - New `components/ops/Timeline.tsx`: arrived → told → read → sheet ready → approved → sent →
    opened → won/lost, each with its timestamp, greyed where it has not happened. Built from fields
    already on `Client`/`Sheet`/`Deal`; no new event collection.
  - Extend `components/ops/ClientActions.tsx` into the full action bar: **Call** (`tel:`),
    **WhatsApp** (`waLink(c.contactPhone, …)` using `lib/notify/whatsapp.ts`, disabled with a reason
    when `msisdn()` returns null), **Copy number** and **Copy handle** (clipboard), **Re-run the
    read**, **Mark lost** (with a reason picker: no reply / price / doing it in-house / not a fit /
    other + free text), **Mark won**, and a note box.
  - `app/api/ops/client/route.ts` gains `action: 'status'` (`lost` | `won`, with `lostReason`),
    `action: 'note'` (append), `action: 'contact'` (fix `contactName`/`contactPhone` — today a lead
    that mistyped its own number is unfixable), and `action: 'vertical'`.
  - Re-run: a vertical `<select>` (labels from `VERTICAL_LABEL[v].en` in `lib/data/concepts.ts`)
    defaulting to `c.vertical`, plus an optional website field, posting
    `{ action: 'run', handle, vertical, website }` to `/api/ops/sheet`. The chosen vertical is saved
    on the client so the next read reuses it. Add the same `<select>` to
    `components/ops/RunHandle.tsx`.
  - Two bugs in `app/api/ops/sheet/route.ts` `'run'` that the console must stop provoking: it calls
    `openClient` with `contactName: ''`/`contactPhone: ''`, which wins over the real values
    (`clients.ts`: "contact details always win"), and it then calls
    `setClientStatus(handle, 'ready')` unconditionally, dragging a `sent` or `won` client backwards.
    The console must omit the contact fields entirely on a re-run, and the route must only move
    `new | reading | failed` clients to `ready`.
- Acceptance: re-running a read on a client with a name and number leaves both intact (itest against
  the emulator). Re-running a `won` client leaves it `won`. A sheet run with `vertical: 'food'`
  produces a different top-five than the same handle with `null`. Marking lost records the reason and
  the client leaves the Today queue. A note added on the phone is visible at the desk on reload.
- Depends on: 1; backend workstream for the `Client` fields and the `openClient` merge fix.

### 4. Sheet review: the two data-losing bugs  [S] [tier: sonnet]
- Problem: in `components/ops/SheetReview.tsx` the Arabic copy inputs are uncontrolled
  (`defaultValue`) and each `onBlur` posts the *other* field's value read from the original
  `sheet.copy` prop. Type a name, then type a hook, and the hook's save writes the stale (empty)
  name back — the name is erased. Separately, `saveOffer` fires a POST on every keystroke of
  `videos`, `pricePerVideo` and `adsMonthlyJOD`: typing "150" writes three sheets, and a partially
  typed number is briefly the stored offer.
- Change: hold copy in component state — `const [copy, setCopy] = useState(sheet.copy ?? {})` — and
  post `{ name: copy[n].name, hook: copy[n].hook }` from that state, never from the prop. Make the
  offer inputs controlled-but-deferred: update local state on change, POST on `blur` and on a 600ms
  trailing debounce, and drop any in-flight save when a newer one is queued. Show a small
  "saved · 12:04" marker rather than a toast for these.
- Acceptance: typing a name, tabbing to the hook, typing a hook and reloading shows both. Typing
  "1500" in per-video fires one POST, not four (assert in a component test or by counting requests in
  the network panel).
- Depends on: none.

### 5. Sheet review: casting, and the placeholder gate  [M] [tier: opus]
- Problem: `castOverrides` exists on `Sheet`, is honoured by `castPlan()` in `lib/store/convert.ts`,
  has a route action in `app/api/ops/sheet/route.ts` — and has no UI at all, so it can never be set.
  `recommend.ts` casts from `roster.filter(t => t.active && t.dayRateJOD > 0)`, which does **not**
  exclude `placeholder: true`, so the invented roster used to make the cast page look populated gets
  named on real prospects' sheets and can be approved and sent. The sidebar shows cast as a flat
  string with no way to change it, and the recommendation cards show `because` but never *which*
  findings a concept answers, although `Recommendation.answers` carries exactly those finding ids.
- Change:
  - New `components/ops/CastPicker.tsx`, rendered inside each chosen `.rec`: one row per slot the
    concept needs (one videographer, `r.models` models, a voiceover when `r.needsVoice`), each a
    `<select>` filtered to `roster.filter(t => t.discipline === slot && t.active && t.dayRateJOD > 0)`.
    Placeholder people render as `disabled` options labelled "— not a real person"; a slot the roster
    cannot fill renders "nobody on the roster" in `--warn`. Changing a slot posts
    `{ action: 'cast', conceptN, talentIds }`. A "reset to the engine's cast" clears the override for
    that concept.
  - `app/api/ops/sheet/route.ts` `'cast'`: validate each id exists, is `active`, has
    `dayRateJOD > 0` and is not `placeholder`; reject the whole patch otherwise.
  - `lib/teardown/recommend.ts`: add `&& !t.placeholder` to `bookable`. (Shared with the teardown
    engine workstream — flag it there too.)
  - `approveSheet` (`lib/store/sheets.ts`) gains a third refusal, `why: 'placeholder-cast'`, when any
    chosen concept's effective cast (override, else `rec.cast`) names a placeholder or an id no
    longer on the roster. `SheetReview`'s approve button surfaces it as "One of the people cast is a
    worked example, not a person. Change the cast before sending this."
  - Findings a concept answers: render `r.answers` as small chips under each card, resolving ids
    against `sheet.findings.findings` for the title (`f.title.en`), so Khaled can see the link he
    will be asked to defend. Unknown ids are skipped silently.
  - The right-hand `.facts` cast panel reads the override when there is one.
- Acceptance: with a roster of only placeholders, a sheet cannot be approved and the reason names the
  cause. Changing the videographer on concept #7 and then winning the sheet produces a booking offer
  pre-filled with the new person (`castPlan` already reads the override — assert end to end). Each
  chosen card shows at least one finding chip when `answers` is non-empty.
- Depends on: 4 (same file); teardown-engine workstream for the `recommend.ts` filter; client-facing
  workstream, which must make `/s` honour `castOverrides` too (it currently renders `rec.cast`, so the
  client can be shown a different cast than the one that gets booked).

### 6. Sheet review: sending it, and knowing it landed  [M] [tier: opus]
- Problem: three things are wrong at the moment of sending. The "Send on WhatsApp" link is
  `https://wa.me/?text=<url>` — no number, so it opens the contact picker and sends a bare URL with
  no message. Approving sets the client to `sent` (`app/api/ops/sheet/route.ts`), which claims a
  message was sent that nobody sent — the opposite of the deliberate "I sent it" discipline that
  `ClientActions` already gets right. And there is no preview of the client's page before approval:
  "See what they see" only exists once the link is live, so the first person to see the finished page
  is the prospect. Nothing records whether they opened it.
- Change:
  - `Sheet` gains `sentAt?: string`, `openedAt?: string`, `openCount?: number` (backend workstream
    writes `openedAt`/`openCount` from `app/s/[token]/page.tsx`; the console only reads them).
  - `app/api/ops/sheet/route.ts`: `'approve'` no longer touches client status. New
    `action: 'compose-share'` returns `{ text, link, phone }` — the Arabic message composed
    server-side (same shape as `lib/notify/operator.ts`, naming the business and the link) with
    `waLink(client.contactPhone, text)`; new `action: 'mark-share-sent'` writes `sheet.sentAt` and
    sets the client to `sent`.
  - `app/ops/sheet/[token]/page.tsx`: fetch `clientForSheet(token)` server-side and pass
    `{ contactName, contactPhone, lang }` into `SheetReview` — the sheet itself carries no phone
    number today, which is why the link is blank.
  - `SheetReview` action bar after approval becomes the `ClientActions` pattern: **Show the message**
    (reveals the text in a `<pre dir="auto">`), **Open in WhatsApp** (prefilled, disabled with
    "no usable number on file — fix it on the client page" when `msisdn()` fails), **I sent it**
    (separate press, writes `sentAt`), then a status line: "Sent 14 Sep · opened twice, last 3h ago"
    or "Sent 14 Sep · not opened yet".
  - Preview before approval: extract the body of `app/s/[token]/page.tsx` into
    `components/share/SheetPage.tsx` and add `app/ops/sheet/[token]/preview/page.tsx` rendering it
    from the draft, behind `opsAuthed()`. Link it from the sheet as "See what they will see" whether
    or not it is approved.
- Acceptance: with a client whose phone is `0791234567`, the WhatsApp button opens
  `wa.me/962791234567?text=…` with the Arabic message and the `/s/` link. Approving does not change
  the client's status; pressing "I sent it" does. The preview renders a draft sheet identically to
  `/s` and is 404 for an unauthenticated request. Once the backend writes `openedAt`, the console
  shows it without further change.
- Depends on: 5 (the approve gate lands in the same bar); backend workstream for `openedAt`;
  client-facing workstream for the `SheetPage` extraction (coordinate — one component, two callers).

### 7. Deals: one flow, consistent with the client page  [M] [tier: sonnet]
- Problem: `components/ops/DealDetail.tsx` `tell()` opens WhatsApp and then marks the booking sent in
  the same handler — opening is not sending, and this is the exact assumption `ClientActions` refuses
  to make. The status row is five equal buttons plus Lost, so "delivered" is one mis-tap from
  "proposed" and there is no confirmation on a backwards move. Lost records no reason. There is no
  link to the invoice for a booking that is `done` but unpaid except through the crew table's name
  link, and the margin panel does not show what is still owed. `app/ops/deals/page.tsx` calls
  `bookingsForDeal` once per deal in a `Promise.all` — N+1 against Firestore on every page load.
- Change:
  - Split `tell()` into the two-step flow: fetch the message, show it with **Open in WhatsApp** and a
    separate **I sent it** that calls `{ action: 'mark-sent' }`. Reuse the presentation from
    `ClientActions` — extract `components/ops/SendByHand.tsx` and use it in both.
  - Status: render as a timeline of `FLOW`, with only the next step as a primary button, earlier
    steps as plain text with their timestamp, and any backwards move behind a confirm. Keep "Lost"
    separate and add a reason picker writing `Deal.lostReason` (new field, mirrors item 3).
  - Money panel: add "crew owed" (`bookings.filter(b => b.status === 'done')` sum) and "crew paid"
    (`status === 'paid'` sum) alongside the existing spread and margin, and a warning when
    `spread < 0`.
  - Booking rows: show `notifyNote` as visible text rather than a `title` tooltip (invisible on a
    phone), add the `/doc/invoice/[talentId]` link as an explicit button, and show
    `respondedAt`/`declined` clearly — a declined day currently looks like an accepted one at a
    glance.
  - `app/ops/deals/page.tsx`: replace the per-deal `bookingsForDeal` loop with one
    `listOpenBookings()` (item 2) grouped in memory.
- Acceptance: opening WhatsApp for a booking and then closing it without sending leaves the booking
  "not told". The deals list issues two Firestore queries regardless of deal count. Marking a deal
  lost records a reason and it disappears from the Today queue. A declined booking is visually
  distinct from an accepted one on a 375px screen.
- Depends on: 2 (`listOpenBookings`), 1.

### 8. The roster page becomes editable  [M] [tier: sonnet]
- Problem: `components/ops/TalentManager.tsx` can create, reissue a code, and toggle active — nothing
  else. Name, phone, discipline and day rate cannot be changed after creation, though
  `/api/ops/talent` `'update'` already accepts `dayRateJOD`, `phone` and `active`. `tags` — which
  `fitOf()` in `recommend.ts` uses to cast — cannot be set anywhere in the product, so casting is
  effectively fit-blind. `placeholder` is invisible, so nothing warns that half the roster is
  invented. `availabilitySetAt` is stored and never shown, so a stale "available" from March reads
  the same as one from this morning. There is no booking history or owed total per person.
- Change:
  - Inline editing per row: name (EN/AR), phone, discipline, day rate, and a tag editor (chips, free
    text, suggestions from `VERTICAL_LABEL` keys plus the disciplines). Save on blur through
    `{ action: 'update' }`; extend the route to accept `nameEn`, `nameAr`, `discipline`, `tags`
    (validate the discipline is in `DISCIPLINE_RATE`).
  - Show `placeholder: true` as a `--warn` pill reading "worked example — not bookable", and dim the
    row. Show availability as `AVAILABILITY_LABEL[x].en` plus its age ("said available 41 days ago",
    `--warn` past 30 days).
  - Per-person expansion: `bookingsForTalent(id)` giving days booked, days done, and **owed** (sum of
    `done` not yet `paid`), with the invoice link. Add `listOpenBookings()`-backed aggregation on the
    page so the table can show an owed column without N+1.
  - Empty state that says what the roster is for rather than "Nobody on the roster."
- Acceptance: changing a videographer's tags to `['food','clinic']` changes which concepts cast them
  on a fresh read of a food business. A placeholder row cannot be selected in `CastPicker` (item 5)
  and is labelled here. The owed total per person matches the sum of their `done` bookings.
- Depends on: 5 (shared placeholder semantics), 2 (`listOpenBookings`).

### 9. Phone-first ergonomics  [M] [tier: sonnet]
- Problem: `app/ops/ops.css` is a desktop stylesheet with two breakpoints (`.cols` at 900px, `.pair`
  at 700px). Concretely, on a 375px screen: buttons are `9px 14px` at 13px — roughly 31px tall,
  under the 44px minimum; `.rec-pick` is a 32px square; all seven tables scroll sideways inside
  `.scroll-x`, so reading a row means scrubbing horizontally; `input`/`textarea` are 14px, which
  makes iOS Safari zoom the page on every focus and never zoom back; the sticky `.bar` ignores
  `env(safe-area-inset-bottom)` and sits under the home indicator; `.top` wraps a title and five
  controls into three ragged lines; `.facts` is a sticky sidebar that becomes a wall of numbers above
  the content once `.cols` collapses; `.htick` labels at 9.5px are unreadable; the availability
  tooltip on booking rows (`title=`) has no touch equivalent.
- Change, all in `app/ops/ops.css` plus small markup edits:
  - `button, .btn { min-height: 44px; padding: 12px 16px }`; `.rec-pick { width: 44px; height: 44px }`;
    `.x { min-width: 44px; min-height: 44px }`.
  - `input, textarea, select { font-size: 16px }` at `max-width: 640px` (kill the zoom).
  - `@media (max-width: 640px)`: every `table` inside `.scroll-x` switches to a card list via
    `display: block` on `thead { display: none }`, `tr { display: grid; border: 1px solid var(--line);
    border-radius: 8px; padding: 12px; margin-bottom: 10px }`, `td { display: grid;
    grid-template-columns: 92px 1fr; padding: 4px 0; border: 0 }` with `td::before { content:
    attr(data-l) }`. Add `data-l` to every `<td>` in `clients/page.tsx`, `deals/page.tsx`,
    `talent/page.tsx`, `clients/[id]/page.tsx` and `DealDetail.tsx`.
  - `.bar { padding-bottom: calc(14px + env(safe-area-inset-bottom)) }`, and make it a real sticky
    action bar on mobile: primary action full-width, secondary actions behind a "More" disclosure.
  - `.top`: h1 shrinks to a 2-line-safe size; tabs become a horizontally scrolling strip
    (`overflow-x: auto; -webkit-overflow-scrolling: touch`) with the active tab scrolled into view;
    "Sign out" moves out of the strip into an overflow.
  - `.facts` moves *below* the main column under 900px (`order: 2`) and collapses to a `<details>`
    summarising the two numbers that matter.
  - Replace every `title=` tooltip in the ops components with visible text or an `aria-describedby`
    line.
- Acceptance: at 375×812, `/ops`, `/ops/clients`, `/ops/clients/[id]`, `/ops/sheet/[token]`,
  `/ops/deals/[id]` and `/ops/talent` have no horizontal document scroll, no tap target under 44px
  (verified with a Lighthouse mobile run or an axe tap-target audit), and focusing any input does not
  change the viewport scale on an iPhone. The primary action on each page is reachable without
  scrolling.
- Depends on: 2, 3, 7, 8 land the markup these rules style — do this after them, or the `data-l`
  attributes get written twice.

### 10. Arabic content renders correctly everywhere  [S] [tier: sonnet]
- Problem: the console is deliberately `lang="en" dir="ltr"`, which is right for the chrome and wrong
  for the content flowing through it. Business names, contact names, concept copy and briefs are
  Arabic. Today only three places get it right (`DealDetail`'s `castfor` and brief textarea, the
  copy inputs' hard-coded `dir="rtl"`). Everywhere else — `clients/page.tsx` business and contact
  cells, `clients/[id]/page.tsx` `<h1>`, `sheet/[token]/page.tsx` `<h2>`, `SheetReview`'s `.facts`
  heading and `rec-name`, `DealDetail`/`DealList` client names, `TalentManager`'s `t.name.ar`, the
  `ClientActions` `<pre>` (hard `direction: rtl`, wrong for an English lead) — Arabic renders with
  LTR punctuation and mixed-direction names come out scrambled.
- Change: add `dir="auto"` to every element rendering user or client content. Change the hard-coded
  `dir="rtl"` on the copy inputs and the `ClientActions` `<pre>` to `dir="auto"`. In `ops.css`, apply
  the Amiri fallback stack by content rather than by attribute:
  `input, textarea, .ar-content { font-family: 'Amiri', var(--sans) }` keyed off a `.ar-content`
  class where Arabic is expected, and keep `unicode-bidi: isolate` on inline spans that sit next to
  Latin (`@handle`, phone numbers, JOD figures) so a name does not drag the number across the line.
  Keep every `mono` number and handle `dir="ltr"` explicitly.
- Acceptance: a client named `مطعم الرومانسية` renders right-aligned with its `@handle` and phone
  still reading left-to-right beside it, on the client list, the account page, the sheet, and the
  deal. A Latin-named client is unaffected. No visual regression at 375px.
- Depends on: 9 (same files) — do them in one pass.

### 11. Empty states, error states, optimistic updates, toasts  [M] [tier: sonnet]
- Problem: every mutation in the console is pessimistic and reports through an inline
  `msg` paragraph rendered at the *bottom* of the page (`SheetReview`, `DealDetail`, `TalentManager`,
  `DealList`, `RunHandle`), so a failure at the top of a long sheet is invisible on a phone. Errors
  are mostly `Failed: ${j.error}` — raw route strings like `unknown-action` shown to a human.
  Toggling a concept round-trips before the tick appears, so on a slow connection the button looks
  dead and gets pressed again. `listClients`/`listDeals`/`listTalent` failures degrade to an empty
  table that reads as "no clients" rather than "we cannot see the store". `deals/page.tsx` and
  `talent/page.tsx` swallow errors entirely.
- Change:
  - New `components/ops/Toast.tsx` + a small `useToast()` context in `app/ops/layout.tsx`: a
    fixed-position stack, top on mobile, bottom-right on desktop, auto-dismiss for successes, sticky
    with a Retry for failures. Replace the `msg` state in all five components.
  - One error dictionary, `lib/ops/errors.ts`, mapping every route error string
    (`pick-three`, `no-offer`, `not-approved`, `placeholder-cast`, `unauthenticated`, `malformed`,
    `not-found`, `unknown-action`, plus the `EXPLAIN` map already in `RunHandle.tsx`) to an operator
    sentence and, where there is one, an action. `RunHandle`'s dictionary moves here and is shared.
  - Optimistic updates for the reversible toggles: concept choose/unchoose, talent active toggle,
    booking status marks. Apply locally, roll back and toast on failure.
  - `unauthenticated` from any fetch triggers a re-auth prompt in place rather than a red line — with
    item 1's 30-day session this should be rare, but a silent no-op after an expiry is the worst
    failure this console has.
  - Distinguish "empty" from "broken" on every list: a caught store error renders the existing
    `note[data-k="err"]` block; an empty result renders a written empty state. Fix
    `deals/page.tsx` and `talent/page.tsx`, which currently catch and show nothing.
- Acceptance: with Firestore unreachable, all four list pages say so; with Firestore reachable and
  empty, all four say what would fill them. Toggling a concept with the network throttled to 3G shows
  the tick immediately and reverts with a toast if the POST fails. No raw route error string reaches
  the screen (grep for `` `Failed: ${ `` returns nothing).
- Depends on: 2, 3, 5, 7, 8 (touches the same components; do it last as a sweep).

## Data-model / interface changes other workstreams must know about
- `Sheet` (`lib/store/sheets.ts`) gains `sentAt?: string`, `openedAt?: string`, `openCount?: number`.
  The console reads all three; the **backend workstream** writes `openedAt`/`openCount` from
  `app/s/[token]/page.tsx`, and `/api/ops/sheet` `action: 'mark-share-sent'` writes `sentAt`.
- `Client` (`lib/data/clients.ts`) gains `vertical?: Vertical`, `notes?: {at, by, text}[]`,
  `lostReason?: string`. **Backend workstream** owns the store functions.
- `Deal` (`lib/data/deals.ts`) gains `lostReason?: string`.
- `approveSheet()` gains a fourth outcome `why: 'placeholder-cast'`.
- New store function `listOpenBookings(limit)` in `lib/store/deals.ts` (needs a Firestore composite
  index on `bookings.status`), used by Today, the deals list and the roster.
- `lib/teardown/recommend.ts` `bookable` must exclude `placeholder: true` — this changes what every
  future sheet casts, so the **teardown-engine workstream** should own the change and the console
  depends on it.
- `app/s/[token]/page.tsx` body is extracted to `components/share/SheetPage.tsx` so both `/s` and the
  operator preview render one implementation — coordinate with the **client-facing workstream**,
  which must also make that page honour `castOverrides` (it renders `rec.cast` today, so the client
  can be shown a cast different from the one that gets booked).
- Session cookies: `pravda_ops` becomes `sameSite:'lax'`, 30-day rolling, HMAC-valued; new
  `pravda_ops_device`. `lib/ops/auth.ts` is owned by the **backend workstream**; the console assumes
  only `opsAuthed()` keeps its signature.
- `/api/ops/client` gains `status`, `note`, `contact`, `vertical`; `/api/ops/sheet` gains
  `compose-share`, `mark-share-sent`; `/api/ops/talent` `update` accepts `nameEn`, `nameAr`,
  `discipline`, `tags`.

## Risks and what NOT to change
- **Do not put `clientTotalJOD` or anything derived from it on a `Booking`, or a `dayRateJOD` on
  anything a client can reach.** The margin panel in `DealDetail` and the day rates on the roster are
  operator-only by schema absence, not by UI. Any new component that joins a booking to a deal must
  do it server-side in `/ops`.
- **Do not make "sent" a side effect of opening WhatsApp** anywhere, including the new
  `SendByHand` component. The whole notification design rests on a human confirming.
- **Do not delete the legacy pipeline** (`app/ops/[token]`, `components/ops/Editor.tsx`,
  `lib/store/teardowns.ts`, `/api/ops/save`). `/{lang}/teardown/sample` still renders that format and
  `Client.teardownTokens` still points at it. Demote it to `/ops/legacy`; removing it is a separate
  decision for the owner.
- Widening the session to 30 days and `sameSite:'lax'` is a real loosening. It is acceptable only
  with the device-cookie + PIN split and a revocable secret — do not ship the `maxAge` change alone.
- `lib/ops/today.ts` reads four collections on every `/ops` load with `dynamic = 'force-dynamic'`.
  With two operators and a few hundred documents this is fine; if the client book passes ~1000, move
  the buckets to indexed queries rather than in-memory filtering.
- Do not restyle the console into the marketing site's typography. `app/ops/layout.tsx` is right that
  a plain surface is what lets weak copy be seen. Item 9 is ergonomics, not art direction.
- `castOverrides` must never widen a cast beyond the slots a concept needs, or `castPlan()` will
  create booking slots — and therefore day-rate liabilities — that nothing sold.

## Open questions for the owner
1. The PIN approach in item 1 assumes one shared PIN for both operators. Do you want per-person
   sign-in (so the timeline and notes can say who did what), or is a shared console correct for two
   people who sit in the same conversation?
2. Which of the eight verticals should the *public* intake infer or ask for? The console can now set
   it, but a lead that arrives through `/teardown` still reads with `vertical: null` unless the
   client-facing form asks — one extra question on a form we deliberately kept to two fields.
3. When a sheet has been sent and not opened for 5+ days, should the Today queue propose a nudge
   message, or is chasing a judgement call you want kept off the screen?
