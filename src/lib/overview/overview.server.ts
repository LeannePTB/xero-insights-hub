// Server-only assembly for the client overview. Reads stored snapshots as the
// caller (RLS applies). Zero Xero calls: this module must never import
// `@/lib/xero/api.server`.

import { nextDueItems, superDueNext } from "@/lib/tax/forward-stored";
import { lateSharePct, splitDebtors } from "@/lib/health/health-checks";
import { PERIOD_END_BS_KEYS, classifiedAccounts } from "@/lib/health/health-checks.server";
import { bankReconWarning, parseStored, statementPosition } from "./bank-reconciliation";
import { addDays, addMonths, endOfMonth, startOfFinancialYear, sydneyDate } from "@/lib/sydney-time";
import { VERDICT_REPORT_KEYS } from "@/lib/health/rule-thresholds";
import { debtorBook, evaluateClient, type SnapshotRow, type Verdict } from "@/lib/health/rules.server";
import { analyseBalanceSheet, buildProtectedMoney, statutoryOverrideMap } from "@/lib/xero/tax-lines";
import { parsePnl, totalsForPeriod } from "@/lib/reports/monthly-report.server";
import { bucketOf, evaluateMove, verdictRank, type MoveResult } from "./changes";
import type { OverviewRow } from "./overview.functions";

type Sb = any;
type Row = SnapshotRow & { client_id: string; tenant_id: string; params: any };

/** Dated figures for one client at one Sydney date. */
export type DayFigures = {
  cash: number | null;
  creditCardDebt: number | null;
  protectedMoney: number | null;
  /** Per-account breakdown of protected money, for the tooltip. */
  protectedAccounts?: { name: string; amount: number; counted: boolean }[];
  /** Super liability on the balance sheet (counted lines only). */
  superOwed?: number | null;
  revenueMtd: number | null;
  netProfitMtd: number | null;
};

export type ClientSeries = {
  anchor: string | null;
  byDate: Map<string, DayFigures>;
  avgMonthlyRevenue: number | null;
};

export type OverviewContext = {
  clients: { client_id: string; client_name: string; firm_id: string; firm_name: string }[];
  rowsByClient: Map<string, Row[]>;
  datedByClient: Map<string, Row[]>;
  connections: Map<string, { tenantId: string; status: string; currency?: string | null }[]>;
  overrides: Map<string, any[]>;
  cycles: Map<string, { gst: string | null; payg: string | null }>;
  lastSent: Map<string, string>;
  sentMonths: Map<string, Set<string>>;
  runs: Map<string, { status: string; started_at: string }[]>;
  /** Nightly key figures (Batch 3), last ~40 days, as the caller under RLS. */
  keyFigures: Map<string, any[]>;
  /** Shared acknowledge/snooze state (Batch 4), as the caller under RLS. */
  alertStates: Map<string, any[]>;
  /** user id -> display label, from organisation_members (auth.users email). */
  people: Map<string, string>;
  /** Shared forward tax summary per client (stored only). */
  forward: Map<string, import("@/lib/tax/forward-tax.server").StoredForward>;
  today: string;
  now: Date;
};

/** Possible lodgement period ends for `today`: last month end and last quarter end. */
function periodEnds(today: string): string[] {
  const y = +today.slice(0, 4);
  const m = +today.slice(5, 7);
  const end = (mm: number) => new Date(Date.UTC(y, mm, 0)).toISOString().slice(0, 10);
  return Array.from(new Set([end(m - 1), end(Math.floor((m - 1) / 3) * 3)]));
}

function chunk<T>(a: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n));
  return out;
}

function push<K, V>(m: Map<K, V[]>, k: K, v: V) {
  const l = m.get(k) ?? [];
  l.push(v);
  m.set(k, l);
}

