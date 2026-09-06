# Bilingual / RTL QA checklist

Source: `docs/plan/03-client-facing.md` item 12. Run every surface below at
390×844 and 1440×900, in `ar` and `en`, with keyboard only and with
`prefers-reduced-motion: reduce`.

## Surfaces

- `/{lang}` (flight — untouched this wave)
- `/{lang}/work`
- `/{lang}/work/[slug]`
- `/{lang}/cast`
- `/{lang}/teardown`
- `/specimen/{lang}`
- `/{lang}/studio`
- `/{lang}/pricing`
- the four legal pages
- `/{lang}/instagram-professional`
- `/s/[token]`
- `/doc/proposal/share-[token]`, on screen and in print preview

## Per-surface checklist

1. No letter-spacing on any Arabic run.
2. No `text-transform` reaching Arabic.
3. No faux italic.
4. Ragged right, never justified.
5. Every Latin run inside Arabic is `dir="ltr" lang="en"` isolated.
6. Directional arrows use `fwd()`/`back()`.
7. `inset-inline-*` and `padding-inline-*` rather than physical sides.
8. `transform-origin` uses the `--inline-start` token.
9. Digits follow the D13 register: Arabic-Indic on every Arabic surface,
   Latin only for phone numbers, CR, handles and other Latin identifiers.
10. No horizontal scroll at 390px.

## Defects closed by this wave (G2 — components/Intake, TeardownView, MastNav,
PieceView, WorkRows, WorkFlow, CastFlow, PricingView, lib/i18n.ts,
lib/data/scenes.ts, globals.css additive rules)

- **`lib/data/scenes.ts` — "a roster of [a headcount]"**, item 9. The roster in
  code is 15 seeded rows, all `placeholder: true`; the claim was checkable and
  false. Replaced with a capability line ("a roster, cast per project" /
  "روستر منكاسته لكل مشروع") and the numeral dropped rather than replaced with
  a smaller invented one.
- **`lib/data/scenes.ts` scene 3 — "already shot"**, item 9. Changed to
  "already worked out" / "مجهّزة": the library holds thirty ready concepts,
  which is not the same claim as thirty finished shoots, and there is no
  source in the repo saying they were produced.
- **`lib/data/scenes.ts` scene 4 — mixed digit register**, item 12/6. `sup:
  '150'` (Western) sat beside the Arabic-Indic `٤٠٠` in the line under it.
  `sup` is now `arNum('150')`. This is a partial fix — see "Left for another
  file" below, since `components/Flight.tsx` renders `{s.sup}` identically in
  both languages and is out of this wave's file scope.
- **`app/sitemap.ts` placeholder pieces** (owned by sibling G1/H2 — not
  edited here, see "Exact edits needed in files I do not own" below).
- **`components/PieceView.tsx` / `components/WorkRows.tsx` — no demo
  disclosure**, item 9. Both now render a `.demo-chip` (`demoNote` i18n key)
  on any piece with `placeholder: true`; `PieceView`'s detail route also gets
  `robots: { index: false }` via `generateMetadata` in
  `app/[lang]/work/[slug]/page.tsx`.
- **`components/WorkFlow.tsx:26` / `components/CastFlow.tsx:34` — reimplemented
  `anyPlaceholder` inline** as `.some(...)`, item 9. Both now import
  `anyPlaceholder` from `lib/store/content.ts`.
- **`components/Intake.tsx` — no progress indication, no pre-submit time
  expectation, a dead-end failure state**, item 7/13. Added the `1 of 2` step
  line (`<fieldset><legend>`, decorative digits `aria-hidden`, the legend
  carrying the real accessible name), the `intakeReassure` line moved ahead of
  the fields, a `wa.me` + `tel:` escape hatch on a server/network failure,
  focus management on `handle → contact` and `→ done`, `aria-invalid` /
  `aria-describedby` on the name input (previously only on handle/phone), the
  honeypot (`company`) and `elapsedMs` fields, the 429 sentence
  (`intakeTooMany`), the "Message Khaled now" `wa.me` button and the repeated
  Instagram-professional reminder on `done`, and the `sheetUrl` primary button
  for a returning approved lead (item 8).
