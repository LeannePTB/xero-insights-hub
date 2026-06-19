## Plan: Hero background image on landing page

**Goal:** Replace the flat purple gradient behind the hero in `src/routes/index.tsx` with a cinematic construction-site photo, with the brand purple gradient overlaid for legibility.

### Steps

1. **Generate the image** (`imagegen` standard quality, 1920×1024, JPG)
   - Path: `src/assets/hero-construction.jpg`
   - Prompt: cinematic wide shot of an Australian residential construction site at golden hour — builders in hi-vis and hard hats framing a timber-framed home, scaffolding, ute in background. Shallow depth of field, warm natural light, photoreal, editorial quality. Composition leaves the left third darker/cleaner for headline overlay.

2. **Wire it into the hero** in `src/routes/index.tsx`
   - Import the JPG.
   - In the `Hero` section, add an `<img>` layer as the bottom of the stack (`-z-20`, `object-cover`, `absolute inset-0`), with `alt="Builders on an Australian construction site"`.
   - Keep the existing `--gradient-hero` layer (`-z-10`) but reduce opacity to ~75% and add a left-to-right dark gradient overlay so the white headline stays readable.
   - Tighten bottom fade to background so the section blends into `BuiltFor`.

3. **No copy/layout changes** — headline, subhead, CTAs, checklist all stay as-is.

### Technical notes
- Image stays in `src/assets/` (not externalized to CDN) — single hero, imported as a module so Vite hashes & optimises it.
- Tailwind only; no new tokens. Reuses existing `--gradient-hero`.
- Accessible `alt` text; image is decorative-supportive, not the sole carrier of meaning.

### Out of scope
- No other section changes (Features, Pricing, etc.)
- No new fonts/colors
- No copy edits