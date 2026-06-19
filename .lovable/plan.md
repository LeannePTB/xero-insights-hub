## Goal
Force every dashboard widget to use **Accrual** basis, remove the user-facing controls that let advisors switch it, and surface a small note on the client dashboard so users know.

## Changes

### 1. Client settings page (`src/routes/_authenticated/clients.$clientId.settings.tsx`)
- Remove the entire "Report basis" `<Section>` (the Accrual/Cash dropdown and its mutation wiring).
- Remove the now-unused `basisMut` mutation and related imports if they become orphaned.

### 2. Widgets — remove per-card basis switcher
In each of these files, remove the `<BasisSelect>` control from the card header, drop the `basis` state, and hard-code `basis: "accrual"` in the query call + key:
- `src/components/dashboard/PnlWidget.tsx`
- `src/components/dashboard/BreakevenWidget.tsx`
- `src/components/dashboard/RevenueExpenseKpis.tsx`

Also drop the `defaultBasis` prop from each widget's signature.

### 3. Client dashboard (`src/routes/_authenticated/clients.$clientId.index.tsx`)
- Stop passing `defaultBasis` to the widgets (and remove the `defaultBasis` calculation).
- Under the client name / tier line, add a small muted line:
  > "All dashboards report on an **Accrual** basis unless noted on the card."

### 4. Leave alone
- `BasisSelect.tsx` component file — keep for now (unused, but harmless); can be deleted later if no callers remain.
- Database `clients.report_basis` column — not changed. The server (`xero/access.server.ts`) currently reads it; that still works but will be ignored by the UI. No migration needed.
- Receivables / Payables widgets — already invoice-based, not touched.

## Technical notes
- No database migration.
- The hard-coded `"accrual"` keeps the existing server `fetchPnl` contract unchanged.
- The dashboard note uses existing `text-muted-foreground` styling to match the tier/orgs subtitle.
