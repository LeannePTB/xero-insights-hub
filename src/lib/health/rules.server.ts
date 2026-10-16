// The verdict rules engine.
//
// Pure functions over stored snapshot payloads. This module must never import
// `@/lib/xero/api.server` — a verdict costs zero Xero calls, by construction.
//
// Staff-only: nothing here is rendered on a client-facing surface.

import { SNAPSHOT_PAYLOAD_VERSION, STALENESS_SECONDS } from "@/lib/xero/snapshot-keys";
import {
  buildProtectedMoney,
  analyseBalanceSheet,
  type StatutoryOverrides,
  accountRefsById,
  balancesByAccountId,
  type TaxLineExtraction,
} from "@/lib/xero/tax-lines";
import {
  analyseAtoPayables,
  looksLikeAtoContact,
  billsFromPayload,
  buildProtectedMoneySplit,
  type AtoPayablesAnalysis,
  type ProtectedMoneySplit,
} from "@/lib/xero/ato-payables";
import { DEBTOR_RULE, REQUIRED_REPORT_KEYS, TAX_RULE } from "./rule-thresholds";
import {
  dayLabel,
  debtorAlert,
  lateSharePct,
  nextTaxPayment,
  withForwardBuilding,
  lodgedAtoBills,
  oldDebtsText,
  splitDebtors,
  taxPaymentAlert,
  xeroDateISO,
  LATE_AFTER_DAYS,
  RECENT_DEBTOR_DAYS,
  type Cycle,
  type DebtorSplit,
  type NextTaxPayment,
} from "./health-checks";
import { periodEndTaxLookup, taxBalancesFromLines } from "./health-checks.server";
import type { TaxBalances } from "./health-checks";
import { sydneyDate } from "@/lib/sydney-time";

export type RuleSeverity = "critical" | "warning" | "watch";

export type Finding = {
  ruleId: string;
  title: string;
  detail: string;
  severity: RuleSeverity;
  consequenceScore: number;
  daysToConsequence: number | null;
};

export type SnapshotRow = {
  report_key: string;
  payload: any;
  payload_version: number;
  as_at: string;
  fetched_at: string;
  complete: boolean;
  params?: any;
};

export type ClientVerdictInput = {
  clientId: string;
  /** Xero connections linked to the client, with their current status. */
  connections: { tenantId: string; status: string }[];
  snapshots: SnapshotRow[];
  now?: Date;
};

/**
 * Neutral context attached to a verdict: info notes (never counted as a
 * warning), the next tax payment and the recent/late/old debtor split.
 */
export type VerdictExtras = {
  notes?: string[];
  nextTax?: NextTaxPayment | null;
  debtorSplit?: DebtorSplit | null;
};

export type Verdict = VerdictExtras & (
  | { state: "ok"; label: string; detail: string; findings: [] }
  | {
      state: "issues";
      label: string;
      detail: string;
      severity: RuleSeverity;
      topRuleId: string;
      more: number;
      findings: Finding[];
      /** Checks that could not be completed. Drives the report's coverage sentence. */
      gaps?: string[];
    }
  | {
      state: "stale" | "partial" | "disconnected" | "no_data" | "unavailable";
      label: string;
      detail: string;
      findings: [];
      gaps?: string[];
    }
);

// ---------------------------------------------------------------------------
// Coverage
// ---------------------------------------------------------------------------

type KeyState = "usable" | "missing" | "stale" | "partial" | "wrong_version";

/**
 * `skipFreshness` is for rows that were fetched live for this very evaluation
 * (the monthly management report). Such rows are fresh by construction and
 * carry no snapshot payload version, so the staleness and version gates would
 * be meaningless — they are skipped rather than faked with a `fetched_at`.
 */
function keyState(
  row: SnapshotRow | undefined,
  key: string,
  now: Date,
  skipFreshness: boolean,
): KeyState {
  if (!row) return "missing";
  if (!skipFreshness) {
    if (row.payload_version !== SNAPSHOT_PAYLOAD_VERSION) return "wrong_version";
    const maxAge = (STALENESS_SECONDS[key] ?? 30 * 3600) * 1000;
    const fetched = new Date(row.fetched_at).getTime();
    if (!Number.isFinite(fetched) || now.getTime() - fetched > maxAge) return "stale";
  }
  if (!row.complete) return "partial";
  return "usable";
}

