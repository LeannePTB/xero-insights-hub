## Goal

Make the tier configuration UI reflect exactly the widgets that actually render on the client dashboard, add a new Health placeholder card, and pin the Standard-tier widgets into the order you described.

## Tier widget list — sync with dashboard

Current tier list (`src/lib/tiers.ts`): `revenue_kpis, tax_liability, pnl, breakeven, payables, receivables`.

What the dashboard actually renders today: Notes, Unreconciled, Tax Liabilities, Superannuation, P&L, Breakeven, Aged Payables, Aged Receivables.

Changes to `WidgetKey` / `ALL_WIDGETS` / `WIDGET_LABEL` / `DEFAULT_TIER_WIDGETS`:

- Remove `revenue_kpis` (widget was deleted).
- Add `health` (new placeholder, full-width).
- Add `superannuation` (currently piggy-backs on `tax_liability`; split so it can be toggled per tier).
- Add `unreconciled` (already on every dashboard; expose so tiers can hide it).
- Keep Notes always-on and out of the tier list (it's not Xero-driven and is already shown for every client).

New default per tier:

- Standard: health, receivables, payables, pnl, unreconciled
- Advisory: + tax_liability, superannuation, breakeven
- Investigate the Numbers: all of the above
- Multi company: all of the above

A migration prunes `revenue_kpis` from `tier_widget_config` rows so the saved configs don't keep a dead key. New keys default to off in DB; the tier settings page will show them unticked until you tick them.

## Standard dashboard order

After Notes, the Standard tier renders (per Xero org):

```text
[ Notes (full width) ]
[ Health placeholder (full width) ]
[ Aged Receivables ] [ Aged Payables ]
[ Profit & Loss   ] [ (empty / next card) ]
[ Unreconciled (full width) ]
```

Implementation in `src/routes/_authenticated/clients.$clientId.index.tsx`:

- Build `cards` in the new order: notes → health → receivables → payables → pnl → tax → super → breakeven → unreconciled.
- Card order remains user-draggable; the new order is just the default when no saved order exists.
- Update the merge in `SortableCardGrid` so unknown saved IDs (e.g. old `revenue_kpis`) are dropped and new IDs (`health`) appear in their default slot rather than tacked on at the end.

## Health placeholder widget

New `src/components/dashboard/HealthWidget.tsx`:

- Full-width card titled "Business health".
- Body: "Coming soon — composite health score across cash, profitability, and obligations."
- Same card shell / BasisBadge slot as other widgets so it visually fits.
- No data fetching; pure placeholder.

Wired into the dashboard for any tier that includes `health` (Standard and above by default).

## Tier settings page

`src/routes/_authenticated/settings.tiers.tsx` already iterates `ALL_WIDGETS` and `WIDGET_LABEL`, so the new keys appear automatically with labels:

- Business Health
- Superannuation Liabilities
- Unreconciled Transactions

The removed `Revenue & Expenses` row disappears.

## Technical notes

- Files touched: `src/lib/tiers.ts`, `src/routes/_authenticated/clients.$clientId.index.tsx`, `src/components/dashboard/SortableCardGrid.tsx` (default-order merge only), new `src/components/dashboard/HealthWidget.tsx`.
- Migration: `DELETE FROM tier_widget_config WHERE widget_key = 'revenue_kpis';` plus an UPDATE to remove that key from any JSON arrays if it's stored that way (will confirm shape with `supabase--read_query` before running).
- No changes to data-fetching widgets' internals.
- Drag-to-reorder still works and is still saved per user/client.

## Out of scope

- Building real Health-score logic.
- Re-introducing a Revenue & Expenses card.
- Locking the order (still user-draggable).
