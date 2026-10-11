# Official brand update — changes and verification

Presentation only, plus the expressly requested knowledge content seed. No policies, grants, entitlements, financial data, server functions or access predicates changed.

## Exact token differences

Unlisted tokens retain the same rendered colours. CSS was normalised to OKLCH; the table shows exact rounded sRGB HEX equivalents.

| Mode | Token | Before | After |
|---|---|---|---|
| :root | `brand-navy` | #002A5F | #082E5E |
| :root | `brand-royal` | #054492 | #28468E |
| :root | `brand-blue` | #005CAB | #1E90D1 |
| :root | `brand-mid` | #1D6CB5 | #426CB2 |
| :root | `brand-sky` | #0091D5 | #1E90D1 |
| :root | `brand-cyan` | #00B5EE | #4EB4EB |
| :root | `brand-black` | (new) | #080909 |
| :root | `primary-strong` | (new) | #082E5E |
| :root | `highlight` | (new) | #4EB4EB |
| :root | `xero-foreground` | #002A5F | #082E5E |
| :root | `sidebar-foreground` | #002A5F | #082E5E |
| :root | `sidebar-accent` | #054492 | #082E5E |
| :root | `foreground` | #002A5F | #080909 |
| :root | `card-foreground` | #002A5F | #080909 |
| :root | `popover-foreground` | #002A5F | #080909 |
| :root | `primary` | #054492 | #28468E |
| :root | `emphasis` | #054492 | #082E5E |
| :root | `secondary-foreground` | #002A5F | #082E5E |
| :root | `accent` | #00B5EE | #1E90D1 |
| :root | `accent-foreground` | #002A5F | #080909 |
| :root | `info` | #17669A | #28468E |
| :root | `info-surface` | #E3F3FC | #E8F4FC |
| :root | `ring` | #005CAB | #426CB2 |
| :root | `link` | #005CAB | #426CB2 |
| .dark | `sidebar-accent` | #054492 | #082E5E |
| .dark | `primary` | #054492 | #28468E |
| .dark | `emphasis` | #85CFF5 | #4EB4EB |
| .dark | `accent` | #00B5EE | #1E90D1 |
| .dark | `accent-foreground` | #002A5F | #080909 |
| .dark | `lavender` | #1D6CB5 | #426CB2 |
| .dark | `info` | #85CFF5 | #4EB4EB |
| .dark | `info-foreground` | #002A5F | #080909 |
| .dark | `ring` | #0091D5 | #4EB4EB |
| .dark | `link` | #85CFF5 | #4EB4EB |

Inherited/aliased colours in both modes also change: chart-1 #00B5EE → #4EB4EB; chart-2 #0091D5 → #1E90D1; chart-3 #1D6CB5 → #426CB2; chart-4 #054492 → #28468E; chart-5 #002A5F → #082E5E. Chart-6 remains wordmark grey #939598. Gradient hero inherits Navy/Royal changes. Tailwind aliases inherit their matching semantic token changes. presentation-tokens.ts mirrors Navy, primary, link, mid, sky, cyan, body text and info surface; Trixie's SVG uses the matching updated blues.

## Contrast fixes

- Artwork grey #939598 is about 3:1 on white, unsuitable for small text. Preserve it in artwork; retain accessible muted UI companions #62666C (light) and #AEB6C1 (dark).
- Accent Blue #1E90D1 needs near-black #080909 text: white and Navy both fail 4.5:1.
- Mid blue focus on dark muted #223044 is 2.55:1, below non-text AA (3:1). Dark focus and links therefore use Light blue #4EB4EB; light mode uses Mid blue.
- Semantic green/red statuses remain unchanged; informational blue/surface are retuned. Chart series are not claimed to achieve 3:1 between every adjacent series; labels remain necessary.

## Artwork and presentation

- Circular T+A crop from the existing publicly configured platform logo; aspect ratio and original artwork colours preserved. Added public/app-icon.png; replaced public/favicon.png; collapsed sidebar uses src/assets/traction-ta-monogram.png. White-label favicon override remains honoured.
- Existing configured logo still contains the older raster blues. It has NOT been recoloured: the brand rules prohibit that. Upload designer-supplied official Colour/White artwork in platform branding to replace it. No official White asset is currently configured; dark surfaces show a readable name fallback rather than putting the Colour logo on dark blue. Approved single-colour versions were documented, not fabricated.
- UI fonts and compact type scale retained. Heading colour now follows emphasis (Navy in light mode, Light blue in dark mode); default buttons use Navy active states.

## Knowledge article

“Traction Advisory brand and style guide” inserted ACTIVE twice because the table accepts one audience per row: staff and platform. Tags: brand, style, logo, colours. The insert-only seed preserves owner edits and atomically adds matching audit entries. Database readback confirmed both articles and two audit rows. No prompts or client data accessed. Live answer citations were not tested.

## Verification

- Full security:check: PASS; 194 tests (including 62 contrast tests), 18 live access checks passed, zero failed/inconclusive.
- Application tests: 164 passed, zero failed.
- Typecheck/tsgo and build are automatic harness checks; no manual run or successful result is claimed here. Check the final harness status before publishing.