// ---------------------------------------------------------------------------
// Money formatting (staff-facing, AUD, brackets for negatives)
// ---------------------------------------------------------------------------

function money(n: number): string {
  const abs = Math.abs(Math.round(n));
  const s = `$${abs.toLocaleString("en-AU")}`;
  return n < 0 ? `(${s})` : s;
}

// ---------------------------------------------------------------------------
// R01 — tax set aside: next payment vs cash (R05 merged in, 16 Oct 2026)
// ---------------------------------------------------------------------------

/** Returns a finding, or a reason the rule could not be evaluated. */
const PROTECTED_MONEY_ABSENT =
  "No GST, PAYG withholding or superannuation balances appeared on the Balance Sheet for this period, so protected money could not be assessed from that report.";
const PROTECTED_MONEY_UNRECOGNISED =
  "The Balance Sheet included statutory balance lines that this report could not identify reliably, so protected money could not be assessed.";
const PROTECTED_MONEY_UNKNOWN =
  "The available accounting records were not sufficient to determine the GST, PAYG withholding and superannuation balances for this period, so protected money was not assessed.";

function taxExtractionUnavailable(result: TaxLineExtraction): string | null {
  if (result.status === "assessed") return null;
  if (result.status === "absent") return PROTECTED_MONEY_ABSENT;
  if (result.status === "unrecognised") return PROTECTED_MONEY_UNRECOGNISED;
  return PROTECTED_MONEY_UNKNOWN;
}

// Precedence: a rule may only speak when BOTH sides of its comparison are
// known. Cash at bank is the denominator of R01 and R05, so anything other
// than a positive, fully read figure ends the rule as not assessed. A missing
// denominator used to produce an infinite ratio, which read as critical.
const CASH_ABSENT =
  "No bank account balance appeared on the Balance Sheet for this period, so this could not be compared against cash at bank.";
const CASH_UNKNOWN =
  "Cash at bank could not be read from the accounting records for this period, so this could not be compared against it.";
const CASH_NOT_POSITIVE =
  "Cash at bank for this period is not a positive balance, so a comparison against it would not be meaningful and was not made.";

type CashExtraction = ReturnType<typeof analyseBalanceSheet>["cashAtBank"];

/** The reason cash cannot serve as the denominator, or null when it can. */
function cashUnavailable(cash: CashExtraction): string | null {
  if (cash.status === "absent") return CASH_ABSENT;
  if (cash.status !== "assessed") return CASH_UNKNOWN;
  // Includes overdrawn files and files whose "bank" accounts are loan or
  // offset facilities: the total is real but it is not spendable cash.
  if (!(cash.total > 0)) return CASH_NOT_POSITIVE;
  return null;
}

/**
 * Which statutory components this client is expected to carry, from its
 * registration settings. An unmatched component that is not expected is the
 * correct position — never a coverage gap, never mentioned on the report.
 */
export type ExpectedStatutory = { gst: boolean; payg: boolean; super: boolean };
const ALL_EXPECTED: ExpectedStatutory = { gst: true, payg: true, super: true };

/** What the tax rule needs beyond the Balance Sheet. */
export type TaxContext = {
  today: string;
  /** Shared forward tax summary (Tax obligations card); replaces "building". */
  forward?: import("@/components/dashboard/tax-obligations").ForwardTax | null;
  gstCycle: Cycle;
  paygCycle: Cycle;
  /** Recent debtors (due in the last 90 days or not yet due). */
  recentDebtors: number;
  /** Tax balances at a lodgement period end; absent → full-balance estimate. */
  periodEnd?: (date: string) => TaxBalances | null;
};
const DEFAULT_TAX_CONTEXT: TaxContext = { today: sydneyDate(), gstCycle: "quarterly", paygCycle: "quarterly", recentDebtors: 0 };

/**
 * Unpaid bills coded to the client's own statutory accounts (matched by
 * AccountID, never by contact name) whose due date has passed.
 */
