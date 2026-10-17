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

/** A finished period with no lodged activity statement in Xero: amount read from the ledger balances. */
export type UnlodgedTax = { kind: "gst" | "payg"; from: string; to: string; amount: number; due: string; overdue: boolean; estimate: boolean };

export type ForwardTax = {
  owing: { amount: number; reference: string; due: string; overdue: boolean }[];
  /** Only when no lodged bill exists: last finished period(s), from Xero balances, not a lodged statement. */
  unlodged?: UnlodgedTax[];
  building: {
    gst: number | null; payg: number | null; total: number | null;
    /** Earliest of the component due dates (kept for older readers). */
    due: string; from: string; to: string;
    /** Per-component due dates following the client's lodgement settings. */
    gstDue?: string; paygDue?: string;
    /** PAYG on pay runs in the running period, when PAYG accruing came from the ledger and differs. */
    paygPayRuns?: number | null;
  };
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
  /** Last finished period(s) from ledger balances; ignored when lodged bills exist. */
  unlodged?: UnlodgedTax[];
  /** PAYG withholding cycle, so the PAYG accruing due date follows the client's setting. */
  paygCycle?: string | null;
  paygPayRuns?: number | null;
}): ForwardTax {
  const owing = input.bills.map(b => ({ amount: b.amount, reference: b.reference, due: b.due, overdue: b.due < input.today }));
  const unlodged = owing.length ? [] : (input.unlodged ?? []).filter((u) => u.amount > 0.005);
  const payg = input.paygRegistered ? input.payg : 0;
  const total = input.gst !== null && payg !== null ? Math.round((input.gst + payg) * 100) / 100 : null;
  const instalment = input.instalmentSetting !== "not_required" && input.instalment && input.instalment.due >= input.today ? input.instalment : null;
  const sum = (xs: { amount: number }[]) => xs.reduce((s, o) => s + o.amount, 0);
  const totalToPlan = total === null ? null : Math.round((sum(owing) + sum(unlodged) + total + (instalment?.amount ?? 0)) * 100) / 100;
  const gstDue = basDueDate(input.period.kind, input.period.asAt);
  const paygDue = paygRunningDue(input.paygCycle ?? null, input.today) ?? gstDue;
  const due = input.paygRegistered && input.payg ? (paygDue < gstDue ? paygDue : gstDue) : gstDue;
  return { owing, unlodged, building: { gst: input.gst, payg: input.paygRegistered ? input.payg : null, total, due, from: input.period.from, to: input.period.asAt, gstDue, paygDue: input.paygRegistered ? paygDue : undefined, paygPayRuns: input.paygPayRuns ?? null }, instalment, instalmentSetting: input.instalmentSetting, totalToPlan };
}

/** Due date of PAYG withholding still accruing on `today`: monthly → 21st of next month; quarterly → with the BAS. */
export function paygRunningDue(cycle: string | null, today: string): string | null {
  if (cycle !== "monthly" && cycle !== "quarterly") return null;
  const p = currentGstPeriod(cycle, today);
  return basDueDate(p.kind, p.asAt);
}

/** What is due first: lodged bills, otherwise the unlodged finished periods. */
export function dueNowItems(fwd: ForwardTax): { amount: number; due: string; overdue: boolean; label: string; lodged: boolean }[] {
  if (fwd.owing.length) return fwd.owing.map((o) => ({ amount: o.amount, due: o.due, overdue: o.overdue, label: o.reference || "Lodged activity statement", lodged: true }));
  return (fwd.unlodged ?? []).map((u) => ({ amount: u.amount, due: u.due, overdue: u.overdue, label: u.kind === "gst" ? "GST" : "PAYG withholding", lodged: false }));
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

export type InstalmentPeriod = { start: string; end: string; due: string; label: string };
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n: number) => String(n).padStart(2, "0");
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m is 1-based

/** Instalment periods still to pay (due on or after today), in date order.
 *  Quarterly: financial-year quarters; annual: 1 Jul – 30 Jun. */
export function upcomingInstalmentPeriods(frequency: "quarterly" | "annual", today: string, count = 2): InstalmentPeriod[] {
  const [ty, tm] = today.split("-").map(Number);
  const out: InstalmentPeriod[] = [];
  if (frequency === "annual") {
    for (let fyEnd = (tm > 6 ? ty : ty - 1); out.length < count; fyEnd++) {
      const end = `${fyEnd}-06-30`;
      const due = instalmentDueDate("annual", end);
      if (due >= today) out.push({ start: `${fyEnd - 1}-07-01`, end, due, label: `FY ${fyEnd - 1}–${String(fyEnd).slice(2)}` });
    }
    return out;
  }
  // Start one quarter back so a just-ended quarter that is still due is included.
  let y = ty, q = Math.floor((tm - 1) / 3) - 1;
  if (q < 0) { q = 3; y -= 1; }
  for (let guard = 0; out.length < count && guard < 12; guard++) {
    const sm = q * 3 + 1, em = sm + 2;
    const start = `${y}-${pad(sm)}-01`, end = `${y}-${pad(em)}-${pad(lastDay(y, em))}`;
    const due = instalmentDueDate("quarterly", end);
    if (due >= today) out.push({ start, end, due, label: `${MON[sm - 1]}–${MON[em - 1]} ${y}` });
    q += 1; if (q > 3) { q = 0; y += 1; }
  }
  return out;
}

