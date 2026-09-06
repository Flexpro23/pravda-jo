# Talent portal, notifications, lifecycle & documents plan

## Goal
The provider (talent) side of PRAVDA — `/t`, its API routes, WhatsApp notifications, the
deal→booking→payment lifecycle as a provider experiences it, and the two printed documents — is
"100% functional and improved" when: a provider can be brute-force-attacked out of the six-digit
gate; the booking state machine has no dead ends (declined/no-show/cancelled days re-cast
themselves instead of vanishing); a provider is never double-booked by two different deals on the
same date; the portal works one-handed on a cheap Android on a set with a bad connection; and the
printed invoice always shows the month a provider actually expects. None of this needs a queue,
a push-notification service, or a PDF library — the existing "compose text + wa.me link, a human
taps send" pattern and the browser's own print-to-PDF are sufficient and already the house style.

## Current state
`/t` (`app/t/page.tsx`, `components/t/Portal.tsx`) is a server component gated by
`currentTalent()` (`lib/talent/auth.ts`), rendering a 6-digit code form when signed out and a
single-query view (`bookingsForTalent`) when signed in: an availability 3-way toggle
(`available`/`busy`/`abroad`), offered/accepted/past booking cards, and per-month invoice links.
Three API routes (`login`, `respond`, `availability`) plus `logout` back it. The session cookie is
`id.sha256(id+OPERATOR_KEY).slice(0,32)` — reused from the same secret as the operator console's
digest, not a distinct HMAC. `lib/store/deals.ts` holds the whole commercial model: `Talent`,
`Deal`, `Booking` (5 statuses: offered/accepted/declined/done/paid), and the schema-level rule that
a `Booking` has no field for the client's price and gets `clientName` only once the deal is paid.
`offerBooking` does not check whether the talent already has a booking on that date. WhatsApp
notification (`lib/notify/whatsapp.ts`) has an honest two-mode design (template when configured,
free-text fallback, `wa.me` link when nothing is configured) but no reminder mechanism at all.
`/doc/invoice/[talentId]` and `/doc/proposal/[id]` share `app/doc/doc.css` (print stylesheet, Amiri
for Arabic, `@media print` page-break rules) and `components/doc/PrintBar.tsx` (print button +
language toggle, hidden on paper). Talent data (`Talent` type) already has `tags`, `placeholder`,
and `active`, but `components/ops/TalentManager.tsx` exposes none of them — only name, discipline,
day rate, phone, and active/reissue. `tests/deals.itest.mts` is the only test and it is exactly
right for what it covers (margin rule, scoping, payment revealing the client); nothing is
unit-tested.

## Work items — ordered by priority

### 1. Rate limiting and lockout on `/api/t/login`  [M] [tier: sonnet]
- Problem: `talentByCode` (`lib/store/deals.ts:60`) does a linear scan of the active roster with a
  constant-time hash comparison per candidate, but nothing limits how often `/api/t/login`
  (`app/api/t/login/route.ts`) can be called. A 6-digit code is 1,000,000 values; against a roster
  of, say, 30 active providers with independent random codes, an unthrottled attacker needs roughly
  1,000,000 / 30 ≈ 33,000 guesses in expectation to land inside *someone's* session — not a
  particular target, any provider — and each hit exposes that person's booking dates, briefs,
  locations, and (once a deal is paid) the client's name. At even 5 req/s with no lockout that is
  under two hours of unattended traffic from one IP. There is no rate-limiting code anywhere in the
  repo (`grep -rn "rate.?limit"` returns nothing) — this is the sharpest version of a gap the
  CONTEXT.md audit already flagged for `/api/lead`.
- Change: add a small in-memory (or Firestore-doc-backed, since Cloud Run instances are ephemeral
  and `minInstances 0`) counter keyed by IP + a coarse time bucket in `app/api/t/login/route.ts`:
  cap at ~8 attempts per IP per 10 minutes, respond `429` with a fixed-delay body past the cap
  rather than a fast rejection (defeats naive scripted retry timing), and — because instances are
  ephemeral, an in-memory counter alone is defeated by Cloud Run cold-starting a fresh instance —
  back it with a `login_attempts/{ip-hash}` Firestore doc (count + windowStart) as the source of
  truth, in-memory only as a fast-path cache. Do not store raw IPs; hash them
  (`sha256(ip + OPERATOR_KEY)`) so the doc is useless if the collection ever leaks. Add a global
  per-minute cap across all IPs too (e.g. 60/min) as a cheap defence against a distributed attempt.
  Log (console) when the global cap trips, since that is worth Khaled's attention.
- Acceptance: 9 rapid POSTs with wrong codes from the same simulated IP → the 9th returns 429; a
  correct code from a *different* simulated IP during another IP's lockout still succeeds; the
  Firestore doc this writes to lives under a name that is obviously test/ops-only and is cleaned
  up or TTL'd (note the TTL policy needed in Firestore, or a periodic sweep — flag as open question
  if no existing sweep mechanism exists to hook into).
