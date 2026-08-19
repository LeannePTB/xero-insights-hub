// Single source of truth for which accounting basis each dashboard card reports on.
//
// Only Profit & Loss follows the client's chosen basis. GST Reconciliation follows
// the Xero file's sales tax (GST) basis. Every other card has one correct basis and
// is hardcoded here, so stored per-card overrides can never send it the wrong one.

export type ReportBasis = "accrual" | "cash";

/** Cards whose basis is a fact, not a setting. */
export const FIXED_CARD_BASIS: Record<string, ReportBasis> = {
  receivables: "accrual",
  payables: "accrual",
  tax_liability: "accrual",
  superannuation: "accrual",
  accounting_breakeven: "accrual",
  true_breakeven: "cash",
  cashflow: "cash",
  balance_sheet_reconciliation: "accrual",
  fixed_assets_reconciliation: "accrual",
};

export const FIXED_CARD_BASIS_LABELS: { key: string; label: string; reason: string }[] = [
  { key: "receivables", label: "Aged Receivables", reason: "On a cash basis there are no receivables" },
  { key: "payables", label: "Aged Payables", reason: "On a cash basis there are no payables" },
  { key: "tax_liability", label: "Tax Liabilities", reason: "Liabilities are an accrual concept" },
  { key: "superannuation", label: "Superannuation Liabilities", reason: "Liabilities are an accrual concept" },
  { key: "accounting_breakeven", label: "Accounting Break-Even", reason: "Accrual by definition" },
  { key: "true_breakeven", label: "True Break-Even (Cash)", reason: "Cash by definition" },
  { key: "cashflow", label: "Cash Flow", reason: "Cash movement is cash movement" },
  {
    key: "balance_sheet_reconciliation",
    label: "Balance Sheet Reconciliation",
    reason: "Xero's Balance Sheet has no cash option; AR/AP control accounts only exist on accruals",
  },
  { key: "fixed_assets_reconciliation", label: "Fixed Assets Reconciliation", reason: "Ties to the balance sheet" },
];

export function basisLabel(basis: ReportBasis): string {
  return basis === "cash" ? "Cash" : "Accrual";
}

/**
 * Normalise Xero's `Organisation.SalesTaxBasis`. Australian files return
 * `ACCRUALS`, `CASH` or `NONE`; other regions add `INVOICE`, `PAYMENTS`,
 * `FLATRATECASH`, `FLATRATEACCRUAL`, `ACCRUAL`. Anything unrecognised (or
 * absent) returns null so callers can say the basis could not be read rather
 * than silently guessing.
 */
export function normaliseSalesTaxBasis(raw: string | null | undefined): ReportBasis | null {
  const v = (raw ?? "").trim().toUpperCase();
  if (!v) return null;
  if (v === "CASH" || v === "PAYMENTS" || v === "FLATRATECASH") return "cash";
  if (v === "ACCRUAL" || v === "ACCRUALS" || v === "INVOICE" || v === "FLATRATEACCRUAL") return "accrual";
  return null; // includes NONE (not GST registered)
}

/**
 * Resolve the basis a card must be rendered with.
 * - Profit & Loss: the client's basis (the only per-card choice left).
 * - GST Reconciliation: the Xero file's GST basis.
 * - Everything else: the fixed constant above, ignoring any stored override.
 */
export function resolveCardBasis(
  widget: string,
  clientBasis: ReportBasis,
  gstBasis: ReportBasis | null,
): ReportBasis {
  if (widget === "pnl") return clientBasis;
  if (widget === "gst_reconciliation") return gstBasis ?? "accrual";
  return FIXED_CARD_BASIS[widget] ?? "accrual";
}
