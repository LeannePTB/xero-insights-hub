// Loads the stored figures behind the Business Health checks and runs the one
// builder in `health-checks.ts`. Shared by the dashboard card, the client-list
// badge and the monthly report.
//
// Stored data only: this module never calls Xero. Every read goes through the
// caller's own Supabase client, so RLS on `xero_snapshots`, the classification
// tables and `clients` applies as the caller (never the service role). A
// tenant ID is a filter, never a grant; callers authorise before calling.

import { addMonths, endOfMonth, startOfFinancialYear, startOfMonth } from "@/lib/sydney-time";
import { computeHealthChecks, monthlyCosts, normaliseName, type HealthChecks } from "./health-checks";
import type { SnapshotSource } from "@/lib/xero/snapshot-source";
import { analyseBalanceSheet, countsTowardProtected, type StatutoryOverrides } from "@/lib/xero/tax-lines";
import { applyBankClassifications, type BankClassificationRow } from "@/lib/xero/bank-classifications";
import { lodgedAtoBills, nextTaxPayment, type TaxBalances } from "./health-checks";
import { nextTaxFromForward } from "@/lib/tax/forward-stored";

/**
 * GST and PAYG withholding owed on one balance sheet, for the cycles the client
 * is registered for. A combined ATO account counts with GST when registered,
 * else with PAYG. The one definition behind "Next tax payment" on the Business
 * Health card, the Overview tooltip and the Overview tax rule.
 */
export function taxBalancesFromLines(
  lines: { amount: number; category: string }[],
  gstCycle: string | null,
  paygCycle: string | null,
): TaxBalances {
  const gstOn = !!gstCycle && gstCycle !== "not_registered";
  const paygOn = !!paygCycle && paygCycle !== "not_registered";
  const out: TaxBalances = { gst: 0, payg: 0 };
  for (const l of lines) {
    if (!countsTowardProtected(l as any)) continue;
    if (l.category === "gst" && gstOn) out.gst += l.amount;
    else if (l.category === "payg" && paygOn) out.payg += l.amount;
    else if (l.category === "ato-combined") {
      if (gstOn) out.gst += l.amount;
      else if (paygOn) out.payg += l.amount;
    }
  }
  return out;
}

/** Report keys that can hold a lodgement period-end balance sheet. */
export const PERIOD_END_BS_KEYS = ["balance_sheet_prior", "balance_sheet_period_end"] as const;

/**
 * Period-end tax balances by date, from stored period-end balance sheets
 * (`params.date` is the period end). Same tax-line extraction as today's.
 */
export function periodEndTaxLookup(
  rows: { report_key: string; params: any; payload: any; complete?: boolean; fetched_at: string }[],
  accountsPayload: any,
  overrides: StatutoryOverrides | undefined,
  gstCycle: string | null,
  paygCycle: string | null,
): (date: string) => TaxBalances | null {
  const sorted = rows
    .filter((r) => (PERIOD_END_BS_KEYS as readonly string[]).includes(r.report_key) && r.complete !== false)
    .sort((a, b) => (a.fetched_at < b.fetched_at ? 1 : -1));
  return (date: string) => {
    const row = sorted.find((r) => r.params?.date === date);
    if (!row) return null;
    const a = analyseBalanceSheet(row.payload, accountsPayload, overrides);
    if (a.taxLines.status !== "assessed") return a.taxLines.status === "absent" ? { gst: 0, payg: 0 } : null;
    return taxBalancesFromLines(a.taxLines.lines, gstCycle, paygCycle);
  };
}

/**
 * Cash at bank for one balance sheet: the client's bank-account
 * classifications applied to the accounts first, so credit cards and excluded
 * accounts never count as cash. The Overview "Cash at bank" column, the
 * Overview tax rule and Business Health all read cash through this.
 */
export function classifiedAccounts(accounts: any[] | null | undefined, bankRows: BankClassificationRow[]): { Accounts: any[] } | undefined {
  return Array.isArray(accounts) ? { Accounts: applyBankClassifications(accounts, bankRows) } : undefined;
}

export const MONTHLY_PNL_KEY = "profit_and_loss_monthly_last3";
const LATEST_KEYS = ["profit_and_loss_ytd", "balance_sheet", "invoices_accrec_open", "invoices_accpay_open", "accounts", MONTHLY_PNL_KEY];
/** Period-end rows are closed periods: read regardless of age. */
const PERIOD_END_MAX_AGE_DAYS = 200;
/** Ignore stored rows older than this: a week-old balance is not "the" balance. */
const MAX_AGE_DAYS = 7;

export type KnownDebt = { name: string; balance: number };
export type HealthChecksResult = HealthChecks & {
  source: SnapshotSource; tenantId: string | null;
  /** Cash Cover's cash at bank (cards never reduce it) and its balance-sheet date. */
  cashAtBank?: number | null; cashAsAt?: string | null;
  /** Loan / ATO liability lines from the same saved balance sheet. */
  knownDebts?: KnownDebt[];
};

