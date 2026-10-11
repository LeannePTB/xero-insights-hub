# Traction Advisory — official brand and style guide

Website: **www.tractionadvisory.com.au**

## Authoritative web colours

Use the following values supplied from the official sheet's **swatches and logo artwork**, not its faulty printed colour columns.

| Colour | Web HEX | CMYK printed on sheet |
|---|---|---|
| Navy | #082E5E | C80 M100 Y0 K20 |
| Royal blue | #28468E | C65 M70 Y0 K0 |
| Mid blue | #426CB2 | C25 M30 Y65 K0 |
| Blue | #1E90D1 | C0 M0 Y0 K50 |
| Light blue | #4EB4EB | C51 M44 Y44 K7 |
| Black | #080909 | C75 M68 Y67 K90 |
| Wordmark grey | #939598 | Colour logo's TRACTION ADVISORY text |

**Designer correction required:** the printed HEX/RGB column is wrong for four of six rows and includes older-palette leftovers #53318D, #6f60aa, #c5ab71 and #939497. The printed CMYK values also need correction/verification by the designer; they are recorded here as printed, not as valid conversions. The web HEX values above are authoritative. Do not derive web colours from these CMYK entries.

## App roles and accessibility

- Primary: Royal blue. Strong/active states and light-theme headings: Navy.
- Links and focus: Mid blue. Dark small-text links use Light blue because Mid blue fails 4.5:1 on the dark surfaces; focus remains Mid blue and is tested at 3:1.
- Accent: Blue, with near-black text (white and navy fail small-text AA on Blue).
- Highlight: Light blue. Body text: near-black in light mode; light text in dark mode.
- Wordmark grey stays #939598 in artwork. It fails AA on light surfaces, so small muted text uses #62666C in light mode; dark mode retains #AEB6C1 for contrast on muted surfaces.
- Charts, light to dark: #4EB4EB, #1E90D1, #426CB2, #28468E, #082E5E. These are graphical series colours, not text foregrounds. Use accessible labels; adjacent series are not guaranteed 3:1 separation.
- Green means healthy/good; red means genuinely bad; soft blue means information, pending, stale or needs attention. Status thresholds and calculations do not change. No orange, amber or gold.
- CSS stores colours as OKLCH equivalents behind semantic tokens. Print/email presentation mirrors use the authoritative HEX values. UI fonts remain unchanged.

## Logo versions and placement

| Version | Use |
|---|---|
| Colour | Default on light backgrounds |
| White | Dark/navy backgrounds; also use instead of Colour on mid/dark blue |
| Blue | Approved artwork entirely #1E90D1 |
| Blue dark | Approved artwork entirely #082E5E |
| Black | Approved black artwork |
| Grey/black | Monochrome printing |

Use a **circular TA monogram**, containing only the original T and A artwork, for favicon, app icon and collapsed sidebar. Crop from the approved artwork; preserve its aspect ratio. Do not substitute typed letters or recreate the letterforms.

Never recolour a supplied logo, stretch it, add shadows/effects, or place the colour logo on mid/dark blue. Use the supplied White version there. Listed variants describe approved artwork, not permission to recolour a bitmap. Organisation White label and report-logo precedence remain unchanged: primary report logo is organisation logo, then platform logo, then bundled fallback; an entitled client logo is secondary. Finalised/sent PDFs are not regenerated.

## Logo artwork fonts

- TRACTION ADVISORY wordmark: **Gotham Book**, **-50 letter spacing** in the original artwork specification.
- T: **Beyond (Regular)**.
- A: **Blacksword (Regular)**.

These are logo-artwork fonts only. Never use Beyond or Blacksword for UI text, and do not reproduce the wordmark as UI text. UI remains SF Pro Display headings and Inter body, with zero letter spacing.

## UI type scale

| Role | Maximum/default |
|---|---|
| Page titles | ≤18px |
| Section headings | 16px / 14px |
| Body and tables | 12px |
| Helper text | 11px |
| KPI figures | ≤24px |

Existing smaller PDF table/footer text is preserved for pagination/readability; the UI scale is not permission to regenerate immutable reports.