export function pastDueTaxBills(payload: any, statutoryAccountIds: string[], today: string): number {
  const ids = new Set(statutoryAccountIds);
  if (!ids.size) return 0;
  const invoices = Array.isArray(payload) ? payload : Array.isArray(payload?.Invoices) ? payload.Invoices : [];
  let owing = 0;
  for (const inv of invoices) {
    const due = Number(inv?.AmountDue ?? 0);
    if (!(due > 0)) continue;
    const dueIso = xeroDateISO(inv?.DueDateString) ?? xeroDateISO(inv?.DueDate);
    if (!dueIso || dueIso >= today) continue;
    // Only bills to the ATO are tax debts: a supplier bill with a notional-GST
    // line (e.g. second-hand stock purchases) is not owed to the ATO.
    if (!looksLikeAtoContact(inv?.Contact?.Name)) continue;
    const lines = Array.isArray(inv?.LineItems) ? inv.LineItems : [];
    if (lines.some((li: any) => typeof li?.AccountID === "string" && ids.has(li.AccountID))) owing += due;
  }
  return owing;
}

/** Returns a finding, or a reason the rule could not be evaluated. */
export function ruleProtectedMoneyVsCash(
  balanceSheet: SnapshotRow,
  accounts?: SnapshotRow,
  payables?: SnapshotRow,
  overrides?: StatutoryOverrides,
  expected: ExpectedStatutory = ALL_EXPECTED,
  tax: TaxContext = DEFAULT_TAX_CONTEXT,
): {
  finding: Finding | null;
  unavailable?: string;
  nextTax?: NextTaxPayment | null;
  /** Refusal sentence for the lodged-and-owing split, if it was refused. */
  splitGap?: string;
  split?: ProtectedMoneySplit;
  debug?: { protectedMoneyTotal?: number; cashAtBank?: number };
} {
  const analysed = analyseBalanceSheet(balanceSheet.payload, accounts?.payload, overrides);
  if (analysed.status === "input_invalid" || analysed.cashAtBank.status === "input_invalid") {
    return { finding: null, unavailable: PROTECTED_MONEY_UNKNOWN };
  }

  const unavailable = taxExtractionUnavailable(analysed.taxLines);
  if (unavailable) {
    // Absence is only a gap when a statutory balance could be expected. When
    // no component is expected at all, the file correctly shows nothing —
    // silence, not a partial review.
    if (analysed.taxLines.status === "absent" && !expected.gst && !expected.payg && !expected.super) {
      return { finding: null };
    }
    return { finding: null, unavailable };
  }

  // A client expected to carry no GST, PAYG or super has no protected money to
  // compare with cash, whatever lines happen to match by name (for example a
  // loan to a "Superannuation Fund"). Silence, not a gap.
  if (!expected.gst && !expected.payg && !expected.super) {
    return { finding: null };
  }

  const protectedMoney = buildProtectedMoney(balanceSheet.as_at, analysed.taxLines.lines);
  const cash = analysed.cashAtBank.status === "assessed" ? analysed.cashAtBank.total : null;

  // The lodged-and-owing half of the figure. Amounts come only from line
  // AccountID matches against the very accounts matched above.
  const statutoryAccountIds = analysed.taxLines.lines
    .filter(
      (l) =>
        l.category === "gst" ||
        l.category === "payg" ||
        l.category === "super" ||
        l.category === "ato-combined",
    )
    .map((l) => l.accountId)
    .filter((id): id is string => typeof id === "string");

  // A client registered for neither GST nor PAYG withholding never lodges an
  // activity statement, so there is no lodged-and-owing split to establish.
  // Skipping the analysis also keeps its refusal wording off the report.
  const atoAnalysis: AtoPayablesAnalysis = !expected.gst && !expected.payg
    ? { status: "not_applicable", pattern: "direct" }
    : analyseAtoPayables({
        bills: payables ? billsFromPayload(payables.payload) : null,
        complete: payables ? payables.complete : false,
        periodEnd: balanceSheet.as_at,
        statutoryAccountIds,
        accountsById: accountRefsById(accounts?.payload),
        balancesByAccountId: balancesByAccountId(balanceSheet.payload),
      });
  const split = buildProtectedMoneySplit(protectedMoney.total, atoAnalysis);
  const splitGap = split.refusal ?? undefined;

  // An unmatched component the client is not expected to carry is the correct
  // position, not a gap — it is filtered before any wording is built, so the
  // report never names a tax that does not apply to this client.
  const unresolved = protectedMoney.unresolved.filter((k) =>
    k === "gst"
      ? expected.gst
      : k === "payg"
        ? expected.payg
        : k === "super"
          ? expected.super
          : expected.gst || expected.payg,
  );

  // Nothing resolved at all. Counting components rather than hard-coding three:
  // a combined ATO account replaces the separate GST and PAYG components, so
  // the number of components is no longer fixed.
  if (protectedMoney.components.every((c) => c.status === "unresolved")) {
    return { finding: null, unavailable: PROTECTED_MONEY_UNKNOWN, splitGap, split, debug: { protectedMoneyTotal: protectedMoney.total, cashAtBank: cash ?? undefined } };
  }

  // Absent or unreadable cash ends the rule. A zero or overdrawn balance is a
  // real figure here: it is what the next payment is compared against.
  if (analysed.cashAtBank.status !== "assessed") {
    return { finding: null, unavailable: cashUnavailable(analysed.cashAtBank) ?? CASH_UNKNOWN, splitGap, split, debug: { protectedMoneyTotal: protectedMoney.total } };
  }
  const cashAmount = analysed.cashAtBank.total;
  const total = protectedMoney.total;
  const nextTax = withForwardBuilding(nextTaxPayment({
    gstCycle: tax.gstCycle,
    paygCycle: tax.paygCycle,
    today: tax.today,
    current: taxBalancesFromLines(analysed.taxLines.lines, tax.gstCycle ?? null, tax.paygCycle ?? null),
    periodEnd: tax.periodEnd ?? (() => null),
    lodged: payables ? lodgedAtoBills(payables.payload) : null,
  }), tax.forward);
  const pastDue = payables ? pastDueTaxBills(payables.payload, statutoryAccountIds, tax.today) : 0;
  const alert = taxPaymentAlert({ next: nextTax, today: tax.today, cashAtBank: cashAmount, recentDebtors: tax.recentDebtors, pastDueOwing: pastDue });

  if (!alert.level) {
    if (unresolved.length > 0) {
      return {
        finding: null,
        unavailable: `Tax set aside is incomplete: ${unresolved.join(", ")} could not be matched on the Balance Sheet, so the total is understated.`,
        nextTax,
        splitGap,
        split,
        debug: { protectedMoneyTotal: total, cashAtBank: cashAmount },
      };
    }
    return { finding: null, nextTax, splitGap, split, debug: { protectedMoneyTotal: total, cashAtBank: cashAmount } };
  }

  const severity: RuleSeverity = alert.level === "action" ? "critical" : "warning";
  const when = nextTax ? `${dayLabel(nextTax.due)}${alert.daysToDue === 0 ? " (today)" : ` (in ${alert.daysToDue} day${alert.daysToDue === 1 ? "" : "s"})`}` : "";
  let title: string;
  let detail: string;
  if (alert.reason === "past_due") {
    title = "A tax payment is past its due date";
    const owing = pastDue > 0 ? pastDue : nextTax?.amount ?? 0;
    detail = pastDue > 0
      ? `${money(owing)} of bills coded to tax accounts is past its due date and still owing, against ${money(cashAmount)} cash at bank.`
      : `A lodged activity statement of ${money(owing)} was due ${dayLabel(nextTax!.due)} and is still unpaid, against ${money(cashAmount)} cash at bank.`;
  } else if (alert.reason === "due_soon_over_available") {
    title = "Tax due now is more than cash and recent debtors";
    detail = `About ${money(nextTax!.amount!)} ${nextTax!.source === "lodged_bill" ? "on the lodged activity statement" : `of GST and PAYG withholding for the period ended ${nextTax!.periodEnd ?? "last period"}`} is due ${when}${nextTax!.estimate ? " (estimate, full balance)" : ""}, against ${money(cashAmount)} cash at bank and ${money(tax.recentDebtors)} of recent debtors.`;
  } else {
    title = "Tax due now is more than cash at bank";
    detail = `About ${money(nextTax!.amount!)} ${nextTax!.source === "lodged_bill" ? "on the lodged activity statement" : `of GST and PAYG withholding for the period ended ${nextTax!.periodEnd ?? "last period"}`} is due ${when}${nextTax!.estimate ? " (estimate, full balance)" : ""}, against ${money(cashAmount)} cash at bank. Recent debtors of ${money(tax.recentDebtors)} would cover it once collected.`;
  }

  return {
    finding: {
      ruleId: "R01",
      title,
      detail,
      severity,
      consequenceScore: TAX_RULE.consequence[alert.level],
      daysToConsequence: alert.daysToDue,
    },
    nextTax,
    splitGap,
    split,
    debug: { protectedMoneyTotal: total, cashAtBank: cashAmount },
  };
}

