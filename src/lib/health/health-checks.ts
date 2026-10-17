// Business Health — three plain checks, no score.
//
// Pure and client-safe: no server imports. One function, `computeHealthChecks`,
// turns stored figures into the payload shown by the dashboard card, the
// client-list badge and the monthly report, so the three can never disagree.
// The loader that gathers the stored figures is `health-checks.server.ts`.

import { looksLikeAtoContact } from "@/lib/xero/ato-payables";

export type CheckStatus = "green" | "watch" | "red" | "na";
export type CheckKey = "profit" | "cash_cover" | "paying_on_time";

export type HealthCheck = {
  key: CheckKey;
  question: string;
  /** The headline figure, e.g. "$31.7k profit · 32.0% margin". */
  figure: string;
  /** Optional small breakdown line under the figure. */
  detail: string | null;
  status: CheckStatus;
  /** One short plain sentence on what the status means. */
  meaning: string;
  /** Panel title for the three-panel layout (presentation only). */
  title?: string;
  /** Label + value cells shown in the panel's left column; formatted from the same figures. */
  rows?: { label: string; value: string }[];
  /** Short "Analysis" lines for the panel's right column. */
  analysis?: string[];
};

export type HealthInfoLine = { key: "next_tax" | "old_debts"; text: string };

export type HealthChecks = {
  asOf: string;
  fyLabel: string;
  /** "2 of 3 on track". */
  headline: string;
  onTrack: number;
  /** Checks that produced a result (excludes "Not available"). */
  counted: number;
  checks: HealthCheck[];
  info: HealthInfoLine[];
  /** True when the financial year is too young for a profit verdict. */
  profitHeldBack: boolean;
};

// ---------------------------------------------------------------------------
// Thresholds (owner-set, 16 Oct 2026)
// ---------------------------------------------------------------------------
export const PROFIT_GREEN_MARGIN_PCT = 5;
export const CASH_COVER_GREEN_MONTHS = 2;
export const CASH_COVER_WATCH_MONTHS = 0.5;
export const RECENT_DEBTOR_DAYS = 90;
export const LATE_AFTER_DAYS = 14;
export const LATE_AMOUNT_FLOOR = 2000;
export const LATE_SHARE_GREEN_PCT = 20;
export const LATE_SHARE_WATCH_PCT = 50;
/** A financial year shorter than this is too young to call. */
export const PROFIT_MIN_DAYS = 14;

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
type Row = { RowType?: string; Title?: string; Rows?: Row[]; Cells?: { Value?: string; Attributes?: { Id?: string; Value?: string }[] }[] };

export function parseAmount(v: string | number | undefined | null): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (!v) return 0;
  const n = Number(String(v).replace(/[, ]/g, "").replace(/^\((.*)\)$/, "-$1"));
  return Number.isFinite(n) ? n : 0;
}

function dayNumber(iso: string): number {
  return Math.floor(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86_400_000);
}

