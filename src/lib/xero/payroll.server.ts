// Server-only Australian payroll reader (payroll.xro/1.0).
//
// WHAT XERO GIVES US, AND WHAT IT DOES NOT
// The pay run list carries, per pay run: the period, the PAYDAY (`PaymentDate`),
// PAYG withheld (`Tax`) and superannuation accrued (`Super`). That is the whole
// accrual side, in ONE call per hundred pay runs — payslips are not read,
// because the per-employee call cost buys nothing this app displays.
//
// Xero exposes NO record of super being PAID to a fund: there is no endpoint
// for super payment batches, auto-super submissions or their dates. Nothing
// built on this module may therefore state that a payday was paid on time.
// The only truthful framing is "accrued on this payday", plus the age of the
// oldest payday, flagged as "may be overdue — check the fund".
//
// Access: reads go through the snapshot table under the caller's own session
// where a stored row exists (invariant 4 — a tenantId is a filter). The live
// fallback is one cheap list call, never a per-employee fan-out.

import type { Connection } from "./api.server";

export type PayRunSummary = {
  payRunID: string;
  periodStart: string | null;
  periodEnd: string | null;
  /** The payday. Superannuation timing runs from this date, not the period end. */
  paymentDate: string | null;
  wages: number;
  /** PAYG withheld in this pay run. */
  tax: number;
  /** Superannuation accrued in this pay run. */
  super: number;
};

export type PayrollPayRuns =
  | { status: "available"; payRuns: PayRunSummary[]; truncated: boolean }
  /** The list read fine and this file has never run a pay run. */
  | { status: "no_payroll" }
  /** Payroll access has not been authorised on this connection yet. */
  | { status: "not_authorised"; reason: string }
  /** Something else went wrong — never treat as zero. */
  | { status: "unavailable"; reason: string };

export const PAYROLL_PAYRUNS_REPORT_KEY = "payroll_payruns";

/** Xero returns `/Date(1788480000000+0000)/`; these are date-only values at UTC midnight. */
export function xeroPayrollDate(v: unknown): string | null {
  const m = /\/Date\((-?\d+)/.exec(String(v ?? ""));
  if (!m) return null;
  const d = new Date(Number(m[1]));
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

const PAGE_SIZE = 100;

/**
 * Every POSTED pay run, newest first. `maxPages` bounds the Xero spend — one
 * call per hundred pay runs, so three pages covers about eleven years of
 * fortnightly payroll.
 */
export async function fetchPayRuns(conn: Connection, maxPages = 3): Promise<PayrollPayRuns> {
  const { xeroGetPayroll, XeroScopeMissingError } = await import("./api.server");
  const out: PayRunSummary[] = [];
  let truncated = false;
  try {
    for (let page = 1; page <= maxPages; page++) {
      const res = await xeroGetPayroll<{ PayRuns?: any[] }>(conn, "PayRuns", { page: String(page) });
      const rows = res.PayRuns ?? [];
      for (const r of rows) {
        if (String(r?.PayRunStatus ?? "").toUpperCase() !== "POSTED") continue;
        out.push({
          payRunID: String(r?.PayRunID ?? ""),
          periodStart: xeroPayrollDate(r?.PayRunPeriodStartDate),
          periodEnd: xeroPayrollDate(r?.PayRunPeriodEndDate),
          paymentDate: xeroPayrollDate(r?.PaymentDate),
          wages: Number(r?.Wages) || 0,
          tax: Number(r?.Tax) || 0,
          super: Number(r?.Super) || 0,
        });
      }
      if (rows.length < PAGE_SIZE) break;
      if (page === maxPages) truncated = true;
    }
  } catch (e) {
    if (e instanceof XeroScopeMissingError) {
      return {
        status: "not_authorised",
        reason:
          "This organisation has not authorised payroll access in Xero yet, so pay runs cannot be read.",
      };
    }
    return { status: "unavailable", reason: e instanceof Error ? e.message : String(e) };
  }
  if (out.length === 0) return { status: "no_payroll" };
  out.sort((a, b) => (b.paymentDate ?? "").localeCompare(a.paymentDate ?? ""));
  return { status: "available", payRuns: out, truncated };
}

/**
 * Pay runs for a tenant: the stored nightly snapshot when there is one, a
 * single live list call otherwise. Never fans out to payslips.
 */
export async function loadPayRuns(opts: {
  supabase: any;
  tenantId: string;
  clientId?: string | null;
  conn?: Connection;
}): Promise<PayrollPayRuns & { fromSnapshot: boolean; fetchedAt?: string }> {
  const { readSnapshot } = await import("./snapshot-read.server");
  const hit = await readSnapshot({
    supabase: opts.supabase,
    tenantId: opts.tenantId,
    clientId: opts.clientId ?? null,
    reportKey: PAYROLL_PAYRUNS_REPORT_KEY,
  });
  if (hit?.payload && typeof hit.payload === "object" && "status" in hit.payload) {
    return { ...(hit.payload as PayrollPayRuns), fromSnapshot: true, fetchedAt: hit.source.fetchedAt };
  }
  const conn = opts.conn ?? (await (await import("./api.server")).getConnectionByTenant(opts.tenantId));
  return { ...(await fetchPayRuns(conn)), fromSnapshot: false };
}

/** Pay runs whose PAYDAY falls inside the period. Payday is the BAS trigger. */
export function payRunsInPeriod(payRuns: PayRunSummary[], from: string, to: string): PayRunSummary[] {
  return payRuns.filter((p) => !!p.paymentDate && p.paymentDate >= from && p.paymentDate <= to);
}
