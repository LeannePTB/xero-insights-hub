// The verdict rules engine.
//
// Pure functions over stored snapshot payloads. This module must never import
// `@/lib/xero/api.server` — a verdict costs zero Xero calls, by construction.
//
// Staff-only: nothing here is rendered on a client-facing surface.

import { SNAPSHOT_PAYLOAD_VERSION, STALENESS_SECONDS } from "@/lib/xero/snapshot-keys";
import { buildProtectedMoney, analyseBalanceSheet, type TaxLineExtraction } from "@/lib/xero/tax-lines";
import {
  R01_PROTECTED_MONEY,
  R05_STATUTORY_MAGNITUDE,
  R06_DEBTORS,
  REQUIRED_REPORT_KEYS,
} from "./rule-thresholds";

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
};

export type ClientVerdictInput = {
  clientId: string;
  /** Xero connections linked to the client, with their current status. */
  connections: { tenantId: string; status: string }[];
  snapshots: SnapshotRow[];
  now?: Date;
};

export type Verdict =
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
    };

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
// R01 — protected money vs cash at bank
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

/** Returns a finding, or a reason the rule could not be evaluated. */
export function ruleProtectedMoneyVsCash(balanceSheet: SnapshotRow, accounts?: SnapshotRow): {
  finding: Finding | null;
  unavailable?: string;
  debug?: { protectedMoneyTotal?: number; cashAtBank?: number };
} {
  const analysed = analyseBalanceSheet(balanceSheet.payload, accounts?.payload);
  if (analysed.status === "input_invalid" || analysed.cashAtBank.status === "input_invalid") {
    return { finding: null, unavailable: PROTECTED_MONEY_UNKNOWN };
  }

  const unavailable = taxExtractionUnavailable(analysed.taxLines);
  if (unavailable) return { finding: null, unavailable };

  const protectedMoney = buildProtectedMoney(balanceSheet.as_at, analysed.taxLines.lines);
  const cash = analysed.cashAtBank.total;

  if (protectedMoney.unresolved.length === 3) {
    return { finding: null, unavailable: PROTECTED_MONEY_UNKNOWN, debug: { protectedMoneyTotal: protectedMoney.total, cashAtBank: cash } };
  }

  const t = R01_PROTECTED_MONEY;
  const total = protectedMoney.total;
  const ratio = cash > 0 ? total / cash : total > 0 ? Infinity : 0;

  let severity: RuleSeverity | null = null;
  let title = "";
  if (ratio >= t.criticalRatio) {
    severity = "critical";
    title = "Protected money exceeds cash at bank";
  } else if (ratio >= t.warningRatio) {
    severity = "warning";
    title = "Protected money is close to cash at bank";
  } else if (ratio >= t.watchRatio) {
    severity = "watch";
    title = "Protected money is over half of cash at bank";
  }

  if (!severity) {
    // An unmatched component is not a zero. If the rule would otherwise stay
    // quiet, report the gap rather than implying the client is fine.
    if (protectedMoney.unresolved.length > 0) {
      return {
        finding: null,
        unavailable: `Protected money is incomplete: ${protectedMoney.unresolved.join(", ")} could not be matched on the Balance Sheet, so the total is understated.`,
        debug: { protectedMoneyTotal: total, cashAtBank: cash },
      };
    }
    return { finding: null };
  }

  const gap =
    protectedMoney.unresolved.length > 0
      ? ` ${protectedMoney.unresolved.length} component(s) could not be matched, so the true figure is higher.`
      : "";

  return {
    finding: {
      ruleId: "R01",
      title,
      detail: `${money(total)} of GST, PAYG withholding and superannuation is held against ${money(cash)} cash at bank.${gap}`,
      severity,
      consequenceScore: t.consequence[severity],
      daysToConsequence: null,
    },
    debug: { protectedMoneyTotal: total, cashAtBank: cash },
  };
}

// ---------------------------------------------------------------------------
// R05 — statutory balances relative to cash (magnitude only)
//
// This rule describes what the Balance Sheet says is owing. It says nothing
// about what has been lodged or when anything is due: Xero has no endpoint
// that reports lodgement status. Never word it as "overdue".
// ---------------------------------------------------------------------------

