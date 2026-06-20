## Goal

In **Settings → Report basis**, render a list of dashboard cards with a toggle per card. Toggle ON = that card uses the client's accounting basis (Accrual or Cash, as set on the client). Toggle OFF = that card always uses Accrual. Today only the Tax liability card honours the client basis — this makes that behaviour explicit, per-card, and configurable.

## Behaviour

- Default for every card = OFF (forced Accrual), **except Tax liability** which defaults ON (matches today's behaviour, so nothing regresses for existing clients).
- Switching a card ON makes it follow `client.report_basis` (which is already editable above in Settings).
- The `BasisBadge` on each dashboard card keeps working — it just shows whatever basis the card is actually using ("CASH" if override is ON and client basis is cash, otherwise "ACCRUAL").
- Viewers never see the override list (advisor-only, same as the rest of Settings).

## Cards exposed in the toggle list

Each linked Xero org's widgets, grouped by widget type (one row per type, applied to all that client's orgs):

- Tax liability  *(default ON)*
- P&L  *(default OFF)*
- Superannuation  *(default OFF)*
- Payables  *(default OFF)*
- Receivables  *(default OFF)*
- Breakeven  *(default OFF)*

Cards that don't pull from Xero reports (Notes, Unreconciled) are excluded — basis doesn't apply.

## Technical changes

### 1. Persist the per-card overrides

Add a `basis_overrides jsonb not null default '{}'::jsonb` column on `public.clients`. Shape:

```json
{ "tax_liability": true, "pnl": false, "superannuation": false, "payables": false, "receivables": false, "breakeven": false }
```

Missing keys fall back to the documented defaults above (so existing rows keep current behaviour without a backfill).

### 2. Server function

In `src/lib/clients.functions.ts`, add `updateClientBasisOverride({ clientId, widget, enabled })`:
- `requireSupabaseAuth` + advisor role check (mirrors `updateClientReportBasis`).
- Updates the single key inside `basis_overrides` via `jsonb_set`.
- Returns the new overrides object.

### 3. Settings UI

In `src/routes/_authenticated/clients.$clientId.settings.tsx`, extend the existing **Report basis** section:

- Keep the existing `BasisSelectRow` (the client-level Accrual/Cash selector).
- Below it, render a small table — one row per widget — with:
  - Widget label
  - `Switch` bound to the override value (defaulting per the rules above)
  - Right-aligned helper text showing the resulting basis: e.g. *"Uses client basis (Cash)"* when ON, *"Always Accrual"* when OFF.
- Updates call the new server fn and invalidate `client`, `xero-tax-buckets`, `xero-pnl`, and any other affected query keys.

### 4. Dashboard wiring

In `src/routes/_authenticated/clients.$clientId.index.tsx`:

- Read `client.basis_overrides`.
- Build a small helper `basisFor(widget)` returning `reportBasis` when the override is ON, else `"accrual"`.
- Pass `basis={basisFor("tax_liability")}` to `TaxLiabilityWidget`, `basis={basisFor("pnl")}` to `PnlWidget`, and add the same `basis` prop to `SuperannuationWidget`, `PayablesWidget`, `ReceivablesWidget`, `BreakevenWidget`.

### 5. Widget changes

For each of Superannuation, Payables, Receivables, Breakeven:
- Accept `basis?: "accrual" | "cash"` prop (default `"accrual"`).
- Include `basis` in the relevant `useQuery` `queryKey` so changing it invalidates cache.
- Pass `basis` through to the report server fn (matching how `PnlWidget` does it today).
- `BasisBadge` already reads the prop, so badge updates automatically.

Server-side report functions (`src/lib/xero/reports.functions.ts`, payables/receivables/etc.) already accept a `basis` parameter where Xero supports it; for ones that don't accept basis, the prop is still threaded so the badge label is honest, but the report request itself is unchanged.

## Out of scope

- No change to the existing client-level Accrual/Cash selector — that stays as-is.
- No change to `BasisBadge` or to which widgets show one.
- No migration of existing data (defaults preserve current Tax-only behaviour).
