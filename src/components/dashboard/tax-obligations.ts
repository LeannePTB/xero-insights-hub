import type { GstResponse } from "@/lib/xero/gst.functions";
import type { PaygWithholdingPosition } from "@/lib/xero/reports.functions";
import type { LodgedAtoBill } from "@/lib/health/health-checks";

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** Match named monthly/quarterly periods; never assign an unrelated open BAS. */
export function lodgedBillsForPeriod(bills: readonly LodgedAtoBill[], from: string, to: string): LodgedAtoBill[] {
  return bills.filter((bill) => {
    const text = bill.periodText || bill.reference;
    const named = [...text.toLowerCase().matchAll(/\b(jan\w*|feb\w*|mar\w*|apr\w*|may|jun\w*|jul\w*|aug\w*|sep\w*|oct\w*|nov\w*|dec\w*)\b/g)]
      .map(m => MONTHS.indexOf(m[1].slice(0, 3)) + 1);
    const explicitYear = text.match(/\b(20\d{2})\b/)?.[1];
    const endMonth = named.at(-1);
    const year = explicitYear ?? String(Number(bill.due.slice(0, 4)) - (endMonth && endMonth >= Number(bill.due.slice(5, 7)) ? 1 : 0));
    if (named.length) {
      const start = `${year}-${String(named[0]).padStart(2, "0")}-01`;
      const end = `${year}-${String(endMonth).padStart(2, "0")}-31`;
      return from >= start && to <= end;
    }
    // Undated/unlabelled activity statements cannot be attributed to a month.
    return false;
  });
}

export function paygMonthState(month: { month: string; owing: boolean; incomplete: boolean }, bills: readonly LodgedAtoBill[], complete: boolean) {
  const matched = month.incomplete ? [] : lodgedBillsForPeriod(bills, month.month, month.month);
  if (matched.length) return matched.some(b => b.total !== undefined && b.total > b.amount + 0.005) ? "lodged_part_paid" : "lodged_owing";
  return month.owing ? "owing" : complete ? "paid" : "unknown";
}

export function netGstAmount(data: Pick<GstResponse, "gstOnSales" | "gstOnPurchases">) {
  return (data.gstOnSales ?? 0) - (data.gstOnPurchases ?? 0);
}

export function latestCompletedPaygMonth(
  data: PaygWithholdingPosition | undefined,
): { month: string; amount: number } | null {
  if (!data || data.status !== "available") return null;
  const month = data.months.find((item) => !item.incomplete);
  return month ? { month: month.month, amount: month.withheld } : null;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
/** The GST period still running on `today` (monthly or quarterly), to its end. */
export function currentGstPeriod(cycle: "monthly" | "quarterly" | "annual" | "not_registered" | null, today: string) {
  const [y, m] = today.split("-").map(Number);
  const quarterly = cycle === "quarterly";
  const startMonth = quarterly ? Math.floor((m - 1) / 3) * 3 : m - 1;
  const from = iso(new Date(Date.UTC(y, startMonth, 1)));
  const to = iso(new Date(Date.UTC(y, startMonth + (quarterly ? 3 : 1), 0)));
  return { kind: quarterly ? ("quarter" as const) : ("month" as const), from, asAt: to };
}

/** ATO due date for a BAS period end: monthly 21st of the next month;
 *  quarterly 28th of the month after the quarter (December quarter 28 Feb). */
export function basDueDate(kind: "month" | "quarter", periodEnd: string): string {
  const [y, m] = periodEnd.split("-").map(Number);
  if (kind === "month") return iso(new Date(Date.UTC(y, m, 21)));
  if (m === 12) return `${y + 1}-02-28`;
  return iso(new Date(Date.UTC(y, m, 28)));
}

export type ForwardTax = {
  owing: { amount: number; reference: string; due: string; overdue: boolean }[];
  building: { gst: number | null; payg: number | null; total: number | null; due: string; from: string; to: string };
  instalment: { amount: number; due: string } | null;
  /** "not_required" contributes nothing; "unset" means nobody has chosen yet. */
  instalmentSetting?: "not_required" | "quarterly" | "annual" | "unset";
  totalToPlan: number | null;
};

/** One forward-looking summary from the shared inputs: unpaid lodged ATO bills,
 *  the running period's GST (statement figure) and PAYG withheld so far. */
export function forwardTax(input: {
  bills: readonly LodgedAtoBill[]; today: string;
  period: { kind: "month" | "quarter"; from: string; asAt: string };
  gst: number | null; payg: number | null; paygRegistered: boolean;
  instalment: { amount: number; due: string } | null;
  instalmentSetting?: "not_required" | "quarterly" | "annual" | "unset";
}): ForwardTax {
  const owing = input.bills.map(b => ({ amount: b.amount, reference: b.reference, due: b.due, overdue: b.due < input.today }));
  const payg = input.paygRegistered ? input.payg : 0;
  const total = input.gst !== null && payg !== null ? Math.round((input.gst + payg) * 100) / 100 : null;
  const instalment = input.instalmentSetting !== "not_required" && input.instalment && input.instalment.due >= input.today ? input.instalment : null;
  const totalToPlan = total === null ? null : Math.round((owing.reduce((s, o) => s + o.amount, 0) + total + (instalment?.amount ?? 0)) * 100) / 100;
  return { owing, building: { gst: input.gst, payg: input.paygRegistered ? input.payg : null, total, due: basDueDate(input.period.kind, input.period.asAt), from: input.period.from, to: input.period.asAt }, instalment, instalmentSetting: input.instalmentSetting, totalToPlan };
}

/** Organisations are Western Australian practices; no per-organisation
 *  timezone is stored, so the organisation day is the Perth calendar day. */
export const ORGANISATION_TIME_ZONE = "Australia/Perth";
export function organisationToday(instant: Date = new Date(), timeZone = ORGANISATION_TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);
}

export type BillStatus = { kind: "not_due" | "due_today" | "overdue" | "paid"; days: number; label: string; detail: string | null };
const dayCount = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
/** One status rule for every lodged bill/instalment label: follows the due date. */
export function billStatus(due: string, today: string, owing: number): BillStatus {
  if (!(owing > 0.005)) return { kind: "paid", days: 0, label: "Paid", detail: null };
  const days = dayCount(today, due);
  if (days > 0) return { kind: "not_due", days, label: "Not due yet", detail: `in ${days} day${days === 1 ? "" : "s"}` };
  if (days === 0) return { kind: "due_today", days: 0, label: "Due today", detail: null };
  return { kind: "overdue", days: -days, label: "Overdue", detail: `${-days} day${days === -1 ? "" : "s"} overdue` };
}

/** Instalment due date from its period end: quarterly follows the BAS quarter
 *  rule; annual instalments fall due 21 October after the financial year. */
export function instalmentDueDate(frequency: "not_required" | "quarterly" | "annual" | null, periodEnd: string): string {
  if (frequency === "annual") {
    const [y, m] = periodEnd.split("-").map(Number);
    return `${m > 6 ? y + 1 : y}-10-21`;
  }
  return basDueDate("quarter", periodEnd);
}