- Depends on: none.

### 2. Talent session: dedicated secret, real HMAC, and a way to revoke on "lost phone"  [S] [tier: sonnet]
- Problem: three related issues in `lib/talent/auth.ts`. (a) `sign(id)` is
  `sha256(id + secret).slice(0,32)`, not an HMAC — plain-hash-with-appended-secret is not the
  standard construction and invites subtle mistakes if anyone ever changes the concatenation order
  (prepending the secret instead of appending would open it to a length-extension attack; today's
  order happens to avoid that, but it is fragile-by-convention, not by construction). (b) it reuses
  `OPERATOR_KEY` — the same secret that also produces the ops console's cookie digest
  (`lib/ops/auth.ts`) — so rotating `OPERATOR_KEY` for any reason (an operator leaving, a suspected
  leak) simultaneously and silently logs out every provider, which is very likely not the intent
  and is easy to be surprised by. (c) there is no way to invalidate one provider's existing browser
  session without deactivating their whole account: "Reissue code" in `TalentManager.tsx` only
  changes `passCodeHash`, and the session cookie's validity depends only on `id` + the shared
  secret, never on `passCodeHash` — so a lost/stolen phone with an active 60-day cookie stays
  logged in after the code is reissued.
- Change: (1) switch to `createHmac('sha256', secret).update(id).digest('hex').slice(0,32)` in
  `lib/talent/auth.ts` — same call sites, no data migration needed since the value is opaque and
  cookies are re-minted on next login anyway (a live session invalidates once on deploy, which is
  acceptable for a 60-day cookie versus carrying a construction weakness). (2) introduce a
  dedicated `TALENT_SESSION_SECRET` env var, falling back to `OPERATOR_KEY` only if unset (so
  nothing breaks before it is provisioned in `apphosting.yaml`), decoupling talent-session rotation
  from ops-cookie rotation. (3) add a `sessionEpoch?: number` field to `Talent`
  (`lib/data/deals.ts`), fold it into the signed material (`sign(id, epoch)`), bump it on both
  "Reissue code" and a new explicit "Sign out everywhere" action in `TalentManager.tsx`
  (`app/api/ops/talent/route.ts` `update`/`reissue` actions), and have `currentTalent()` compare
  the cookie's epoch against the stored one.
- Acceptance: a cookie minted before a reissue fails `currentTalent()` after the reissue; unit test
  (see item 16) for the HMAC construction against a fixed vector; `TALENT_SESSION_SECRET` absent in
  `.env`/`apphosting.yaml` still works today (falls back), and is called out as a var to add.
- Depends on: none. Interacts with item 16 (tests).

### 3. Booking conflicts: same provider, same date, two offers  [M] [tier: opus]
- Problem: `offerBooking` (`lib/store/deals.ts:134`) writes a new booking unconditionally. Nothing
  stops two different deals (or the same deal twice) from offering the same talent the same date —
  the operator's "Offer a day" form (`DealDetail.tsx`) shows the talent's self-reported
  `availability` as a hint ("They have marked themselves busy... you can still offer") but performs
  no server-side check against *existing bookings*, so the realistic failure mode is Khaled offering
  Omar 12 September on two different jobs without realizing it, both getting accepted, and PRAVDA
  discovering the clash on the day. This needs a data-model decision, not just a UI warning, which
  is why it is tiered opus.
