# PRAVDA

Production and advertising, Amman. Next.js 15, App Router, bilingual Arabic/English,
hand-written Three.js.

## Run

```bash
npm install
npm run dev     # http://localhost:3000 → redirects to /ar
npm run build   # writes to .next-prod
npm start       # serves .next-prod
```

**`next dev` and `next build` write to different directories on purpose.**
Both default to `.next`, so building while the dev server is running clobbers
its module graph and it starts throwing `Cannot find module './403.js'` — the
chunk names are real but the files were replaced underneath it. `distDir` is
set from `NEXT_DIST_DIR`, and the build/start scripts point it at `.next-prod`.
If you ever see that error, the cause is a collision, not corruption: stop the
server, `rm -rf .next`, restart.

## Routes

Every page under `/{lang}` exists in both locales. `/ar` is canonical.

| Path | | Indexed |
|---|---|---|
| `/` | 307 → `/ar` | — |
| `/{lang}` | Home — the flight | yes |
| `/{lang}/work` | The archive | yes |
| `/{lang}/work/[slug]` | One piece | yes |
| `/{lang}/cast` | Cast & crew — reached only through work | yes |
| `/{lang}/teardown` | What a Teardown is, and the handle intake | yes |
| `/{lang}/teardown/sample` | 308 → `/specimen/{lang}` (kept: it's `heroCta2` and was in the old sitemap) | no |
| `/{lang}/studio` | Founders and the entity block | yes |
| `/{lang}/pricing` | Published rates | yes |
| `/{lang}/privacy` | Privacy | yes |
| `/{lang}/notice` | PDPL Article 9 processing notice | yes |
| `/{lang}/terms` | Terms | yes |
| `/{lang}/data` | The six data rights and how to exercise them | yes |
| `/{lang}/instagram-professional` | Helper for the ~1/3 of accounts that are personal | yes |
| `/specimen/[lang]` | **The one complete, public specimen sheet** — the proof `/teardown` sends every cold visitor to | yes |
| `/s/[token]` | **The delivered Sheet** — the one artefact a real prospect receives | **no** |
| `/ops` | Operator console — queue, clients, deals, roster | **no** |
| `/t` | Talent portal — a provider's own bookings, by passcode | **no** |
| `/doc/proposal/[id]`, `/doc/invoice/[talentId]` | Print-only documents, no PDF library — see `CLAUDE.md` | **no** |
| `/api/health` | Firestore + Meta token self-check, unauthenticated | — |
| `/api/cron/read` | The read sweeper Cloud Scheduler calls; `x-pravda-cron` gated | — |

`/s`, `/ops`, `/t` and `/doc` carry `noindex, nofollow, nocache`, are absent
from the sitemap, and are disallowed in `robots.txt` (`app/robots.ts`) — each
is either per-recipient or operator/provider-only and must never surface in
search. `/specimen` is the deliberate exception: it is the one artefact meant
to be found by a stranger, so it is in both the sitemap and the routes above
that are indexed.

There used to be two delivery surfaces, `/r/[token]` (a long-form report) and
`/p/[token]` (its one-screen preview), each with its own renderer. Both are
**deleted**, not redirected — see `CLAUDE.md`'s "The one artefact" section for
why, and do not resurrect either for a one-off case.

`sitemap.xml`, `robots.txt`, `icon.svg`, an error boundary and a skeleton
loading state are all generated.

## How a lead flows

1. **Intake** — a stranger types an Instagram handle into `/{lang}/teardown`.
   `POST /api/lead` writes a `Client` (`openClient`) before anything is read,
   so a Meta outage never loses a lead, and tells Khaled *before* responding —
   the notice is more time-critical than the read itself.
2. **Queue** — the read is claimed, not just started (`claimForRead`, a
   Firestore transaction). The fast path runs inline via `after()`; if that
   instance dies mid-read, `GET /api/cron/read` (Cloud Scheduler, once a
   minute) sweeps anything left in `new` or a `reading` state whose lease
   expired, up to three attempts before a client is marked `failed`.
3. **Sheet** — `lib/teardown/run.ts` composes a `Sheet`: signals, findings,
   recommended concepts, a vertical guess. Nothing in it is invented — see
   "Only what we can prove" in `CLAUDE.md`.
4. **Approve** — an operator reviews the sheet at `/ops`, casts real talent
   against it (never a placeholder), and approves it. Approving mints a share
   link; it does **not** by itself tell the client anything.
5. **Send** — `compose-share` hands the operator the Arabic message and a
   `wa.me` link; `mark-share-sent` is the separate, human-confirmed act that
   actually advances the client to `sent`. Two steps on purpose: opening
   WhatsApp is not sending.
6. **Win** — the client opens `/s/[token]`, and if they say yes, the sheet
   converts into a `Deal`.
7. **Bookings** — real talent are offered days against the deal
   (`POST /api/ops/booking`), each a `Booking` that never carries what the
   client paid — the connector invariant in `CLAUDE.md`.
8. **Portal** — a talent signs into `/t` with their own passcode to accept or
   decline, set availability, and see their own upcoming days.
9. **Documents** — `/doc/proposal/[id]` and `/doc/invoice/[talentId]` are
   print stylesheets a human opens and prints/saves as PDF from the browser;
   there is no server-side PDF generation anywhere in this codebase.

### The entity block

The registered name, CR number, street address and phone appear in the footer of
every page **and in the final scene of the homepage flight**, which has no
footer. That is not decoration: Meta Business Verification requires them on the
site, and a cold visitor checking whether PRAVDA is real looks for exactly those
four things. They live in `lib/data/company.ts` — one source of truth.

Locale is a URL segment, so `lang` and `dir` are set **server-side** on `<html>`.
No hydration flash, correct for crawlers, correct with JS disabled.

## The homepage is a flight

`/ar` and `/en` are not a scrolling page. The document never scrolls —
`overflow` is fixed and wheel/touch/keyboard input is integrated into a single
normalised `progress` value (0..1). That one value drives **both** the camera
and the type, so they can never drift apart.

- `components/webgl/Terrain.tsx` — a 300 × 400 point corridor (120k points)
  displaced by three octaves plus a drifting ridge, wrapped modulo its own
  depth so the field is infinite. One draw call.

  Four things decide whether this reads as elegant or cheap, and the first
  version got all four wrong:

  1. **Point size.** The ceiling is ~4px at dpr 2. At 13px — which is what
     `mix(1.0, 5.2, vFog)` produced — points read as beads, not grains of
     light, and crowded areas clip to white.
  2. **Jitter.** A perfect lattice seen in perspective produces moiré arcs
     across the near field. Every point carries ±1.25 × spacing of random
     offset in X and Z.
  3. **Depth cue in both directions.** Far points fade into the ground; points
     very close to the camera must fade *too*, or perspective balloons them.
     `vFog = far * near`.
  4. **Low alpha.** Additive blending accumulates, so density does the work.
     Base alpha is 0.17–0.57, not near-opaque.

  A third of the field is a finer, dimmer *dust* tier sitting slightly lower,
  which gives texture between the structural points. Colour cools with
  distance as well as darkening.

- **The field resolves into objects.** Every point carries a second address —
  `aTarget` — and `uMorph` blends between the terrain and a form. The field
  disperses while travelling between sections and resolves once it settles, so
  raw material becomes a thing at each moment of the story. That is the
  business, stated in the medium.

  The forms are the instruments of the work, one per scene: the phone under
  review, a model at the mark, the slate, the cinema camera, a voice waveform,
  the send. They live in `lib/forms3d.ts` as a handful of Three.js primitives
  each — nothing is loaded — sampled across their surface with
  `MeshSurfaceSampler`, normals included. `lib/forms.ts` maps scenes to forms
  and keeps the earlier drawn diagrams, which drop back in through the same
  `FormSpec` type. `aTarget` is object-local: the shader scales it, turns it
  under the pointer (`uSpin`), and sets it down at `uFormPos`, so the object
  revolves without the attribute being rewritten.

  Four things decide whether a point-cloud object reads or turns to fog:

  1. **Edges, not panels.** A flat face is noise in a point cloud; its outline
     is the object. Bodies are drawn by their twelve edges (`wireBox`),
     screens and slates by their frames (`frame`), with a faint fill weighted
     at a tenth of the sampling density.
  2. **Rim light, back faces dimmed.** Each point carries its normal. Faces
     seen edge-on go bright, faces square to the eye go thin, and the far side
     drops to a third — so the object has a front, and never burns to white.
  3. **A clearing.** Terrain points under and behind the object go quiet while
     it is resolved, so it is read against dark rather than through whichever
     bright ridge it shares the screen with.
  4. **Its own angle.** Each form carries a resting yaw, pitch, size and lift:
     the camera is met in profile, the plane from above, the waveform wide.
     On portrait screens the object moves below the type and shrinks.

  Easing is against the clock, not the frame: the same settle on a 120Hz
  display and a phone that has dropped to 30.
- `components/Flight.tsx` — virtual scroll, scene envelopes, the HUD.
- **Ripples.** Four round-robin slots, each a wave packet struck on every
  section change. Two things decide whether it reads as a wave or as noise:

  1. **The packet must be wider than its own wavelength.** At 31-unit
     wavelength and a 29-unit envelope either side you see ~1.9 cycles — a
     crest with a trough on each shoulder. Narrower than one cycle and it is
     jitter.
  2. **It must not be outrun.** The camera covers ~107 world units per section
     while the front travels 7 units/second, so a ripple struck at the camera
     is behind you instantly. It is struck **132 units downrange**, roughly
     where the camera will arrive, so you fly into the ring as it opens.

  Tuning lives in `terrain.glsl.ts`: `speed` (7), band tightness (0.034),
  wavelength (0.20), age decay (0.17), and the `ring * 2.15` amplitude.
  The strike position is `originZ` in `Terrain.tsx`.
- `lib/data/scenes.ts` — six scenes, each one figure. Every number is a fact
  about PRAVDA (roster, library, rate card), not market research we did not do.

Two things learned building it, both of which look like bugs if you hit them:

- **Scenes must travel, not crossfade in place.** Two headlines fading through
  each other at the same coordinates reads as a broken render. The outgoing
  scene translates up and away while the incoming rises in.
- **The envelope must be clipped.** A raw `sin()` envelope has long tails, so
  neighbouring scenes stayed partly visible in the gap between their ranges and
  stacked. `clamp(sin(...) * 1.55 - 0.18)` forces a true zero.

### Scroll model — one gesture, one section

The flight advances in discrete sections rather than continuously, because a
hard flick on a trackpad emits dozens of momentum events and a continuous
integrator turns that into three or four skipped sections.

- Wheel/touch deltas accumulate; crossing `THRESHOLD` (70px) commits one step.
- Committing sets `locked`, and **every further event is absorbed entirely** —
  this is what eats trackpad momentum.
- The lock clears only when *both* the 900ms travel has finished *and* input has
  been silent for `QUIET` (260ms). Requiring only the first lets momentum
  immediately commit the next section.
- A failsafe releases the lock unconditionally at `DURATION + 2500ms`. A lock
  that never clears makes the page unscrollable, which is far worse than a
  skipped section.

Keyboard: arrows step, space and PageUp/PageDown jump. Reduced motion or a
device below the capability gate gets `.flat` — the same six scenes as an
ordinary scrolling page.

## The WebGL layer

`components/webgl/Plate.tsx` — one fullscreen triangle, one fragment shader,
one draw call. No scene graph, no loaders, no post-processing stack.

The shader does three things:

- **Registration** — RGB channels arrive ~10px apart and resolve into register
  over 900ms, like ink hitting paper. Mirrored in RTL.
- **Grain** — animated, luminance-weighted so shadows stay clean.
- **Displacement** — pointer-driven, ±1.2%, eased, falls off from centre.

### Why it is safe

- **The poster `<img>` is always the LCP element.** The canvas fades in over it
  only after the texture decodes and the shader compiles.
- **Capability gate** runs before anything is compiled: WebGL2, ≥4GB device
  memory, ≥4 cores, and `prefers-reduced-motion` unset. A device that fails sees
  a correct fast page and nothing that appears then vanishes.
- **Context loss is permanent for the session.** On a 4GB Android with Instagram
  resident, context loss *is* memory pressure — rebuilding under memory pressure
  produces a flicker loop, so we fall back to the poster and never retry.
- **Pauses** on `IntersectionObserver` and `visibilitychange`.
- Named imports only. `import * as THREE` defeats tree-shaking.

### ThreeUI

The hero and teardown fields are ThreeUI's `EmeraldHorizonBackground` and
`RibbonFieldBackground`, wrapped in `components/webgl/Horizon.tsx`.

Three things the wrapper adds, because the library omits them: a capability
gate (so no shader is compiled on a device that would stall), a
`visibilitychange` pause, and `webglcontextlost` handling. ThreeUI does pause
on `IntersectionObserver` already.

Two integration notes worth knowing:

- **`hue` is a CSS `hue-rotate` in degrees, not a shader uniform.** The glow
  colours are hardcoded bright emerald, so a second `saturate()/brightness()`
  filter is composited on the library's own wrapper to bring it to PRAVDA
  petrol.
- **The shader is a horizon** — `smoothstep(0.4, -0.1, st.y)` means it only
  emits light in the bottom 40% of its own frame. The field must therefore end
  where the viewport ends (`height: 100svh`), or the glow renders below the
  fold, and any bottom-weighted scrim will cover the only lit part.

ThreeUI imports `three128` and `three165` internally. `next.config.mjs` aliases
both onto the installed `three` — the API surface its shader components touch
is unchanged in r172. Without the alias the home route ships two runtimes and
weighs 368 kB; with it, 245 kB.

Work images still use the hand-written `Plate`, because no ThreeUI component
accepts a `src` — its entire API is shader knobs.

## Arabic

Four rules enforced globally in `globals.css`, not per-component:

1. `letter-spacing: 0` — tracking shatters cursive joins.
2. No `text-transform` — Arabic has no case.
3. No faux-italic — Arabic has no oblique.
4. Ragged right, never justified — kashida justification is unimplemented in
   every shipping browser.

The Arabic type scale is **forked**, not derived: it shares no size token with
the Latin and sets ~1.35× at 1.85 line-height.

## Budgets

| | Target | Actual |
|---|---|---|
| First Load JS, WebGL routes | ≤250 kB | 245 kB |
| First Load JS, text routes | ≤250 kB | 109–111 kB |
| Shared chunk | — | 105 kB |
| `/s/[token]` | ≤150 kB | — |

`/s/[token]` — where every real prospect's teardown lands, and all cold
traffic that isn't the specimen — is held to the stricter budget the old
`/r` used to carry, and ships **no canvas at all**. `scripts/check-bundle.mjs`
enforces this in CI against `next build`'s own "First Load JS" output.

## Placeholders

`public/plates/*.svg` are generated abstract plates, deliberately not stock
photography. Replace with real work — AVIF, `q=60`, explicit `sizes`.

## Tests

```bash
npm run test:unit    # pure engine — signals, findings, recommend, auth,
                      # msisdn/handle normalisation. node --test, no network,
                      # no Firestore. Fast; run this on every change.
npm run test:itest   # the same code paths against a real Firestore emulator —
                      # queue claiming, status transitions, contact merges,
                      # deals/bookings, the golden sheet snapshot.
npm test             # both, wrapped in `firebase-tools emulators:exec`
```

Itests need a JDK for the Firestore emulator (`firebase-tools` requires 21+).
On macOS, if the emulator refuses to start over a Java version error, point
`JAVA_HOME` at a JDK 21+ before running:

```bash
JAVA_HOME=$(/usr/libexec/java_home -v 21) npm test
```

`npx tsc --noEmit`, `npm run lint` (`next lint`) and `npm run lint:eslint`
(ESLint 9's own CLI, same rules via `eslint.config.mjs`) round out what CI
runs on every push — see `.github/workflows/ci.yml`.

## Runbook and the plan

Operational procedures — rotating a secret, reissuing the Meta token,
re-running a stuck read, honouring a PDPL export/delete request, standing up
staging — live in [`docs/RUNBOOK.md`](docs/RUNBOOK.md). Cross-cutting rules
an agent must not violate live in [`CLAUDE.md`](CLAUDE.md). The reconciled
plan across every workstream — the decisions, the unified data model, the
execution waves — is [`docs/plan/MASTER-PLAN.md`](docs/plan/MASTER-PLAN.md);
read it before a change that touches more than one file.
