# Wave 2 — contracts between H1 (engine integration), H2 (console), H3 (process)

Rules: docs/plan/WAVE1-RULES.md applies verbatim (three agents now, not eight). Exclusive files:
- H1: lib/teardown/run.ts, lib/store/sheets.ts, lib/store/convert.ts, app/api/ops/sheet/route.ts,
  components/SheetView.tsx, app/s/[token]/page.tsx, lib/data/deals.ts (CREW_LABEL only),
  tests/unit/golden.test.mts, tests/fixtures/golden/**, tests/sheet-deal.itest.mts (only if the
  castOverrides type change breaks it).
- H2: app/ops/** (all pages, ops.css), components/ops/**, lib/ops/today.ts, lib/ops/errors.ts,
  and the LEGACY DELETIONS: app/r/**, app/p/**, app/ops/[token]/**, components/ReportView.tsx,
  components/Configurator.tsx, components/ops/Editor.tsx, lib/teardown/compose.ts,
  lib/data/report.ts, lib/store/teardowns.ts, app/api/teardown/**, app/api/ops/save/**,
  app/api/ops/concept/**, app/api/proposal/**, tests/proposal.itest.mts, the `.rep-*`/`.cfg-*`/
  `.prev-*`/`.vitals`/`.fixes`/`.specimen` blocks in app/[lang]/globals.css, app/robots.ts
  (drop /r and /p lines only), README routes table rows for /r and /p (H3 owns the rest of README —
  H2 leaves README alone and reports the rows to remove), lib/data/clients.ts (remove
  `teardownTokens` writes only — keep the optional field), lib/store/clients.ts
  (`attachToClient` 'teardown' branch removal only).
- H3: app/api/health/route.ts, scripts/export-client.mjs, scripts/delete-client.mjs,
  scripts/check-env.mjs, README.md, CLAUDE.md, docs/RUNBOOK.md, eslint.config.mjs (flat config
  via FlatCompat so `npx eslint` works as well as `next lint`), lib/store/clients.ts
  (`expiresAt` on openClient for unconverted leads only), app/api/ops/{client,booking,deal,talent,
  notify}/route.ts and app/api/t/{respond,availability}/route.ts (ONE edit each: `sameOrigin(req)`
  → 403 `{ error: 'origin' }` at the top; nothing else), .github/workflows/ci.yml (add
  `node scripts/check-env.mjs` if useful), package.json scripts (`check-env`, `lint:eslint`).
  NOT app/api/ops/sheet (H1 adds sameOrigin there itself).

## Sheet route contract (H1 implements, H2 consumes) — POST /api/ops/sheet, opsAuthed + sameOrigin
- `{ action:'run', handle, website?, vertical?, contactName?, contactPhone? }` → as today, plus
  `verticalGuess` on the sheet. Uses `advanceClient`; `setClientStatus` alias removed.
- `{ action:'choose', token, chosen:number[] }` → `{ ok, chosen }` (unchanged).
- `{ action:'cast', token, conceptN, talentIds:string[] }` → validates each id (exists, active,
  dayRateJOD>0, !placeholder, discipline matches a slot the concept needs) → writes
  `castOverrides[n]: CastPick[]` (talentId, name{ar,en}, discipline, why) → `{ ok, cast: CastPick[] }`;
  400 `{ error:'bad-cast', detail }` on any invalid id. Empty `talentIds` clears the override.
- `{ action:'copy', token, conceptN, name, hook }` → unchanged.
- `{ action:'offer', ... }` → unchanged.
- `{ action:'vertical', token, vertical: Vertical|null }` → sets `sheet.vertical`, calls
  `rerecommend(sheet, roster)` (no Meta call), clears `chosen` entries no longer offered →
  `{ ok, recommendations, chosen }`.
- `{ action:'approve', token }` → `{ ok, shareToken }` | 422 `{ error:'pick-three'|'no-offer'|
  'placeholder-cast'|'uncastable-chosen', detail? }`. Does NOT change client status.
- `{ action:'unapprove', token }` → `{ ok }`; client back to `ready` via forceClientStatus.
- `{ action:'compose-share', token }` → `{ text, link, phone, name }` — Arabic message naming the
  business with the /s link, `link` = wa.me with the client's number (null when unusable), from
  `clientForSheet(token)`.
- `{ action:'mark-share-sent', token }` → `{ ok, sentAt }`; writes `sheet.sentAt`, advances client
  to `sent`.
- `{ action:'won', token }` → unchanged.
- `Sheet` gains: `profile`, `verticalGuess`, `vertical`, `webState`, `rosterState`, plus G1's
  `sentAt/openedAt/lastOpenedAt/openCount`. `castOverrides: Record<string, CastPick[]>`.
  `Findings.operatorNotes[]` exists (D1) — /ops renders it, /s never.

## Client route (E1 landed) — POST /api/ops/client
Actions: `compose` `{id,event}`, `mark-sent` `{id,event}`, `rerun` `{id, vertical?, website?}` →
`{ ok, queued|reading }`, `status` `{id, status:'won'|'lost', lostReason?}`, `note` `{id, text,
by}`, `contact` `{id, contactName?, contactPhone?}`, `vertical` `{id, vertical}`.
Store: `listClients`, `getClient`, `advanceClient`, `forceClientStatus`, `claimForRead`,
`queuedForRead`, `expiredLeases`. `Client` fields: see MASTER-PLAN §2. `lib/config/check.ts`
exports `configReport()`, `configSummary()`, `anyNotifyChannel()`; `POST /api/ops/selfcheck`.

## Booking / notify / talent (F landed) — verbatim from F's report
POST /api/ops/booking `offer` `{ dealId, talentId, date, feeJOD, brief, location?, callTime?,
rescheduledFrom?, force? }` → 200 `{ ok, id, notified, note?, conflictWith? }` | 409
`{ error:'conflict', conflict:{id,dealId,status}, message }` (re-POST with force:true) | 400
`{ error:'placeholder'|'inactive'|'no-talent', message }`. `mark` `{ id, status }` → 200 | 409
`{ error:'illegal-transition', message }`; import `canTransition`, `BOOKING_TRANSITIONS` from
lib/data/deals. POST /api/ops/notify `{ dealId, id }` (+ `action`: none → `{text,link,name}` offer;
`remind` → same shape; `mark-sent`; `mark-reminded`). POST /api/ops/talent `update` `{ id, nameEn?,
nameAr?, discipline?, dayRateJOD?, phone?, active?, placeholder?, tags?, availableFrom?,
portfolioUrl?, legalName?, idNumber?, note? }`; `reissue` `{id}` → `{ ok, code, signedOut:true }`
(signs every device out — the button must say so); `signout` `{id}`; `create` as before.
Store: `listOpenBookings(limit)`, `bookingsForDeal`, `bookingsForTalent`, `advanceDeal(id,
status, lostReason?)`. Booking statuses now include `cancelled`, `no_show`; fields
`declineReason`, `conflictWith`, `rescheduledFrom/To`, `remindedAt[]`. Talent: `availableFrom`,
`sessionEpoch`, `portfolioUrl`, `legalName`, `idNumber`, `note`, `tags`, `placeholder`.

## Auth (E2 landed)
`opsAuthed()` unchanged; `sameOrigin(req)`, `opsNext()` exported from lib/ops/auth.ts. The gate is
in app/ops/layout.tsx (`components/ops/SignIn.tsx`); pages no longer gate themselves.