/** Xero's "/Date(…)/" or an ISO date → "YYYY-MM-DD" (UTC calendar date). */
export function xeroDateISO(s: unknown): string | null {
  if (typeof s !== "string" || !s) return null;
  const m = s.match(/\/Date\((-?\d+)/);
  const d = m ? new Date(parseInt(m[1]!, 10)) : new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** One style throughout: "$31.7k", "$118k", "$5.1k", "-$2.1k", "$850". */
export function money(n: number): string {
  const sign = n < 0 ? "-" : "";
  const a = Math.abs(n);
  if (a >= 99_950) return `${sign}$${Math.round(a / 1000)}k`;
  if (a >= 1_000) return `${sign}$${(a / 1000).toFixed(1)}k`;
  return `${sign}$${Math.round(a)}`;
}

/**
 * Plain sentence describing the actual cover figure (never the band's
 * threshold). Under one month → weeks; otherwise months to the nearest half.
 */
export function cashCoverText(months: number): string {
  const m = Math.max(0, months);
  if (m < 1) {
    const weeks = Math.round(m * 52 / 12 * 2) / 2;
    if (weeks < 1) return "less than a week";
    const w = weeks % 1 ? `${Math.floor(weeks)}½` : String(weeks);
    return `about ${w} week${weeks === 1 ? "" : "s"}`;
  }
  const half = Math.round(m * 2) / 2;
  const t = half % 1 ? `${Math.floor(half)}½` : String(half);
  return `about ${t} month${half === 1 ? "" : "s"}`;
}

export function cashCoverMeaning(months: number, includesDebtors: boolean): string {
  const who = includesDebtors ? "Cash and recent debtors" : "Cash";
  return `${who} would cover ${cashCoverText(months)} of normal costs.`;
}

function dayLabel(iso: string): string {
  return `${+iso.slice(8, 10)} ${MONTHS[+iso.slice(5, 7) - 1]}`;
}
function monthYearLabel(iso: string): string {
  return `${MONTHS[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}`;
}

// ---------------------------------------------------------------------------
// Check 1 — Making money?
// ---------------------------------------------------------------------------

/** Xero's own Net Profit and Total Income rows, wherever they sit. */
export function readProfitRows(report: { Rows?: Row[] } | null | undefined): { netProfit: number | null; revenue: number | null } {
  let netProfit: number | null = null;
  let revenue: number | null = null;
  const walk = (rows: Row[] | undefined) => {
    for (const r of rows ?? []) {
      if (r.RowType === "Section") { walk(r.Rows); continue; }
      const name = (r.Cells?.[0]?.Value ?? "").trim().toLowerCase();
      const value = parseAmount(r.Cells?.[1]?.Value);
      if (name === "net profit") netProfit = value;
      else if (name === "net loss") netProfit = -Math.abs(value);
      else if (name === "total income" || name === "total trading income") revenue = (revenue ?? 0) + value;
    }
  };
  walk(report?.Rows);
  return { netProfit, revenue };
}

export function profitStatus(netProfit: number, revenue: number | null): CheckStatus {
  if (netProfit < 0) return "red";
  const margin = revenue && revenue > 0 ? (netProfit / revenue) * 100 : null;
  if (margin === null) return netProfit > 0 ? "green" : "watch";
  return margin >= PROFIT_GREEN_MARGIN_PCT ? "green" : "watch";
}

// ---------------------------------------------------------------------------
// Debtors — recent / late / old
// ---------------------------------------------------------------------------
export type DebtorSplit = { recent: number; late: number; old: number; oldestOldDue: string | null };

export function splitDebtors(invoices: { AmountDue?: unknown; DueDate?: unknown; DueDateString?: unknown; Status?: unknown }[] | null | undefined, today: string): DebtorSplit {
  const t = dayNumber(today);
  let recent = 0, late = 0, old = 0;
  let oldestOldDue: string | null = null;
  for (const inv of invoices ?? []) {
    const due = parseAmount(inv.AmountDue as any);
    if (due <= 0) continue;
    // Only approved invoices are in Accounts Receivable; "Awaiting approval" (SUBMITTED) and drafts are not.
    if (inv.Status !== undefined && inv.Status !== "AUTHORISED") continue;
    const dueISO = xeroDateISO(inv.DueDateString) ?? xeroDateISO(inv.DueDate);
    const overdueDays = dueISO ? t - dayNumber(dueISO) : 0;
    if (overdueDays > RECENT_DEBTOR_DAYS) {
      old += due;
      if (dueISO && (!oldestOldDue || dueISO < oldestOldDue)) oldestOldDue = dueISO;
      continue;
    }
    recent += due;
    if (overdueDays > LATE_AFTER_DAYS) late += due;
  }
  return { recent, late, old, oldestOldDue };
}

export function payingOnTimeStatus(late: number, recent: number): CheckStatus {
  if (recent <= 0) return "green";
  if (late < LATE_AMOUNT_FLOOR) return "green";
  const share = (late / recent) * 100;
  if (share < LATE_SHARE_GREEN_PCT) return "green";
  if (share <= LATE_SHARE_WATCH_PCT) return "watch";
  return "red";
}

// ---------------------------------------------------------------------------
// Check 2 — Cash cover
// ---------------------------------------------------------------------------
export type AccountRef = { AccountID?: string; Name?: string; Class?: string; Type?: string };
export type MonthlyCosts = { months: number; average: number; wages: number; other: number };

const NON_CASH_NAME = /depreciat|amortis|amortiz/i;
const COST_SECTION = /cost of sales|cost of goods|direct cost|expense|overhead/i;
export const WAGE_NAME = /wage|salary|salaries|superannuation|payroll|staff|employee|contract\s*labou?r|sub[-\s]*contract|director'?s?\s*fee|payg|kiwisaver|bonus|commission/i;

export function normaliseName(n: string): string {
  return n.trim().toLowerCase();
}

/**
 * Average monthly cost of sales + operating expenses over the given monthly
 * P&L reports (each value column is one calendar month). Non-cash accounts
 * (depreciation/amortisation) are left out: by account type when the account
 * is known, otherwise by name.
 */
export function monthlyCosts(
  reports: ({ Rows?: Row[] } | null | undefined)[],
  accounts: AccountRef[] | null | undefined,
  wageNames: Set<string>,
): MonthlyCosts | null {
  const byId = new Map<string, AccountRef>();
  for (const a of accounts ?? []) if (a.AccountID) byId.set(a.AccountID, a);
  let months = 0, wages = 0, other = 0;
  for (const report of reports) {
    if (!report?.Rows) continue;
    const header = report.Rows.find((r) => r.RowType === "Header");
    const cols = Math.max(1, (header?.Cells?.length ?? 2) - 1);
    months += cols;
    const walk = (rows: Row[] | undefined, section: string) => {
      for (const r of rows ?? []) {
        if (r.RowType === "Section") { walk(r.Rows, r.Title || section); continue; }
        if (r.RowType !== "Row" || !r.Cells?.length) continue;
        const name = r.Cells[0]?.Value ?? "";
        const id = r.Cells[0]?.Attributes?.find((a) => a.Id === "account")?.Value;
        const acc = id ? byId.get(id) : undefined;
        let isCost: boolean;
        if (acc) isCost = String(acc.Class).toUpperCase() === "EXPENSE" && String(acc.Type).toUpperCase() !== "DEPRECIATN" && !NON_CASH_NAME.test(acc.Name ?? name);
        else isCost = !!id && COST_SECTION.test(section) && !NON_CASH_NAME.test(name);
        if (!isCost) continue;
        let amount = 0;
        for (let i = 1; i <= cols; i++) amount += parseAmount(r.Cells[i]?.Value);
        const n = acc?.Name ?? name;
        const isWage = wageNames.size > 0 ? wageNames.has(normaliseName(n)) : WAGE_NAME.test(n);
        if (isWage) wages += amount; else other += amount;
      }
    };
    walk(report.Rows, "");
  }
  if (months === 0) return null;
  return { months, average: (wages + other) / months, wages: wages / months, other: other / months };
}

export function cashCoverStatus(months: number | null): CheckStatus {
  if (months === null) return "na";
  if (months >= CASH_COVER_GREEN_MONTHS) return "green";
  if (months >= CASH_COVER_WATCH_MONTHS) return "watch";
  return "red";
}

// ---------------------------------------------------------------------------
// Info — next ATO payment
// ---------------------------------------------------------------------------
export type Cycle = "monthly" | "quarterly" | "annual" | "not_registered" | null | undefined;

/** Next standard ATO due date on or after `today` for a lodgement cycle. */
export function nextAtoDueDate(cycle: Cycle, today: string): string | null {
  const y = +today.slice(0, 4);
  const cands: string[] = [];
  const pad = (n: number) => String(n).padStart(2, "0");
  if (cycle === "monthly") {
    for (let i = 0; i < 2; i++) {
      const d = new Date(Date.UTC(y, +today.slice(5, 7) - 1 + i, 21));
      cands.push(d.toISOString().slice(0, 10));
    }
  } else if (cycle === "quarterly") {
    for (const yy of [y, y + 1]) for (const m of [2, 4, 7, 10]) cands.push(`${yy}-${pad(m)}-28`);
  } else return null;
  return cands.sort().find((d) => d >= today) ?? null;
}

/** GST and PAYG withholding owed on one balance sheet (combined ATO account included). */
export type TaxBalances = { gst: number; payg: number };

/** End of the client's last completed lodgement period on or before `today`. */
export function lastPeriodEnd(cycle: Cycle, today: string): string | null {
  const y = +today.slice(0, 4);
  const m = +today.slice(5, 7);
  const end = (yy: number, mm: number) => new Date(Date.UTC(yy, mm, 0)).toISOString().slice(0, 10);
  if (cycle === "monthly") return end(y, m - 1);
  if (cycle === "quarterly") {
    const qEndMonth = Math.floor((m - 1) / 3) * 3; // 0, 3, 6, 9 — month index of last completed quarter end
    return end(y, qEndMonth);
  }
  return null;
}

/** Standard ATO due date for the period ending `periodEnd`. */
export function dueDateForPeriodEnd(cycle: Cycle, periodEnd: string): string {
  const y = +periodEnd.slice(0, 4);
  const m = +periodEnd.slice(5, 7); // 1-12, the period's last month
  const pad = (n: number) => String(n).padStart(2, "0");
  if (cycle === "quarterly") {
    // Oct–Dec quarter is due 28 Feb; the others 28th of the month after.
    if (m === 12) return `${y + 1}-02-28`;
    return `${y}-${pad(m + 1)}-28`;
  }
  const d = new Date(Date.UTC(y, m, 21));
  return d.toISOString().slice(0, 10);
}

function nextPeriodEndAfter(cycle: Cycle, periodEnd: string): string {
  const y = +periodEnd.slice(0, 4);
  const m = +periodEnd.slice(5, 7);
  const step = cycle === "quarterly" ? 3 : 1;
  return new Date(Date.UTC(y, m + step, 0)).toISOString().slice(0, 10);
}

/** An open, unpaid bill to the ATO for a lodged activity statement. */
export type LodgedAtoBill = { due: string; amount: number; reference: string; contact: string; total?: number; periodText?: string };

const ACTIVITY_STATEMENT = /\b(bas|ias|activity\s+statements?)\b/i;

/**
 * Lodged activity statements still owing: open bills (AmountDue > 0) to the
 * Australian Taxation Office whose reference, number or line text names a
 * BAS / IAS / activity statement. Source: the `invoices_accpay_open` snapshot.
 */
export function lodgedAtoBills(payload: any): LodgedAtoBill[] {
  const invoices = Array.isArray(payload) ? payload : Array.isArray(payload?.Invoices) ? payload.Invoices : [];
  const out: LodgedAtoBill[] = [];
  for (const inv of invoices) {
    const amount = Number(inv?.AmountDue ?? 0);
    if (!(amount > 0)) continue;
    if (inv?.Type && inv.Type !== "ACCPAY") continue;
    if (inv?.Status && !["AUTHORISED", "SUBMITTED"].includes(String(inv.Status))) continue;
    const contact = String(inv?.Contact?.Name ?? "");
    if (!looksLikeAtoContact(contact)) continue;
    const lines = Array.isArray(inv?.LineItems) ? inv.LineItems.map((l: any) => String(l?.Description ?? "")) : [];
    const text = [inv?.Reference, inv?.InvoiceNumber, ...lines].filter(Boolean).join(" ");
    if (!ACTIVITY_STATEMENT.test(text)) continue;
    const due = xeroDateISO(inv?.DueDateString) ?? xeroDateISO(inv?.DueDate);
    if (!due) continue;
    out.push({ due, amount, reference: String(inv?.Reference || inv?.InvoiceNumber || ""), contact,
      ...(inv?.Total != null && Number.isFinite(Number(inv.Total)) ? { total: Number(inv.Total) } : {}),
      ...(lines.length ? { periodText: text } : {}),
    });
  }
  return out.sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : 0));
}

