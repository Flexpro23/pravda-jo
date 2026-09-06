# CLAUDE.md

PRAVDA. Next.js 15 App Router, bilingual Arabic/English, Firestore via
`firebase-admin`, hand-written Three.js. **Read `README.md` first** — this
file is the cross-cutting rules an agent must not violate; README is the
architecture and the "why" behind the WebGL layer. **Read
`docs/plan/MASTER-PLAN.md` before any change that touches more than one
file** — it is the reconciled decision record across every workstream, and a
change that looks locally correct can still contradict a decision made there.

## The one artefact

There is one delivered surface: **`/s/[token]`**, rendered by one component,
`components/SheetView.tsx`. The public specimen at `/specimen/[lang]` is a
real sheet built from static content (`lib/data/specimenSheet.ts`), not a
second renderer. There used to be two — `/r` (long-form report) and `/p`
(preview) — with their own component, compose step, and store. They are
**deleted**, not deprecated: `ReportView`, `Configurator`, `compose.ts`,
`report.ts`, `teardowns.ts`, `/api/teardown`, `/api/ops/save`,
`/api/ops/concept`, `/api/proposal`, `/ops/[token]`, `Editor.tsx` are gone
from the tree. Do not resurrect a second renderer for "just this one case" —
every Arabic fix written twice is exactly the failure mode that deletion
fixed.

## The sheet pipeline, in order

Intake (`POST /api/lead`) → `openClient` writes a `Client`, keyed by the
normalised Instagram handle → the read is **claimed**, not just started
(`claimForRead` transaction; `after()` is the fast path, `GET /api/cron/read`
is the sweeper that finishes a read whose instance died) → `lib/teardown/run.ts`
composes a `Sheet` → an operator reviews it at `/ops`, casts real talent
against it (never a `placeholder`), and approves it → `compose-share` /
`mark-share-sent` is a two-step, human-confirmed send (approving a sheet is
**not** the same act as telling someone it exists — `Client.status` only
moves to `sent` on the second step) → the client opens `/s/[token]` → `won`
converts the client into a `Deal`, with `Booking`s against real talent.

## "Only what we can prove"

Every number in a sheet must be computed from public Meta/website data the
engine actually read. Nothing invented, nothing "typical for this industry",
nothing rounded up to look better. A concept the engine cannot justify is
`⟦placeholder⟧` in the copy, never filled in with plausible-sounding prose.
This applies to code as much as content: do not add a fallback value that
quietly stands in for a number nobody computed.

## The connector invariant

PRAVDA is always the connector. A client never learns what a provider costs;
a provider never learns what the client paid. This is enforced by **schema
absence** on `Booking` (`lib/data/deals.ts`) — a `Booking` carries `feeJOD`
(what PRAVDA pays the provider) and nothing about the client's price;
`Deal.clientTotalJOD` lives on the other object entirely. Never add a field
to `Booking` that would let either side compute the other's number, even
behind a flag, even temporarily.

## No PDF libraries, by design

`/doc/*` (invoice, proposal) are print stylesheets, not PDF generation. Do
not add `puppeteer`, `react-pdf`, `pdfkit`, or anything that renders a PDF
server-side — even if asked, without first flagging the tension with this
rule. The browser's own print-to-PDF is the entire mechanism.

## `firebase-admin` only

No client-side Firestore SDK, ever. `firestore.rules` denies all client
access **by design** — every read and write goes through a Next.js route
handler using the Admin SDK, which is also why every `lib/store/*.ts` module
reads `FIRESTORE_COLLECTION_PREFIX` itself rather than trusting a client to
scope its own queries. If a change seems to need a client-side Firestore
read, that is a sign the architecture is being violated, not a sign the rules
need loosening.

## The dist-dir split

`npm run build` (App Hosting) writes to `.next`; `npm run build:local` writes
to `.next-prod`, so a production build on a developer's machine cannot
clobber a running `next dev` server's module graph. Full detail in README.
Never hand-edit `NEXT_DIST_DIR` handling without re-reading that section.

## The three secrets, and what each one signs

| Secret | Signs |
|---|---|
| `OPERATOR_KEY` | Falls back for both secrets below when they are unset. Rotating it with both unset signs everyone — every operator and every talent — out at once. |
| `SESSION_SECRET` | The `pravda_ops` operator console cookie only. |
| `TALENT_SESSION_SECRET` | Talent HMAC sessions only (`sessionEpoch`-bound; a reissue or "sign out everywhere" bumps the epoch independently of this secret). |

Full rotation procedure: `docs/RUNBOOK.md` §1. The point to hold in your head
while editing auth code: these are three separate revocation domains by
design, and a change that makes one secret implicitly depend on another
un-does that separation.

## Routes that must never be indexed

`/s`, `/ops`, `/t`, `/doc`, `/api` — matching `app/robots.ts`'s disallow list
and each route's own `noindex` meta tag (the second lock, not the only one).
`/specimen` is the deliberate exception: it is the one artefact meant to be
found by a stranger. A new route under any of the disallowed prefixes needs
no separate reminder to stay unindexed — it inherits the prefix's rule — but
a new *top-level* route must be added to `robots.ts` explicitly if it is
per-recipient or operator-only; nothing does that automatically.

## Reserved collection prefixes

`FIRESTORE_COLLECTION_PREFIX` scopes every store module's collections.
`staging_` (the staging App Hosting backend, §9 of the runbook) and `_itest_`
(the itest suite against the Firestore emulator) are reserved — never target
either from a script or a manual `gcloud` invocation unless that is
specifically what you mean. Production runs with the prefix unset.

## Test commands

```bash
npx tsc --noEmit                 # typecheck
npm run lint                     # next lint
npm run lint:eslint              # ESLint 9's own CLI, same rules, via eslint.config.mjs
npm run test:unit                # pure engine, node --test, no network, no Firestore
npm run test:itest               # against the Firestore emulator
npm test                         # unit + itest, wrapped in `firebase-tools emulators:exec`
node scripts/check-env.mjs       # what this environment is configured to do
```

Itests need a JDK for the Firestore emulator. On macOS, if `next lint`'s
JVM or `firebase-tools emulators:exec` complains about the Java version, set
`JAVA_HOME` to a JDK 21+ before running: e.g.
`JAVA_HOME=$(/usr/libexec/java_home -v 21) npm test`.

## Before a large change

Read `docs/plan/MASTER-PLAN.md` — sections 1 (decisions), 2 (data model), and
whichever wave's item your change resembles. It is the reconciliation across
every workstream's plan; the six source plans in `docs/plan/` are detail
underneath it, not a second source of truth. When in doubt about whether a
convention in this file is still current, `MASTER-PLAN.md`'s decision log
wins — this file is a summary of it, not a replacement.
