## Add Worksheet 3 — True Break-Even calculator

Add a "True Break-Even" section below the existing Accounting Break-Even table in `BreakevenWidget`. Inputs persist per tenant; Xero pre-fills what it can, user can override every value.

### Inputs (Worksheet 3)

| Field | Source |
|---|---|
| Loan Principal Repayments | Manual |
| Credit Card Interest Payments | Manual |
| Owner Drawings | Manual |
| Tax Payments (GST/PAYG) | **Auto-fill from Xero** — sum of `getTaxLiabilities` GST + PAYG categories for the period end; editable |
| ATO Payment Plans | Manual |
| Equipment Finance | Manual |
| Other | Manual |

### Computed rows

- **Total Additional Cash Commitments** = sum of inputs above
- **Adjusted Fixed Costs** = `fixedOpex` (from existing calc) + Total Additional Cash Commitments
- **True Break-Even Revenue** = Adjusted Fixed Costs ÷ Gross Margin %
- **True Break-Even / mo** = True Break-Even Revenue ÷ months in period
- **Above / Below True Break-Even?** — coloured green/red based on `monthlyIncome` vs True Break-Even / mo

Display as a second 2-column Item/Value table, same styling as the Accounting Break-Even table. Inputs render as inline editable number cells (currency-formatted on blur).

### Persistence

New table `public.client_true_breakeven_inputs`:
- `client_id uuid`, `tenant_id text`, `loan_principal numeric`, `credit_card_interest numeric`, `owner_drawings numeric`, `tax_payments numeric` (nullable — null = auto from Xero), `ato_payment_plan numeric`, `equipment_finance numeric`, `other numeric`, `notes text`, `created_at`, `updated_at`
- Composite unique `(client_id, tenant_id)`
- RLS: gated by existing advisor/firm access on the client (same pattern as `client_cost_classifications`)
- GRANTs to `authenticated` and `service_role`

Server functions in `src/lib/true-breakeven.functions.ts`:
- `getTrueBreakevenInputs({ clientId, tenantId })` — returns saved row or defaults
- `upsertTrueBreakevenInputs({ clientId, tenantId, ...fields })` — debounced save on field change

### Xero auto-fill behaviour

- On first load (no saved row), call `getTaxLiabilities` for the breakeven period's `toDate`; pre-populate `tax_payments` with `gst + payg`.
- Show a small "Auto-filled from Xero · refresh" link next to the Tax row that re-pulls the latest figure.
- All other fields default to 0; user types them in.

### Files

- New: `supabase/migrations/<ts>_true_breakeven_inputs.sql` (table + RLS + GRANTs)
- New: `src/lib/true-breakeven.functions.ts` (get + upsert server fns)
- Edit: `src/components/dashboard/BreakevenWidget.tsx` — add True Break-Even table section with inputs, auto-fill, save debounce; show even when classification is enabled.

### Out of scope (future)

- Worksheets 4 (Sensitivity) and 5 (12-Month Tracker) — not included this round per your selection.
- Auto-deriving loan principal / equipment finance from Xero bank rules — flagged as a follow-up.