const DEBT_NAME = /loan|\bato\b|integrated client|finance|hire purchase|chattel|equipment|overdraft|director/i;
/** Liability rows that look like borrowings or ATO debts (display/prefill only). */
export function knownDebtLines(bsPayload: any): KnownDebt[] {
  const out: KnownDebt[] = [];
  const walk = (rows: any[], inLiab: boolean) => {
    for (const r of rows ?? []) {
      const liab = inLiab || /liabilit/i.test(String(r?.Title ?? ""));
      if (Array.isArray(r?.Rows)) walk(r.Rows, liab);
      else if (liab && r?.RowType === "Row" && Array.isArray(r.Cells)) {
        const name = String(r.Cells[0]?.Value ?? "");
        const v = Number(String(r.Cells[1]?.Value ?? "").replace(/,/g, ""));
        if (DEBT_NAME.test(name) && Number.isFinite(v) && v > 0) out.push({ name: name.slice(0, 80), balance: Math.round(v * 100) / 100 });
      }
    }
  };
  walk(bsPayload?.Reports?.[0]?.Rows ?? [], false);
  return out.slice(0, 20);
}

function fyLabelFor(today: string): string {
  const s = +startOfFinancialYear(today).slice(0, 4);
  return `FY${String(s).slice(-2)}–${String(s + 1).slice(-2)} to date`;
}

/** The last three full calendar months before `today`, oldest first. */
export function lastThreeFullMonths(today: string): { from: string; to: string }[] {
  const thisMonth = startOfMonth(today);
  return [-3, -2, -1].map((k) => {
    const from = addMonths(thisMonth, k);
    return { from, to: endOfMonth(from) };
  });
}

