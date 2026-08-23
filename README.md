# PRAVDA

Production and advertising, Amman. Next.js 15, App Router, bilingual Arabic/English,
hand-written Three.js.

## Run

```bash
npm install
npm run dev     # http://localhost:3000 → redirects to /ar
npm run build
```

## Routes

| Path | |
|---|---|
| `/` | 307 → `/ar` |
| `/ar`, `/en` | Home |
| `/ar/work`, `/en/work` | The archive |
| `/ar/work/[slug]` | One piece |
| `/ar/cast` | Cast & crew — reached only through work |
| `/ar/teardown` | What a Teardown is, and the handle intake |

Locale is a URL segment, so `lang` and `dir` are set **server-side** on `<html>`.
No hydration flash, correct for crawlers, correct with JS disabled.

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