// ---------------------------------------------------------------------------
// R06 — debtor ageing and concentration
// ---------------------------------------------------------------------------

function invoicesOf(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.Invoices)) return payload.Invoices;
  return [];
}

function xeroDate(v: any): number | null {
  if (typeof v !== "string") return null;
  const netMatch = v.match(/\/Date\((\d+)/);
  if (netMatch) return Number(netMatch[1]);
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
}

/**
 * The whole open-invoice book as at `asAtMs` (totals for key figures and
 * creditors). Alerting never uses this — see `ruleDebtors`.
 */
export function debtorBook(
  payload: any,
  asAtMs: number,
): { total: number; overdue: number; over60: number; over90: number; byContact: Map<string, number> } {
  const over60Cutoff = asAtMs - 60 * 86_400_000;
  let over60 = 0;
  const over90Cutoff = asAtMs - RECENT_DEBTOR_DAYS * 86_400_000;
  let total = 0;
  let overdue = 0;
  let over90 = 0;
  const byContact = new Map<string, number>();
  for (const inv of invoicesOf(payload)) {
    const due = Number(inv?.AmountDue ?? 0);
    if (!Number.isFinite(due) || due <= 0) continue;
    total += due;
    const dueDate = xeroDate(inv?.DueDate);
    if (dueDate !== null && dueDate < asAtMs) overdue += due;
    if (dueDate !== null && dueDate < over60Cutoff) over60 += due;
    if (dueDate !== null && dueDate < over90Cutoff) over90 += due;
    const contact = inv?.Contact?.Name ?? "Unnamed customer";
    byContact.set(contact, (byContact.get(contact) ?? 0) + due);
  }
  return { total, overdue, over60, over90, byContact };
}

/**
 * R06 — the "Customers paying on time?" rule. Only invoices due in the last
 * 90 days or not yet due count; debts older than that are an info note, never
 * Action or Warn.
 */
export function ruleDebtors(
  row: SnapshotRow,
  today: string = sydneyDate(),
): { finding: Finding | null; unavailable?: string; notes: string[]; split: DebtorSplit | null } {
  if (!row.complete) {
    return {
      finding: null,
      unavailable: "The open invoice list is incomplete, so debtor ageing was not assessed.",
      notes: [],
      split: null,
    };
  }
  const invoices = invoicesOf(row.payload);
  const split = splitDebtors(invoices, today);
  const notes = split.old > 0 ? [oldDebtsText(split)] : [];
  if (split.recent <= 0) return { finding: null, notes, split };

  const level = debtorAlert(split.late, split.recent);
  const share = Math.round(lateSharePct(split) ?? 0);
  if (level) {
    const severity: RuleSeverity = level === "action" ? "critical" : "warning";
    return {
      finding: {
        ruleId: "R06",
        title: level === "action" ? "Most recent invoices are running late" : "Recent invoices are running late",
        detail: `${money(split.late)} of ${money(split.recent)} owing on recent invoices is more than ${LATE_AFTER_DAYS} days past due (${share}%).`,
        severity,
        consequenceScore: DEBTOR_RULE.consequence[level],
        daysToConsequence: null,
      },
      notes,
      split,
    };
  }

  // Single-customer concentration, recent invoices only, Watch level at most.
  const byContact = new Map<string, number>();
  const t = new Date(`${today}T00:00:00Z`).getTime();
  for (const inv of invoices) {
    const due = Number(inv?.AmountDue ?? 0);
    if (!(due > 0)) continue;
    const iso = xeroDateISO(inv?.DueDateString) ?? xeroDateISO(inv?.DueDate);
    if (iso && (t - new Date(`${iso}T00:00:00Z`).getTime()) / 86_400_000 > RECENT_DEBTOR_DAYS) continue;
    const name = inv?.Contact?.Name ?? "Unnamed customer";
    byContact.set(name, (byContact.get(name) ?? 0) + due);
  }
  let topName = "";
  let topAmount = 0;
  for (const [name, amount] of byContact) if (amount > topAmount) { topAmount = amount; topName = name; }
  const concentration = topAmount / split.recent;
  if (concentration >= DEBTOR_RULE.watchConcentrationShare) {
    return {
      finding: {
        ruleId: "R06",
        title: "Debtors are concentrated in one customer",
        detail: `${topName} owes ${money(topAmount)} of ${money(split.recent)} on recent invoices (${Math.round(concentration * 100)}%).`,
        severity: "watch",
        consequenceScore: DEBTOR_RULE.consequence.watch,
        daysToConsequence: null,
      },
      notes,
      split,
    };
  }
  return { finding: null, notes, split };
}

// ---------------------------------------------------------------------------
// Ranking and the verdict
// ---------------------------------------------------------------------------

export function rankFindings(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => {
    if (b.consequenceScore !== a.consequenceScore) return b.consequenceScore - a.consequenceScore;
    const ad = a.daysToConsequence ?? Number.POSITIVE_INFINITY;
    const bd = b.daysToConsequence ?? Number.POSITIVE_INFINITY;
    if (ad !== bd) return ad - bd;
    return a.ruleId.localeCompare(b.ruleId);
  });
}

