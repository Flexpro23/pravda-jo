# Client-facing surfaces plan

## Goal
Every surface a prospect or client touches — the marketing site, the intake, the specimen, the
sheet at `/s/<share>`, and the printed proposal — tells one story in one visual language, in
correct Arabic, on a phone, in a WhatsApp in-app browser. "100% functional and improved" means:
what a visitor is shown as a specimen is exactly the artefact a real prospect receives; the sheet
is a finished conversion document with a beacon, a CTA that survives a long scroll, and a link
preview; and nothing invented is presented as fact anywhere a stranger can read it.

## Current state
Two teardown formats coexist. Real prospects receive `/s/[shareToken]` — findings, charts, three
ideas, one flat offer, no controls — rendered by a bare layout with its own stylesheet (`app/s/s.css`),
which does **not** import `globals.css` and therefore inherits none of the four Arabic rules. The
public specimen at `/{lang}/teardown/sample` renders the *legacy* long-form `Report` through
`ReportView` + `Configurator`, where a visitor assembles their own price — a model the business
abandoned. `/r`, `/p`, `compose.ts`, `lib/data/report.ts` and `app/api/teardown` serve that legacy
path and nothing else reaches them. The marketing site is in good shape: the audit's P0 items
(mobile menu, route transitions, Cast cut) are already implemented and need finishing rather than
building. The archive, the roster and the homepage's "roster of ninety" all present placeholder
data as fact.

---

## Work items — ordered by priority

### 1. Make the public specimen a real sheet; retire the legacy report surfaces  [L] [tier: opus]

