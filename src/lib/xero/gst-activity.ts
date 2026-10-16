// Pure GST activity-statement helpers (no I/O), shared by the GST engine and
// tests. Xero's API has no activity-statement endpoint and does not say which
// transactions a lodged return included, so "unfiled amounts" are an
// explicitly labelled ESTIMATE built from what the API does expose.

import { normaliseSalesTaxBasis, type ReportBasis } from "@/lib/report-basis";

export type GstMethodSource = "override" | "xero" | "unset";
export type GstMethod = { method: ReportBasis | null; source: GstMethodSource; xero: ReportBasis | null };

/** Adviser override wins, then Xero's Organisation.SalesTaxBasis; otherwise the
 *  practice must choose (method null). Never guessed. */
export function resolveGstMethod(override: unknown, xeroRaw: string | null | undefined): GstMethod {
  const xero = normaliseSalesTaxBasis(xeroRaw);
  if (override === "cash" || override === "accrual") return { method: override, source: "override", xero };
  if (xero) return { method: xero, source: "xero", xero };
  return { method: null, source: "unset", xero: null };
}

export function gstMethodLabel(m: GstMethod): string {
  if (!m.method) return "GST accounting method not set";
  const name = m.method === "cash" ? "Cash basis" : "Accrual basis";
  return m.source === "override" ? `${name} (set by your adviser)` : `${name} (from Xero)`;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

type Payment = { PaymentType?: string; Amount?: number; Invoice?: { InvoiceID?: string } | null; CreditNote?: { CreditNoteID?: string } | null };
type Doc = { Total?: number | string; TotalTax?: number | string };

/** GST carried by payments: each payment's share of its document's tax. */
export function paymentGst(payments: Payment[], docsById: Map<string, Doc>): { sales: number; purchases: number; missing: number } {
  let sales = 0, purchases = 0, missing = 0;
  for (const p of payments) {
    const id = p.Invoice?.InvoiceID ?? p.CreditNote?.CreditNoteID;
    const doc = id ? docsById.get(id) : undefined;
    const total = Number(doc?.Total ?? 0);
    if (!doc || !(Math.abs(total) > 0)) { missing++; continue; }
    const tax = (Number(p.Amount) || 0) * (Number(doc.TotalTax) || 0) / total;
    const type = String(p.PaymentType ?? "");
    if (type === "ACCRECPAYMENT") sales += tax;
    else if (type === "ACCPAYPAYMENT") purchases += tax;
    else if (type === "ARCREDITPAYMENT") sales -= tax;
    else if (type === "APCREDITPAYMENT") purchases -= tax;
  }
  return { sales: r2(sales), purchases: r2(purchases), missing };
}

/** GST on spend/receive money (cash by nature, same under both methods). */
export function bankTxGst(bankTx: { Type?: string; TotalTax?: number | string }[]): { sales: number; purchases: number } {
  let sales = 0, purchases = 0;
  for (const b of bankTx) {
    const tax = Number(b.TotalTax) || 0;
    const t = String(b.Type ?? "");
    if (t === "RECEIVE" || t === "RECEIVE-OVERPAYMENT" || t === "RECEIVE-PREPAYMENT") sales += tax;
    else if (t === "SPEND" || t === "SPEND-OVERPAYMENT" || t === "SPEND-PREPAYMENT") purchases += tax;
  }
  return { sales: r2(sales), purchases: r2(purchases) };
}

/**
 * Cut-off for "entered after the last return was lodged": the start of the day
 * after the latest lodged ATO activity-statement bill's date, Sydney time
 * (14:00 UTC of the bill date ≈ midnight AEST). An estimate: Xero does not
 * expose the actual filing moment.
 */
export function unfiledCutoff(lastBillDate: string | null): string | null {
  return lastBillDate && /^\d{4}-\d{2}-\d{2}$/.test(lastBillDate) ? `${lastBillDate}T14:00:00Z` : null;
}

/** The newest ATO activity-statement bill date at or before `asAt`, from any
 *  ACCPAY bill list (paid or unpaid). */
export function latestBasBillDate(bills: { Type?: string; Status?: string; Contact?: { Name?: string }; Reference?: string; InvoiceNumber?: string; DateString?: string; Date?: string }[], asAt: string, isAto: (name: string) => boolean): string | null {
  let best: string | null = null;
  for (const b of bills) {
    if (b.Type && b.Type !== "ACCPAY") continue;
    if (b.Status && !["AUTHORISED", "PAID", "SUBMITTED"].includes(String(b.Status))) continue;
    if (!isAto(String(b.Contact?.Name ?? ""))) continue;
    if (!/\b(bas|ias|activity\s+statements?)\b/i.test(`${b.Reference ?? ""} ${b.InvoiceNumber ?? ""}`)) continue;
    const d = String(b.DateString ?? "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || d > asAt) continue;
    if (!best || d > best) best = d;
  }
  return best;
}

/** Xero `where` literal for a UTC timestamp. */
export function xeroDateTimeLiteral(isoUtc: string): string {
  const d = new Date(isoUtc);
  return `DateTime(${d.getUTCFullYear()},${d.getUTCMonth() + 1},${d.getUTCDate()},${d.getUTCHours()},${d.getUTCMinutes()},${d.getUTCSeconds()})`;
}