export async function loadHealthChecks(
  supabase: any,
  targets: { clientId: string; tenantId?: string | null }[],
  today: string,
): Promise<Map<string, HealthChecksResult>> {
  const out = new Map<string, HealthChecksResult>();
  const clientIds = Array.from(new Set(targets.map((t) => t.clientId))).slice(0, 500);
  if (!clientIds.length) return out;
  const months = lastThreeFullMonths(today);
  const since = new Date(Date.now() - MAX_AGE_DAYS * 86_400_000).toISOString();
  const cols = "client_id, tenant_id, report_key, params, payload, payload_version, fetched_at, as_at, complete";

  const [latestQ, priorQ, bankQ, overrideQ, clientQ, wageQ, periodQ] = await Promise.all([
    supabase.from("xero_snapshots").select(cols).in("client_id", clientIds).in("report_key", LATEST_KEYS).gte("fetched_at", since).order("fetched_at", { ascending: false }),
    supabase.from("xero_snapshots").select(cols).in("client_id", clientIds).eq("report_key", "profit_and_loss_prior").in("params->>fromDate", months.map((m) => m.from)).order("fetched_at", { ascending: false }),
    supabase.from("account_setup_bank_v").select("client_id, tenant_id, account_id, classification").in("client_id", clientIds),
    supabase.from("account_setup_statutory_v").select("client_id, account_name, category").in("client_id", clientIds),
    supabase.from("clients").select("id, gst_cycle, payg_withholding_cycle").in("id", clientIds),
    supabase.from("account_setup_cost_v").select("client_id, tenant_id, account_name, classification, is_wages").in("client_id", clientIds),
    supabase.from("xero_snapshots").select(cols).in("client_id", clientIds).in("report_key", PERIOD_END_BS_KEYS as unknown as string[]).gte("fetched_at", new Date(Date.now() - PERIOD_END_MAX_AGE_DAYS * 86_400_000).toISOString()).order("fetched_at", { ascending: false }),
  ]);
  if (latestQ.error || priorQ.error) throw new Error("Saved figures could not be read.");
  // The shared forward tax figures (same as the Tax obligations card).
  const { loadStoredForward } = await import("@/lib/tax/forward-tax.server");
  const forward = await loadStoredForward(supabase, targets.map((t) => ({ clientId: t.clientId, tenantId: t.tenantId ?? null })), today).catch(() => new Map());

  const { SNAPSHOT_PAYLOAD_VERSION, STALENESS_SECONDS } = await import("@/lib/xero/snapshot-keys");
  const { statutoryOverrideMap } = await import("@/lib/xero/tax-lines");
  const { sydneyDate } = await import("@/lib/sydney-time");
  const rows = ((latestQ.data ?? []) as any[]).filter((r) => r.payload_version === SNAPSHOT_PAYLOAD_VERSION);
  const priorRows = ((priorQ.data ?? []) as any[]).filter((r) => r.payload_version === SNAPSHOT_PAYLOAD_VERSION);

  for (const t of targets) {
    const mine = rows.filter((r) => r.client_id === t.clientId);
    const tenantId = t.tenantId ?? mine.find((r) => r.report_key === "balance_sheet")?.tenant_id ?? mine[0]?.tenant_id ?? null;
    const pick = (key: string) => mine.find((r) => r.report_key === key && r.tenant_id === tenantId) ?? null;
    const used: any[] = [];
    const use = (r: any) => { if (r) used.push(r); return r; };

    const ytd = use(pick("profit_and_loss_ytd"));
    const bs = use(pick("balance_sheet"));
    const inv = use(pick("invoices_accrec_open"));
    // Payables are only read for lodged ATO bills; not part of the freshness line.
    const ap = pick("invoices_accpay_open");
    const acc = use(pick("accounts"));
    const accounts: any[] | null = Array.isArray(acc?.payload?.Accounts) ? acc.payload.Accounts : null;

    // Monthly costs: the nightly three-month P&L when it matches this window,
    // else the stored one-month "prior month" P&Ls for each of those months.
    const monthly3 = pick(MONTHLY_PNL_KEY);
    let monthlyReports: any[] = [];
    if (monthly3 && monthly3.params?.toDate === months[2]!.to && monthly3.params?.fromDate === months[2]!.from) {
      use(monthly3);
      monthlyReports = [monthly3.payload?.Reports?.[0]];
    } else {
      for (const m of months) {
        const r = priorRows.find((p) => p.client_id === t.clientId && p.tenant_id === tenantId && p.params?.fromDate === m.from && p.params?.toDate === m.to);
        // Closed past months: not counted in the freshness line, which would
        // otherwise report the date the oldest month was first saved.
        if (r) monthlyReports.push(r.payload?.Reports?.[0]);
      }
    }
    const wageNames = new Set<string>(
      ((wageQ.data ?? []) as any[])
        .filter((w) => w.client_id === t.clientId && w.tenant_id === tenantId && (w.is_wages || w.classification === "wages"))
        .map((w) => normaliseName(String(w.account_name))),
    );
    const monthly = monthlyReports.length ? monthlyCosts(monthlyReports, accounts, wageNames) : null;

    // Cash at bank and tax: the same analysis as the Overview column and rule.
    let cashAtBank: number | null = null;
    let nextTax = null as ReturnType<typeof nextTaxPayment>;
    const client = ((clientQ.data ?? []) as any[]).find((c) => c.id === t.clientId);
    const gstCycle = client?.gst_cycle ?? null;
    const paygCycle = client?.payg_withholding_cycle ?? null;
    if (bs && accounts) {
      const banks = ((bankQ.data ?? []) as any[]).filter((b) => b.client_id === t.clientId && b.tenant_id === tenantId);
      const overrides = statutoryOverrideMap(((overrideQ.data ?? []) as any[]).filter((o) => o.client_id === t.clientId));
      const accs = classifiedAccounts(accounts, banks);
      const analysis = analyseBalanceSheet(bs.payload, accs, overrides);
      if (analysis.cashAtBank.status === "assessed" || analysis.cashAtBank.status === "absent") cashAtBank = analysis.cashAtBank.total;
      const periodRows = ((periodQ.data ?? []) as any[]).filter((r) => r.client_id === t.clientId && r.tenant_id === tenantId && r.payload_version === SNAPSHOT_PAYLOAD_VERSION);
      nextTax = nextTaxPayment({
        gstCycle,
        paygCycle,
        today,
        current: analysis.taxLines.status === "assessed" ? taxBalancesFromLines(analysis.taxLines.lines, gstCycle, paygCycle) : analysis.taxLines.status === "absent" ? { gst: 0, payg: 0 } : null,
        periodEnd: periodEndTaxLookup(periodRows, accs, overrides, gstCycle, paygCycle),
        lodged: ap ? lodgedAtoBills(ap.payload) : null,
      });
    }

    const checks = computeHealthChecks({
      today,
      fyLabel: fyLabelFor(today),
      pnlYtd: ytd ? { report: ytd.payload?.Reports?.[0] ?? null, from: ytd.params?.fromDate ?? startOfFinancialYear(today), to: ytd.params?.toDate ?? today } : null,
      cashAtBank,
      invoices: inv ? (inv.payload?.Invoices ?? []) : null,
      monthly,
      // One tax-position reader: lodged bills, unlodged finished periods and accruing tax all come from the shared forward summary.
      nextTax: forward.has(t.clientId) ? nextTaxFromForward(forward.get(t.clientId)?.tax) : nextTax,
      gstCycle,
      paygCycle,
    });

    // Freshness: the OLDEST stored component is what the card is as fresh as.
    const oldest = used.slice().sort((a, b) => (a.fetched_at < b.fetched_at ? -1 : 1))[0];
    const source: SnapshotSource = oldest
      ? {
          mode: "snapshot",
          asAt: sydneyDate(new Date(oldest.as_at)),
          fetchedAt: oldest.fetched_at,
          stale: used.some((r) => (Date.now() - new Date(r.fetched_at).getTime()) / 1000 >= (STALENESS_SECONDS[r.report_key] ?? 30 * 3600)),
          complete: used.every((r) => r.complete !== false),
          connection: "unknown",
        }
      : { mode: "pending", asAt: null, fetchedAt: null, stale: false, complete: true, connection: "unknown", reason: "missing" };

    out.set(t.clientId, { ...checks, source, tenantId, cashAtBank, cashAsAt: bs?.as_at ? sydneyDate(new Date(bs.as_at)) : null, knownDebts: bs ? knownDebtLines(bs.payload) : [] });
  }
  return out;
}
