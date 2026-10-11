// Nightly key figures (client overview, Batch 3). System context only: called
// by the scheduled snapshot refresh after a file's run, never by a user path.
// Reads the snapshots that run just stored and writes one numeric row per
// client, Xero file and Sydney day. Zero Xero calls.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sydneyDate, endOfMonth } from "@/lib/sydney-time";
import { debtorBook } from "@/lib/health/rules.server";
import { analyseBalanceSheet, buildProtectedMoney, statutoryOverrideMap } from "@/lib/xero/tax-lines";
import { parsePnl, totalsForPeriod } from "@/lib/reports/monthly-report.server";

const KEYS = ["balance_sheet", "accounts", "invoices_accrec_open", "invoices_accpay_open", "profit_and_loss_mtd", "bank_unreconciled_recent", "payments_unreconciled_recent", "user_activities"];

export async function writeKeyFigures(target: { clientId: string; firmId: string; tenantId: string }): Promise<void> {
  const db = supabaseAdmin as any;
  const { data: rows, error } = await db
    .from("xero_snapshots")
    .select("report_key, payload, as_at, fetched_at, complete, params")
    .eq("client_id", target.clientId)
    .eq("tenant_id", target.tenantId)
    .in("report_key", KEYS)
    .order("fetched_at", { ascending: false })
    .limit(60);
  if (error) throw new Error(error.message);
  const latest = new Map<string, any>();
  for (const r of (rows ?? []) as any[]) if (!latest.has(r.report_key)) latest.set(r.report_key, r);

  const { data: ov } = await db
    .from("client_statutory_accounts")
    .select("account_name, category")
    .eq("client_id", target.clientId);
  const overrides = statutoryOverrideMap((ov ?? []) as any[]);

  const asAt = sydneyDate();
  const fig: Record<string, number | null> = {
    cash: null, debtors_total: null, debtors_overdue: null, creditors: null,
    protected_money: null, revenue_mtd: null, net_profit_mtd: null,
    credit_card_debt: null,
  };

  const bs = latest.get("balance_sheet");
  if (bs?.complete) {
    const { classifiedAccounts } = await import('@/lib/xero/bank-classifications.server');
    const accounts = await classifiedAccounts(db, target.tenantId, latest.get('accounts')?.payload, target.clientId);
    const a = analyseBalanceSheet(bs.payload, accounts, overrides);
    if (a.cashAtBank.status === "assessed") fig.cash = a.cashAtBank.total;
    if (a.creditCardDebt.status === "assessed") fig.credit_card_debt = a.creditCardDebt.total;
    if (a.taxLines.status === "assessed")
      fig.protected_money = buildProtectedMoney(bs.params?.date ?? asAt, a.taxLines.lines).total;
  }
  const ar = latest.get("invoices_accrec_open");
  if (ar?.complete) {
    const b = debtorBook(ar.payload, new Date(ar.as_at).getTime());
    fig.debtors_total = b.total;
    fig.debtors_overdue = b.overdue;
  }
  const ap = latest.get("invoices_accpay_open");
  if (ap?.complete) fig.creditors = debtorBook(ap.payload, new Date(ap.as_at).getTime()).total;
  const pnl = latest.get("profit_and_loss_mtd");
  const report = pnl?.complete ? pnl.payload?.Reports?.[0] : null;
  if (report) {
    const t = totalsForPeriod(parsePnl(report, endOfMonth(pnl.params?.toDate ?? asAt)), 0);
    fig.revenue_mtd = t.revenue;
    fig.net_profit_mtd = t.netProfit;
  }

  // Bank reconciled to, per in-scope account (client's bank-account settings,
  // active cash accounts only). Settings that cannot be read, or pulls that
  // did not run, leave it unavailable — never invented.
  const { computeBankReconciliation, oldestReconciledTo } = await import("./bank-reconciliation");
  const { data: cls, error: clsErr } = await db.from("client_bank_account_classifications").select("account_id, classification").eq("tenant_id", target.tenantId).eq("client_id", target.clientId);
  const pull = (key: string, items: string) => {
    const r = latest.get(key);
    return r && r.as_at.slice(0, 10) === asAt ? { items: r.payload?.[items] ?? [], complete: !!r.complete } : null;
  };
  const bankReconciliation = computeBankReconciliation({
    accounts: latest.get("accounts")?.payload?.Accounts,
    classifications: clsErr ? null : ((cls ?? []) as any[]),
    transactions: pull("bank_unreconciled_recent", "BankTransactions"),
    payments: pull("payments_unreconciled_recent", "Payments"),
    asAt,
  });
  const bankReconciledTo = oldestReconciledTo(bankReconciliation);

  // Last Xero login: the most recent sign-in by anyone in the file, from the
  // Finance API User Activities snapshot. Null = the report has not run or the
  // file has not granted the scope (unavailable, never invented).
  const ua = latest.get("user_activities");
  const users = ua?.complete ? (ua.payload?.Users ?? []) : null;
  let lastXeroLoginAt: string | null = null;
  if (users) {
    for (const u of users as any[]) {
      const raw = u?.LastLoginDateUtc;
      if (typeof raw !== "string") continue;
      const d = new Date(raw);
      if (isNaN(d.getTime())) continue;
      const iso = d.toISOString();
      if (!lastXeroLoginAt || iso > lastXeroLoginAt) lastXeroLoginAt = iso;
    }
  }

  if (Object.values(fig).every((v) => v === null) && bankReconciledTo === null && lastXeroLoginAt === null) return;
  const { error: wErr } = await db.from("client_key_figures").upsert(
    { client_id: target.clientId, firm_id: target.firmId, tenant_id: target.tenantId, as_at: asAt, ...fig, bank_reconciled_to: bankReconciledTo, bank_reconciliation: bankReconciliation, last_xero_login_at: lastXeroLoginAt },
    { onConflict: "client_id,tenant_id,as_at" },
  );
  if (wErr) throw new Error(wErr.message);
}