- Change: in `offerBooking`, before writing, query `bookingsForTalent(talentId)` (or a narrower
  `where('talentId','==',...).where('date','==',...)` query, cheaper than pulling the whole
  history) for any existing booking on the same `date` whose status is `offered` or `accepted`.
  Do not silently block it — a producer may legitimately want to offer a day already spoken for as
  a backup, or the existing one may be about to be declined — so return a `conflict` result
  (`{ ok: false, conflict: { id, dealId, status } }` alongside the successful path) and have
  `app/api/ops/booking/route.ts`'s `offer` action surface it, with `DealDetail.tsx` asking the
  operator to confirm before proceeding (a second POST with `force: true`). Record the fact that it
  was offered despite a conflict (`Booking.conflictWith?: string` — the other booking's id) so the
  console can show both sides of a double-booking rather than losing the trail.
- Acceptance: two `offerBooking` calls for the same `talentId` + `date` from different deals — the
  second surfaces `conflict` and is not written unless `force` is passed; an itest added to
  `tests/deals.itest.mts` covering exactly this (see item 16).
- Depends on: none.

### 4. Booking states: cancelled-by-studio, no-show, rescheduled — and re-casting a decline  [M] [tier: opus]
- Problem: `BookingStatus` (`lib/data/deals.ts:178`) is
  `offered | accepted | declined | done | paid`. Real production has at least three more outcomes
  the schema cannot represent today: PRAVDA cancels a day after offering it (the client moved the
  shoot, or the concept changed) — currently the only tool is `markBooking` to force it into an
  existing status, none of which mean "cancelled"; a provider accepts and then does not show up,
  which is materially different from declining up front (it should not silently look like an
  unpaid `accepted` day forever); and a day gets moved to a different date, which today has to be
  modeled as declining the old booking and creating a new one, losing the link between them. Also:
  a `declined` booking today is a dead end — nothing re-offers that day to anyone else, so a
  decline just quietly drops a shoot day unless a human notices the card in the console.
- Change: extend `BookingStatus` to
  `offered | accepted | declined | cancelled | no_show | done | paid`, add `BOOKING_LABEL` entries
  (bilingual, matching the existing style) for the three new ones. Add a `rescheduledFrom?: string`
  / `rescheduledTo?: string` pair of booking-id fields rather than a status, since a reschedule is a
  relationship between two bookings, not a state one booking is "in" — the *new* booking is a
  normal `offered` booking with `rescheduledFrom` set, and the old one moves to a new terminal
  status `cancelled` (not a fifth thing). Who may set what: `respondToBooking`
  (talent-scoped, `lib/store/deals.ts`) stays limited to `offered → accepted|declined`, exactly as
  now; `markBooking` (operator-only, via `app/api/ops/booking/route.ts`) gains `cancelled` (from
  `offered`/`accepted`) and `no_show` (from `accepted`, on or after the date). Add validation in
  `markBooking` itself (currently a bare `update`) so an operator cannot walk a booking backwards
  (e.g. `paid → offered`) — a small explicit transition table, in `lib/data/deals.ts` alongside
  `BOOKING_LABEL`, that both the API route and any future UI can import rather than re-deriving.
  For the "re-cast on decline" half: do not automate re-offering (no code should guess who else is
  right for a declined day) — instead, surface it: `DealDetail.tsx`'s crew table already lists
  `plan` (cast slots from the sheet) with a "Use this" button; when a booking's status is `declined`
  or `cancelled`, keep its row visible with a prominent "needs a replacement" marker instead of
  letting it blend into the past-bookings scroll, so a human is the one who re-casts, immediately.
- Acceptance: `markBooking('X','cancelled')` on a `done`/`paid` booking is rejected by the
  transition table; a new itest in `tests/deals.itest.mts` exercises
  offered→cancelled and accepted→no_show; `DealDetail.tsx` visibly flags a declined/cancelled row.
- Depends on: item 3 (both touch `offerBooking`/`markBooking`; do the schema change together to
  avoid two migrations).

### 5. Placeholder talent must never be offerable  [S] [tier: sonnet]
- Problem: CONTEXT.md's audit already names this bug for the sheet-casting path
  (`recommend.ts` filters `active && rate>0` but not `placeholder`). It is present a second time,
  independently, in `DealDetail.tsx:73`: `const bookable = talent.filter((t) => t.active);` — the
  "Offer a day" dropdown includes invented placeholder people (`Talent.placeholder`, seeded true for
  the roster's current worked examples per `lib/data/specimens.ts` / `lib/data/roster.ts`). An
  operator could offer a real shoot day to someone who does not exist and has no phone number,
  discovering the mistake only when `notifyOffer` reports `no-number`.
- Change: `bookable = talent.filter((t) => t.active && !t.placeholder)` in `DealDetail.tsx`.
  Additionally guard it one layer deeper, at `offerBooking` itself (`lib/store/deals.ts`) — look up
  the talent and refuse (return an error result, do not silently proceed) if `placeholder` is true —
  so the rule holds even if a future screen reintroduces an unfiltered picker. Update
  `app/api/ops/booking/route.ts`'s `offer` action to propagate that refusal as a 400 with a clear
  message.
- Acceptance: a placeholder talent id does not appear in the dropdown; `offerBooking` called
  directly (bypassing the UI) with a placeholder talent id returns an error rather than writing a
  booking; itest addition.
- Depends on: none.

### 6. Availability as date ranges, not a single flag  [M] [tier: sonnet]
- Problem: `Availability = 'available' | 'busy' | 'abroad'` (`lib/data/deals.ts:46`) is a single
  present-tense flag with an `availabilitySetAt` timestamp for staleness, but no notion of *until
  when*. A provider marking "busy" before a two-week trip has no way to say when they are back, so
  either they forget to flip it back to available (an operator sees a stale "busy" and skips
  offering them work they could actually do) or PRAVDA has to just ask over WhatsApp, which is the
  exact manual step the portal exists to remove.
- Change: keep the three-value enum as the *current* state (it is still the right coarse signal for
  "can I be booked right now") and add an optional `availableFrom?: string` (ISO date) — the
  provider marks "busy" and picks a return date directly in the same toggle interaction
  (`components/t/Portal.tsx`'s `.avail` row grows a date input that only appears when `busy` or
  `abroad` is selected, defaulting to empty/unknown). `setAvailability`
  (`lib/store/deals.ts` and `app/api/t/availability/route.ts`) accepts the optional date, validates
  it is a real future-ish ISO date or absent. On the operator side, `DealDetail.tsx`'s per-talent
  availability pill (`AVAILABILITY_LABEL[...]`) appends "until {date}" when known, and — this is
  the actual payoff — a status of `busy` whose `availableFrom` has already passed is shown as
  "busy (since {date}, may be back)" rather than trusted at face value, addressing the staleness gap
  `availabilitySetAt` alone does not close.
- Acceptance: setting busy with a return date round-trips through the API and renders on both the
  portal and `DealDetail.tsx`; a past `availableFrom` renders the "may be back" hint instead of a
  plain "Busy" pill.
- Depends on: none.

### 7. Portal login: WhatsApp magic-link prefill, remember-me, and a lost-code path  [M] [tier: sonnet]
- Problem: today's only way in is typing a 6-digit code every time the 60-day cookie has expired or
  been cleared, and the only recovery for a lost code is "reissue" from the console, which requires
  the provider to reach an operator by some out-of-band channel. On a phone, retyping six digits
  under a set with wet hands is real friction the brief specifically calls out.
- Change: (1) `/t?code=123456` prefill — `app/t/page.tsx` reads a `code` search param when signed
  out and, if present, auto-submits the login form via a tiny inline script (no client bundle
  needed for this one path) rather than requiring a tap; `notifyOffer`'s composed message
  (`lib/notify/whatsapp.ts:compose`) already links to `${origin}/t` — change it to
  `${origin}/t?code=${code}` *only* when the message is being sent to that specific provider's own
  number (never put a code in a URL that could be forwarded blind — since this is the same message
  already carrying their day and fee, the marginal exposure is small, but state it: this is a
  convenience link that still requires possessing the code, i.e. it's a shortcut for the person the
  message was written for, not a bypass of the login). This is not a new secret; it is the existing
  code inline in a URL parameter of a message already private to them via WhatsApp — same trust
  boundary as the existing text. (2) "remember me" is effectively already true (60-day cookie); make
  it visible — a line under the form on `/t` states plainly "you'll stay signed in on this phone."
  (3) lost-code path: since a code cannot be recovered (only hashed), add a
  "ما وصلني رمز؟ / لم يصلني الرمز" link under the form that opens a `wa.me` link straight to
  `OPERATOR_PHONE` with a prefilled "أنا <ask them to type their name>, بدي رمز جديد" message —
  reusing the exact `msisdn`/link-building helpers already in `lib/notify/whatsapp.ts`, no new
  channel.
- Acceptance: visiting `/t?code=000000` (wrong) still lands on the gate with the error, not stuck in
  a redirect loop; a correct `?code=` logs in without a tap; the lost-code link opens WhatsApp
  pointed at the operator's number with a legible pre-filled message.
- Depends on: none.

### 8. Offered-day cards: full details, and a reason on decline  [S] [tier: sonnet]
- Problem: `Portal.tsx`'s `Card` shows date, call time, fee, brief, and location — already close to
  complete — but decline (`respond(id, 'declined')`) carries no reason, so a declined day arrives at
  the operator console (`DealDetail.tsx`) as a bare status change with no context for why, which
  matters when deciding whether to re-offer the same day to the same person later or write them off
  for it.
- Change: on tapping "ما بقدر" in `Portal.tsx`, open a small inline reason picker (not a modal —
  screen space on a phone is scarce; a row of 3–4 short chips: "مشغول", "مسافر", "السعر", "غير
  ذلك") plus a free-text fallback, POSTed as `reason` in the existing `/api/t/respond` body. Add
  `declineReason?: string` to `Booking` (`lib/data/deals.ts`), written by `respondToBooking`
  (`lib/store/deals.ts`) only when `status === 'declined'`. Surface it in `DealDetail.tsx`'s crew
  table as a muted note under the status pill.
- Acceptance: declining without picking a reason still works (optional, not blocking — a provider
  in a hurry should not be forced through a form to say no); a reason, when given, appears on the
  operator console.
- Depends on: none.

### 9. Calendar / ICS export of accepted days  [S] [tier: sonnet]
- Problem: the brief for the portal asks for it and nothing exists — no `.ics` anywhere in the
  repo. A provider juggling PRAVDA against other clients has no way to get an accepted shoot day
  onto their phone's calendar besides manually retyping it.
- Change: a new route, `app/api/t/ics/route.ts`, authenticated the same way as the rest of `/t`
  (`currentTalent()`), that returns a `text/calendar` document built from `bookingsForTalent(me.id)`
  filtered to `status === 'accepted'` (and, arguably, `done`/`paid` too, so a provider's calendar
  keeps a record) — one `VEVENT` per booking using `date` (+`callTime` when present, else an
  all-day event) and `brief` as the summary, `location` when present. No new dependency: an ICS
  file is a handful of lines of plain text (`BEGIN:VCALENDAR` / `VEVENT` / `DTSTART` /
  `SUMMARY` / `END:...`), matching the house rule of no document-generation libraries. Link it from
  `Portal.tsx` next to the invoice buttons ("أضف للتقويم"), and from the WhatsApp offer message
  once accepted is out of scope for this item — keep it a pull the provider does on the portal, not
  a push.
- Acceptance: the route returns a spec-valid `.ics` (opens in a calendar app / validates against a
  basic ICS linter) containing exactly the caller's own accepted bookings — a provider cannot fetch
  another's by any parameter, since the route takes none besides the session.
- Depends on: none.

### 10. Owed/paid ledger: clarity and one accuracy fix  [S] [tier: sonnet]
- Problem: `Portal.tsx`'s ledger (`owed`, the "سابق" section, monthly statement links) is already
  close to right — it sums `done` bookings for "owed" and links to per-month invoices — but it
  double-counts nothing and shows nothing wrong today *except* that a `cancelled`/`no_show` booking
  (once item 4 lands) would fall into `past` (everything not offered/accepted) and render as a plain
  card with no owed amount, which is correct, but with no distinguishing label it will look
  identical to a `declined` card to the provider, which is worth a one-word distinction("لن تحصل
  على أجرة" i.e. "no fee for this one" is implicit already since `.fee` still renders — that number
  should be visually de-emphasized or struck through for these three statuses so it's not read as
  money still coming).
- Change: in `Portal.tsx`'s `Card`, when `b.status` is `declined`, `cancelled`, or `no_show`, render
  the `.fee` span with reduced opacity / a line through it rather than in the normal `--go` green,
  since green there currently reads as "money owed" even for days that will never be paid.
- Acceptance: a declined/cancelled/no-show card's fee is visually distinct from an owed one; no
  numeric change (the arithmetic in `owed`/`months` already excludes these correctly).
- Depends on: item 4 (the two new statuses this addresses do not exist until then).

### 11. WhatsApp: template parameter shape, and an honest reminder mechanism  [M] [tier: sonnet]
- Problem: `notifyOffer` (`lib/notify/whatsapp.ts:123`) sends three template parameters
  (`t.name.ar`, `arDate(b.date)`, `String(b.feeJOD)`) when `WHATSAPP_TEMPLATE` is set, which is
  fine but undocumented anywhere outside this function — whoever registers the template with Meta
  needs to know its exact `{{1}}{{2}}{{3}}` body text ahead of time, and there is no reminder
  concept at all (no day-before / morning-of nudge), which the brief explicitly asks for. Building
  a scheduler is out of proportion for a two-person studio with no job queue.
- Change: (1) document the template contract as a comment block directly above `notifyOffer`
  spelling out the exact expected template body (e.g.
  `"مرحبا {{1}} — في يوم تصوير إلك من برافدا يوم {{2}}. الأجرة {{3}} دينار. افتح البرافدا للتفاصيل."`)
  so registering it with Meta and changing this function stay in sync — today they can silently
  drift. (2) for reminders, do not build a scheduler: add a second WhatsApp template concept,
  `WHATSAPP_REMINDER_TEMPLATE` (or reuse `compose`'s free-text shape when unconfigured, same
  honest-fallback pattern as everywhere else), a new `reminderOffer`/`composeReminder` pair in
  `lib/notify/whatsapp.ts` mirroring `notifyOffer`/`compose`, and a "Send reminder" button in
  `DealDetail.tsx` next to each `accepted` booking — exactly the existing "Tell them" pattern
  (`app/api/ops/notify/route.ts`'s by-hand path), reusable with an `action: 'remind'` branch that
  builds the reminder text instead of the offer text. This makes "day before" and "morning of" an
  operator's one-tap decision rather than an automated schedule — honest about there being no queue,
  matching the house philosophy stated in `lib/notify/whatsapp.ts`'s own header comment. A
  `remindedAt?: string[]` (timestamps) field on `Booking` records that reminders were sent, purely
  informational, shown in the console.
- Acceptance: the template contract comment exists and matches what `notifyOffer` actually sends;
  "Send reminder" produces a `wa.me` link with the correct booking's date/brief and records
  `remindedAt` once the operator confirms it was sent, following the same confirm-before-record
  pattern `tell()` already uses in `DealDetail.tsx`.
- Depends on: none.
- Open question for the owner: is a real scheduled reminder (Cloud Scheduler → Cloud Function, or a
  cron-triggered route) worth building once volume grows past what a human remembers to tap? Not
  proposed here because it is infrastructure, not a talent-portal change, and the studio does not
  have a job queue today.

### 12. `/doc/invoice`: fix the month-default bug, and note the UTC/Amman skew  [S] [tier: sonnet]
- Problem: two related issues in `app/doc/invoice/[talentId]/page.tsx`. (a) The comment at line 73
  says "Default to the month just gone, which is when anyone actually invoices" but the code
  (`` `${now.getUTCFullYear()}-${...now.getUTCMonth()+1...}` ``) computes the *current* calendar
  month, not the previous one — so a provider opening their invoice on, say, 3 September with no
  `?m=` param sees September (mostly or entirely empty, since the month has barely started)
  instead of August (the month whose work is actually complete and payable), directly contradicting
  the stated intent and the button that already exists on `Portal.tsx` for exactly the completed
  months (`months` array there correctly looks backward). (b) `now` is built from `getUTCFullYear`/
  `getUTCMonth` — Jordan is UTC+3 year-round (no DST since 2022) — so during the first ~3 hours of
  Amman-local each month, the UTC clock is still showing the last few hours of the previous day,
  which for month *boundaries* specifically means the UTC-based default can lag Amman's actual
  calendar by up to a few hours right at the edge. This is a much smaller issue than (a) but is the
  literal "timezone" item the brief asks about, and worth fixing at the same time since it is the
  same few lines.
- Change: default `month` to the *previous* calendar month computed from an Amman-local "now"
  (construct via `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Amman', ... })` or a fixed
  `+3` hour offset — Jordan has no DST, so a fixed offset is exact and needs no timezone database
  nuance — then step back one month), matching the comment's stated intent and matching
  `Portal.tsx`'s own `months` list, which already only offers completed months. Keep `?m=` as an
  explicit override for the operator/provider to look at any month, including the current one.
- Acceptance: opening `/doc/invoice/[id]` with no `?m=` on any date shows the *previous* completed
  month, matching one of the month buttons `Portal.tsx` renders; the specimen path (`talentId
  === 'sample'`) is untouched (it already hardcodes `2026-08`).
- Depends on: none.

### 13. Print / "share as PDF on WhatsApp" — verify the phone flow, tighten Arabic page breaks  [S] [tier: sonnet]
- Problem: the print stylesheet (`app/doc/doc.css`, `@media print` block) already sets `@page
  margin`, hides `.bar`, and marks `tr`/`.note`/`.sign`/`.totals` as `break-inside: avoid` — this is
  solid for desktop print-to-PDF. On a phone, "browser print → Save as PDF → share sheet" is a
  different, OS-level flow (iOS Safari's print preview offers a share icon that exports the
  rendered PDF directly to WhatsApp; Android Chrome's "Save as PDF" writes a file the user then
  shares from Files/Downloads) that the code cannot control beyond making sure the printed page
  itself is correct — there is nothing to "build" here beyond verifying the existing CSS holds up
  at phone width and documenting the flow for whoever writes user-facing help text.
- Change: no functional code change proposed beyond confirming `@media print` renders correctly at
  common phone print-preview widths (this is a manual verification item, not a build item — flag it
  for whoever does device QA rather than inventing a fix for a problem not yet observed). Document,
  as a comment near `PrintBar.tsx` or in a short note the operator-facing help text can quote, the
  actual two taps: "افتح القائمة ← طباعة ← احفظ كـ PDF ← شارك عبر واتساب" (iOS) /
  "القائمة ← طباعة ← احفظ كـ PDF، ثم شارك من الملفات" (Android) — since these differ by OS and a
  provider will ask once and then know it.
- Acceptance: this item is closed by a short verification pass (screenshot at 375px/390px width in
  print-preview emulation) plus the documented copy existing somewhere reachable — not by a code
  diff.
- Depends on: none.

### 14. Proposal's `sheet-<token>` route: use the share token, not the operator token  [S] [tier: sonnet]
- Problem: this is client-facing-workstream content (the proposal itself), but the mechanism is
  shared with the invoice page and the finding belongs here. `components/ops/SheetReview.tsx:277`
  links to `/doc/proposal/sheet-${sheet.token}` — that `token` is the *operator's* internal sheet
  id, the same one used to reach `/ops/sheet/[token]`. `app/doc/proposal/[id]/page.tsx:55` then
  does `id.startsWith('sheet-') ? getSheet(id.slice(6)) : ...` — `getSheet` (`lib/store/sheets.ts`)
  looks a sheet up by its internal token with **no status check**, unlike `getShared(shareToken)`
  which explicitly refuses anything not `status === 'approved'`. Two consequences: (a) this preview
  link works for a *draft* sheet too, which is presumably intended for Khaled's own preview-before-
  approving workflow (this is likely deliberate, not a bug, given the button's placement in
  `SheetReview.tsx`) — but (b) the proposal page's whole trust model, stated in its own header
  comment, is "reachable by whoever holds the link — the deal id is 12 random bytes, the same trust
  the teardown runs on" — and the *operator's own internal token* is now embedded in a URL that
  could end up in a PDF's metadata, a browser's autofill/history, or a screen-share, none of which
  should carry a credential that also (indirectly, since it is the same id) names the sheet's
  `/ops/sheet/[token]` document — that route is separately gated by the `pravda_ops` cookie, so
  today's actual exposure is "which sheet exists", not a takeover, but it is still the wrong token
  for a document meant to model itself on `shareToken`-style capability links everywhere else in
  the codebase.
- Change (for the client-facing workstream to implement, noted here because it touches
  `app/doc/proposal/[id]/page.tsx` which this workstream also reads): keep the operator preview
  path but make it explicit rather than overloading the shared-link shape — e.g.
  `/doc/proposal/sheet-<token>?preview=1` gated by `opsAuthed()` for the draft case, and have
  `SheetReview.tsx`'s "approve" flow hand Khaled the *`shareToken`*-based link
  (`/doc/proposal/sheet-<shareToken>`, resolved via `getShared`) once a sheet is approved — matching
  how `/s/[shareToken]` already works for the sheet review page itself, so the proposal document and
  the sheet the client actually reads use the same token family.
- Acceptance: (for whoever implements) an unapproved sheet's proposal is reachable only by an
  authenticated operator; the link Khaled is ever asked to hand a client uses `shareToken`, never
  the operator's own `token`.
- Depends on: none. Cross-workstream — flag to the client-facing/proposal plan owner rather than
  implementing here.

### 15. Talent data: expose `tags`, add a portfolio link, contractor basics, and the placeholder flag  [M] [tier: sonnet]
- Problem: `Talent` (`lib/data/deals.ts`) already has `tags?: string[]` and `placeholder?: boolean`
  in its schema, and the recommender (`recommend.ts`, outside this workstream's scope but the
  consumer) matches on `tags` — but `components/ops/TalentManager.tsx` exposes neither field, so
  tags can only be seeded by hand (`lib/data/roster.ts`'s `suits` array, which is a *separate*,
  publicly-rendered roster, not the bookable Firestore record) and `placeholder` can only be set at
  creation time via direct Firestore writes, never toggled from the console. There is also nowhere
  to record a portfolio link (a reel, an Instagram) or the basic facts an operator will eventually
  need for a contractor relationship (full legal name for a receipt, an ID/passport number for a
  contract, a bank/wallet detail for paying them, a general note field) — see the coordination note
  below; this item does not decide the legal classification, only makes room for the operator to
  record what they will need regardless of how that question resolves.
- Change: extend `Talent` with `portfolioUrl?: string`, `legalName?: string`, `idNumber?: string`
  (national ID or passport — stored as an opaque string, no validation of Jordanian ID checksum
  rules attempted here), and `note?: string` (free text — "the field for everything the schema
  didn't anticipate," matching the studio's own stated philosophy elsewhere in the codebase).
  **Do not** add anything resembling a bank account or IBAN field without the owner explicitly
  asking for it — that is a materially higher-sensitivity data class than everything else this
  record holds, and Firestore access rules for it are outside this plan's scope (see Risks below).
  Add all of these plus `tags` (a comma-separated input, split/joined at the UI boundary the way
  the rest of this codebase handles free-form lists) and a `placeholder` checkbox to
  `TalentManager.tsx`'s create form and to a new "Edit" action alongside the existing
  reissue/deactivate buttons per row (today there is create + reissue + activate/deactivate only —
  no way to edit an existing person's discipline, tags, phone, or the new fields once added, which
  this item should also close by adding a full edit form, not just fields on create).
  `app/api/ops/talent/route.ts`'s `update` action already exists and merges via `saveTalent`
  (`{ merge: true }`) — extend its accepted body to include the new fields.
- Acceptance: a tag typed into the console for an existing person round-trips and is visible on
  reload; toggling `placeholder` on an existing (previously real) person removes them from
  `DealDetail.tsx`'s `bookable` list per item 5; the portfolio link, when set, renders as a link in
  the talent table.
- Depends on: item 5 (placeholder exclusion logic).
- Coordination note (Jordan labour classification — no legal advice given or implied here): the
  owner should decide, outside this plan, whether providers are contracted as independent
  contractors or under some other arrangement before deciding which of `legalName`/`idNumber`
  become *required* rather than optional, and whether anything here needs a consent notice given
  PDPL. This plan only adds the storage and the note field; it does not recommend a classification.

### 16. Tests: unit-test the pure functions, extend the itest for the new states  [M] [tier: sonnet]
- Problem: `tests/deals.itest.mts` is a good integration test for the one rule that matters most
  (the margin/visibility rule) but needs real Firestore credentials to run, so it is not something
  that runs on every small change, and nothing here is unit-tested despite several pure,
  easily-tested functions existing: `msisdn` and `compose` (`lib/notify/whatsapp.ts`), `when`/
  `monthName`/`arNum` (`components/t/Portal.tsx`), and `days`/`dayOf`/`arNum` (the Arabic plural
  logic in `app/doc/invoice/[talentId]/page.tsx`) — the five-shape Arabic plural in particular
  (`days()`) is exactly the kind of function that silently regresses under a refactor without a
  test pinning its five branches (0/1, 2, 3–10, 11+, and the non-Arabic branch).
- Change: add `tests/whatsapp.test.mts` (or whatever lightweight runner the project already uses —
  check for an existing unit-test convention before introducing a new one; `deals.itest.mts` is
  invoked via `npm run test:deals`, a plain Node script, so a matching plain-Node `node --test` or
  hand-rolled assert script is consistent with the existing style rather than pulling in a new test
  framework) covering: `msisdn` against `07...`, `+9627...`, `009627...`, `7........` and invalid
  inputs; `compose` produces the expected line shape and omits null lines; the Arabic plural
  function's five branches (extract `days()` to a shared, exported helper if it is worth reusing
  between `Portal.tsx` and the invoice page — today it is only in the invoice page, so this is
  optional polish, not required for the test itself). Extend `tests/deals.itest.mts` with: the
  conflict case from item 3 (`offerBooking` twice for the same talent/date), the new-state
  transitions from item 4 (`cancelled`, `no_show`, and the transition-table rejection of an invalid
  move), and the placeholder-exclusion refusal from item 5.
- Acceptance: `npm run test:deals` (or whatever it is renamed to) still passes and gains the three
  new sections; a new unit-test script runs without Firestore credentials and covers the plural and
  phone-number edge cases enumerated above.
- Depends on: items 3, 4, 5 (the itest additions need those changes to exist first).

## Data-model / interface changes other workstreams must know about
- `Booking.status` gains `cancelled` and `no_show` (item 4) — any other code that switches on
  `BookingStatus` exhaustively (TypeScript will flag these at compile time, which is the point) must
  be updated. `Booking` gains `declineReason?`, `conflictWith?`, `rescheduledFrom?`,
  `rescheduledTo?`, `remindedAt?: string[]` (items 3, 4, 8, 11).
- `Talent` gains `availableFrom?`, `sessionEpoch?`, `portfolioUrl?`, `legalName?`, `idNumber?`,
  `note?` (items 2, 5, 6, 15). None of these are breaking — all optional, all additive.
- `lib/talent/auth.ts`'s `sessionValue`/`sign` signature changes to take an epoch (item 2) — any
  other code that calls `sessionValue(id)` directly (only `app/api/t/login/route.ts` today) needs
  updating to pass the talent's current `sessionEpoch`.
- A new env var, `TALENT_SESSION_SECRET` (item 2), and optionally `WHATSAPP_REMINDER_TEMPLATE`
  (item 11) — both need adding to `apphosting.yaml` alongside the existing gap CONTEXT.md already
  flags (`OPERATOR_PHONE`, `WHATSAPP_*` absent in prod).
- The proposal document's token scheme (item 14) is the client-facing workstream's file
  (`app/doc/proposal/[id]/page.tsx`) but is flagged here since this workstream also reads that file
  for the invoice/proposal shared mechanics — coordinate before either workstream edits it.

## Risks and what NOT to change
- Do not touch the core absence rule: `Booking` must never grow a client-price field, and
  `clientName` must stay written only inside `advanceDeal`'s `paid` transition
  (`lib/store/deals.ts:90-107`). Every item above adds fields to `Booking`/`Talent` that are either
  operator-only-visible or provider-own-data — none of them are the client's price.
- Do not add a bank/IBAN/payment-detail field to `Talent` speculatively (item 15 explicitly excludes
  it) — that is a step up in data sensitivity that deserves its own explicit ask and its own
  Firestore-rules conversation, not a drive-by addition here.
- Do not build a real scheduler/queue for reminders (item 11) — it is out of proportion to a
  two-person studio today and the honest-manual-fallback pattern is already the house style; flagged
  as an open question instead.
- The rate-limiting store (item 1) must hash IPs before persisting them — raw IP storage is exactly
  the kind of thing a PDPL-conscious codebase (see CONTEXT.md's Jordan legal note) should avoid
  without a stated retention reason.
- Session-epoch changes (item 2) will log out any already-signed-in provider whose epoch is bumped —
  make sure "Reissue code" and "Sign out everywhere" in the console say so plainly, since it is a
  behavior change from today's reissue (which currently does *not* sign anyone out).
- Item 14 is a note, not an instruction to edit `app/doc/proposal/[id]/page.tsx` from this
  workstream — that file is owned by the client-facing plan; changing it here risks conflicting
  edits landing in two plans at once.

## Open questions for the owner
- Item 11: is a real scheduled reminder (Cloud Scheduler / Cloud Function) worth building once
  booking volume outgrows what a human reliably taps through, or does the manual "Send reminder"
  button stay the permanent answer given the studio's size? Not decidable from the code alone.
- Item 15: should `legalName`/`idNumber` be mandatory before a booking can be marked `paid` (i.e.
  enforced in `advanceDeal`), or purely optional record-keeping the operator fills in when they get
  around to it? This is the labour-classification question CONTEXT.md defers to the owner, restated
  here because it determines whether item 15 needs a second, smaller follow-up (a `paid`-transition
  guard) once the classification is settled.
- Item 1's Firestore-backed rate-limit doc needs either a TTL policy or a periodic sweep to avoid
  growing forever — is there an existing cron/sweep mechanism in the ops side this can hook into, or
  does one need to be created (which would be its own small item, likely devops-owned rather than
  talent-portal-owned)?
