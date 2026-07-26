## Goal

The main `/dashboard` is a **firm subscription overview** — one card per firm the user belongs to, showing plan/status/usage/renewal only. Clients live inside the firm (existing `/firms/$firmId` page, which already shows the Client / Plan / Due Date / Status / Tiers table).

## Changes

### `src/routes/_authenticated/dashboard.tsx`
Replace the current firm grid (which mixes plan chips with client counts and is easy to confuse with a client list) with a focused **Subscription** panel per firm:

- Title: "Your subscription" (single firm) or "Your firms" (multiple).
- One card per firm with:
  - Firm name + "Always free" badge if applicable.
  - Plan label (Starter / Growth / Scale / Firm / Legacy / Free) via `TIER_LABEL`.
  - Status pill (Active / Trialing / Past due / Canceled / No billing) via `firmPlanView`.
  - Client usage: `3 / 5 clients` with a thin progress bar.
  - Renewal / trial end date, or "—" when none.
  - Primary action: **Open clients →** navigates to `/firms/$firmId`.
  - Secondary action (super-admin only): **Manage** → `/admin/firms/$firmId`.
- No client rows, no health badges, no "New client" button on this page. Client management stays on the firm page.

If the user belongs to a single firm, render it as one wide card; multiple firms render as a responsive grid.

### `src/routes/_authenticated/firms.$firmId.tsx`
No behavioural change — this already is the "Positive Traction Clients" page shown in the screenshot. Confirm the "New client" button and subscription header stay here (they do).

### Nothing else
- No schema changes.
- No changes to `listMyFirms` — it already returns plan / status / usage / renewal.
- No changes to admin pages, health widgets, or Stripe wiring.

## Out of scope

- Re-enabling Stripe checkout / portal buttons (still paused per earlier request).
- Adding a firm switcher in the header — the dashboard card itself is the switcher.
