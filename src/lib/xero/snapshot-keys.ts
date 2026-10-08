// The snapshot catalogue: which reports are cached, how their cache key is
// built, and how stale a row may be before it is considered unusable.
//
// Everything tunable lives here so the refresh policy can change without a
// migration. Nothing in this file talks to Xero or to the database.

import { createHash } from "crypto";
import { addDays, addMonths, endOfMonth, startOfFinancialYear, startOfMonth, sydneyDate } from "@/lib/sydney-time";

/** Bump when a payload's shape changes. Older rows are treated as absent. */
export const SNAPSHOT_PAYLOAD_VERSION = 1;

/**
 * Ceiling on Xero calls for a single-file run (manual refresh, first-link
 * backfill). Also the floor for the nightly run. The bound is a number, not
 * the report loop being correct: if the loop misbehaves the run aborts here.
 */
export const MAX_XERO_CALLS_PER_RUN = 400;

/**
 * Nightly run allowance per connected, client-linked Xero file. A file needs
 * about 12 report calls plus up to INVOICE_PAGE_LIMIT pages for each of the two
 * open-invoice lists; 25 covers that with a little slack.
 */
export const XERO_CALLS_PER_FILE_PER_RUN = 25;

/** Absolute upper bound for the nightly run, whatever the file count. */
export const MAX_XERO_CALLS_PER_SCHEDULED_RUN_HARD = 3000;

/** Nightly ceiling: scales with file count, never below the floor or above the hard bound. */
export function scheduledRunCallCeiling(fileCount: number): number {
  const n = Number.isFinite(fileCount) && fileCount > 0 ? Math.floor(fileCount) : 0;
  return Math.min(
    MAX_XERO_CALLS_PER_SCHEDULED_RUN_HARD,
    Math.max(MAX_XERO_CALLS_PER_RUN, n * XERO_CALLS_PER_FILE_PER_RUN),
  );
}

/**
 * Nightly order: files whose last scheduled run is oldest (or never) go first,
 * so any file a stopped run skipped tonight is first tomorrow. Ties keep the
 * given order (callers pass a stable hash order).
 */
export function orderByLeastRecentlyRefreshed<T extends { tenantId: string }>(
  targets: T[],
  lastRunAt: Map<string, string>,
): T[] {
  return targets
    .map((t, i) => ({ t, i, at: lastRunAt.get(t.tenantId) ?? "" }))
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.i - b.i))
    .map((x) => x.t);
}

/** Pages of `Invoices` pulled per report. Each page is one Xero call. */
export const INVOICE_PAGE_LIMIT = 5;

/** Manual "refresh now" throttle: one per tenant per 2 minutes. */
export const MANUAL_REFRESH_MAX = 1;
export const MANUAL_REFRESH_WINDOW_SECONDS = 120;

/** Route-level throttles, applied before any Xero call. */
export const GLOBAL_RUN_MAX = 4;
export const GLOBAL_RUN_WINDOW_SECONDS = 3600;
export const TENANT_RUN_MAX = 2;
export const TENANT_RUN_WINDOW_SECONDS = 3600;

/**
 * How old a snapshot may be before a reader treats it as stale, per report.
 * One daily refresh, so the default is a day plus slack for a missed run.
 * Nothing reads these yet — Stage 5 does.
 */
export const STALENESS_SECONDS: Record<string, number> = {
  balance_sheet: 30 * 3600,
  balance_sheet_prior: 30 * 3600,
  profit_and_loss_mtd: 30 * 3600,
  profit_and_loss_prior: 30 * 3600,
  profit_and_loss_ytd: 30 * 3600,
  trial_balance: 30 * 3600,
  bank_summary: 30 * 3600,
  accounts: 30 * 3600,
  organisation: 30 * 3600,
  invoices_accrec_open: 30 * 3600,
  invoices_accpay_open: 30 * 3600,
  payroll_payruns: 30 * 3600,
  bank_reconciled_latest: 30 * 3600,
};

export type SnapshotReport = {
  reportKey: string;
  /** Xero path, e.g. `Reports/BalanceSheet`. */
  path: string;
  params: Record<string, string | undefined>;
  /** The Sydney calendar date the figures describe. */
  asAt: string;
  /** True when the report is assembled from paginated `Invoices` pages. */
  paginated?: boolean;
  /**
   * Which Xero API the report comes from. Payroll lives on its own base URL
   * and is SKIPPED for any connection that has not granted payroll access —
   * a missing grant is not a failed report.
   */
  api?: "accounting" | "payroll";
};

