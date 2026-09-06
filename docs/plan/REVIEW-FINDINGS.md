# Adversarial review findings (wave 3), triaged for the fix agents

Severity-ordered; numbers are the reviewer's. Fix ownership: A = website reader, B = engine copy
and arithmetic + client/portal rendering, C = backend, store and routes. Rules: WAVE1-RULES.md.

## CRITICAL
1 [A] lib/meta/website.ts resolvable(): `address.split('.').length === 4` lets `::ffff:169.254.169.254`
  through (NaN comparisons → 'ok'). Normalise with net.isIP; strip `::ffff:` and re-test as IPv4;
  deny `::`, `64:ff9b::/96`, `2002::/16`, and any private/link-local/ULA v6. Use lookup(host,{all:true})
  and reject if ANY address is private (also covers finding 5's "only first address" half).
2 [B] findings.ts ig-engagement: `fresh` gated on recentPosts but rate from recentKnown; median([])=0 →
  "0%" critical. Require recentKnown ≥ max(5, 40% of recentPosts) for the recent figure, else fall back
  to the window figure; never print a rate whose numerator has no known posts. Header tile in
  SheetView must agree with the finding (same basis) and guard followers === 0.
3 [C] app/api/ops/sheet/route.ts: choose/copy/offer/cast/vertical must refuse when status === 'approved'
  → 422 { error: 'approved-locked' }. (SheetReview UI disable is done separately after the polish
  agent finishes — do not edit SheetReview.)

## HIGH
4 [A] ReDoS: `<meta[^>]+name=...[^>]+content=...` shapes (website.ts ~395-411). Extract each
  `<meta ...>` tag with a bounded `[^>]{0,2000}` then parse attributes with anchored, non-nested
  patterns; same for title/link/html-lang. Measure: 760 KB body must parse < 200 ms.
5 [A] DNS rebinding TOCTOU: lookup all:true (see 1); document that a pinned-IP connector is the
  full fix; also apply the guard to the http→https probe (bypasses `guarded`), require an explicit
  content-type of text/html (missing content-type → not-html), report `bytes` from bytes read not
  the header, restrict ports to 80/443, and put ONE total AbortSignal.timeout(20_000) around the whole
  readSite rather than per hop.
6 [C] claimForRead force + readAndFile → advanceClient('ready') walks a won client to ready.
  Refuse force on won/lost (return null, route answers 409 'settled'); for sent, write
  `resumeStatus: 'sent'` on claim and have readAndFile advance to ready only when the resume rank ≤ 2,
  otherwise restore resumeStatus and still file the sheet.
7 [C] ratelimit.hit fails open under contention. Replace the transaction with
  `set({count: FieldValue.increment(1), expiresAt}, {merge:true})` then `get()`; add
  `opts.failClosed` and use it for the login buckets and `reads:global`.
8 [C] app/t/page.tsx passes the whole Talent to the client Portal. Pass only
  { id, name, phone, availability, availableFrom }; adjust Portal's prop type (B owns Portal.tsx —
  C edits the page and reports the exact prop type; B applies it).
9 [C] winSheet: re-run the same effective-cast validation approveSheet uses (export a shared
  `castRefusal(sheet, roster)` from sheets.ts) → why 'placeholder-cast'.
10 [C] advanceDeal: validate status membership with hasOwnProperty and add DEAL_TRANSITIONS
  (proposed→negotiating|signed|lost; negotiating→signed|lost; signed→paid|lost; paid→delivered;
  delivered terminal; lost→proposed allowed as the one reopen). Route returns 409 'illegal-transition'.
11/12 [B] formats chart: values = medianKnown(format) / overall median of known posts (the note
  already says "against your own typical post"); omit a format whose known count < 3; omit the chart
  when overall median < 1.
13 [B] ig-likes-hidden: figure and copy from engagementKnown (both counts), not likesKnown; title
  must say counts are missing, not that likes are hidden, unless likesKnown < posts.
14 [B] hours chart `best` band must be omitted when !engagementReliable.
15 [B] postsPerWeek denominator = min(RECENT_DAYS, activeSpanDays)/7; copy interpolates RECENT_DAYS.

## MEDIUM
16 [C] openClient: overwrite contact only when prior.status ∈ {new, reading, failed}; otherwise keep
  the prior contact and append a system note "form resubmitted with name X / phone Y".
17 [C] talent login: new codes are 8 digits (newPassCode), 1.5s delay on every wrong code, global cap
  20/min, per-IP 5/10min; keep 6-digit codes valid for existing records.
18 [C] `in` enum checks → Object.prototype.hasOwnProperty.call in app/api/t/availability, ops/booking,
  ops/talent (2), ops/client.
19 [C] Sheet.expiresAt: set at creation (composeSheet env.now + 180d) and cleared on approve and win;
  scripts/delete-client.mjs also finds sheets by `where('handle','==',handle)`.
20 [C] cron: add `notifyNewAttemptedAt`; retry the new notice at most once per hour.
21 [B] SheetView: an uncastable concept with an operator override must render the override's names.
22 [C] sheet route: choose/copy/offer/cast/vertical use targeted `update()` with dotted paths, not
  saveSheet({...sheet}); validate conceptN against recommendations for copy/cast.
23 [C] robots.ts: add '/api'.
24 [C] talent update: clear fields with FieldValue.delete() when '' is sent.
25 [A] see 5 (ports, total budget).
26 [B] Portal.tsx: dir="auto" on brief, clientName, location; isPast in Amman time.
27 [B] Finding `figure` becomes { ar, en } (figureAr optional is acceptable); no Latin words in Arabic
  chips; ٪ in Arabic; whatsapp.ts template fee via arNum (C owns whatsapp.ts: one-line).
28 [C] talent create id collision: loop until free.
29 [A] JSON-LD walk depth cap (e.g. 6) and node cap.
30 [B] ig-ask title conditional on the count; ig-format denominators both over known posts; header
  tile guard; RECENT_DAYS interpolated everywhere.

## LOW
[C] selfcheck route sameOrigin; remove `allowPlaceholders` option from recommend.ts (one-line, C may
  touch that line only); ics esc() also escapes \r; seed: `prior.placeholder ?? true` → only set when
  creating; remove `needsWriting` mentions from lib/data/concepts.ts comments and delete
  `toReportConcept` if it has no callers.
