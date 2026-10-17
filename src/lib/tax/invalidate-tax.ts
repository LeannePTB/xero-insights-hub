import type { QueryClient } from "@tanstack/react-query";

/** Every cached read that depends on a client's GST / PAYG / instalment settings.
 *  Called after saving Tax & reporting settings so cards, tiles, the Health
 *  footer and Overview chips re-read straight away instead of after their stale time. */
const TAX_DERIVED_PREFIXES = new Set([
  "client", "clients", "tax-position", "health-checks", "gst-reconciliation",
  "xero-payg-withholding", "lodged-tax-bills", "income-tax-instalments",
  "overview", "overview-clients", "monthly-report-preview",
]);

export function isTaxDerivedKey(key: readonly unknown[]): boolean {
  return typeof key[0] === "string" && (TAX_DERIVED_PREFIXES.has(key[0]) || key[0].startsWith("overview"));
}

export function invalidateTaxDerived(qc: QueryClient) {
  return qc.invalidateQueries({ predicate: (q) => isTaxDerivedKey(q.queryKey) });
}