export type NextTaxPayment = {
  due: string;
  /** Due now for the completed period; null when nothing is known to be due yet. */
  amount: number | null;
  /** Accruing for a period that has not ended yet. */
  building: number;
  /** Due date of the building amount, when it comes from the shared forward figure. */
  buildingDue?: string;
  /** Period end the due amount was read at; null when estimated. */
  periodEnd: string | null;
  /** True when the period-end balance sheet was missing (full balance used). */
  estimate: boolean;
  /** Other completed-period payments due on a later date (e.g. quarterly GST after monthly PAYG). */
  later: { due: string; amount: number }[];
  /** Where "due next" came from: a lodged ATO bill, or the period-end balance sheet. */
  source?: "lodged_bill" | "balance_sheet";
};

/**
 * The next GST / PAYG withholding payment, split into what is due now for the
 * last completed lodgement period and what is still building for the next.
 * Due now = min(period-end balance, current balance) — any fall since the
 * period end is a payment; never below zero. Without the period-end balance
 * the full current balance is used and flagged as an estimate.
 */
export function nextTaxPayment(i: {
  gstCycle: Cycle;
  paygCycle: Cycle;
  today: string;
  current: TaxBalances | null;
  periodEnd: (date: string) => TaxBalances | null;
  /** Lodged, unpaid ATO activity-statement bills (see `lodgedAtoBills`). */
  lodged?: LodgedAtoBill[] | null;
}): NextTaxPayment | null {
  const registered = (c: Cycle) => c === "monthly" || c === "quarterly";
  if (i.lodged && i.lodged.length && (registered(i.gstCycle) || registered(i.paygCycle))) {
    // Lodging moved the completed period off the GST / PAYG accounts, so the
    // bill is due next and the whole current balance is still building.
    const first = i.lodged[0]!.due;
    const amount = i.lodged.filter((b) => b.due === first).reduce((s, b) => s + b.amount, 0);
    const laterMap = new Map<string, number>();
    for (const b of i.lodged) if (b.due !== first) laterMap.set(b.due, (laterMap.get(b.due) ?? 0) + b.amount);
    const building =
      (registered(i.gstCycle) ? Math.max(0, i.current?.gst ?? 0) : 0) +
      (registered(i.paygCycle) ? Math.max(0, i.current?.payg ?? 0) : 0);
    return {
      due: first,
      amount,
      building,
      periodEnd: null,
      estimate: false,
      later: [...laterMap].map(([due, amount]) => ({ due, amount })),
      source: "lodged_bill",
    };
  }
  type Item = { due: string; amount: number | null; building: number; periodEnd: string | null; estimate: boolean };
  const items: Item[] = [];
  for (const [comp, cycle] of [["gst", i.gstCycle], ["payg", i.paygCycle]] as const) {
    if (cycle !== "monthly" && cycle !== "quarterly") continue;
    const cur = Math.max(0, i.current?.[comp] ?? 0);
    const pe = lastPeriodEnd(cycle, i.today)!;
    const due = dueDateForPeriodEnd(cycle, pe);
    if (due < i.today) {
      // Last period's due date has passed: everything on the books is for the next period.
      items.push({ due: dueDateForPeriodEnd(cycle, nextPeriodEndAfter(cycle, pe)), amount: null, building: cur, periodEnd: null, estimate: false });
      continue;
    }
    if (!i.current) { items.push({ due, amount: null, building: 0, periodEnd: null, estimate: false }); continue; }
    const at = i.periodEnd(pe);
    if (!at) { items.push({ due, amount: cur, building: 0, periodEnd: null, estimate: true }); continue; }
    const dueNow = Math.max(0, Math.min(at[comp], cur));
    items.push({ due, amount: dueNow, building: Math.max(0, cur - dueNow), periodEnd: pe, estimate: false });
  }
  if (!items.length) return null;
  const dueItems = items.filter((x) => x.amount !== null && x.amount > 0);
  const first = (dueItems.length ? dueItems : items).map((x) => x.due).sort()[0]!;
  const now = items.filter((x) => x.due === first && x.amount !== null);
  const amount = now.length ? now.reduce((s, x) => s + (x.amount ?? 0), 0) : null;
  const later = dueItems.filter((x) => x.due !== first).map((x) => ({ due: x.due, amount: x.amount! })).sort((a, b) => (a.due < b.due ? -1 : 1));
  return {
    due: first,
    amount: amount !== null && amount > 0 ? amount : null,
    building: items.reduce((s, x) => s + x.building, 0),
    periodEnd: now.find((x) => x.periodEnd)?.periodEnd ?? null,
    estimate: now.some((x) => x.estimate),
    later,
    source: "balance_sheet",
  };
}