/** Dates whose dated snapshots the overview and the feed compare. */
export function comparisonDates(today: string): string[] {
  const out = new Set<string>();
  for (let a = 0; a <= 9; a++) out.add(addDays(today, -a));
  for (const anchor of [today, addDays(today, -1), addDays(today, -2)]) {
    const pm = addMonths(anchor, -1);
    for (const d of [0, 1, 7, 8, 9]) out.add(addDays(pm, -d));
  }
  return [...out];
}

export async function loadOverviewContext(sb: Sb, firmId: string | null = null): Promise<OverviewContext> {
  const now = new Date();
  const today = sydneyDate(now);
  const { data: list, error } = await sb.rpc("overview_clients", { _firm_id: firmId });
  if (error) throw new Error(error.message);
  const clients = (list ?? []) as OverviewContext["clients"];
  const ids = clients.map((c) => c.client_id);

  const ctx: OverviewContext = {
    clients,
    rowsByClient: new Map(),
    datedByClient: new Map(),
    connections: new Map(),
    overrides: new Map(),
    cycles: new Map(),
    lastSent: new Map(),
    sentMonths: new Map(),
    runs: new Map(),
    keyFigures: new Map(),
    alertStates: new Map(),
    people: new Map(),
    forward: new Map(),
    today,
    now,
  };
  if (!ids.length) return ctx;

  const { data: classifications, error: classificationError } = await sb.from('account_setup_bank_v').select('client_id, tenant_id, account_id, classification').in('client_id', ids);
  if (classificationError) throw new Error('Bank account classifications could not be read.');

  const dates = comparisonDates(today);
  const cols =
    "client_id, tenant_id, report_key, params, payload, payload_version, as_at, fetched_at, complete";
  const undatedKeys = (VERDICT_REPORT_KEYS as readonly string[]).filter((k) => k !== "balance_sheet");

  for (const part of chunk(ids, 50)) {
    const [undated, bs, pnl, ytd, links, ov, cl, rep, runs, st, kf, pe] = await Promise.all([
      sb.from("xero_snapshots").select(cols).in("report_key", undatedKeys).in("client_id", part),
      sb.from("xero_snapshots").select(cols).eq("report_key", "balance_sheet").in("params->>date", dates).in("client_id", part),
      sb.from("xero_snapshots").select(cols).eq("report_key", "profit_and_loss_mtd").in("params->>toDate", dates).in("client_id", part),
      sb.from("xero_snapshots").select(cols).eq("report_key", "profit_and_loss_ytd").in("params->>toDate", dates.slice(0, 3)).in("client_id", part),
      sb.from("client_xero_orgs").select("client_id, xero_connections(tenant_id, status, base_currency)").in("client_id", part),
      sb.from("account_setup_statutory_v").select("client_id, account_name, category").in("client_id", part),
      sb.from("clients").select("id, gst_cycle, payg_withholding_cycle").in("id", part),
      sb.from("client_reports").select("client_id, period_end, sent_at").not("sent_at", "is", null).in("client_id", part),
      sb.from("xero_snapshot_runs").select("client_id, status, started_at").in("client_id", part).gte("started_at", addDays(today, -9)),
      sb.from("overview_alert_states").select("client_id, event_key, severity_at_ack, acknowledged_by, acknowledged_at, snoozed_by, snoozed_until").in("client_id", part),
      sb.from("client_key_figures").select("client_id, as_at, cash, debtors_total, debtors_overdue, creditors, bank_reconciled_to, bank_reconciliation, last_xero_login_at").in("client_id", part).gte("as_at", addDays(today, -40)),
      // Lodgement period-end balance sheets (closed periods), for the tax split.
      sb.from("xero_snapshots").select(cols).in("report_key", PERIOD_END_BS_KEYS as unknown as string[]).in("params->>date", periodEnds(today)).in("client_id", part),
    ]);
    for (const r of [undated, bs, pnl, ytd, pe]) if (r.error) throw new Error(r.error.message);
    for (const row of (pe.data ?? []) as Row[]) push(ctx.rowsByClient, row.client_id, row);
    for (const row of (undated.data ?? []) as Row[]) {
      if (row.report_key === 'accounts' && Array.isArray(row.payload?.Accounts)) {
        // One cash-at-bank definition: shared with Business Health and the tax rule.
        row.payload = { ...row.payload, ...classifiedAccounts(row.payload.Accounts, (classifications ?? []).filter((r: any) => r.client_id === row.client_id && r.tenant_id === row.tenant_id)) };
      }
      push(ctx.rowsByClient, row.client_id, row);
    }
    for (const row of [...(bs.data ?? []), ...(pnl.data ?? []), ...(ytd.data ?? [])] as Row[])
      push(ctx.datedByClient, row.client_id, row);
    for (const link of (links.data ?? []) as any[]) {
      const c = link.xero_connections;
      if (c) push(ctx.connections, link.client_id, { tenantId: c.tenant_id, status: c.status, currency: c.base_currency ?? null });
    }
    for (const row of (ov.data ?? []) as any[]) push(ctx.overrides, row.client_id, row);
    for (const row of (cl.data ?? []) as any[])
      ctx.cycles.set(row.id, { gst: row.gst_cycle, payg: row.payg_withholding_cycle });
    for (const row of (rep.data ?? []) as any[]) {
      const prev = ctx.lastSent.get(row.client_id);
      if (!prev || row.sent_at > prev) ctx.lastSent.set(row.client_id, row.sent_at);
      const months = ctx.sentMonths.get(row.client_id) ?? new Set<string>();
      months.add(String(row.period_end).slice(0, 7));
      ctx.sentMonths.set(row.client_id, months);
    }
    for (const row of (runs.data ?? []) as any[]) push(ctx.runs, row.client_id, row);
    for (const row of (kf.data ?? []) as any[]) push(ctx.keyFigures, row.client_id, row);
    for (const row of (st.data ?? []) as any[]) push(ctx.alertStates, row.client_id, row);
  }
  {
    const { loadStoredForward } = await import("@/lib/tax/forward-tax.server");
    ctx.forward = await loadStoredForward(sb, ids.map((id: string) => ({ clientId: id, tenantId: ctx.connections.get(id)?.[0]?.tenantId ?? null })), today).catch(() => new Map());
  }
  // Who cleared an alert: names come from organisation_members (caller-scoped),
  // only for organisations that have any alert state.
  const firmsWithStates = new Set(
    clients.filter((c) => ctx.alertStates.has(c.client_id)).map((c) => c.firm_id),
  );
  for (const firmId of firmsWithStates) {
    const { data: members } = await sb.rpc("organisation_members", { _firm_id: firmId });
    for (const m of (members ?? []) as any[])
      ctx.people.set(m.user_id, (m.display_name as string) || (m.email as string) || "A colleague");
  }
  return ctx;
}

