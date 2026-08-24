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

Every page exists in both locales. `/ar` is canonical.

| Path | | Indexed |
|---|---|---|
| `/` | 307 → `/ar` | — |
| `/{lang}` | Home — the flight | yes |
| `/{lang}/work` | The archive | yes |
| `/{lang}/work/[slug]` | One piece | yes |
| `/{lang}/cast` | Cast & crew — reached only through work | yes |
| `/{lang}/teardown` | What a Teardown is, and the handle intake | yes |
| `/{lang}/teardown/sample` | A complete specimen teardown | yes |
| `/{lang}/studio` | Founders and the entity block | yes |
| `/{lang}/pricing` | Published rates | yes |
| `/{lang}/privacy` | Privacy | yes |
| `/{lang}/notice` | PDPL Article 9 processing notice | yes |
| `/{lang}/terms` | Terms | yes |
| `/{lang}/data` | The six data rights and how to exercise them | yes |
| `/{lang}/instagram-professional` | Helper for the ~1/3 of accounts that are personal | yes |
| `/r/[token]` | **A delivered Teardown** | **no** |
| `/p/[token]` | **The one-screen preview sent in the DM** | **no** |

`/r` and `/p` are per-recipient. They carry `noindex, nofollow, nocache`, are
absent from the sitemap, and are disallowed in `robots.txt` — a teardown is
written for one business and must never surface in search.

`sitemap.xml`, `robots.txt`, `icon.svg`, an error boundary and a skeleton
loading state are all generated.

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

- `components/webgl/Terrain.tsx` — a 190 × 260 point corridor displaced into
  dunes by two octaves of value noise, wrapped modulo its own depth so the
  field is infinite. Additive blending, ridges catch brass, a minority of
  points twinkle. One draw call.
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

`/r/{token}` — the Teardown, where all cold traffic lands — is held to a
stricter ≤150 kB and carries **no canvas at all**.

## Placeholders

`public/plates/*.svg` are generated abstract plates, deliberately not stock
photography. Replace with real work — AVIF, `q=60`, explicit `sizes`.