/**
 * Replace the balance-sheet "building" figure with the shared forward figure
 * (running period's corrected GST + PAYG withheld so far) used by the Tax
 * obligations card. Lodged bills stay as "due next".
 */
export function withForwardBuilding(
  next: NextTaxPayment | null,
  fwd: { owing: { amount: number; due: string }[]; building: { total: number | null; due: string } } | null | undefined,
): NextTaxPayment | null {
  if (!fwd || fwd.building.total === null) return next;
  if (!next) {
    const first = fwd.owing.map((o) => o.due).sort()[0];
    const amount = first ? fwd.owing.filter((o) => o.due === first).reduce((s, o) => s + o.amount, 0) : null;
    return { due: first ?? fwd.building.due, amount, building: fwd.building.total, buildingDue: fwd.building.due, periodEnd: null, estimate: false, later: [], source: first ? "lodged_bill" : "balance_sheet" };
  }
  return { ...next, building: fwd.building.total, buildingDue: fwd.building.due };
}

function nextTaxCore(next: NextTaxPayment): string {
  const head = next.amount !== null
    ? `~${money(next.amount)} due ${dayLabel(next.due)}${next.estimate ? " (estimate, full balance)" : ""}`
    : `due ${dayLabel(next.due)}`;
  const then = next.later.map((l) => ` · then ~${money(l.amount)} due ${dayLabel(l.due)}`).join("");
  const building = next.building > 0
    ? next.buildingDue ? ` · currently accruing: ~${money(next.building)} due ${dayLabel(next.buildingDue)}` : ` · currently accruing for next period: ~${money(next.building)}`
    : "";
  return `${head}${then}${building}`;
}

