# PRAVDA UI/UX + Motion Audit

Audit date: 2026-08-25  
Scope: `/en` and `/ar`, desktop and phone-width review, current source implementation, and external motion references.

## Executive conclusion

The homepage has a clear point of view: it treats the site as a material field that moves, resolves, and tells a story. The interior pages do not inherit that idea. They mostly use three generic reveal effects — `fade`, `riseIn`, and `wipeIn` — so Work, Studio, Pricing, and the lower Teardown content feel like static layouts with animation added on top.

The strongest direction is not to make every page as intense as Home. It is to give the whole site one motion grammar, then vary the choreography by content type:

- Home: continuous flight and morphing material.
- Work: image-led editorial travel through the archive.
- Cast: a deliberate, tactile roster experience with real human presence.
- Studio: a slower “meet the people behind the work” reveal.
- Pricing: calm comparison and number-led emphasis.
- Teardown: a guided investigation from field to intake.

## What is already working

- Home has the most coherent relationship between content and motion. The terrain, morphing forms, moving type, and progress HUD all share the same section model.
- The dark forest/oak palette is distinctive and works especially well when the WebGL field is restrained behind the typography.
- Typography creates a strong editorial identity without needing decorative UI.
- The pages are bilingual and the direction-aware rules are thoughtfully handled.
- Reduced-motion fallbacks exist for both Home and Cast. That is important because the site currently uses gesture interception.
- The Work rows have a good structural foundation: numbered media, metadata, concept, cast, and a measurable result.

## Main UX problems

### 1. The interior pages feel like one template

Work, Studio, and Pricing all open with the same giant heading, right-aligned paragraph, large pause, then content. The consistency is visually clean but narratively flat. The user does not get a reason to keep moving beyond the browser scrollbar.

Recommendation: keep the shared masthead and typographic system, but give each route a distinct opening behavior and a persistent route-specific progress cue.

### 2. Motion is mostly entrance animation, not interaction

The interior system is primarily viewport-triggered opacity, translate, and clip-path. That produces “things arriving” but not “a page responding.” The difference is why Home feels alive and the rest feels decorated.

Recommendation: make scroll position affect at least one meaningful property per section — image crop, material density, rule length, number scale, type offset, or color temperature. Keep the movement subtle and purposeful.

### 3. There is no transition between routes

Clicking from Work to a piece, or from Cast to Work, replaces the whole page without a shared handoff. The fixed masthead persists, but the content does not feel like it has traveled anywhere.

Recommendation: add a short route transition using the existing oak/forest palette: outgoing page compresses into a vertical rule or image strip; incoming page expands from that same edge. Keep it under 500ms and make it skippable by reduced-motion settings.

### 4. The site hides too much structure on small screens

At phone width the masthead collapses to the current compact action — normally “Teardown.” This is clean, but the other sections become invisible unless the user already knows the site. A small menu trigger or bottom sheet would preserve the visual restraint while making the information architecture discoverable.

### 5. Some pages spend too long before delivering content

The large top whitespace is intentional, but on mobile the first meaningful Work image arrives late and the Cast intro occupies most of the screen before the user reaches a person. The first screen should establish the page and reveal the first useful object sooner.

## Route-by-route audit

### Work

Current strengths: strong archive structure, useful metrics, clear metadata, and good media/text alternation.

Current weakness: every row uses essentially the same reveal rhythm. The plate appears, then the body rises. After the first row, the pattern is predictable and the archive becomes a long list.

Recommended motion:

- Let each plate enter with a restrained crop reveal plus a very slow image-scale correction.
- Offset the metadata, title, and metric by a small stagger, not a repeated full-block rise.
- Use scroll position to shift the plate crop by 2–4% and the oversized row number by 1–2%; this will create depth without turning the archive into a gimmick.
- On hover/focus, expose a short “piece card” state: plate sharpens, metric brightens, arrow travels, and the title shifts a few pixels.
- On the piece detail page, transition from the clicked archive plate into the detail plate so the user understands the relationship.

### Cast

Current strengths: it has a distinct interaction model, filters, a progress HUD, and a clear premise that people are reached through work.

Current weakness: the full-screen wheel/touch hijack is too rigid for a directory-like task. The first transition visibly shows the old Cast title underneath the arriving name before it settles. The page also calls itself Cast but currently shows abstract work plates instead of people, so the promise and the visual evidence are misaligned.

Recommended direction: keep Cast as the one page with a more cinematic interaction, but make it feel like a tactile roster rather than a slide deck.

- Replace the hard screen cut with a layered “contact sheet” interaction: the current person slides into a side rail while the next person’s image expands into the main frame.
- Let wheel/touch progress the current scene continuously, with snap only near the next person. Preserve keyboard and a visible next/previous control.
- Use the work plate as a temporary bridge only. As soon as portraits exist, the image should be a portrait or a short portrait loop; the linked work plate can appear as a secondary proof card.
- Keep the discipline filter persistent, but animate the filter state with a small count transition and a re-indexed progress indicator.
- Add a visible “View the work” action in the person frame and make the image itself a link. Cast should naturally send people into Work.
- Avoid showing two full text layers at once during the cut. Use a mask or a shared text baseline so the old name leaves before the new name resolves.
- On phone, use normal vertical scroll with sticky media and a compact person rail. A gesture-controlled full-screen stage should remain optional, not the only reading mode.