/** Quarters of the financial year containing the first upcoming period that are still to pay. */
export function remainingFyQuarters(today: string): InstalmentPeriod[] {
  const all = upcomingInstalmentPeriods("quarterly", today, 5);
  if (!all.length) return [];
  const [y, m] = all[0].end.split("-").map(Number);
  const fyEnd = `${m > 6 ? y + 1 : y}-06-30`;
  return all.filter((p) => p.end <= fyEnd);
}

/** The saved instalment the tile shows: the one with the earliest due date on or after today. */
export function pickCurrentInstalment<T extends { amount: number; periodEnd: string }>(
  rows: readonly T[], frequency: "not_required" | "quarterly" | "annual" | null, today: string,
): (T & { due: string }) | null {
  if (frequency === "not_required") return null;
  let best: (T & { due: string }) | null = null;
  for (const r of rows) {
    const due = instalmentDueDate(frequency, r.periodEnd);
    if (due >= today && (!best || due < best.due)) best = { ...r, due };
  }
  return best;
}

export type PaygRowStatus = "accruing" | "no_pay_runs" | "lodged_owing" | "lodged_part_paid" | "not_due" | "due_today" | "overdue" | "paid" | "paid_or_older" | "unknown";
export type PaygPeriodRow = { key: string; from: string; to: string; withheld: number; payRuns: number; due: string; status: PaygRowStatus };

/** ATO due date for PAYG withholding of the period ending `to`. */
export function paygPeriodDue(cycle: "monthly" | "quarterly", to: string): string {
  const y = +to.slice(0, 4), m = +to.slice(5, 7);
  const pad = (n: number) => String(n).padStart(2, "0");
  if (cycle === "quarterly") return m === 12 ? `${y + 1}-02-28` : `${y}-${pad(m + 1)}-28`;
  return m === 12 ? `${y + 1}-01-21` : `${y}-${pad(m + 1)}-21`;
}

/**
 * The PAYG card's rows, following the client's withholding cycle: months, or
 * BAS quarters built from the same monthly pay-run figures. "Paid" only when the
 * ledger shows the balance fell (month not owing); no pay runs is never "Paid".
 */
export function paygPeriodRows(
  months: readonly { month: string; withheld: number; payRuns: number; owing: boolean; incomplete: boolean }[],
  cycle: "monthly" | "quarterly",
  today: string,
  bills: readonly LodgedAtoBill[],
  billsComplete: boolean,
  olderBalance: boolean,
): PaygPeriodRow[] {
  const groups = new Map<string, typeof months[number][]>();
  for (const m of months) {
    const y = +m.month.slice(0, 4), mo = +m.month.slice(5, 7);
    const start = cycle === "quarterly" ? Math.floor((mo - 1) / 3) * 3 + 1 : mo;
    const key = `${y}-${String(start).padStart(2, "0")}-01`;
    groups.set(key, [...(groups.get(key) ?? []), m]);
  }
  return [...groups].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([from, ms]) => {
    const y = +from.slice(0, 4), mo = +from.slice(5, 7);
    const to = new Date(Date.UTC(y, mo - 1 + (cycle === "quarterly" ? 3 : 1), 0)).toISOString().slice(0, 10);
    const due = paygPeriodDue(cycle, to);
    const withheld = Math.round(ms.reduce((s, m) => s + m.withheld, 0) * 100) / 100;
    const payRuns = ms.reduce((s, m) => s + m.payRuns, 0);
    const running = to >= today;
    const matched = running ? [] : lodgedBillsForPeriod(bills, from, to);
    let status: PaygRowStatus;
    if (running) status = "accruing";
    else if (payRuns === 0) status = "no_pay_runs";
    else if (matched.length) status = matched.some((b) => b.total !== undefined && b.total > b.amount + 0.005) ? "lodged_part_paid" : "lodged_owing";
    else if (ms.some((m) => m.owing)) status = today < due ? "not_due" : today === due ? "due_today" : "overdue";
    else if (!billsComplete) status = "unknown";
    else status = olderBalance ? "paid_or_older" : "paid";
    return { key: from, from, to, withheld, payRuns, due, status };
  });
}
