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
 * Hard ceiling on Xero calls issued by a single refresh run. The bound is a
 * number, not the report loop being correct: if the loop ever misbehaves the
 * run aborts here rather than spending the app-wide daily quota.
 */
export const MAX_XERO_CALLS_PER_RUN = 400;

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