/**
 * The report catalogue for one tenant, with every date derived in Sydney.
 *
 * `today` is passed in (already a Sydney date) so callers and tests share one
 * clock. Do not default it to a UTC-derived value.
 */
export function snapshotReports(today: string = sydneyDate()): SnapshotReport[] {
  const monthStart = startOfMonth(today);
  const priorMonthEnd = addDays(monthStart, -1);
  const priorMonthStart = startOfMonth(priorMonthEnd);
  const fyStart = startOfFinancialYear(today);
  const bankFrom = addMonths(today, -12);

  return [
    { reportKey: "balance_sheet", path: "Reports/BalanceSheet", params: { date: today }, asAt: today },
    {
      reportKey: "balance_sheet_prior",
      path: "Reports/BalanceSheet",
      params: { date: priorMonthEnd },
      asAt: priorMonthEnd,
    },
    {
      reportKey: "profit_and_loss_mtd",
      path: "Reports/ProfitAndLoss",
      params: { fromDate: monthStart, toDate: today, standardLayout: "false" },
      asAt: today,
    },
    {
      reportKey: "profit_and_loss_prior",
      path: "Reports/ProfitAndLoss",
      params: { fromDate: priorMonthStart, toDate: priorMonthEnd, standardLayout: "false" },
      asAt: priorMonthEnd,
    },
    {
      reportKey: "profit_and_loss_ytd",
      path: "Reports/ProfitAndLoss",
      params: { fromDate: fyStart, toDate: today, standardLayout: "false" },
      asAt: today,
    },
    { reportKey: "trial_balance", path: "Reports/TrialBalance", params: { date: today }, asAt: today },
    {
      reportKey: "bank_summary",
      path: "Reports/BankSummary",
      // Xero caps BankSummary at 365 days.
      params: { fromDate: bankFrom, toDate: today },
      asAt: today,
    },
    { reportKey: "accounts", path: "Accounts", params: {}, asAt: today },
    { reportKey: "organisation", path: "Organisation", params: {}, asAt: today },
    {
      reportKey: "invoices_accrec_open",
      path: "Invoices",
      params: {
        where: 'Type=="ACCREC"&&Status!="PAID"&&Status!="VOIDED"&&Status!="DELETED"&&Status!="DRAFT"',
        order: "DueDate ASC",
      },
      asAt: today,
      paginated: true,
    },
    {
      reportKey: "invoices_accpay_open",
      path: "Invoices",
      params: {
        where: 'Type=="ACCPAY"&&Status!="PAID"&&Status!="VOIDED"&&Status!="DELETED"&&Status!="DRAFT"',
        order: "DueDate ASC",
      },
      asAt: today,
      paginated: true,
    },
    {
      // Pay runs carry the payday, PAYG withheld and super accrued. One call
      // per hundred pay runs; payslips are never read.
      reportKey: "payroll_payruns",
      path: "PayRuns",
      params: {},
      asAt: today,
      api: "payroll",
    },
    {
      // The most recent reconciled bank transaction gives the "bank
      // reconciled to" date for the client overview. One call: first page
      // only, newest first.
      reportKey: "bank_reconciled_latest",
      path: "BankTransactions",
      params: { where: "IsReconciled==true", order: "Date DESC" },
      asAt: today,
    },
  ];
}

/** Unused today; kept next to the catalogue it describes. */
export function monthEndFor(date: string): string {
  return endOfMonth(date);
}

/**
 * The cache key for a snapshot's parameters. Same class of risk as the Stage 1
 * memo key: a collision serves one client another client's figures, so the
 * canonicalisation matches `xeroMemoKey` exactly —
 *
 * - keys sorted, so argument order cannot produce two hashes for one request
 * - empty and undefined values dropped, exactly as the request builder drops them
 * - key and value percent-encoded, so a value containing `=` or `&` cannot
 *   forge a different parameter set
 *
 * `tenant_id` and `client_id` are deliberately NOT inputs: they are columns in
 * the unique constraint, so a lookup is always keyed by all four fields and a
 * hash can never select a row from another tenant.
 */
export function snapshotParamsHash(params: Record<string, string | undefined>): string {
  const parts: string[] = [];
  for (const key of Object.keys(params).sort()) {
    const value = params[key];
    if (value === undefined || value === "") continue;
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
  }
  return createHash("sha256").update(parts.join("&")).digest("hex");
}