### Studio

Current strengths: the copy is direct and credible; the founders/company distinction is clear.

Current weakness: the reserved initial plates read as placeholders, even though the copy tries to frame them as intentional. The two founder entries also arrive with the same generic rise animation.

Recommended motion:

- Turn each founder frame into a slow editorial reveal: frame line draws, initial/portrait resolves, then name and role lock to the frame.
- Use a slightly different reveal direction for Ali and Khaled to establish two people rather than two repeated cards.
- When the company block enters, let the founder frames recede into a quieter tint so the legal/entity information feels like the operational foundation of the studio.

### Pricing

Current strengths: transparent rates, simple comparison grid, clear inclusions.

Current weakness: pricing is the least expressive page. The three rates are static equal-weight cells, even though the free teardown is the primary conversion path.

Recommended motion:

- Reveal the three cards as a single measuring instrument: rule draws across, then each price resolves in sequence.
- Give the free teardown a slightly different oak signal and a persistent CTA path.
- Keep prices stable; animate only the supporting rule, unit, and explanatory copy. A count-up would feel generic and less trustworthy here.
- On mobile, reveal one rate at a time with a clear active state instead of making the user parse a tall stack of identical boxes.

### Teardown

Current strengths: the ribbon field makes this the best interior page, and the promise is immediately understandable.

Current weakness: the hero has a strong field, but the evidence rows below return to the generic `riseIn` treatment. The page changes motion language at the exact point where it should explain the investigation.

Recommended motion:

- Let the hero ribbon continue as a thin visual thread into the evidence list.
- As each evidence row enters, animate a small “finding mark” or data trace rather than only moving the row upward.
- Tie the handle intake to the field: entering a handle could gently increase field density or shift the horizon, then resolve into a calm confirmation state.
- Preserve the clear form and short path to the specimen; motion must not delay the CTA.

## Proposed shared motion system

Use four levels rather than one animation class for everything:

1. **Page arrival** — a short route transition shared across the site, 300–500ms.
2. **Section reveal** — opacity plus 8–20px movement, staggered by semantic hierarchy.
3. **Material response** — scroll-linked crop, scale, rule, grain, or field behavior. This is what interior pages are missing.
4. **Interaction response** — hover, focus, filter, and CTA feedback, all under 280ms.

Motion rules:

- Animate `transform` and `opacity` first; reserve `clip-path` for deliberate image/mask moments.
- Do not animate every child. Reveal the section’s image, headline, and one supporting signal; let the rest be immediately readable.
- Keep text readable throughout the scroll. Never rely on opacity as the only way content becomes discoverable.
- Use a single transition vocabulary: travel, resolve, register, draw, and settle.
- Keep Home’s one-gesture model exclusive to Home or make it an explicit optional mode.
- Test every motion state at 390px width, in Arabic RTL, with keyboard navigation, and with reduced motion.

## Priority order

### P0 — fix experience quality first

- Remove the visible Cast text overlap during transitions.
- Add an accessible mobile navigation control instead of hiding the site map behind one compact link.
- Rework Cast input behavior so normal scroll, touch, and keyboard navigation remain predictable.
- Add route transitions that preserve the current visual language.

### P1 — give every interior route a reason to move

- Build a small shared scroll-motion controller with route-specific presets.
- Redesign Work rows around image travel and clicked-image continuity.
- Give Teardown’s evidence section a motion continuation from the hero field.

### P2 — make the content more convincing

- Replace Cast placeholder plates with real portraits or intentional portrait crops from the work.
- Refine Studio founder frames into a deliberate identity reveal.
- Make Pricing’s free teardown path visually primary without adding salesy decoration.

## Reference inspiration

- [Locomotive — Lightship case study](https://locomotive.ca/en/work/lightship-1): the useful lesson is not “add more scroll.” Locomotive explicitly describes evolving a scroll-heavy experience into a structured, product-driven journey with progressive disclosure and interactive elements that clarify the product. That is the right model for Pravda’s interior pages.
- [Explore with Locomotive](https://explore.locomotive.ca/en): a strong reference for a scroll-led archive where chapters, images, geography, and navigation are one system rather than isolated effects.
- [Active Theory — Creative Digital Experiences](https://v5.activetheory.net/): useful inspiration for treating motion as an integrated design/development system and keeping performance and attention to detail part of the creative brief.
- [Studio Freight — Info](https://studiofreight.com/info): useful reference for “brutal elegance” — design the system, copy, and motion together, then remove anything that does not clarify the work.

## Recommended next design direction

Keep Home’s material field as the signature, but make the rest of the site feel like the same material being handled differently. Work should feel like turning contact sheets, Cast should feel like selecting and meeting people, Studio should feel like a slow portrait wall, Pricing should feel like a measuring instrument, and Teardown should feel like the field resolving into evidence.

The goal is not more animation. It is fewer, more specific behaviors that explain what the user is looking at and where they can go next.
