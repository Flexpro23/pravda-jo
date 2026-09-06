# PRAVDA — shared context for planning agents

Repo: /Users/aliodat/Pravda (branch next-site). Next.js 15.5 App Router, React 19, TypeScript strict,
firebase-admin only (no client SDK; Firestore rules deny all client access), deployed on Firebase App
Hosting (Cloud Run, minInstances 0). Bilingual Arabic/English; /ar is canonical; RTL rules in
app/[lang]/globals.css (no letter-spacing, no text-transform, no faux italic, ragged right). No PDF
libraries by design (print stylesheets). Read README.md first.

## What the business is
PRAVDA is a two-person production + advertising studio in Amman (Ali: systems and paid ads; Khaled:
production and the talent roster). Acquisition: a free "Teardown" of a prospect's Instagram account is
the lead magnet. Rate card is locked: 150 JOD per video, ads management 400 JOD/month, crew day rates
videographer 35 / model 50 / voiceover 40. PRAVDA is always the connector: a client never learns what a
provider costs, a provider never learns what the client paid (enforced by schema absence on Booking).
Principle throughout: "only say what we can prove" — every number in a teardown is computed from public
data; prose the engine cannot justify is left as a ⟦placeholder⟧.

## The live flow (sheet pipeline)
1. /{lang}/teardown → components/Intake.tsx (handle, then name+phone) → POST app/api/lead/route.ts
2. lead route: openClient (lib/store/clients.ts, doc id = handle) → responds → Next `after()` background:
   tellOperator('new') → lib/teardown/run.ts runRead (lib/meta/discovery.ts Business Discovery, 100 posts;
   lib/meta/website.ts) → signals.ts → findings.ts → recommend.ts (5 concepts from lib/data/concepts.ts,
   cast from Firestore `talent`) → sheet saved (lib/store/sheets.ts) → client 'ready' → tellOperator('ready')
3. Operator console /ops (cookie = sha256(OPERATOR_KEY)): /ops/clients, /ops/clients/[id],
   /ops/sheet/[token] (components/ops/SheetReview.tsx: choose 3, Arabic copy, offer, approve → mints
   shareToken), /ops/deals, /ops/deals/[id] (DealDetail: offer days to talent), /ops/talent
4. Client reads /s/[shareToken] (app/s/[token]/page.tsx). Replies on WhatsApp. Khaled presses
   "They said yes" → lib/store/convert.ts winSheet → Deal (status signed) → bookings → talent portal /t
   (components/t/Portal.tsx, 6-digit code login) → accept/decline → done → paid.
5. Documents: /doc/proposal/[id] and /doc/invoice/[talentId] are print pages.
Notifications: lib/notify/operator.ts and lib/notify/whatsapp.ts. Without WHATSAPP_* env they compose
text + a wa.me link for a human to tap; the console records "sent" only after a human confirms.

## Legacy pipeline (still in repo, no UI reaches it)
POST /api/teardown (bearer OPERATOR_KEY) → long-form Report (lib/data/report.ts, lib/teardown/compose.ts)
→ /ops/[token] Editor → /p/[token] preview and /r/[token] full report with components/Configurator.tsx →
/api/proposal. /{lang}/teardown/sample still renders THIS format as the public specimen, which does not
match what a real prospect receives (/s).

## Audit findings already established (do not re-derive; build on them)
Critical/High:
- Ops cookie sameSite 'strict' (app/api/ops/login/route.ts) → links tapped from WhatsApp land on login gate.
- app/api/ops/sheet/route.ts 'run' calls openClient with empty contactName/phone → wipes a real lead's
  contact (clients.ts "contact details always win").
- SheetReview.tsx Arabic copy: hook onBlur sends stale name from initial prop → erases the name.
- after() background read on Cloud Run with minInstances 0 may stall; 'new' notice is inside it; client
  can sit in 'reading' forever; no stale sweep; no re-run button.
- Placeholder (invented) talent are bookable → real prospects' sheets name people who do not exist
  (recommend.ts filters only active && rate>0; seed sets placeholder:true).
- apphosting.yaml wires only META_ACCESS_TOKEN, META_IG_USER_ID, OPERATOR_KEY, META_API_VERSION.
  OPERATOR_PHONE, WHATSAPP_*, NEXT_PUBLIC_SITE_URL, NEXT_PUBLIC_CONTACT_EMAIL absent in prod.
- findings.ts / compose.ts engagement sentence mixes mean rate with median count.
- No rate limiting on public /api/lead (Meta budget ~200 calls/hr; each handle pings Khaled).
Medium/Low:
- castOverrides has no UI; /s ignores it while convert.ts castPlan honours it.
- /api/proposal scans listDeals(200) instead of a where query.
- SheetReview offer posts on every keystroke.
- DealDetail "Tell them" marks sent on WhatsApp open; ClientActions requires explicit "I sent it".
- Operator free-text WhatsApp only works in a 24h window.
- Dead paths: /api/ops/run, /api/teardown, Client.teardownTokens never written; ops nav lists legacy queue.
- Ops cookie never rotates (static digest).
- Console re-run drags 'sent'/'won' client back to 'ready'.
- No unit tests for pure engine (signals/findings/recommend/msisdn/normaliseHandle); only Firestore
  itests (tests/*.itest.mts) needing credentials; no CI; no eslint config.
- main is 4 commits behind next-site; unknown which branch App Hosting builds.
- No "opened" signal on /s; no notification channel until WhatsApp Business exists (Telegram/email fallback).
- PRAVDA_UI_UX_AUDIT.md (repo root) is a prior UI/motion audit of the marketing site; read it for the
  client-facing workstream.

## Plan format (write exactly this structure)
# <Workstream> plan
## Goal (2-3 sentences: what "100% functional and improved" means for this area)
## Current state (short; assume the reader has the context above)
## Work items — ordered by priority
For each item:
### N. <title>  [S|M|L] [tier: sonnet|opus]
- Problem:
- Change: (concrete — files, functions, data model changes, UI elements)
- Acceptance: (checkable — tests, commands, behaviours)
- Depends on: (other item numbers or other workstreams, or none)
## Data-model / interface changes other workstreams must know about
## Risks and what NOT to change
## Open questions for the owner (only genuinely undecidable ones)

Rules for the planning agent: READ ONLY. Do not modify any file in the repo. Do not run git commands
that mutate state (no stash/checkout/reset/commit). Do not start dev servers. Write your plan file to the
path given in your brief and return a short summary (≤15 lines) plus the path.