export function nextTaxText(next: NextTaxPayment): string {
  return next.amount !== null ? `Next tax payment: ${nextTaxCore(next)}` : `Next tax payment ${nextTaxCore(next)}`;
}

/** Neutral tooltip for the Overview "Protected money %" column. */
export function taxSetAsideTooltip(next: NextTaxPayment | null): string {
  if (!next) return "Tax set aside";
  return `Tax set aside · next ${nextTaxCore(next)}`;
}

export function oldDebtsText(d: DebtorSplit): string {
  return `Old debts to review: ${money(d.old)}${d.oldestOldDue ? ` (oldest from ${monthYearLabel(d.oldestOldDue)})` : ""}`;
}

export function daysUntil(today: string, date: string): number {
  return dayNumber(date) - dayNumber(today);
}
export { dayLabel };

// ---------------------------------------------------------------------------
// Overview alert rules (owner-set, 16 Oct 2026). The Overview badge and the
// Business Health card both call these, so they can never disagree.
// ---------------------------------------------------------------------------
export type AlertLevel = "action" | "warn" | null;
/** A tax payment due within this many days can raise an alert. */
export const TAX_DUE_SOON_DAYS = 7;

export type TaxAlert = {
  level: AlertLevel;
  reason: "past_due" | "due_soon_over_available" | "due_soon_over_cash" | null;
  daysToDue: number | null;
};

