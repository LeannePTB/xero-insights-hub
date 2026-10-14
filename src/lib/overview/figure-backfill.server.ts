// One-off month-end history backfill worker. SYSTEM CONTEXT ONLY: called from
// the registered scheduled route /api/public/xero/snapshot-refresh after its
// bearer check. Items are queued only by public.start_figure_backfill()
// (System Administrator, aal2, audited); this worker never decides who may ask.
//
// Per Xero file: 1 Accounts + up to 12 Balance Sheets + 1 Profit and Loss.
// Every call goes through xeroGet (per-file hourly ceiling, app-wide limiter,
// one 401/403 refresh). Writes only client_figure_history; never touches
// client_key_figures, so a nightly row can never be overwritten.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sydneyDate } from "@/lib/sydney-time";
import { completedMonthEnds, nextAttempt } from "./figure-backfill";

const FILES_PER_TICK = 5; // processed one file after another, never in parallel

type Item = { id: string; client_id: string; firm_id: string; tenant_id: string; attempts: number };

export async function processFigureBackfill(): Promise<{ processed: number; pending: number }> {
  const db = supabaseAdmin as any;
  const { data: items, error } = await db
    .from("figure_backfill_items")
    .select("id, client_id, firm_id, tenant_id, attempts")
    .eq("status", "pending")
    .lte("next_attempt_at", new Date().toISOString())
    .order("next_attempt_at")
    .limit(FILES_PER_TICK);
  if (error) throw new Error("Backfill queue could not be read.");
  if ((items ?? []).length) await db.from("figure_backfill_runs").update({ status: "running" }).eq("status", "queued");

  for (const item of (items ?? []) as Item[]) {
    try {
      const r = await backfillFile(db, item);
      await db.from("figure_backfill_items").update({
        status: "done", months_cash: r.cash, months_profit: r.profit, reason: r.note, attempts: item.attempts + 1, updated_at: new Date().toISOString(),
      }).eq("id", item.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const { isXeroRateLimitMessage } = await import("@/lib/xero/api.server");
      const { XERO_FILE_CEILING_MESSAGE } = await import("@/lib/xero/file-ceiling.server");
      const rate = isXeroRateLimitMessage(msg) || msg === XERO_FILE_CEILING_MESSAGE;
      const refused = /401|403|disconnected|not connected|scope|reconnect/i.test(msg);
      const next = refused ? null : nextAttempt(rate ? "rate_limited" : "error", item.attempts + 1);
      await db.from("figure_backfill_items").update({
        status: next ? "pending" : "failed",
        attempts: item.attempts + 1,
        next_attempt_at: next ?? new Date().toISOString(),
        // Generic, token-free reason only.
        reason: rate ? "Xero rate limit — resuming shortly" : refused ? "Xero refused access to this file" : "Xero request failed",
        updated_at: new Date().toISOString(),
      }).eq("id", item.id);
      if (rate) break; // stop this tick on a rate limit
    }
  }

  const { count } = await db.from("figure_backfill_items").select("id", { count: "exact", head: true }).eq("status", "pending");
  if ((count ?? 0) === 0) {
    await db.from("figure_backfill_runs").update({ status: "done", finished_at: new Date().toISOString() }).in("status", ["queued", "running"]);
  }
  return { processed: (items ?? []).length, pending: count ?? 0 };
}

async function backfillFile(db: any, item: Item): Promise<{ cash: number; profit: number; note: string | null }> {
  const { getConnectionByTenant, xeroGet } = await import("@/lib/xero/api.server");
  const { analyseBalanceSheet, statutoryOverrideMap } = await import("@/lib/xero/tax-lines");
  const { classifiedAccounts } = await import("@/lib/xero/bank-classifications.server");
  const { parsePnl, totalsForPeriod } = await import("@/lib/reports/monthly-report.server");

  const { FILL_GAP_MS, fillShouldPause } = await import("@/lib/xero/request-gate");
  const { XERO_RATE_LIMIT_MESSAGE } = await import("@/lib/xero/api.server");

  // Never alongside a snapshot refresh (nightly or re-sync) for the same file.
  const { data: busy } = await db.from("xero_snapshot_runs").select("id")
    .eq("tenant_id", item.tenant_id).is("finished_at", null)
    .gte("started_at", new Date(Date.now() - 30 * 60_000).toISOString()).limit(1);
  if ((busy ?? []).length) throw new Error(XERO_RATE_LIMIT_MESSAGE);

  const conn0 = await getConnectionByTenant(item.tenant_id);
  // Strictly one request at a time for this file, with a gap between requests,
  // pausing (rescheduled, not dropped) when Xero's remaining allowance is low.
  let first = true;
  const paced = async <T,>(path: string, params: Record<string, string | undefined> = {}): Promise<T> => {
    if (!first) await new Promise((r) => setTimeout(r, FILL_GAP_MS));
    first = false;
    const { data: lim } = await db.from("xero_rate_limits").select("day_remaining_low, min_remaining_low, min_low_at")
      .eq("tenant_id", item.tenant_id).eq("day", new Date().toISOString().slice(0, 10)).maybeSingle();
    const minuteFresh = lim?.min_low_at && Date.now() - new Date(lim.min_low_at).getTime() < 60_000;
    if (fillShouldPause(lim?.day_remaining_low ?? null, minuteFresh ? (lim?.min_remaining_low ?? null) : null)) {
      throw new Error(XERO_RATE_LIMIT_MESSAGE);
    }
    return xeroGet<T>(conn0, path, params);
  };
  const conn = conn0;
  void conn;
  const months = completedMonthEnds(sydneyDate());
  const last = months[months.length - 1];

  // Month-ends already holding a real nightly cash figure are left alone.
  const { data: nightly } = await db.from("client_key_figures").select("as_at, cash")
    .eq("client_id", item.client_id).eq("tenant_id", item.tenant_id).in("as_at", months);
  const hasNightly = new Set(((nightly ?? []) as any[]).filter((r) => r.cash !== null).map((r) => r.as_at));

  const { data: ov } = await db.from("client_statutory_accounts").select("account_name, category").eq("client_id", item.client_id);
  const overrides = statutoryOverrideMap((ov ?? []) as any[]);
  const accountsRaw = await paced<any>("Accounts");
  // Same selected-accounts overlay as today's Cash at bank (current settings).
  const accounts = await classifiedAccounts(db, item.tenant_id, accountsRaw, item.client_id);

  const rows = new Map<string, { cash?: number | null; net_profit?: number | null }>();
  let cashCount = 0;
  for (const date of months) {
    if (hasNightly.has(date)) continue;
    const bs = await paced<any>("Reports/BalanceSheet", { date });
    const a = analyseBalanceSheet(bs, accounts, overrides);
    if (a.cashAtBank.status === "assessed") {
      rows.set(date, { ...(rows.get(date) ?? {}), cash: a.cashAtBank.total });
      cashCount++;
    }
  }

  let profitCount = 0;
  const pnl = await paced<any>("Reports/ProfitAndLoss", {
    fromDate: `${last.slice(0, 7)}-01`, toDate: last, periods: String(months.length - 1), timeframe: "MONTH",
  });
  const report = pnl?.Reports?.[0];
  if (report) {
    const parsed = parsePnl(report, last);
    parsed.periods.forEach((p, i) => {
      if (!months.includes(p.monthEnd)) return;
      const t = totalsForPeriod(parsed, i);
      if (typeof t.netProfit === "number" && Number.isFinite(t.netProfit)) {
        rows.set(p.monthEnd, { ...(rows.get(p.monthEnd) ?? {}), net_profit: t.netProfit });
        profitCount++;
      }
    });
  }

  for (const [month_end, v] of rows) {
    const { error } = await db.from("client_figure_history").upsert(
      { client_id: item.client_id, firm_id: item.firm_id, tenant_id: item.tenant_id, month_end, ...v, source: "xero_backfill", fetched_at: new Date().toISOString() },
      { onConflict: "client_id,tenant_id,month_end" },
    );
    if (error) throw new Error("History could not be saved.");
  }
  const note = hasNightly.size ? `${hasNightly.size} month-end(s) already had nightly figures` : null;
  return { cash: cashCount, profit: profitCount, note };
}
