# Client header: view toggle + Refresh figures placement

Classification: NOT security-relevant — presentation only. No access, data, Xero or policy changes.

## What Leanne asked for

Current live-dashboard header buttons (advisor only): `Refresh figures` · `Monthly Management Reports` · `Client Settings`.

- Move `Refresh figures` next to `Client Settings`.
- Make "Monthly management reports" and a NEW "Live Dashboard" button a clearly selectable pair (headings/buttons) so it is obvious which of the two views you are on and how to switch.

## Changes

### 1. Live dashboard header
File: `src/routes/_authenticated/clients.$clientId.index.tsx` (header block ~lines 415–435)

New order, left to right:
1. Segmented toggle: **Live Dashboard** (active/filled) | **Monthly management reports** (outline) — links to `/clients/$clientId/reports`
2. **Client Settings** (outline) — links to `/clients/$clientId/settings`
3. **Refresh figures** (moved here, immediately next to Client Settings)

### 2. Monthly reports page header
File: `src/routes/_authenticated/clients.$clientId.reports.tsx` (header block ~lines 196–208)

- Show the same segmented toggle with **Monthly management reports** active, so switching works both directions.
- Keep the page title and description; keep the existing "Back to dashboard" link only if it does not crowd the header — the toggle replaces its purpose, so remove it when the toggle is present.

### 3. Behaviour
- Active state derives from the current route; no new state, no new routes.
- Same advisor-only gating as today (`isAdvisor`); business owners see what they see now.
- Refresh figures stays on the live dashboard only — reports are point-in-time snapshots and are not refreshed.
- Styling uses existing semantic tokens/Button variants (filled = current view, outline = the other view); no hardcoded colours.

## Verification
- `bunx tsgo --noEmit` clean.
- Playwright screenshots of both headers showing the toggle with the correct active side and Refresh figures beside Client Settings.