export type EvaluateOptions = {
  /** See `keyState`: for rows fetched live rather than read from a snapshot. */
  skipFreshness?: boolean;
  /**
   * Per-client statutory account overrides. Passed straight to
   * `classifyTaxLine`; absent means name matching, exactly as before.
   */
  statutoryOverrides?: StatutoryOverrides;
  /**
   * The client's registration settings, from `clients.gst_cycle` and
   * `clients.payg_withholding_cycle`. Undefined means "unknown", which is
   * treated as registered — the historical behaviour. When BOTH are false, no
   * statutory balance is expected and R01/R05 stay silent on its absence.
   */
  gstRegistered?: boolean;
  withholdsPayg?: boolean;
  /** Lodgement cycles, for the next-tax-payment due date. */
  gstCycle?: Cycle;
  paygCycle?: Cycle;
  forward?: import("@/components/dashboard/tax-obligations").ForwardTax | null;
};

/** Evaluate against stored snapshot rows (the staff badge). */
export function evaluateClient(input: ClientVerdictInput, options: EvaluateOptions = {}): Verdict {
  return evaluateFromRows(input, options);
}

/**
 * Evaluate against any correctly shaped rows, from a snapshot or from a live
 * fetch. The monthly management report uses this with `skipFreshness: true`.
 */
