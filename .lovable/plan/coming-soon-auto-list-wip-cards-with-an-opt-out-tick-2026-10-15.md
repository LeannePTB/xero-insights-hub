# Coming soon: auto-list WIP cards (with an opt-out tick)

## Background (verified)

Today "Coming soon" teasers come only from manual rows in `coming_soon_entries`, edited on System Admin → Packages & modules. A card being Work in progress does **not** create a teaser — Rental properties appears only because of a seeded manual entry. WIP cards should be listed automatically, with a tick per card so some can be left out.

Key pieces in place (unchanged by this work):
- `app_private.coming_soon_rows(_firm_id)` builds the teaser list; readers `coming_soon_for_client` / `coming_soon_for_firm` are practice-only (aal2), and the row already shows "You have early access" when the organisation holds a live early-access grant for the linked card.
- `register_coming_soon_interest` currently only accepts keys that exist in `coming_soon_entries`.
- The Packages page loads the full catalogue including WIP cards, and the Cards table already has a Status dropdown saved via an audited super-admin function.

## What changes

1. **Automatic teasers for WIP cards.** Every card with status `wip` becomes a Coming soon teaser using its catalogue name and description — no manual entry needed. If the organisation has a live early-access grant for that card, the tile shows "You have early access" exactly as manual linked entries do.
2. **Opt-out tick per card.** New checkbox in the Packages → Cards table, shown on Work in progress rows: "Coming soon" (ticked by default = auto-listed). Unticking hides the card from Coming soon while it stays WIP; ticking again restores it. Saved through a new audited super-admin database function (aal2, caller guard, audit-log entry), matching the existing `admin_set_card_status` pattern.
3. **Manual entries keep winning.** If a manual entry already points at a WIP card, the manual wording is shown and no duplicate auto tile appears. When the card becomes Available, its auto teaser disappears immediately and any manual entry hides via the existing "still coming" rule. Retired cards (e.g. Business health) are never listed.
4. **"I'm interested" works on auto teasers.** The interest recorder is extended to accept auto entries (keyed `auto_<card_key>`), with the same practice-only gate, 3-per-hour limit and audit write as today. Auto entries carry the card's Advisory module where one exists, so Enquiries filtering keeps working.
5. **Admin visibility.** The Coming soon section on Packages & modules shows the auto-listed WIP cards as read-only rows labelled "Automatic — untick Coming soon on the card to hide", above the manual entries. Public website output is unchanged: auto teasers are app-only; the website still shows only manually website-ticked entries.

## Technical detail

- Migration `0056_coming_soon_auto_wip.sql`:
  - `ALTER TABLE public.card_catalogue ADD COLUMN hide_from_coming_soon boolean NOT NULL DEFAULT false;`
  - Rewrite `app_private.coming_soon_rows(_firm_id)` as a UNION: manual entries (as today) plus auto rows — `card_catalogue` where `status = 'wip' AND NOT hide_from_coming_soon` and no shown manual entry links that `card_key`; `entry_key = 'auto_' || card_key`; early-access check keyed on the card.
  - Extend `public.register_coming_soon_interest` to resolve `_entry_key` from either `coming_soon_entries` or the auto WIP set (card must be wip, not hidden); otherwise identical.
  - New `public.admin_set_card_coming_soon(_card_key text, _hidden boolean)`: `assert_super_admin()`, validates the card exists, updates the column, writes `card_catalogue_changed` audit meta; REVOKE from PUBLIC/anon, GRANT to authenticated.
- `src/lib/cards/catalogue.ts`: map the new column into `CatalogueCard` (`comingSoon?: boolean`).
- `src/lib/coming-soon.functions.ts`: new `setCardComingSoon` server function wrapper (requireAal2, zod-validated) calling the new RPC.
- `src/routes/_authenticated/system.packages.tsx`: Coming soon checkbox on WIP card rows (disabled for Available/retired), plus read-only auto rows in `src/components/admin/ComingSoonAdmin.tsx` derived from the catalogue the page already loads.
- Dashboard `ComingSoonRow`, Upgrade page and public website components need no change — rows flow through the existing readers.

## Checks

- Tests: auto WIP card appears for practice users; opt-out tick removes it; manual entry overrides auto (no duplicate); card becomes Available → auto teaser gone; retired card never listed; Business Owner / Viewer get no teasers; interest can be recorded on an auto entry (rate limit intact); non-super-admin cannot change the tick.
- Access-matrix rows for the new function and column; security snapshots and registers refreshed.
- `bun run security:check`, full test suite, build; confirm the Security page shows no new findings from the new definer function.