function dateOf(row: Row): string | null {
  return (row.params?.date ?? row.params?.toDate ?? null) as string | null;
}

function latest(rows: Row[], key: string): Row | undefined {
  return rows
    .filter((r) => r.report_key === key)
    .sort((a, b) => (a.fetched_at < b.fetched_at ? 1 : -1))[0];
}

export function verdictFor(ctx: OverviewContext, clientId: string, bsDate?: string): Verdict {
  const undated = ctx.rowsByClient.get(clientId) ?? [];
  const dated = ctx.datedByClient.get(clientId) ?? [];
  const bsRows = dated.filter((r) => r.report_key === "balance_sheet");
  const bs = bsDate
    ? bsRows.find((r) => dateOf(r) === bsDate)
    : bsRows.sort((a, b) => (a.fetched_at < b.fetched_at ? 1 : -1))[0];
  const conns = ctx.connections.get(clientId) ?? [];
  if (!conns.length && !undated.length && !bsRows.length) {
    return {
      state: "unavailable",
      label: "Unavailable",
      detail: "No snapshot data is readable for this client with your access.",
      findings: [],
    };
  }
  return evaluateClient(
    {
      clientId,
      connections: conns,
      snapshots: [...undated, ...(bs ? [bs] : [])],
      // Evaluating an older snapshot set: judge freshness as at that day.
      now: bsDate && bs ? new Date(new Date(bs.fetched_at).getTime() + 3600_000) : ctx.now,
    },
    {
      statutoryOverrides: statutoryOverrideMap(ctx.overrides.get(clientId) ?? []),
      gstRegistered: ctx.cycles.get(clientId)?.gst !== "not_registered",
      withholdsPayg: ctx.cycles.get(clientId)?.payg !== "not_registered",
      gstCycle: (ctx.cycles.get(clientId)?.gst ?? null) as any,
      paygCycle: (ctx.cycles.get(clientId)?.payg ?? null) as any,
      forward: ctx.forward.get(clientId)?.tax ?? null,
    },
  );
}