export function evaluateFromRows(
  input: ClientVerdictInput,
  options: EvaluateOptions = {},
): Verdict {
  const skipFreshness = options.skipFreshness === true;
  const now = input.now ?? new Date();

  if (!input.connections.length) {
    return {
      state: "no_data",
      label: "No Xero organisation",
      detail: "No Xero organisation is linked to this client, so there is nothing to assess.",
      findings: [],
    };
  }
  if (!input.connections.some((c) => c.status === "connected")) {
    return {
      state: "disconnected",
      label: "Xero disconnected",
      detail: "The Xero connection was not available when this report was prepared.",
      findings: [],
    };
  }

  const byKey = new Map<string, SnapshotRow>();
  for (const row of input.snapshots) {
    const existing = byKey.get(row.report_key);
    if (!existing || new Date(row.fetched_at) > new Date(existing.fetched_at))
      byKey.set(row.report_key, row);
  }

  const states = new Map<string, KeyState>();
  for (const key of REQUIRED_REPORT_KEYS)
    states.set(key, keyState(byKey.get(key), key, now, skipFreshness));

  const allStates = [...states.values()];
  if (allStates.every((s) => s === "missing")) {
    return {
      state: "no_data",
      label: "No snapshot yet",
      detail:
        "No snapshot has been stored for this client yet. The next overnight refresh will produce one.",
      findings: [],
    };
  }
  if (allStates.includes("stale")) {
    const newest = [...byKey.values()].sort((a, b) => (a.fetched_at < b.fetched_at ? 1 : -1))[0];
    const when = newest
      ? new Date(newest.fetched_at).toLocaleDateString("en-AU")
      : "an earlier date";
    return {
      state: "stale",
      label: "Data out of date",
      detail: `The most recent snapshot is from ${when}. A refresh is pending, so no verdict is shown.`,
      findings: [],
    };
  }

  // Rules run against whatever is usable; anything unusable is reported, never
  // silently skipped.
  const findings: Finding[] = [];
  const gaps: string[] = [];

  // Which statutory components this client is expected to carry, from its
  // registration settings. A client that does not withhold PAYG has no
  // wages withheld from — and no wages means no super accrues, so super
  // follows PAYG withholding (there is no separate super setting).
  const expected: ExpectedStatutory = {
    gst: options.gstRegistered !== false,
    payg: options.withholdsPayg !== false,
    super: options.withholdsPayg !== false,
  };

  const today = sydneyDate(now);
  const notes: string[] = [];
  let nextTax: NextTaxPayment | null = null;
  let debtorSplit: DebtorSplit | null = null;

  // Debtors first: the tax rule counts recent debtors as money coming in.
  const arState = states.get("invoices_accrec_open");
  const ar = byKey.get("invoices_accrec_open");
  let debtorFinding: Finding | null = null;
  if (ar && (arState === "usable" || arState === "partial")) {
    const r = ruleDebtors(ar, today);
    debtorFinding = r.finding;
    debtorSplit = r.split;
    notes.push(...r.notes);
    if (r.unavailable) gaps.push(r.unavailable);
  } else {
    gaps.push("The open invoice snapshot is missing, so debtor ageing was not assessed.");
  }

  const cycleOf = (c: Cycle | undefined, registered: boolean): Cycle =>
    c !== undefined ? c : registered ? "quarterly" : "not_registered";
  const taxCtx: TaxContext = {
    today,
    gstCycle: cycleOf(options.gstCycle, expected.gst),
    paygCycle: cycleOf(options.paygCycle, expected.payg),
    recentDebtors: debtorSplit?.recent ?? 0,
    forward: options.forward ?? null,
    periodEnd: periodEndTaxLookup(
      input.snapshots as any,
      byKey.get("accounts")?.payload,
      options.statutoryOverrides,
      (cycleOf(options.gstCycle, expected.gst) ?? null) as string | null,
      (cycleOf(options.paygCycle, expected.payg) ?? null) as string | null,
    ),
  };

  const bsState = states.get("balance_sheet");
  const bs = byKey.get("balance_sheet");
  if (bs && (bsState === "usable" || bsState === "partial")) {
    if (bsState === "partial") gaps.push("The Balance Sheet snapshot is incomplete.");
    const accounts = byKey.get("accounts");
    // Payables are not a required key (a verdict is still produced without
    // them), so their usability is resolved here rather than read from
    // `states`. Anything short of usable makes the split refuse.
    const apRow = byKey.get("invoices_accpay_open");
    const apState = keyState(apRow, "invoices_accpay_open", now, skipFreshness);
    const ap = apState === "usable" ? apRow : undefined;

    const r01 = ruleProtectedMoneyVsCash(
      bs,
      accounts,
      ap,
      options.statutoryOverrides,
      expected,
      taxCtx,
    );
    nextTax = r01.nextTax ?? null;
    if (r01.finding) findings.push(r01.finding);
    else if (r01.unavailable) gaps.push(r01.unavailable);
    // A refused lodged-and-owing split is reported even when R01 itself fired:
    // the reader must know the total was not established.
    if (r01.splitGap) gaps.push(r01.splitGap);

  } else {
    gaps.push("The Balance Sheet snapshot is missing, so protected money was not assessed.");
  }

  if (debtorFinding) findings.push(debtorFinding);
  const extras: VerdictExtras = { notes, nextTax, debtorSplit };

  if (findings.length) {
    const ranked = rankFindings(findings);
    const top = ranked[0];
    return {
      state: "issues",
      label: top.title,
      detail: gaps.length ? `${top.detail} ${gaps.join(" ")}` : top.detail,
      severity: top.severity,
      topRuleId: top.ruleId,
      more: ranked.length - 1,
      findings: ranked,
      gaps,
      ...extras,
    };
  }

  if (gaps.length) {
    return {
      state: "partial",
      label: `Partial data — ${gaps.length} check${gaps.length === 1 ? "" : "s"} unavailable`,
      detail: gaps.join(" "),
      findings: [],
      gaps,
      ...extras,
    };
  }

  const debtorsClause = "whether customers are paying recent invoices on time";
  const parts: string[] = [];
  if (expected.gst && expected.payg) {
    parts.push("the next GST and PAYG withholding payment against cash at bank");
  } else if (expected.gst) {
    parts.push("the next GST payment against cash at bank");
  } else if (expected.payg) {
    parts.push("the next PAYG withholding payment against cash at bank");
  }
  parts.push(debtorsClause);

  const detail =
    parts.length === 1
      ? `This month we checked ${parts[0]}. Nothing needed attention.`
      : `This month we checked ${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}. Nothing needed attention.`;

  return {
    state: "ok",
    label: "Nothing required attention this month",
    detail,
    findings: [],
    ...extras,
  };
}