- **`components/MastNav.tsx` — no `Escape`, no outside-click close, no focus
  return, two competing mobile affordances**, item 11a/13. Added all three;
  the compact link is now a filled pill so it reads as CTA, the toggle as
  menu.
- **`components/PricingView.tsx` — three equal-weight rate cards, Western
  digits**, item 11c/6. The teardown card gets an oak border (`.rate-free`)
  and its own `.btn` into `/{lang}/teardown`; figures now go through
  `num(r.price, ar)` (Arabic-Indic in `ar`) per D13, reversing the deliberate
  Western-digit comment that used to sit on this line.
- **`components/TeardownView.tsx` — the specimen is one small `.u link`
  reachable once**, item 1/11b. Repointed to `/specimen/{lang}`; it is now a
  `.btn` above the fold and a full-size `.btn` again below a new "what
  arrives" section (CSS-only mock of the sheet's header, no invented figure —
  it names the same four things the evidence rows already promise). The
  `tdDeliver` line (item 1's exact copy) now renders above the intake.

## Defects found now, outside this wave's file scope

These are real per the audit/plan but sit in files this brief does not own.
Reported rather than fixed, per WAVE1-RULES.

- **`components/Flight.tsx`** renders `{s.sup}` (not `{s.sup[lang]}`) at two
  call sites (`~L204`, `~L253`), so `lib/data/scenes.ts`'s `sup` field cannot
  vary by language. The scene-4 fix above (`arNum('150')`) is therefore
  correct for Arabic but also affects English. Exact fix: import `arNum` from
  `lib/format/num` and change both sites to
  `{s.sup && <span className="sup num">{lang === 'ar' ? arNum(s.sup) : s.sup}</span>}`,
  then revert `scenes.ts`'s scene-4 `sup` back to the plain Western string
  `'150'` so the conversion happens once, centrally, for every scene.
- **`app/s/s.css`** — the whole of item 2 (the four Arabic rules and the
  forked Arabic scale are missing; `s.css` does not import `globals.css`).
- **`/s` cast discipline printed as a raw English enum in Arabic** (item 3).
- **`/s` untranslated idea names carry `dir="ltr"` but not `lang="en"`**
  (item 3).
- **`/doc/proposal`** `deal.concepts.map(c => c.name).join(' · ')` — Latin
  names joined by a middot inside an RTL cell, unisolated; bidi will move the
  separators (item 10).
- **`app/s/s.css` `.hours`** is a 24-column flex row that runs
  right-to-left under `dir="rtl"` while the `ص/م` labels read as a clock.
  Plan's recommendation: force `direction:ltr` on `.hours` only (labels stay
  Arabic) — flagged for the owner if they disagree (open question 5).
  `.htick` at 9.5px is below the site's Arabic floor; bump to 11px in Arabic.
- **`app/doc/proposal/[id]/page.tsx`** still resolves `sheet-<opsToken>`
  rather than `share-<shareToken>` (item 10) — publishes the operator token
  in a document a client keeps.
- **`app/sitemap.ts`** still emits every `work/{slug}`, including
  `placeholder: true` pieces. Not edited here — see "Exact edits needed in
  files I do not own".
- **`recommend.ts` `bookable` filter** does not yet exclude
  `t.placeholder` (item 9) — owned by the engine workstream (D5, D2 in the
  master plan).

## Exact edits needed in files I do not own

- **`app/sitemap.ts`** (owned by G1/H2): change
  `for (const w of work) { out.push(...) }` to iterate
  `work.filter((w) => !w.placeholder)` instead of `work`, so a placeholder
  piece never reaches the sitemap.
- **`components/Flight.tsx`**: see "Defects found now" above — the two-site
  lang branch on `s.sup`, paired with reverting `scenes.ts` scene 4's `sup`
  to a plain `'150'`.