- **Problem:** `/{lang}/teardown/sample` is the page we send every cold visitor to as proof
  ("Read a specimen", `heroCta2`), and it shows a document no prospect will ever receive. It
  offers a `Configurator` that lets the reader tick concepts and watch a price assemble —
  the exact behaviour the sheet pipeline exists to remove ("Khaled fixes everything before
  anything is shared", `lib/store/sheets.ts`). A visitor who reads the specimen and then gets a
  sheet has been shown the wrong product. It also ships client-side JS on a text route that
  the README holds to ≤150 kB.
- **Decision — option (a): one artefact, rendered by one component.** Option (b) ("sheet is the
  short, report is the long") fails on three counts: (i) nothing produces a long report any more —
  `compose.ts` is only reachable from `POST /api/teardown` with a bearer key and no UI calls it, so
  "the long one" would be a page we promise and cannot deliver; (ii) the two formats disagree on
  the pricing model (assemble-your-own vs. flat published offer), and the flat offer is the locked
  business decision; (iii) two report renderers means every finding, every Arabic string and every
  RTL fix is written twice.
- **Change:**
  1. Extract the body of `app/s/[token]/page.tsx` into `components/SheetView.tsx`
     (`{ sheet: Sheet; ar: boolean; specimen?: boolean }`), pure and store-free. `app/s/[token]/page.tsx`
     becomes fetch + render.
  2. Add `lib/data/specimenSheet.ts` exporting `SPECIMEN_SHEET: Sheet` — a checked-in, fully
     materialised sheet (signals, findings, 5 recommendations, `chosen` = 3, `copy`, `offer`),
     generated once by running `buildFindings` + `recommend` against a fixed fixture and pasted in.
     Client is `Bayt Al-Akhdar` (matching `SAMPLE_DEAL` in `lib/data/specimens.ts`); cast names are
     the `SAMPLE_TALENT`-style fictional set, and `placeholder: true` is carried through.
     Do **not** call the engine at request time — the specimen must not depend on Firestore or drift.
  3. New route `app/specimen/[lang]/{layout,page}.tsx`: its own `<html lang dir>` set server-side
     from the segment, imports `s.css`, renders `<SheetView specimen />`. Indexable, canonical,
     `hreflang` both ways. It cannot live under `app/[lang]/` because `s.css` and `globals.css`
     define colliding `.wrap`/`.u`/`.num`/`.btn`/`.foot` and a nested `<html>` is impossible.
  4. `SheetView specimen` renders: a stamp band (copy the `.stamp` treatment from `app/doc/doc.css`)
     reading *"نموذج — منشأة غير حقيقية وأرقام تمثيلية"* / *"Specimen — fictional business,
     illustrative figures"*; a masthead-lite link back to `/{lang}`; and the closing CTA swapped
     from "Reply on WhatsApp" to `heroCta` → `/{lang}/teardown`.
  5. `app/[lang]/teardown/sample/page.tsx` becomes a permanent redirect to `/specimen/{lang}`.
     `app/sitemap.ts`: drop `'teardown/sample'` from `PAGES`, add `/specimen/ar` and `/specimen/en`
     with alternates.
  6. Delete: `app/r/**`, `app/p/**`, `components/ReportView.tsx`, `components/Configurator.tsx`,
     `lib/teardown/compose.ts`, `lib/data/report.ts`, `lib/store/teardowns.ts`,
     `app/api/teardown/route.ts`, `app/api/ops/save/route.ts`, `app/ops/[token]/page.tsx`,
     `components/ops/Editor.tsx`, and the `.rep-*` / `.cfg-*` / `.prev-*` / `.vitals` / `.fixes` /
     `.specimen` blocks in `globals.css` (~430 lines of CSS). Drop `/r/` and `/p/` from
     `app/robots.ts`; add `/specimen` is allowed (it is not in the disallow list, no change needed).
     Coordinate the ops-side deletions with the operator workstream.
- **Marketing copy that follows (i18n keys in `lib/i18n.ts`):**
  - `heroCta2` "شوفوا نموذج / Read a specimen" — keep, repoint to `/specimen/{lang}`.
  - `tdBody` currently describes only *reading* ("A hundred posts, their formats…"). Add a second
    key `tdDeliver`: *"وبيرجعلكم صفحة وحدة: كل الأرقام، تلات أفكار لحسابكم، وسعر مكتوب."* /
    *"You get back one page: every figure, three ideas for your account, and one published price."*
    Rendered on `/{lang}/teardown` above the specimen link, so the promise names the artefact.
  - Retire `tdCta`-adjacent report language nowhere else; no other key references the report format.
  - The `/specimen` page needs `specimenStamp`, `specimenBack`, `specimenCta` keys.
- **Acceptance:**
  - `/ar/teardown/sample` and `/en/teardown/sample` 308 to `/specimen/ar` / `/specimen/en`.
  - `/specimen/ar` renders the identical DOM structure as `/s/<token>` (same component), plus the
    stamp, and carries `<html lang="ar" dir="rtl">` server-side with JS disabled.
  - `/specimen/*` is in `sitemap.xml` with alternates; `/r/`, `/p/` return 404.
  - `rg -n "ReportView|Configurator|compose\(|SPECIMEN\b" app components lib` returns nothing
    outside `lib/data/specimenSheet.ts`.
  - `npm run build` succeeds; First Load JS for `/specimen/[lang]` ≤ 120 kB (no client component
    beyond the opened-beacon, which the specimen does not mount).
- **Depends on:** none. Items 2–6 should land on `SheetView` after this extraction, or be
  rebased onto it.

---

### 2. `s.css`: the four Arabic rules and the forked Arabic scale are missing  [M] [tier: sonnet]

- **Problem:** `app/s/s.css` is a standalone stylesheet. `globals.css` enforces Arabic globally
  (`[lang="ar"],[lang="ar"] * {letter-spacing:0 !important}`, no `text-transform`, no faux italic,
  and a forked Arabic type scale at ~1.35× / 1.85 leading). None of it reaches the sheet. Concrete
  defects on the single most important page in the business:
  - `.u{letter-spacing:.16em;text-transform:uppercase}` is applied to Arabic section kickers —
    `اللي شغّال`, `اللي بيكلّفكم`, `أي شكل بيشتغل`, `إمتى بتنشروا`, `اللي منعمله إلكم`, `السعر`.
    Tracking shatters cursive joins; this is rule 1, broken on every section heading.
  - `.mark`, `.idea-n` carry tracking too (Latin/digits only — harmless, but the rule should be
    categorical).
  - Arabic body text is 17px/1.72 — the Latin metric. The site sets Arabic body at
    `clamp(17px,1.3vw,20px)/1.92`. Arabic on the sheet reads a size small and a step tight.
  - No `[lang="ar"] em,i{font-style:normal}` guard.
  - `.bfill` un-highlighted bars are `var(--rule)` `#33352F` on `var(--panel)` `#202220` — ~1.2:1.
    The format comparison chart is effectively invisible except for the one brass bar.
  - No `:focus-visible` rule at all — keyboard focus on `.lang`, `.btn`, `.btn.ghost` and the `tel:`
    links falls back to the UA ring on a near-black ground.
- **Change:** add to `s.css`, at the top of the file so it is unmissable:
  ```
  [lang="ar"],[lang="ar"] *{letter-spacing:0 !important;}
  [lang="ar"] .u,[lang="ar"] .btn{text-transform:none !important;}
  [lang="ar"] em,[lang="ar"] i{font-style:normal;}
  [lang="ar"] body{font-size:19px;line-height:1.9;}
  [lang="ar"] .u{font-size:13px;}
  [lang="ar"] .find-t{font-size:20px;line-height:1.5;}
  [lang="ar"] .prov,[lang="ar"] .keys,[lang="ar"] .idea-yield{font-size:13.5px;}
  :focus-visible{outline:2px solid var(--brass);outline-offset:3px;}
  ```
  Change `.bfill` base to `var(--edge)` `#6B655B` (3.4:1 on `--panel`). Add
  `.lang{padding:10px 12px;margin:-10px -12px;}` so the toggle meets the 24×24 target.
  Add a short comment at the head of `s.css` pointing at the globals block it deliberately mirrors,
  so the next person changing one changes both.
- **Acceptance:** `/s/<token>` in Arabic shows zero letter-spacing on any Arabic run (computed
  style check); Arabic body ≥19px; every focusable element shows a brass ring; the non-highlighted
  format bars are visible against the track at 390px on a real phone.
- **Depends on:** none (do before or after item 1; if after, the same file serves `/specimen`).

---

### 3. The sheet's content defects: an empty opening, an untranslated word, a cast that is not the cast  [M] [tier: opus]

- **Problem:** four things the sheet can render wrong, all client-visible:
  1. **"What is working" can be empty.** `good.length > 0 &&` hides the section. `findings.ts`
     produces a `good` finding only if `best.multiple >= 2`, or `postsPerWeek >= 2`, or the site
     has a pixel. An account failing all three opens straight into "اللي بيكلّفكم / What is costing
     you" — the exact sequencing the page's own doc comment forbids ("Discomfort only lands after
     they have been told something true and generous first").
  2. **"What is costing you" can be empty too** — `bad.map()` inside an unguarded `<section>`
     renders a kicker and an `<h2>` over nothing.
  3. **`r.because` is never shown.** `recommend.ts` computes, per idea, one deciding bilingual
     sentence — *"Because it puts the price on screen, and no price appears anywhere they
     publish"* — chosen as the *rarest* answer across the shortlist precisely so it says something
     specific. It is the most persuasive line the engine produces and the sheet drops it.
  4. **`castOverrides` is ignored.** `lib/store/convert.ts` `castPlan` honours
     `sheet.castOverrides[conceptN]`; `app/s/[token]/page.tsx` renders `r.cast` from the
     recommender. If Khaled changes the cast, the client is shown one name and a different person
     is booked.
  5. `<span className="u">{c.discipline}</span>` prints the raw enum — `videographer`, `model`,
     `voiceover` — uppercased and tracked, in Arabic. `DISCIPLINE_LABEL` in `lib/data/roster.ts`
     already holds the bilingual strings.
  6. No date. The sheet asserts provenance ("computed from what you published publicly") without
     saying when it was read. `sheet.approvedAt ?? sheet.createdAt` exists.
- **Change (in `SheetView.tsx`):**
  - Guard both sections on non-empty. Add a fallback `good` finding in `lib/teardown/findings.ts`:
    when no `good` finding was produced, emit one from whatever is measurably true — the
    highest-performing format, or the span of consistent publishing — so the invariant
    "there is always something working" lives in the engine, not in a template.
  - Render `r.because[ar?'ar':'en']` under the hook as `.idea-why`, with the same
    Arabic-copy-wins / LTR-isolation treatment already applied to `name` and `hook`.
  - Resolve cast through `sheet.castOverrides?.[String(r.conceptN)]` when present; the sheet needs
    names for those ids, so persist the resolved `CastPick[]` onto the sheet when the override is
    saved (operator workstream) rather than reading `talent` at render time.
  - Map `c.discipline` through `DISCIPLINE_LABEL`.
  - Add a dateline under `.for`: *"قراءة يوم ٤ أيلول ٢٠٢٦"* / *"Read on 4 September 2026"*, using
    the same `AR_MONTHS` table the proposal already carries — extract it to `lib/date.ts` and have
    both use it.
  - Add `lang="en"` alongside the existing `dir="ltr"` on untranslated idea names and hooks, so a
    screen reader does not read English with an Arabic voice.
- **Acceptance:** a sheet fixture with zero `good` findings still renders a "what is working"
  section; a sheet with an empty `bad` array renders no orphan heading; every idea shows its
  `because`; `castOverrides` set on a sheet changes the names the client sees; unit tests for
  `buildFindings` assert `findings.some(f => f.severity === 'good')` for every fixture.
- **Depends on:** 1 (for `SheetView`), and the operator workstream for persisting overrides.

---

### 4. The sheet as a conversion page: preview, sticky reply, print, structure  [M] [tier: sonnet]

- **Problem:** the sheet arrives as a link pasted into WhatsApp and is read standing up, on a
  phone, by someone who did not ask for it.
  - **No link preview.** `app/s/layout.tsx` sets `title: 'PRAVDA'` and no description or image.
    WhatsApp shows a bare grey card with a bare word. This is the first impression, before the
    page is even opened.
  - **The CTA is at the bottom of a five-screen document.** A reader who is convinced by the
    findings has to keep scrolling past three ideas and a price to find the reply button.
  - **No print / save-as-PDF affordance,** and no `@media print` in `s.css`. A business owner who
    wants to show this to a partner has no way to keep it. `app/doc/doc.css` and
    `components/doc/PrintBar.tsx` already solve exactly this problem for the proposal.
  - **No `<main>` landmark and no skip link** — the whole document is a bare `<div class="wrap">`.
- **Change:**
  - `app/s/layout.tsx`: add `openGraph` + `twitter` metadata with a **generic** title/description
    ("برافدا — تحقيق حسابكم" / "PRAVDA — your account, read") and a static `og:image` (a plain brand
    card in `public/`). Deliberately generic: the client's name and figures must not be handed to
    WhatsApp's crawler or rendered in a group chat preview. Keep `robots: noindex`.
  - Add a sticky reply bar: a `position:sticky; bottom:0` WhatsApp button that appears once the
    reader passes the findings (CSS-only via a sentinel + `position:sticky`, no JS), hidden on
    ≥720px where the page reads as a document. Respect `env(safe-area-inset-bottom)`.
  - Add a `PrintBar`-equivalent to `SheetView` (reuse `components/doc/PrintBar.tsx`, it is already
    generic) and a `@media print` block in `s.css`: white ground, ink type, charts kept,
    `.cta`/`.lang`/sticky bar hidden, `break-inside:avoid` on `.find`, `.idea`, `.offer`.
  - Wrap the content in `<main id="main">`, add the `.skip` link pattern.
  - The `tel:` CTA and `wa.me` prefill are correct as written; add the sheet reference (first 6 of
    the share token, uppercased — the same `ref` shape the proposal prints) to the WhatsApp prefill
    so Khaled knows which sheet a reply belongs to.
- **Acceptance:** pasting a `/s/<token>` URL into WhatsApp shows a titled card with no client data;
  the reply button is reachable without scrolling from any point below the findings on a 390×844
  viewport; `window.print()` produces a legible A4 Arabic document with the charts intact;
  axe reports a `main` landmark.
- **Depends on:** 1.

---

### 5. The "opened" beacon  [S] [tier: sonnet]

- **Problem:** nobody knows whether a sheet was read. Khaled follows up blind.
- **Change — a tiny client fetch, not a server-render side effect.** Add
  `components/s/Opened.tsx` (client, ~15 lines): on mount, `fetch('/api/s/opened', {method:'POST',
  keepalive:true, body: JSON.stringify({t: shareToken})})`, fired once per page load, errors
  swallowed. The route validates the token shape, resolves via `getShared`, and writes
  `firstViewedAt` **only if unset**, plus `lastViewedAt` and an incremented `views`. Mounted by
  `app/s/[token]/page.tsx`, **not** by the specimen route.
- **Why not a server-render increment:** `/s` is `force-dynamic`, so every fetch of the URL renders
  it — and the two fetches that happen first are (i) WhatsApp's link-preview crawler the instant
  Khaled pastes the URL, and (ii) Khaled opening it himself to check it before sending. A
  server-side stamp would record "opened" before the client has seen it, which is worse than no
  signal: it would make the follow-up conversation wrong. Crawlers do not run JS; a client fetch
  measures a human with a browser. The cost is that it misses a reader with JS disabled, which on
  the WhatsApp in-app browser is essentially nobody.
- **Privacy:** a timestamp and a counter on a record we already hold, no cookie, no third party,
  no IP retention — so no consent surface is required and none should be added. Nothing about this
  changes `/{lang}/notice` or `/{lang}/privacy`.
- **Acceptance:** loading `/s/<token>` once sets `firstViewedAt`; loading it again leaves
  `firstViewedAt` unchanged and bumps `views`; `curl` on the URL (no JS) writes nothing;
  `/specimen/*` writes nothing.
- **Depends on:** the backend workstream owns the `Sheet` field additions (`firstViewedAt`,
  `lastViewedAt`, `views`) and the operator notification on first view.

---

### 6. Language toggle that persists, and one number register  [S] [tier: sonnet]

- **Problem:** the toggle is `?lang=en`, which is correct and shareable, but a reader who switches
  to English, closes the WhatsApp browser and taps the original link again is back in Arabic.
  Separately, `arNum` is copy-pasted verbatim in three files (`app/s/[token]/page.tsx`,
  `app/doc/proposal/[id]/page.tsx`, `lib/teardown/findings.ts`) and the site and the delivery
  documents disagree about digits: `components/PricingView.tsx` explicitly forces Western digits in
  Arabic ("every other figure on the site is Western-digit, in both locales") while `/s` and
  `/doc` render Arabic-Indic. `lib/data/scenes.ts` disagrees with itself inside one scene —
  `sup: '150'` beside `٤٠٠` in the same subtitle.
- **Change:**
  - Extract `lib/num.ts` with `arNum(s)`, `num(n, ar)`, `hour(h, ar)`; import it in all three
    places and delete the copies.
  - **Recommendation: Arabic-Indic in every Arabic surface**, Latin only for the phone number, the
    CR, the handle and any Latin-script identifier. A Jordanian owner reads Arabic-Indic natively;
    the current split makes the sheet and the site look like two companies to the one person who
    sees both. Apply to `PricingView`, `scenes.ts`, `PieceView`, `WorkRows`.
  - Persist the toggle: `app/s/[token]/page.tsx` reads `?lang` first, then a `pravda_lang` cookie;
    the toggle link sets the cookie via a tiny `route.ts` redirect (`/s/[token]/lang?to=en`) so no
    client JS is needed. Same treatment for `/doc/*`.
- **Acceptance:** switching to English, then re-opening the bare `/s/<token>` URL in the same
  browser, lands in English; `rg -n "٠١٢٣٤٥٦٧٨٩" app components lib` shows the table in exactly one
  file; every Arabic figure on `/ar/pricing` and the homepage flight is Arabic-Indic.
- **Depends on:** 1. Confirm the digit register with the owner (open question 1).

---

### 7. Intake: progress, reassurance, and a failure that has somewhere to go  [M] [tier: opus]

- **Problem:** `components/Intake.tsx` is well-reasoned (risk-gradient two-step) but the second
  step is a leap of faith with no scaffolding, and the failure state is a dead end.
  - No progress indication — a visitor who gave a handle does not know the phone step is the last.
  - No time expectation before submitting; the "within one working day" promise only appears
    *after* the number is handed over, which is exactly backwards.
  - The generic failure says "message us on WhatsApp" and provides **no link**.
  - Step changes do not move focus; the `done` state is not announced.
  - The name input carries no `aria-invalid`/`aria-describedby` (the handle and phone do).
  - The `/instagram-professional` link only appears on step 1, but the personal-account problem is
    only discovered *after* the read — the `done` state is the place it needs to be repeated.
- **Change:**
  - Add a step line above the fields: `١ من ٢` / `1 of 2` — `.intake-step`, `aria-hidden` on the
    decorative half, with the accessible name carried by a `<fieldset><legend>`.
  - Move the reassurance forward: on step 2, above the fields, state the three facts —
    *"مجاني · بيوصلكم خلال يوم عمل · الرقم للتواصل بس"* / *"Free · arrives within one working
    day · the number is for contact only"*. `tdNote` already carries the first two for step 1.
  - Failure state: render an explicit `wa.me` link with the handle pre-filled
    (`مرحبا، بدي تحقيق لحساب @handle`), plus a `tel:` link to `CO.phone`. Import `CO` from
    `lib/data/company.ts` (a plain module — safe in a client component).
  - Focus management: on `handle → contact`, focus the name input; on `→ done`, focus the
    confirmation heading and give the block `role="status"`.
  - Add `aria-invalid`/`aria-describedby` to the name input.
  - `done` state additions: (a) a "Message Khaled now" `wa.me` button, so an eager lead does not
    have to wait for us; (b) a one-line repeat of the professional-account condition with the
    `/{lang}/instagram-professional` link — *"لو حسابكم لسّا شخصي، حوّلوه هلق — بياخد نص دقيقة"*;
    (c) a countdown-free, honest expectation line (keep the current text, which is correctly
    scoped to what is true at that instant).
  - `components/TeardownView.tsx`: repoint the `hero-alt` specimen link to `/specimen/{lang}`, and
    add the new `tdDeliver` line from item 1 above the intake.
- **Acceptance:** submitting with the network offline shows a tappable WhatsApp link carrying the
  handle; keyboard-only, `Tab` from the handle field to the button and `Enter` lands focus in the
  name field; VoiceOver announces the confirmation; the `1 of 2` indicator is present on both steps.
- **Depends on:** none.

---

### 8. Intake "returning" state should hand back the sheet  [S] [tier: sonnet]

- **Problem:** `setReturning(!!j.returning)` produces one sentence — *"We already have you on
  file"*. If that client's sheet is already approved, we are telling somebody who came back to the
  site that we will contact them, while their finished document sits at a URL they cannot reach.
- **Change:** have `POST /api/lead` return, for a returning handle whose sheet is approved,
  `{ returning: true, sheetUrl: '/s/<shareToken>' }`. The `done` state then renders
  *"تحقيقكم جاهز — افتحوه"* / *"Your teardown is ready — open it"* as a primary button. Nothing
  else changes; if the sheet is not approved the current copy stands.
- **Acceptance:** re-submitting a handle with an approved sheet renders a working link to `/s`;
  re-submitting one still in `reading` renders the existing sentence.
- **Depends on:** backend workstream (`/api/lead` response shape).

---

### 9. Placeholder honesty: one rule, applied at every leak  [M] [tier: opus]

- **The rule.** *A record carrying `placeholder: true` may never be (i) named to a client on a
  sheet or a document, (ii) indexed, or (iii) presented without the same viewport saying it is a
  worked example.* Two of the three are currently broken, and there is a fourth leak that carries
  no flag at all.
- **Leaks found:**
  1. **`lib/data/scenes.ts` claims "A roster of ninety models, photographers and editors in
     Amman".** The roster in code is 15 entries, all `placeholder: true`. This is the highest-traffic
     surface on the site making the largest unprovable claim, from a studio whose entire pitch is
     that it only says what it can prove — and it is checkable by anyone who reads the Cast page.
     The neighbouring scene says thirty ideas *"already shot"*; the library has 30 concepts, but
     "already shot" is a production claim, not a library count.
  2. **Placeholder work pieces are in the sitemap.** `app/sitemap.ts` emits
     `/{lang}/work/{slug}` for every piece from `getWork()`. Four invented Amman businesses are
     therefore submitted to Google under our domain.
  3. **`components/PieceView.tsx` carries no demo note.** The list pages swap in `workBodyDemo`,
     but the detail page renders an invented client, sector, date, metric and price as fact. It is
     also the page a cold prospect is most likely to land on from search.
  4. **`/s` can name people who do not exist.** `recommend.ts` filters `active && dayRateJOD > 0`
     only; seeded talent are `placeholder: true` and pass. (Established in CONTEXT; restated here
     because the sheet is where the harm lands.)
  5. `demoNote` exists in `lib/i18n.ts` and is used nowhere.
  6. `anyPlaceholder` is exported from `lib/store/content.ts` and used nowhere; `WorkFlow.tsx:26`
     and `CastFlow.tsx:34` each reimplement it inline.
- **Change:**
  - `scenes.ts`: replace the roster figure with one we can prove — the count of non-placeholder
    talent, or, until there is one, drop the numeral and state the capability
    (*"طاقم منكاسته لكل مشروع"* / *"a roster we cast per project"*). Change "already shot" to
    "already worked out" / *"مجهّزة"* unless the library concepts were in fact produced.
  - `sitemap.ts`: filter `work.filter(w => !w.placeholder)`.
  - `PieceView.tsx` and `WorkRows.tsx`: render a `demoNote` chip on any piece with
    `placeholder: true`, and add `robots: { index: false }` to `generateMetadata` for a placeholder
    piece.
  - `recommend.ts`: add `&& !t.placeholder` to the `bookable` filter (coordinate — the engine
    workstream may own this line; it must land in exactly one of the two plans).
  - Replace the two inline `.some(...)` with `anyPlaceholder(...)`.
- **Acceptance:** `sitemap.xml` contains no `work/` URLs while every piece is seeded; a placeholder
  piece page returns `noindex` and shows the chip; a generated sheet fixture over a placeholder-only
  roster produces recommendations with empty `cast` (and the sheet renders them without a cast
  block) rather than inventing names; `rg "\.some\(\(.\) => .\.placeholder\)"` returns nothing.
- **Depends on:** coordination with the engine workstream on `recommend.ts`.

---

### 10. The proposal: stop putting the operator token in the client's URL  [M] [tier: sonnet]

- **Problem:** `components/ops/SheetReview.tsx:277` links to `/doc/proposal/sheet-<sheet.token>`.
  `sheet.token` is the **operator** address — the same token as `/ops/sheet/[token]`. The proposal
  is a document a client keeps, forwards to a partner and prints. It therefore publishes the
  operator handle for that record to everyone downstream. The ops cookie is the only thing standing
  between that URL and the review console, and CONTEXT already records that the ops cookie is
  `sameSite: 'strict'` and mis-behaving. `shareToken` exists for exactly this purpose and its
  absence is what makes an unapproved sheet unaddressable.
- **Change:**
  - `app/doc/proposal/[id]/page.tsx`: accept `share-<shareToken>` and resolve via
    `getShared(shareToken)`; drop the `sheet-<token>` branch entirely (only `SheetReview` emits it,
    and it is not in the wild long enough to need a deprecation window — confirm with the owner).
  - `SheetReview.tsx` emits `/doc/proposal/share-${sheet.shareToken}` and the button is disabled
    until the sheet is approved (a proposal for an unapproved sheet should not exist).
  - `ref` derives from the shareToken, so the quote and the deal it becomes carry one reference.
- **What the sheet-derived proposal should say** (the flat-pack case, `flat` truthy):
  - Keep the single line item — `N videos at 150` — because that is the number the client agreed
    to on the sheet. Correct.
  - **Add the three idea names as their own sub-rows with one line of hook each**, not the current
    ` · `-joined run. The client is buying three specific ideas; a joined string of English names
    inside an Arabic table is both unreadable and un-isolated (bidi will scatter the ` · `
    separators). Wrap each Latin name in `dir="ltr" lang="en"` the way `/s` already does.
  - **Add the shoot-day count and a delivery window** ("one shoot day, finished pieces within N
    days of the shoot") — the sheet promises *"N finished pieces from a single shoot day"* and the
    proposal currently never mentions time at all.
  - **Add payment terms.** A quotation a client keeps with no deposit, no schedule and no
    cancellation line is not actionable. See open question 2.
  - Keep the specimen stamp behaviour, the 30-day validity, the "quotation not a contract" note and
    the signature block as they are.
- **Acceptance:** `/doc/proposal/share-<shareToken>` renders; `/doc/proposal/sheet-<opsToken>`
  404s; the Arabic proposal lays out the three Latin idea names correctly with no stray
  punctuation at line starts; `window.print()` in Arabic produces correct ligatures.
- **Depends on:** operator workstream owns the `SheetReview.tsx` edit.

---

### 11. Marketing interior pages: finish what the audit started  [M] [tier: sonnet]

Three of the audit's four P0 items are already implemented (`MastNav` menu toggle + `globals.css`
`@media(max-width:760px)`, `RouteTransition` + `.route-wash`, `useCutStage`). The remaining work is
finishing, not building. Scoped by conversion impact / effort; everything not listed here is
explicitly deferred (see "Risks and what NOT to change").

- **11a. Finish the mobile menu [S].** `MastNav.tsx` has `aria-expanded`/`aria-controls` and the
  panel is correctly `visibility:hidden` when closed, but: no `Escape` to close, no outside-click
  close, focus is not returned to the toggle on close, and at ≤760px the bar shows *both* the
  compact "Teardown" link and a "Menu" button, which reads as two competing affordances.
  Change: keep the compact link (it is the CTA and it converts), style it as a small filled
  `.btn`-like pill so the two read as CTA + navigation rather than two links; add `Escape`,
  outside-click via a `pointerdown` listener, and `toggleRef.current?.focus()` on close.
  Acceptance: `Escape` closes and returns focus; tapping the page body closes; the two controls are
  visually distinct at 390px in both locales.
- **11b. `/{lang}/teardown`: show the artefact [M].** Highest-conversion interior change. The page
  currently promises a teardown in prose and links to a specimen in a small `.u` link below the
  form. Add, below the evidence rows, a "what arrives" section: the `tdDeliver` line from item 1, a
  scaled-down static image or CSS mock of the sheet's top screen, and a full-size button to
  `/specimen/{lang}`. Acceptance: the specimen link is a `.btn`, not a `.u link`, and appears both
  above and below the fold.
- **11c. `/{lang}/pricing`: make the free teardown primary [S].** Three equal `.rate` cards where
  one of them is the conversion path and costs nothing. Change: give the `teardown` rate an oak
  border and a `.btn` to `/{lang}/teardown` inside the card; leave the other two untouched; do not
  animate the prices (the audit is right that a count-up would read as untrustworthy here).
  Acceptance: the teardown card is visually distinct and carries its own CTA at 390px.
- **11d. Cast/Work stage: verify the transition overlap [S].** The audit's "visible text overlap
  during the Cast cut" was addressed by `--cut` + `useCutStage`; verify at 390px and 1440px in both
  locales and fix only if a defect is observed. Do not redesign the interaction.
- **Deferred with reason:** the shared scroll-motion controller, per-route material response, Work
  row choreography, clicked-plate → detail continuity, Studio founder reveal. All are polish on
  pages whose *content* is still placeholder (item 9). Real photography and a real archive change
  these designs; building the motion first means building it twice.

---

### 12. Bilingual / RTL QA checklist and the defects found now  [S] [tier: sonnet]

- **Checklist — run every surface at 390×844 and 1440×900, in `ar` and `en`, with keyboard only
  and with `prefers-reduced-motion: reduce`:** `/{lang}` (flight), `/{lang}/work`,
  `/{lang}/work/[slug]`, `/{lang}/cast`, `/{lang}/teardown`, `/specimen/{lang}`,
  `/{lang}/studio`, `/{lang}/pricing`, the four legal pages, `/{lang}/instagram-professional`,
  `/s/[token]`, `/doc/proposal/share-[token]` on screen and in print preview.
  Per surface: (1) no letter-spacing on any Arabic run; (2) no `text-transform` reaching Arabic;
  (3) no faux italic; (4) ragged right, never justified; (5) every Latin run inside Arabic is
  `dir="ltr" lang="en"` isolated; (6) directional arrows use `fwd()`/`back()`; (7) `inset-inline-*`
  and `padding-inline-*` rather than physical sides; (8) `transform-origin` uses the
  `--inline-start` token; (9) digits follow the register decided in item 6; (10) no horizontal
  scroll at 390px.
- **Defects found now:**
  - `s.css` — the whole of item 2.
  - `/s` cast discipline printed as a raw English enum in Arabic (item 3).
  - `/s` untranslated idea names carry `dir="ltr"` but not `lang="en"` (item 3).
  - `/doc/proposal` `deal.concepts.map(c => c.name).join(' · ')` — a run of Latin names joined by
    a middot inside an RTL cell, with no isolation. Bidi will move the separators (item 10).
  - `lib/data/scenes.ts` scene 4: `sup: '150'` (Western) beside `٤٠٠` (Arabic-Indic) in the same
    subtitle (item 6).
  - `app/[lang]/error.tsx` hardcodes `tel:+962797989818` instead of `CO.phone`; if the number
    changes, the error page keeps the old one. One-line fix.
  - `s.css` `.hours` is a 24-column flex row; under `dir="rtl"` the time axis runs right-to-left
    while the `ص/م` tick labels read as a clock. **Recommendation: force `direction:ltr` on
    `.hours` only** (labels stay Arabic), so the axis always runs earliest-to-latest left-to-right,
    which is how every clock, calendar and chart a Jordanian business owner has seen is drawn.
    Flag for the owner if they disagree.
  - `.htick` is 9.5px — below the site's Arabic floor. Bump to 11px in Arabic.
- **Acceptance:** the checklist is committed as `docs/rtl-qa.md` (the one doc file worth writing)
  and every defect above is closed.

---

### 13. Accessibility: the real defects only  [S] [tier: sonnet]

- `/s` and `/specimen`: no `:focus-visible` styling, no `<main>` landmark, no skip link, `.lang`
  toggle below the 24×24 target (items 2 and 4).
- `/s`: the format chart's low bars fail 3:1 non-text contrast (item 2).
- `Intake.tsx`: focus is not moved on step change; the `done` state is not announced; the name
  input lacks `aria-invalid`/`aria-describedby` (item 7).
- `MastNav.tsx`: no `Escape`, no focus return (item 11a).
- **Already correct, do not "fix":** `globals.css` has the blanket `prefers-reduced-motion` rule,
  `:focus-visible{outline:2px solid var(--brass)}`, a `.skip` link on every `Page`, `main
  tabIndex={-1}`, `aria-current="page"` in the nav, `role="alert"` on intake errors, the
  `<dl>` in `StudioView` correctly dropping the term when the CR is absent, and the Arabic
  placeholder decision in `tdField`. `--dim` (7.0:1) and `--ash` (4.7:1) both pass on the ground.

---

## Data-model / interface changes other workstreams must know about

- **`Sheet` gains** `firstViewedAt?: string`, `lastViewedAt?: string`, `views?: number`
  (item 5, written by `POST /api/s/opened`). The backend/ops workstream owns the write path and any
  operator notification on first view.
- **`Sheet.castOverrides` must be materialised.** `/s` needs names, not ids. When an override is
  saved, persist the resolved `CastPick[]` (id + bilingual name + discipline) onto the
  recommendation, so the client-facing render never reads `talent` (item 3).
- **`POST /api/lead` response** gains `sheetUrl?: string` for a returning handle with an approved
  sheet (item 8).
- **New route `POST /api/s/opened`** — public, token-shaped body, no auth, idempotent on
  `firstViewedAt`. Needs the same rate limiting the `/api/lead` item in the backend plan describes.
- **`/doc/proposal/[id]` id grammar changes** from `sheet-<opsToken>` to `share-<shareToken>`
  (item 10). `components/ops/SheetReview.tsx:277` must change with it.
- **`recommend.ts` `bookable` filter** gains `&& !t.placeholder` (item 9) — must land in exactly
  one plan; this one defers to the engine workstream if it claims it.
- **New shared modules:** `lib/num.ts` (`arNum`, `num`, `hour`), `lib/date.ts` (`AR_MONTHS`,
  `fmtDate`), `components/SheetView.tsx`, `lib/data/specimenSheet.ts`.
- **Deletions that touch other workstreams:** `app/ops/[token]`, `components/ops/Editor.tsx`,
  `app/api/ops/save`, `app/api/teardown`, `lib/store/teardowns.ts` (item 1). The ops nav's legacy
  queue entry goes with them.

## Risks and what NOT to change

- **The homepage flight is not in scope and is not broken.** Do not touch `Flight.tsx`,
  `Terrain.tsx`, `terrain.glsl.ts`, `forms3d.ts`, the scroll model or the section envelopes. The
  only change to the homepage in this plan is one honesty edit to `lib/data/scenes.ts` copy
  (item 9), which changes no timing, no `at` range and no `sup` position other than the roster
  figure.
- **Do not merge `s.css` into `globals.css`.** They share class names (`.wrap`, `.u`, `.num`,
  `.btn`, `.foot`) with different meanings, and `/s` is deliberately canvas-free and light. Mirror
  the four Arabic rules; do not import.
- **Deleting `/r` and `/p` is irreversible for anything already sent.** Confirm with the owner that
  no `/r/<token>` link is live in a WhatsApp thread before removing the route (open question 3). If
  one is, leave `/r` in place behind a 410 with a link to `/{lang}/teardown` for one quarter.
- **Do not add analytics, cookies or a consent banner.** The beacon is a timestamp on a record we
  already hold. A cookie banner on the sheet would be the single most expensive UI element on it.
- **Do not put client data in `og:` tags.** The link preview is generic on purpose.
- **The `format` field must stay off the sheet.** The existing comment in
  `app/s/[token]/page.tsx` explains why; carry it into `SheetView.tsx` verbatim.
- **Do not build the audit's motion system yet.** See the deferral note in item 11.
- **`/specimen` is indexable and permanent.** Once it is in the sitemap and linked from the
  teardown page, its URL is a public address; do not rename it later.

## Open questions for the owner

1. **Digit register.** Item 6 recommends Arabic-Indic on every Arabic surface, which reverses the
   deliberate Western-digit decision recorded in `PricingView.tsx`. Confirm, or confirm the
   opposite — but the site and the sheet must agree.
2. **Payment terms for the proposal** (item 10): deposit percentage, when the balance is due, and
   what happens if a shoot is cancelled. There is no source for these in the repo and they cannot
   be invented on a document a client keeps.
3. **Is any `/r/<token>` link live** in a real WhatsApp thread? Determines whether item 1 deletes
   the route or 410s it for a quarter.
4. **"Thirty ideas already shot"** (item 9): were the 30 library concepts actually produced, or is
   that a claim about the library? The copy must match.
5. **The hours chart axis direction in Arabic** (item 12): force left-to-right, or mirror with the
   document? Recommendation is to force LTR.