export function seriesFor(ctx: OverviewContext, clientId: string): ClientSeries {
  const undated = ctx.rowsByClient.get(clientId) ?? [];
  const dated = ctx.datedByClient.get(clientId) ?? [];
  const accounts = latest(undated, "accounts");
  const overrides = statutoryOverrideMap(ctx.overrides.get(clientId) ?? []);
  const byDate = new Map<string, DayFigures>();
  const get = (d: string) => {
    let f = byDate.get(d);
    if (!f) {
      f = { cash: null, creditCardDebt: null, protectedMoney: null, revenueMtd: null, netProfitMtd: null };
      byDate.set(d, f);
    }
    return f;
  };
  for (const row of dated) {
    const d = dateOf(row);
    if (!d || !row.complete) continue;
    if (row.report_key === "balance_sheet") {
      const a = analyseBalanceSheet(row.payload, accounts?.payload, overrides);
      const f = get(d);
      if (a.cashAtBank.status === "assessed") f.cash = a.cashAtBank.total;
      if (a.creditCardDebt.status === "assessed") f.creditCardDebt = a.creditCardDebt.total;
      if (a.taxLines.status === "assessed") {
        const pm = buildProtectedMoney(d, a.taxLines.lines);
        f.protectedMoney = pm.total;
        f.protectedAccounts = pm.components.flatMap((c) => (c.status === "resolved" ? c.accounts : []));
        f.superOwed = Math.round(a.taxLines.lines.filter((l) => l.category === "super" && l.amount > 0).reduce((t, l) => t + l.amount, 0) * 100) / 100;
      }
    } else if (row.report_key === "profit_and_loss_mtd") {
      const report = row.payload?.Reports?.[0];
      if (!report) continue;
      const t = totalsForPeriod(parsePnl(report, endOfMonth(d)), 0);
      const f = get(d);
      f.revenueMtd = t.revenue;
      f.netProfitMtd = t.netProfit;
    }
  }
  const anchor =
    [ctx.today, addDays(ctx.today, -1), addDays(ctx.today, -2)].find((d) => byDate.get(d)?.cash != null) ??
    null;

  let avgMonthlyRevenue: number | null = null;
  const ytd = dated
    .filter((r) => r.report_key === "profit_and_loss_ytd" && r.complete)
    .sort((a, b) => (a.fetched_at < b.fetched_at ? 1 : -1))[0];
  const ytdReport = ytd?.payload?.Reports?.[0];
  const ytdDate = ytd ? dateOf(ytd) : null;
  if (ytdReport && ytdDate) {
    const revenue = totalsForPeriod(parsePnl(ytdReport, endOfMonth(ytdDate)), 0).revenue;
    const fy = startOfFinancialYear(ytdDate);
    const months =
      (Number(ytdDate.slice(0, 4)) - Number(fy.slice(0, 4))) * 12 +
      (Number(ytdDate.slice(5, 7)) - Number(fy.slice(5, 7))) +
      Number(ytdDate.slice(8, 10)) / 30;
    if (months > 0) avgMonthlyRevenue = revenue / months;
  }
  return { anchor, byDate, avgMonthlyRevenue };
}

