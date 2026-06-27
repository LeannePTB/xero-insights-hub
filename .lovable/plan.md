## Pin Business Health + Notes, group Standard tier widgets

### 1. Pin the top two cards (non-draggable)

In `src/routes/_authenticated/clients.$clientId.index.tsx`:
- Render **Business Health** (full width) and **Notes** (full width) directly above the `SortableCardGrid`, not inside it. Order: Business Health → Notes.
- Remove `health` and `notes` from the `cards` array passed to `SortableCardGrid` so they can't be reordered or hidden by saved layout.
- Strip any stale `health` / `notes` ids out of `savedOrder` before passing it down (one-time cleanup so old saved layouts don't leave gaps).

In `src/components/dashboard/SortableCardGrid.tsx`: no change needed — it only renders what it's given.

### 2. Group Standard-tier widgets visually

Standard tier = `health`, `receivables`, `payables`, `pnl`, `unreconciled`. Health is already pinned at top, so the grouped block under Notes is:

```text
[ Receivables ] [ Payables ]
[ P&L         ] [ Unreconciled ]
```

Approach: render a dedicated "Standard" section with its own heading + 2-col grid for the Standard cards (still draggable within the section), then render the remaining tier-upgrade cards (Tax, Super, Breakeven) below in a second "Advisory / Investigate" section via a second `SortableCardGrid`.

- Split `cards` into two arrays: `standardCards` (receivables, payables, pnl, unreconciled per org) and `advancedCards` (tax_liability, superannuation, breakeven per org).
- Render two `<section>` blocks each with a small heading ("Standard dashboard" / "Advisory") and its own `SortableCardGrid`.
- Persist order per section: extend `dashboard_card_order` usage to store two keys (`standard` + `advanced`) under the same row, or save a single combined order and split on read. Simplest: keep one saved order array, filter it per section when passing to each grid, and merge back on save.

### 3. Acceptance

- Business Health and Notes always appear at top, in that order, with no drag handle.
- Standard widgets sit together in their own labeled group; tax/super/breakeven sit in a second labeled group.
- Drag/reorder still works inside each group and persists.
- No leftover empty slot where Notes/Health used to be in saved layouts.

Confirm and I'll build it.