export function ruleStatutoryMagnitude(balanceSheet: SnapshotRow, accounts?: SnapshotRow): {
  finding: Finding | null;
  unavailable?: string;
  debug?: { statutoryTotal?: number; cashAtBank?: number };
} {
  const analysed = analyseBalanceSheet(balanceSheet.payload, accounts?.payload);
  if (analysed.status === "input_invalid" || analysed.cashAtBank.status === "input_invalid") {
    return { finding: null, unavailable: PROTECTED_MONEY_UNKNOWN };
  }

  const unavailable = taxExtractionUnavailable(analysed.taxLines);
  if (unavailable) return { finding: null, unavailable };

  const lines = analysed.taxLines.lines;
  const statutory = lines
    .filter((l) => l.category === "gst" || l.category === "payg" || l.category === "other-tax")
    .reduce((s, l) => s + l.amount, 0);
  if (
    !lines.some((l) => l.category === "gst" || l.category === "payg" || l.category === "other-tax")
  ) {
    return {
      finding: null,
      unavailable: "No GST, PAYG withholding or tax account could be matched on the Balance Sheet.",
      debug: { statutoryTotal: statutory, cashAtBank: analysed.cashAtBank.total },
    };
  }

  const cash = analysed.cashAtBank.total;
  const t = R05_STATUTORY_MAGNITUDE;
  const ratio = cash > 0 ? statutory / cash : statutory > 0 ? Infinity : 0;

  let severity: RuleSeverity | null = null;
  if (ratio >= t.warningRatio) severity = "warning";
  else if (ratio >= t.watchRatio) severity = "watch";
  if (!severity) return { finding: null, debug: { statutoryTotal: statutory, cashAtBank: cash } };

  return {
    finding: {
      ruleId: "R05",
      title: "Statutory balances are large relative to cash",
      detail: `${money(statutory)} of GST, PAYG withholding and tax balances sits on the Balance Sheet at ${balanceSheet.as_at}, against ${money(cash)} cash at bank. This is the balance owing only — it says nothing about what has been lodged.`,
      severity,
      consequenceScore: t.consequence[severity],
      daysToConsequence: null,
    },
    debug: { statutoryTotal: statutory, cashAtBank: cash },
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

export function ruleDebtors(row: SnapshotRow): { finding: Finding | null; unavailable?: string } {
  // A truncated invoice pull is written with `complete = false`. Ageing and
  // concentration computed on part of the book would be wrong in the safe-
  // looking direction, so the rule refuses to run.
  if (!row.complete) {
    return {
      finding: null,
      unavailable: "The open invoice list is incomplete, so debtor ageing was not assessed.",
    };
  }

  const invoices = invoicesOf(row.payload);
  if (!invoices.length) return { finding: null };

  const asAt = new Date(`${row.as_at}T00:00:00Z`).getTime();
  const over90Cutoff = asAt - R06_DEBTORS.over90Days * 86_400_000;

  let total = 0;
  let overdue = 0;
  let over90 = 0;
  const byContact = new Map<string, number>();

  for (const inv of invoices) {
    const due = Number(inv?.AmountDue ?? 0);
    if (!Number.isFinite(due) || due <= 0) continue;
    total += due;
    const dueDate = xeroDate(inv?.DueDate);
    if (dueDate !== null && dueDate < asAt) overdue += due;
    if (dueDate !== null && dueDate < over90Cutoff) over90 += due;
    const contact = inv?.Contact?.Name ?? "Unnamed customer";
    byContact.set(contact, (byContact.get(contact) ?? 0) + due);
  }

  if (total <= 0) return { finding: null };

  const t = R06_DEBTORS;
  const over90Share = over90 / total;
  const overdueShare = overdue / total;
  let topName = "";
  let topAmount = 0;
  for (const [name, amount] of byContact) {
    if (amount > topAmount) {
      topAmount = amount;
      topName = name;
    }
  }
  const concentration = topAmount / total;

  if (over90Share >= t.criticalOver90Share) {
    return {
      finding: {
        ruleId: "R06",
        // Canonical document wording: descriptive, no judgement. The staff
        // badge abbreviates this in badge-wording.ts.
        title: "Most of the debtor book is more than 90 days past due",
        detail: `${money(over90)} of ${money(total)} owing is more than ${t.over90Days} days past its due date (${Math.round(over90Share * 100)}% of the book).`,
        severity: "critical",
        consequenceScore: t.consequence.critical,
        daysToConsequence: t.daysToConsequence.critical,
      },
    };
  }
  if (overdueShare >= t.warningOverdueShare) {
    return {
      finding: {
        ruleId: "R06",
        title: "Most of the debtor book is overdue",
        detail: `${money(overdue)} of ${money(total)} owing is past its due date (${Math.round(overdueShare * 100)}% of the book).`,
        severity: "warning",
        consequenceScore: t.consequence.warning,
        daysToConsequence: t.daysToConsequence.warning,
      },
    };
  }
  if (concentration >= t.watchConcentrationShare) {
    return {
      finding: {
        ruleId: "R06",
        title: "Debtors are concentrated in one customer",
        detail: `${topName} owes ${money(topAmount)} of ${money(total)} (${Math.round(concentration * 100)}% of the book).`,
        severity: "watch",
        consequenceScore: t.consequence.watch,
        daysToConsequence: t.daysToConsequence.watch,
      },
    };
  }
  return { finding: null };
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
};

/** Evaluate against stored snapshot rows (the staff badge). */
export function evaluateClient(input: ClientVerdictInput): Verdict {
  return evaluateFromRows(input, {});
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

  const bsState = states.get("balance_sheet");
  const bs = byKey.get("balance_sheet");
  if (bs && (bsState === "usable" || bsState === "partial")) {
    if (bsState === "partial") gaps.push("The Balance Sheet snapshot is incomplete.");
    const accounts = byKey.get("accounts");
    for (const run of [ruleProtectedMoneyVsCash, ruleStatutoryMagnitude]) {
      const r = run(bs, accounts);
      if (r.finding) findings.push(r.finding);
      else if (r.unavailable) gaps.push(r.unavailable);
    }
  } else {
    gaps.push("The Balance Sheet snapshot is missing, so protected money was not assessed.");
  }

  const arState = states.get("invoices_accrec_open");
  const ar = byKey.get("invoices_accrec_open");
  if (ar && (arState === "usable" || arState === "partial")) {
    const r = ruleDebtors(ar);
    if (r.finding) findings.push(r.finding);
    else if (r.unavailable) gaps.push(r.unavailable);
  } else {
    gaps.push("The open invoice snapshot is missing, so debtor ageing was not assessed.");
  }

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
    };
  }

  if (gaps.length) {
    return {
      state: "partial",
      label: `Partial data — ${gaps.length} check${gaps.length === 1 ? "" : "s"} unavailable`,
      detail: gaps.join(" "),
      findings: [],
      gaps,
    };
  }

  return {
    state: "ok",
    label: "Nothing required attention this month",
    detail:
      "We reviewed protected money held against cash at bank, the statutory balances carried on the Balance Sheet, and the ageing and concentration of the debtor book. Nothing in those checks required attention.",
    findings: [],
  };
}