/**
 * Tax is money set aside, not a shortfall. Action: a tax payment is past due
 * and still owing, or the next one is due within 7 days and is more than cash
 * at bank + recent debtors. Warn: due within 7 days and more than cash alone.
 */
export function taxPaymentAlert(i: {
  next: NextTaxPayment | null;
  today: string;
  cashAtBank: number;
  recentDebtors: number;
  pastDueOwing: number;
}): TaxAlert {
  if (i.pastDueOwing > 0) return { level: "action", reason: "past_due", daysToDue: null };
  // A lodged ATO bill past its due date and still unpaid is overdue tax.
  if (i.next?.source === "lodged_bill" && i.next.amount && i.next.due < i.today)
    return { level: "action", reason: "past_due", daysToDue: daysUntil(i.today, i.next.due) };
  if (!i.next || i.next.amount === null) return { level: null, reason: null, daysToDue: null };
  const days = daysUntil(i.today, i.next.due);
  if (days < 0 || days > TAX_DUE_SOON_DAYS) return { level: null, reason: null, daysToDue: days };
  if (i.next.amount > i.cashAtBank + Math.max(0, i.recentDebtors)) return { level: "action", reason: "due_soon_over_available", daysToDue: days };
  if (i.next.amount > i.cashAtBank) return { level: "warn", reason: "due_soon_over_cash", daysToDue: days };
  return { level: null, reason: null, daysToDue: days };
}

/** Same thresholds as "Customers paying on time?": red → Action, watch → Warn. */
export function debtorAlert(late: number, recent: number): AlertLevel {
  const s = payingOnTimeStatus(late, recent);
  return s === "red" ? "action" : s === "watch" ? "warn" : null;
}