export type FigureKey = Exclude<keyof DayFigures, "protectedAccounts" | "superOwed">;

/** A move of one figure over `days` ending at the anchor, with the prior-month routine check. */
export function moveFor(s: ClientSeries, key: FigureKey, days: number): MoveResult {
  if (!s.anchor) return { state: "no_data" };
  const at = (d: string) => s.byDate.get(d)?.[key] ?? null;
  const pm = addMonths(s.anchor, -1);
  return evaluateMove({
    now: at(s.anchor),
    before: at(addDays(s.anchor, -days)),
    priorEnd: at(pm),
    priorStart: at(addDays(pm, -days)),
    avgMonthlyRevenue: s.avgMonthlyRevenue,
  });
}

export async function buildOverview(
  sb: Sb,
  userId: string,
  firmId: string | null = null,
): Promise<{
  rows: OverviewRow[];
  feed: import("./feed.server").FeedEvent[];
  cleared: import("./feed.server").FeedEvent[];
  feedNotes: string[];
}> {
  const ctx = await loadOverviewContext(sb, firmId);
  const { logClientDataRead } = await import("@/lib/audit.server");
  const out: OverviewRow[] = [];
  // Presentation signal from the caller-scoped manage predicate; never a grant.
  const manageable = new Set<string>();
  await Promise.all(
    ctx.clients.map(async (c) => {
      const { data } = await sb.rpc("me_can_manage_client", { _client_id: c.client_id });
      if (data === true) manageable.add(c.client_id);
    }),
  );
  for (const c of ctx.clients) {
    // Phase 6 read audit: one read per client (the writer de-duplicates in 5-minute windows).
    logClientDataRead({ actorUserId: userId, clientId: c.client_id, firmId: c.firm_id, readKey: "overview", source: "snapshot" });

    const verdict = verdictFor(ctx, c.client_id);
    const s = seriesFor(ctx, c.client_id);
    const today = s.anchor ? s.byDate.get(s.anchor) : undefined;
    const m7 = moveFor(s, "cash", 7);
    const ar = latest(ctx.rowsByClient.get(c.client_id) ?? [], "invoices_accrec_open");
    // Same split as "Customers paying on time?": recent late share only;
    // debts over 90 days past due are shown neutrally, never as overdue.
    let debtorsOverduePct: number | null = null;
    let debtorsOver60: number | null = null;
    let debtorsOldAmount: number | null = null;
    if (ar?.complete) {
      const invs = Array.isArray(ar.payload) ? ar.payload : (ar.payload?.Invoices ?? []);
      const split = splitDebtors(invs, ctx.today);
      debtorsOverduePct = lateSharePct(split);
      debtorsOldAmount = split.old > 0 ? split.old : null;
      debtorsOver60 = debtorBook(ar.payload, new Date(ar.as_at).getTime()).over60;
    }
    const all = [...(ctx.rowsByClient.get(c.client_id) ?? []), ...(ctx.datedByClient.get(c.client_id) ?? [])];
    const freshAsAt = all.reduce<string | null>((m, r) => (!m || r.fetched_at > m ? r.fetched_at : m), null);
    const cash = today?.cash ?? null;
    const creditCardDebt = today?.creditCardDebt ?? null;
    const netCash = cash !== null ? cash - (creditCardDebt ?? 0) : null;
    const prot = today?.protectedMoney ?? null;
    // Bank reconciled to: from the most recent nightly key-figures row.
    const kfRows = (ctx.keyFigures.get(c.client_id) ?? []).sort((a: any, b: any) => (a.as_at < b.as_at ? 1 : -1));
    const bankRecon = kfRows[0] ? bankReconWarning(kfRows[0].bank_reconciliation, String(kfRows[0].as_at)) : null;
    const storedRecon = kfRows[0] ? parseStored(kfRows[0].bank_reconciliation) : null;
    const bankReconciledTo: string | null = storedRecon ? (kfRows[0].bank_reconciled_to ?? null) : null;
    // Display-only context: where the bank would stand if everything coded
    // were reconciled. The ledger figure above is never replaced by this.
    const stmtPos = statementPosition(storedRecon, cash);
    const cashNote = stmtPos
      ? `Reconciled bank position ${stmtPos.reconciled.toLocaleString("en-AU", { style: "currency", currency: "AUD", signDisplay: "negative" })} — ${Math.abs(stmtPos.unreconciled).toLocaleString("en-AU", { style: "currency", currency: "AUD" })} not yet reconciled in Xero (last 90 days).`
      : null;
    const cashNoteShort = stmtPos
      ? `${Math.round(Math.abs(stmtPos.unreconciled)).toLocaleString("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 })} unreconciled`
      : null;
    out.push({
      clientId: c.client_id,
      clientName: c.client_name,
      firmId: c.firm_id,
      firmName: c.firm_name,
      verdict,
      rank: verdictRank(verdict as any),
      bucket: bucketOf(verdict as any),
      cash,
      protectedMoney: prot,
      creditCardDebt,
      netCash,
      cashChange7d: m7.state === "evaluated" ? m7.change : null,
      cashBigMove: m7.state === "evaluated" && m7.big,
      ...(() => {
        // Amounts, not percentages: the same helpers as the Tax obligations and super cards.
        const fw = ctx.forward.get(c.client_id);
        if (!fw) return { taxNext: null, taxBuilding: null, superDue: null, taxItems: [] };
        const sup = superDueNext(today?.superOwed ?? null, fw.payRuns);
        const items = nextDueItems(fw.tax, sup);
        const first = [...fw.tax.owing].sort((a, b) => (a.due < b.due ? -1 : 1))[0];
        const b = fw.tax.building;
        const taxNext = first
          ? { amount: fw.tax.owing.filter((o) => o.due === first.due).reduce((t, o) => t + o.amount, 0), due: first.due, overdue: first.overdue }
          : b.total !== null && b.total > 0 ? { amount: b.total, due: b.due, overdue: false } : null;
        return {
          taxNext,
          taxBuilding: first && b.total !== null && b.total > 0 ? { amount: b.total, due: b.due } : null,
          superDue: sup,
          taxItems: items,
        };
      })(),
      netProfitMtd: today?.netProfitMtd ?? null,
      debtorsOverduePct,
      debtorsOver60,
      debtorsOldAmount,
      xeroNeedsAttention: (ctx.connections.get(c.client_id) ?? []).some((k) => k.status !== "connected"),
      lastReportSentAt: ctx.lastSent.get(c.client_id) ?? null,
      freshAsAt,
      canResync: manageable.has(c.client_id),
      bankReconciledTo,
      bankReconWarning: bankRecon?.text ?? null,
      cashNote,
      cashNoteShort,
      lastXeroLoginAt: kfRows.find((k: any) => k.last_xero_login_at != null)?.last_xero_login_at ?? null,
      cashSpark: (ctx.keyFigures.get(c.client_id) ?? [])
        .filter((k) => k.as_at >= addDays(ctx.today, -30) && k.cash !== null)
        .sort((a, b) => (a.as_at < b.as_at ? -1 : 1))
        .map((k) => Number(k.cash)),
      historyNote:
        m7.state === "evaluated" && !m7.routineTested
          ? "Not enough history to compare with last month."
          : null,
    });
  }
  out.sort((a, b) => b.rank - a.rank || a.clientName.localeCompare(b.clientName));
  const { buildFeed } = await import("./feed.server");
  const feed = buildFeed(ctx);
  return { rows: out, feed: feed.events, cleared: feed.cleared, feedNotes: feed.notes };
}