/** Late share of recent invoices, as a percentage; null when nothing recent. */
export function lateSharePct(d: DebtorSplit): number | null {
  return d.recent > 0 ? (d.late / d.recent) * 100 : null;
}

// ---------------------------------------------------------------------------
// The one builder
// ---------------------------------------------------------------------------
export type HealthInputs = {
  today: string;
  fyLabel: string;
  /** Year-to-date P&L and its actual dates. */
  pnlYtd: { report: { Rows?: Row[] } | null; from: string; to: string } | null;
  /** Cash at bank from `analyseBalanceSheet`; null when unreadable. */
  cashAtBank: number | null;
  invoices: any[] | null;
  monthly: MonthlyCosts | null;
  /** Next GST / PAYG payment, from `nextTaxPayment` (built by the loader). */
  nextTax: NextTaxPayment | null;
  gstCycle: Cycle;
  paygCycle: Cycle;
};

export function computeHealthChecks(input: HealthInputs): HealthChecks {
  const checks: HealthCheck[] = [];

  // 1. Making money?
  const profit = input.pnlYtd ? readProfitRows(input.pnlYtd.report) : { netProfit: null, revenue: null };
  const ytdDays = input.pnlYtd ? dayNumber(input.pnlYtd.to) - dayNumber(input.pnlYtd.from) + 1 : 0;
  const profitHeldBack = !!input.pnlYtd && ytdDays < PROFIT_MIN_DAYS;
  if (profit.netProfit === null) {
    checks.push({ key: "profit", question: "Making money?", figure: "No data", detail: null, status: "na", meaning: "Xero's profit and loss for this year hasn't been saved yet." });
  } else {
    const np = profit.netProfit;
    const margin = profit.revenue && profit.revenue > 0 ? (np / profit.revenue) * 100 : null;
    const status = profitHeldBack ? "na" : profitStatus(np, profit.revenue);
    const figure = `${money(Math.abs(np))} ${np < 0 ? "loss" : "profit"} this year${margin === null ? "" : ` · ${margin.toFixed(1)}% margin`}`;
    const meaning = profitHeldBack
      ? "The financial year has only just started, so it's too early to call."
      : status === "green" ? "Profitable this financial year, with a healthy margin."
      : status === "watch" ? "Making a profit, but only a thin one."
      : "Spending more than is coming in this financial year.";
    const word = status === "green" ? "Healthy" : status === "watch" ? "Thin" : status === "red" ? "Loss" : "Too early";
    const analysis = status === "green"
      ? ["Check profit margin against your industry standards.", "Are you charging enough? Can you automate or systemize better?"]
      : [meaning];
    checks.push({ key: "profit", question: "Making money?", figure, detail: null, status, meaning, title: "Profit",
      rows: [
        { label: "Current Financial Year", value: `${np < 0 ? "-" : ""}${money(Math.abs(np))}` },
        { label: "Margin", value: margin === null ? "—" : `${margin.toFixed(1)}%` },
        { label: "Profit Health", value: word },
      ],
      analysis });
  }

  // 2. Cash cover
  const debtors = splitDebtors(input.invoices, input.today);
  const haveDebtors = input.invoices !== null;
  if (input.cashAtBank === null || !input.monthly || input.monthly.average <= 0) {
    checks.push({ key: "cash_cover", question: "Cash cover", figure: "No data", detail: null, status: "na",
      meaning: input.cashAtBank === null ? "Cash at bank couldn't be read from the saved balance sheet." : "Monthly costs for the last three months aren't saved yet." });
  } else {
    const available = input.cashAtBank + (haveDebtors ? debtors.recent : 0);
    const months = available / input.monthly.average;
    // An overdrawn bank never reads better than Monitor, whatever debtors add.
    const overdrawn = input.cashAtBank < 0;
    const banded = cashCoverStatus(months);
    const status = overdrawn && banded === "green" ? "watch" : banded;
    const cashPart = `Cash ${money(input.cashAtBank)}${overdrawn ? " (overdrawn)" : ""}${haveDebtors ? ` + recent debtors ${money(debtors.recent)}` : ""}`;
    const m = input.monthly;
    checks.push({
      key: "cash_cover",
      question: "Cash cover",
      figure: `${Math.max(0, months).toFixed(1)} months of costs`,
      detail: `${cashPart} = ${money(available)} against monthly costs of ~${money(m.average)} (wages ${money(m.wages)} · other ${money(m.other)})${m.months < 3 ? ` — average of ${m.months} month${m.months === 1 ? "" : "s"}` : ""}`,
      status,
      meaning: cashCoverMeaning(months, haveDebtors) + (overdrawn ? " The bank is overdrawn, so cash cover relies on debtors paying." : ""),
      title: "Cash Cover",
      rows: [
        { label: "Current Coverage (mths)", value: Math.max(0, months).toFixed(1) },
        { label: "Cash Health", value: status === "green" ? "Ok" : status === "watch" ? "Low" : "Critical" },
      ],
      analysis: [
        `${cashPart} = ${money(available)}`,
        ...(haveDebtors ? [`Recent debtors = unpaid invoices no more than ${RECENT_DEBTOR_DAYS} days overdue.`] : []),
        `Monthly costs = ${money(m.average)} (${money(m.wages)} wages + ${money(m.other)} other)`,
        `${cashCoverText(months).replace(/^a/, "A")} of normal costs.`,
      ],
    });
  }

  // 3. Paying on time?
  if (!haveDebtors) {
    checks.push({ key: "paying_on_time", question: "Customers paying on time?", figure: "No data", detail: null, status: "na", meaning: "The list of unpaid sales invoices hasn't been saved yet." });
  } else if (debtors.recent <= 0) {
    checks.push({ key: "paying_on_time", question: "Customers paying on time?", figure: "Nothing owing", detail: null, status: "green", meaning: "No recent sales invoices are waiting to be paid." });
  } else {
    const share = (debtors.late / debtors.recent) * 100;
    const status = payingOnTimeStatus(debtors.late, debtors.recent);
    checks.push({
      key: "paying_on_time",
      question: "Customers paying on time?",
      figure: `${share.toFixed(0)}% late`,
      detail: `${money(debtors.late)} more than ${LATE_AFTER_DAYS} days overdue, of ${money(debtors.recent)} owing from the last ${RECENT_DEBTOR_DAYS} days`,
      status,
      meaning: status === "green" ? "Most customers are paying on time."
        : status === "watch" ? "A fair share of recent invoices are running late — worth a follow-up."
        : "Most recent invoices are overdue — chase them up.",
      title: "Customers Paying",
      rows: [
        { label: "Late Payers", value: `${share.toFixed(0)}%` },
        { label: `${LATE_AFTER_DAYS}+ Days Overdue`, value: money(debtors.late) },
        { label: `${RECENT_DEBTOR_DAYS}+ Days Overdue`, value: money(debtors.old) },
        { label: "Total Owing", value: money(debtors.recent + debtors.old) },
      ],
      analysis: [status === "green" ? "Most customers are paying on time." : "Follow up on late invoices required"],
    });
  }

  // Info lines (never counted)
  const info: HealthInfoLine[] = [];
  const next = input.nextTax;
  if (next) info.push({ key: "next_tax", text: nextTaxText(next) });
  if (haveDebtors && debtors.old > 0) {
    info.push({ key: "old_debts", text: oldDebtsText(debtors) });
  }

  const counted = checks.filter((c) => c.status !== "na").length;
  const onTrack = checks.filter((c) => c.status === "green").length;
  return {
    asOf: input.today,
    fyLabel: input.fyLabel,
    headline: counted === 0 ? "Not enough saved figures yet" : `${onTrack} of ${counted} on track`,
    onTrack,
    counted,
    checks,
    info,
    profitHeldBack,
  };
}

/** Pill wording for the three-panel Business Health layout (owner mockup, 17 Oct). */
export const PANEL_STATUS_LABEL: Record<CheckStatus, string> = { green: "Good", watch: "Monitor", red: "Alert", na: "No data" };
export const PANEL_TITLE: Record<CheckKey, string> = { profit: "Profit", cash_cover: "Cash Cover", paying_on_time: "Customers Paying" };

export const STATUS_LABEL: Record<CheckStatus, string> = PANEL_STATUS_LABEL;
