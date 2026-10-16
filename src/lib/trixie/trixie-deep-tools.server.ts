import { tool, type ToolSet } from "ai";
import { z } from "zod";
import type { TrixieContext } from "./trixie-context.server";
import { DEEP_TOOL_POLICY, deepToolsFor, type DeepToolName } from "./trixie-tool-policy";
import {
  ISO_DATE, UNTRUSTED_NOTE, accountLines, biggestMoves, boundedRange, capLines, contactSummary,
  daysBetween, pickAccount, possibleDuplicates, round2, unusualAmounts, untrusted, xeroDate,
} from "./trixie-deep-logic";

// Deeper read-only tools. Every one of them:
//  - takes NO organisation, client, tenant or user identifier from the model;
//    the client and its Xero files come from the verified route context;
//  - is offered only per DEEP_TOOL_POLICY and re-checks, per Xero file, the
//    database card gate (assert_widget_access) as the caller before reading;
//  - reads saved snapshots / figure tables through ctx.supabase (RLS as the
//    caller). Where the saved data cannot answer, it uses GET only through the
//    shared Xero client (request gate, retry, rate limit, per-file ceiling);
//  - records the read in the audit trail (logClientDataRead, no figures);
//  - writes nothing, and returns `sources` with report name, range and fetched date.

type Source = { label: string; asAt: string | null; href?: string };
type Out = Record<string, unknown> & { available: boolean; sources: Source[] };

const UNAVAILABLE = "This isn't available for this client with your access.";
const sydneyToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney" }).format(new Date());

function denied(reason: string): Out {
  return { available: false, reason, sources: [] };
}

async function cardAllowed(ctx: TrixieContext, tenantId: string, widget: string) {
  const { error } = await (ctx.supabase as any).rpc("assert_widget_access", { _tenant_id: tenantId, _widget: widget });
  return !error;
}

function audit(ctx: TrixieContext, tenantId: string | null, name: DeepToolName, source: "snapshot" | "live", period?: { from?: string; to?: string }) {
  void import("@/lib/audit.server").then(({ logClientDataRead }) =>
    logClientDataRead({ actorUserId: ctx.userId, clientId: ctx.clientId, firmId: ctx.firmId, tenantId, readKey: `trixie:${name}`, source, periodStart: period?.from ?? null, periodEnd: period?.to ?? null }),
  );
}

async function snapshot(ctx: TrixieContext, tenantId: string, reportKey: string) {
  const { readSnapshot } = await import("@/lib/xero/snapshot-read.server");
  return readSnapshot({ supabase: ctx.supabase, tenantId, clientId: ctx.clientId, reportKey });
}

const fresh = (hit: any) => ({ asAt: hit?.source?.asAt ?? null, fetchedAt: hit?.source?.fetchedAt ?? null, stale: hit?.source?.stale === true });

/** Runs `read` for each Xero file of the verified client that passes the card gate. */
async function perFile(ctx: TrixieContext, name: DeepToolName, label: string, read: (tenantId: string, file: string) => Promise<Record<string, unknown>>): Promise<Out> {
  // Re-check the policy here too, so a tool can never run outside it.
  if (!deepToolsFor(ctx).includes(name)) return denied(UNAVAILABLE);
  const tenants = ctx.tenantId ? ctx.tenants.filter((t) => t.tenantId === ctx.tenantId) : ctx.tenants;
  if (!ctx.clientId || tenants.length === 0) return denied("Open a client dashboard with a connected Xero file first.");
  const files: Record<string, unknown>[] = [];
  for (const t of tenants) {
    const cards = DEEP_TOOL_POLICY[name].cards as readonly string[];
    let ok = false;
    for (const card of cards) if (await cardAllowed(ctx, t.tenantId, card)) { ok = true; break; }
    if (!ok) { files.push({ file: t.name, available: false, reason: UNAVAILABLE }); continue; }
    try {
      files.push({ file: t.name, available: true, ...(await read(t.tenantId, t.name)) });
    } catch (e) {
      const msg = e instanceof Error && /Reconnect|Waiting for Xero|Xero is busy|limit/i.test(e.message) ? e.message : "The figures could not be read.";
      files.push({ file: t.name, available: false, reason: msg });
    }
  }
  const sources: Source[] = files.filter((f) => f.available).map((f) => ({
    label: `${label}${f.range ? ` (${f.range})` : ""} — ${f.file}`,
    asAt: (f.fetchedAt as string) ?? (f.asAt as string) ?? null,
    href: `/clients/${ctx.clientId}`,
  }));
  return { available: files.some((f) => f.available), note: UNTRUSTED_NOTE, files, sources };
}

async function conn(tenantId: string) {
  const { getConnectionByTenant } = await import("@/lib/xero/api.server");
  return getConnectionByTenant(tenantId); // only after the card gate above
}

async function get<T = any>(tenantId: string, path: string, params: Record<string, string | undefined>): Promise<T> {
  const { xeroGet } = await import("@/lib/xero/api.server");
  return xeroGet<T>(await conn(tenantId), path, params);
}

const dt = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return `DateTime(${y},${m},${d})`; };
const dateWhere = (from: string, to: string) => `Date>=${dt(from)} AND Date<=${dt(to)}`;

/** Accounts excluded by this client's statutory settings ("None of these"), e.g. notional GST. */
async function excludedNames(ctx: TrixieContext): Promise<Set<string>> {
  const { data } = await (ctx.supabase as any).from("client_statutory_accounts").select("account_name, category").eq("client_id", ctx.clientId);
  return new Set(((data ?? []) as any[]).filter((r) => r.category === "none").map((r) => String(r.account_name).trim().toLowerCase()));
}

const range = z.object({
  from: z.string().regex(ISO_DATE).describe("Start date YYYY-MM-DD"),
  to: z.string().regex(ISO_DATE).describe("End date YYYY-MM-DD"),
});

// ---------------------------------------------------------------- tools

async function accountTransactions(ctx: TrixieContext, input: { account: string; from: string; to: string; limit?: number }) {
  const r = boundedRange(input.from, input.to, 400);
  return perFile(ctx, "account_transactions", "Account transactions (Xero)", async (tenantId) => {
    const accounts = (await snapshot(ctx, tenantId, "accounts"))?.payload?.Accounts ?? [];
    const acct = pickAccount(accounts, input.account);
    if (!acct) return { available: false, reason: "No account with that code or name in this file's chart of accounts." };
    const where = dateWhere(r.from, r.to);
    const [inv, bt, mj] = await Promise.all([
      get(tenantId, "Invoices", { where, page: "1" }),
      get(tenantId, "BankTransactions", { where, page: "1" }),
      get(tenantId, "ManualJournals", { where, page: "1" }).catch(() => ({ ManualJournals: [] })),
    ]);
    audit(ctx, tenantId, "account_transactions", "live", r);
    const lines = accountLines(acct, { invoices: inv?.Invoices, bankTransactions: bt?.BankTransactions, manualJournals: mj?.ManualJournals });
    const pageFull = (inv?.Invoices?.length ?? 0) >= 100 || (bt?.BankTransactions?.length ?? 0) >= 100;
    return {
      account: { code: acct.code, name: untrusted(acct.name, 80) },
      range: `${r.from} to ${r.to}`,
      fetchedAt: new Date().toISOString(),
      mode: "live from Xero",
      ...capLines(lines, Math.min(200, Math.max(1, input.limit ?? 200))),
      incomplete: pageFull ? "More than 100 documents in this range — only the first page was read; narrow the dates for a full list." : null,
      signNote: "Positive = debit (expense/asset), negative = credit (income/liability).",
    };
  });
}

async function journals(ctx: TrixieContext, input: { from: string; to: string; account?: string }) {
  const r = boundedRange(input.from, input.to, 400);
  return perFile(ctx, "journals", "Manual journals (Xero)", async (tenantId) => {
    const res = await get(tenantId, "ManualJournals", { where: dateWhere(r.from, r.to), page: "1" });
    audit(ctx, tenantId, "journals", "live", r);
    const accounts = (await snapshot(ctx, tenantId, "accounts"))?.payload?.Accounts ?? [];
    const acct = input.account ? pickAccount(accounts, input.account) : null;
    const byCode = new Map<string, string>(accounts.map((a: any) => [String(a.Code ?? ""), String(a.Name ?? "")]));
    const list = ((res?.ManualJournals ?? []) as any[]).filter((j) => j.Status === "POSTED").map((j) => ({
      date: xeroDate(j.DateString ?? j.Date),
      narration: untrusted(j.Narration, 200),
      lines: ((j.JournalLines ?? []) as any[])
        .filter((l) => !acct || String(l.AccountCode ?? "") === acct.code || l.AccountID === acct.accountId)
        .map((l) => ({ account: untrusted(byCode.get(String(l.AccountCode ?? "")) ?? l.AccountCode, 80), code: l.AccountCode ?? null, amount: round2(Number(l.LineAmount ?? 0)), description: untrusted(l.Description), taxCode: l.TaxType ?? null })),
    })).filter((j) => j.lines.length > 0).sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
    return { range: `${r.from} to ${r.to}`, fetchedAt: new Date().toISOString(), mode: "live from Xero", journalCount: list.length, journals: list.slice(0, 60), truncated: list.length > 60 };
  });
}

async function contactHistory(ctx: TrixieContext, input: { contact: string; side: "customer" | "supplier" }) {
  const side = input.side === "supplier" ? "ACCPAY" : "ACCREC";
  const widget = side === "ACCPAY" ? "payables" : "receivables";
  const out = await perFile(ctx, "contact_history", side === "ACCPAY" ? "Supplier history (Xero)" : "Customer history (Xero)", async (tenantId) => {
    // Side-specific gate: a customer needs Receivables, a supplier Payables.
    if (!(await cardAllowed(ctx, tenantId, widget))) return { available: false, reason: UNAVAILABLE };
    const name = input.contact.replace(/["\\]/g, "").trim().slice(0, 100);
    if (!name) return { available: false, reason: "Name a customer or supplier." };
    const today = sydneyToday();
    const from = new Date(`${today}T00:00:00Z`); from.setUTCFullYear(from.getUTCFullYear() - 1);
    const fromIso = from.toISOString().slice(0, 10);
    const res = await get(tenantId, "Invoices", { where: `Type=="${side}" AND Contact.Name=="${name}" AND Date>=${dt(fromIso)}`, page: "1" });
    audit(ctx, tenantId, "contact_history", "live", { from: fromIso, to: today });
    const invoices = (res?.Invoices ?? []) as any[];
    if (!invoices.length) return { available: false, reason: "No documents for that exact name in the last 12 months. Try the name exactly as it appears in Xero." };
    return { contact: untrusted(name, 100), range: `${fromIso} to ${today}`, fetchedAt: new Date().toISOString(), mode: "live from Xero", ...contactSummary(invoices, today) };
  });
  return out;
}

async function bankActivity(ctx: TrixieContext, input: { from?: string; to?: string }) {
  return perFile(ctx, "bank_activity", "Bank activity (saved)", async (tenantId) => {
    const [unrec, pays, summary] = await Promise.all([
      snapshot(ctx, tenantId, "bank_unreconciled_recent"),
      snapshot(ctx, tenantId, "payments_unreconciled_recent"),
      snapshot(ctx, tenantId, "bank_summary"),
    ]);
    audit(ctx, tenantId, "bank_activity", "snapshot", input);
    const { data: kf } = await (ctx.supabase as any).from("client_key_figures").select("as_at, bank_reconciliation").eq("client_id", ctx.clientId).order("as_at", { ascending: false }).limit(1).maybeSingle();
    const { parseStored } = await import("@/lib/overview/bank-reconciliation");
    const inRange = (d: string | null) => !d || ((!input.from || d >= input.from) && (!input.to || d <= input.to));
    const lines = ((unrec?.payload?.BankTransactions ?? []) as any[])
      .filter((t) => t.Status !== "DELETED" && t.IsReconciled !== true)
      .map((t) => ({ date: xeroDate(t.DateString ?? t.Date), account: untrusted(t.BankAccount?.Name, 60), contact: untrusted(t.Contact?.Name), reference: untrusted(t.Reference, 60), type: t.Type ?? null, amount: round2((String(t.Type ?? "").startsWith("SPEND") ? -1 : 1) * Number(t.Total ?? 0)), coded: ((t.LineItems ?? []) as any[]).some((l) => l.AccountCode) }))
      .filter((l) => inRange(l.date))
      .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
    const payments = ((pays?.payload?.Payments ?? []) as any[]).filter((p) => p.IsReconciled !== true).length;
    return {
      ...fresh(unrec ?? summary),
      range: input.from || input.to ? `${input.from ?? "start"} to ${input.to ?? "latest"}` : "recent saved window",
      unreconciledCount: lines.length,
      unreconciledValue: round2(lines.reduce((s, l) => s + Math.abs(l.amount), 0)),
      unreconciledLines: lines.slice(0, 80),
      unreconciledPayments: payments,
      lastReconciledByAccount: parseStored(kf?.bank_reconciliation)?.accounts.map((a) => ({ account: untrusted(a.name, 60), reconciledTo: a.reconciledTo })) ?? null,
      note: "Saved overnight window of recent bank lines; older unreconciled lines may exist in Xero.",
    };
  });
}

async function payRuns(ctx: TrixieContext, input: { from?: string; to?: string }) {
  return perFile(ctx, "pay_runs", "Pay runs (saved)", async (tenantId) => {
    const { loadPayRuns, payRunsInPeriod } = await import("@/lib/xero/payroll.server");
    const { readSnapshot } = await import("@/lib/xero/snapshot-read.server");
    const { PAYROLL_PAYRUNS_REPORT_KEY } = await import("@/lib/xero/payroll.server");
    // Saved pay runs only; Trixie never fans out to live payroll.
    const hit = await readSnapshot({ supabase: ctx.supabase, tenantId, clientId: ctx.clientId, reportKey: PAYROLL_PAYRUNS_REPORT_KEY });
    if (!hit) return { available: false, reason: "No saved pay runs for this file yet." };
    const res = await loadPayRuns({ supabase: ctx.supabase, tenantId, clientId: ctx.clientId });
    audit(ctx, tenantId, "pay_runs", "snapshot", input);
    if (res.status !== "available") return { available: false, reason: `Pay runs are ${String(res.status).replace(/_/g, " ")}.` };
    const { paydaySuperDueDate, paydaySuperFlag } = await import("@/lib/payday-super");
    const list = (input.from && input.to ? payRunsInPeriod(res.payRuns, input.from, input.to) : res.payRuns.slice(0, 26)).map((p) => ({
      paymentDate: p.paymentDate, periodStart: p.periodStart, periodEnd: p.periodEnd,
      gross: round2(p.wages), paygWithheld: round2(p.tax), super: round2(p.super),
      superAsShareOfGross: p.wages > 0 ? Math.round((p.super / p.wages) * 1000) / 10 : null,
      paydaySuperDue: p.paymentDate ? paydaySuperDueDate(p.paymentDate) : null,
      flag: p.paymentDate ? paydaySuperFlag(paydaySuperDueDate(p.paymentDate)) : null,
    }));
    return {
      ...fresh(hit), fetchedAt: res.fetchedAt ?? hit.source?.fetchedAt ?? null,
      range: input.from && input.to ? `${input.from} to ${input.to}` : "latest 26 pay runs",
      payRuns: list,
      totals: { gross: round2(list.reduce((s, p) => s + p.gross, 0)), paygWithheld: round2(list.reduce((s, p) => s + p.paygWithheld, 0)), super: round2(list.reduce((s, p) => s + p.super, 0)) },
      truncated: res.truncated,
      ordinaryTimeEarnings: "Not in the saved pay-run summary — gross wages are shown. Super guarantee is 12% of ordinary time earnings, which can be lower than gross.",
      paydaySuperRule: "Due in the fund within 7 business days of payday (weekends and national public holidays skipped).",
    };
  });
}

async function comparePeriods(ctx: TrixieContext, input: { from: string; to: string; priorFrom?: string; priorTo?: string }) {
  const cur = boundedRange(input.from, input.to, 370);
  const { sameDaysPreviousMonth, paydayNote } = await import("@/lib/pnl-comparison");
  const d = (s: string) => new Date(`${s}T00:00:00`);
  const iso = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  const prior = input.priorFrom && input.priorTo ? boundedRange(input.priorFrom, input.priorTo, 370) : (() => { const p = sameDaysPreviousMonth(d(cur.from), d(cur.to)); return { from: iso(p.from), to: iso(p.to) }; })();
  return perFile(ctx, "compare_periods", "Profit & Loss comparison (Xero)", async (tenantId) => {
    const { summarisePnl } = await import("@/lib/xero/reports.functions");
    const [a, b] = await Promise.all([
      get(tenantId, "Reports/ProfitAndLoss", { fromDate: cur.from, toDate: cur.to }),
      get(tenantId, "Reports/ProfitAndLoss", { fromDate: prior.from, toDate: prior.to }),
    ]);
    audit(ctx, tenantId, "compare_periods", "live", cur);
    const sa = summarisePnl(a?.Reports?.[0]);
    const sb = summarisePnl(b?.Reports?.[0]);
    const excluded = await excludedNames(ctx);
    const keep = (l: { name: string }) => !excluded.has(l.name.trim().toLowerCase());
    const { readSnapshot } = await import("@/lib/xero/snapshot-read.server");
    const { PAYROLL_PAYRUNS_REPORT_KEY, payRunsInPeriod } = await import("@/lib/xero/payroll.server");
    const pr = await readSnapshot({ supabase: ctx.supabase, tenantId, clientId: ctx.clientId, reportKey: PAYROLL_PAYRUNS_REPORT_KEY });
    const runs = pr?.payload?.status === "available" ? (pr.payload.payRuns as any[]) : null;
    const paydays = runs ? { current: payRunsInPeriod(runs, cur.from, cur.to).map((p) => p.paymentDate), prior: payRunsInPeriod(runs, prior.from, prior.to).map((p) => p.paymentDate) } : null;
    const t = (s: any) => ({ income: round2(s.totalIncome), costOfSales: round2(s.totalCostOfSales), grossProfit: round2(s.grossProfit), expenses: round2(s.totalExpenses), netProfit: round2(s.netProfit) });
    return {
      range: `${cur.from} to ${cur.to} vs ${prior.from} to ${prior.to}`,
      fetchedAt: new Date().toISOString(), mode: "live from Xero, accrual",
      current: { from: cur.from, to: cur.to, ...t(sa) },
      prior: { from: prior.from, to: prior.to, ...t(sb) },
      biggestMoves: biggestMoves([...sa.incomeLines, ...sa.cogsLines, ...sa.expenseLines].filter(keep), [...sb.incomeLines, ...sb.cogsLines, ...sb.expenseLines].filter(keep)),
      paydays,
      paydayNote: paydays ? paydayNote(paydays.current.length, paydays.prior.length) : "Pay-run dates are not saved for this file.",
      excludedAccounts: excluded.size ? "Accounts excluded in this client's tax settings are left out of the movers list." : null,
    };
  });
}

async function activityStatement(ctx: TrixieContext, input: { period: "current" | "previous" | "same_last_year" }) {
  return perFile(ctx, "activity_statement", "Activity statement (GST card)", async (tenantId) => {
    const { data: client } = await (ctx.supabase as any).from("clients").select("gst_cycle").eq("id", ctx.clientId).maybeSingle();
    const cycle = client?.gst_cycle ?? null;
    if (!cycle || cycle === "not_registered") return { available: false, reason: cycle ? "This client is not registered for GST." : "The client's GST lodgement cycle isn't set." };
    const { currentGstPeriod, basDueDate, lodgedBillsForPeriod } = await import("@/components/dashboard/tax-obligations");
    const today = sydneyToday();
    let ref = today;
    const step = cycle === "quarterly" ? 3 : 1;
    const shift = (iso: string, months: number) => { const [y, m] = iso.split("-").map(Number); return new Date(Date.UTC(y!, m! - 1 + months, 15)).toISOString().slice(0, 10); };
    if (input.period === "previous") ref = shift(today, -step);
    if (input.period === "same_last_year") ref = shift(today, -12);
    const p = currentGstPeriod(cycle, ref);
    const { loadGstReconciliation } = await import("@/lib/xero/gst-load.server");
    const gst = await loadGstReconciliation(ctx.supabase, ctx.userId, { clientId: ctx.clientId!, tenantId, asAt: p.asAt > today ? today : p.asAt, window: p.kind === "quarter" ? "quarter" : "month" });
    let bills: any[] = [];
    try { const { readLodgedTaxBills } = await import("@/lib/xero/lodged-tax.server"); bills = (await readLodgedTaxBills(ctx.supabase, tenantId, "tax_obligations")).bills; } catch { bills = []; }
    const { loadPayRuns, payRunsInPeriod } = await import("@/lib/xero/payroll.server");
    const pr = await loadPayRuns({ supabase: ctx.supabase, tenantId, clientId: ctx.clientId }).catch(() => null);
    const runs = pr?.status === "available" ? payRunsInPeriod(pr.payRuns, p.from, p.asAt) : null;
    audit(ctx, tenantId, "activity_statement", "snapshot", { from: p.from, to: p.asAt });
    const g: any = gst;
    return {
      range: `${p.from} to ${p.asAt}`,
      fetchedAt: g.generatedAt ?? g.fetchedAt ?? null,
      gstMethod: g.method ? { method: g.method.method, source: g.method.source } : null,
      labels: {
        G1: "Not worked out by the GST card — check the Activity Statement in Xero.",
        "1A": g.gstOnSales, "1B": g.gstOnPurchases,
        netGst: g.gstOnSales != null && g.gstOnPurchases != null ? round2(g.gstOnSales - g.gstOnPurchases) : null,
        W1: runs ? round2(runs.reduce((s, r) => s + r.wages, 0)) : null,
        W2: runs ? round2(runs.reduce((s, r) => s + r.tax, 0)) : null,
        T7: "Income tax instalments are entered on the Tax obligations card.",
      },
      payRunsInPeriod: runs?.length ?? null,
      unfiled: g.unfiled,
      statementNet: g.statementNet,
      accrualFigures: { gstOnSales: g.accrualGstOnSales, gstOnPurchases: g.accrualGstOnPurchases },
      gstAccount: { name: untrusted(g.controlAccountName, 80), opening: g.openingBalance, closing: g.closingBalance, expectedClosing: g.expectedClosing, difference: g.difference, ties: g.ties, reasons: g.tieReasons },
      complete: g.complete, issues: g.issues,
      due: basDueDate(p.kind, p.asAt),
      lodgedAtoBills: bills.map((b) => ({ reference: untrusted(b.reference, 60), amount: b.amount, total: b.total ?? null, due: b.due, overdue: b.due < today })),
      lodgedForThisPeriod: lodgedBillsForPeriod(bills, p.from, p.asAt).map((b) => ({ reference: untrusted(b.reference, 60), amount: b.amount, due: b.due })),
    };
  });
}

async function findIssues(ctx: TrixieContext) {
  return perFile(ctx, "find_issues", "Bookkeeping checks (saved)", async (tenantId) => {
    const [tb, bills, invs, bank] = await Promise.all([
      snapshot(ctx, tenantId, "trial_balance"),
      snapshot(ctx, tenantId, "invoices_accpay_open"),
      snapshot(ctx, tenantId, "invoices_accrec_open"),
      snapshot(ctx, tenantId, "bank_unreconciled_recent"),
    ]);
    audit(ctx, tenantId, "find_issues", "snapshot");
    const today = sydneyToday();
    const excluded = await excludedNames(ctx);
    const num = (v: unknown) => { const n = Number(String(v ?? "").replace(/,/g, "")); return Number.isFinite(n) ? n : 0; };
    const suspense: { account: string | null; balance: number }[] = [];
    for (const sec of (tb?.payload?.Reports?.[0]?.Rows ?? []) as any[]) for (const row of (sec.Rows ?? []) as any[]) {
      const c = row.Cells ?? [];
      const name = String(c[0]?.Value ?? "");
      if (row.RowType !== "Row" || !/suspense|clearing/i.test(name) || excluded.has(name.trim().toLowerCase())) continue;
      const bal = round2((num(c[3]?.Value) - num(c[4]?.Value)) || (num(c[1]?.Value) - num(c[2]?.Value)));
      if (Math.abs(bal) >= 0.01) suspense.push({ account: untrusted(name, 80), balance: bal });
    }
    const billRows = ((bills?.payload?.Invoices ?? []) as any[]).map((b) => ({ contact: String(b.Contact?.Name ?? ""), amount: round2(Number(b.Total ?? 0)), date: xeroDate(b.DateString ?? b.Date), reference: untrusted(b.InvoiceNumber ?? b.Reference, 40) }));
    const dups = possibleDuplicates(billRows).map((d) => ({ ...d, contact: untrusted(d.contact) }));
    const old = ((invs?.payload?.Invoices ?? []) as any[]).map((i) => ({ contact: untrusted(i.Contact?.Name), number: untrusted(i.InvoiceNumber, 40), due: xeroDate(i.DueDateString ?? i.DueDate), amountDue: round2(Number(i.AmountDue ?? 0)) }))
      .filter((i) => i.amountDue > 0 && i.due && daysBetween(i.due, today) > 90);
    const bankLines = ((bank?.payload?.BankTransactions ?? []) as any[]).filter((t) => t.Status !== "DELETED");
    const uncoded = bankLines.filter((t) => !((t.LineItems ?? []) as any[]).some((l) => l.AccountCode)).map((t) => ({ date: xeroDate(t.DateString ?? t.Date), contact: untrusted(t.Contact?.Name), amount: round2(Number(t.Total ?? 0)) }));
    const unusual = unusualAmounts(billRows).map((b) => ({ ...b, contact: untrusted(b.contact) }));
    return {
      ...fresh(tb ?? bills), range: "saved overnight snapshots",
      suspenseOrClearingBalances: suspense,
      possibleDuplicateBills: dups,
      debtsOver90Days: { count: old.length, total: round2(old.reduce((s, i) => s + i.amountDue, 0)), items: old.slice(0, 20) },
      uncodedBankLines: { count: uncoded.length, items: uncoded.slice(0, 20), note: "From the saved recent unreconciled bank lines only." },
      unusualOpenBills: unusual.slice(0, 10),
      missing: [!tb && "trial balance", !bills && "open bills", !invs && "open invoices", !bank && "recent bank lines"].filter(Boolean),
    };
  });
}

export function buildDeepTools(ctx: TrixieContext): ToolSet {
  const allowed = new Set(deepToolsFor(ctx));
  const all: Partial<Record<DeepToolName, any>> = {
    // practice_overview and ask_about_client live in trixie-org-tools.server.ts.
    account_transactions: tool({ description: "Staff only. Lines posted to ONE account (by code or name) in a date range: date, contact, description, amount, tax code; newest first, up to 200, with totals.", inputSchema: range.extend({ account: z.string().min(1).max(80).describe("Account code or name"), limit: z.number().int().min(1).max(200).optional() }), execute: (i) => accountTransactions(ctx, i) }),
    journals: tool({ description: "Staff only. Posted manual journals/adjustments in a date range, optionally for one account.", inputSchema: range.extend({ account: z.string().max(80).optional().describe("Optional account code or name") }), execute: (i) => journals(ctx, i) }),
    contact_history: tool({ description: "One customer's invoices or one supplier's bills over the last 12 months: payments, average days to pay, amounts overdue by age.", inputSchema: z.object({ contact: z.string().min(1).max(100).describe("Contact name exactly as in Xero"), side: z.enum(["customer", "supplier"]) }), execute: (i) => contactHistory(ctx, i) }),
    bank_activity: tool({ description: "Saved recent bank lines not yet reconciled, count and value, and last reconciled date per bank account.", inputSchema: z.object({ from: z.string().regex(ISO_DATE).optional(), to: z.string().regex(ISO_DATE).optional() }), execute: (i) => bankActivity(ctx, i) }),
    pay_runs: tool({ description: "Saved pay runs: payment date, gross, PAYG withheld, super and Payday Super due date (7 business days).", inputSchema: z.object({ from: z.string().regex(ISO_DATE).optional(), to: z.string().regex(ISO_DATE).optional() }), execute: (i) => payRuns(ctx, i) }),
    compare_periods: tool({ description: "Profit & Loss for two periods side by side (prior defaults to the same days last month), the accounts that moved most, and the paydays in each. Use for any 'why did X change' question.", inputSchema: range.extend({ priorFrom: z.string().regex(ISO_DATE).optional(), priorTo: z.string().regex(ISO_DATE).optional() }), execute: (i) => comparePeriods(ctx, i) }),
    activity_statement: tool({ description: "The GST card's figures for a BAS period: 1A, 1B, W1, W2, unfiled amounts, cash or accrual method, GST account tie-out, lodged ATO bills and due date.", inputSchema: z.object({ period: z.enum(["current", "previous", "same_last_year"]) }), execute: (i) => activityStatement(ctx, i) }),
    find_issues: tool({ description: "Staff only. Bookkeeping checks: suspense/clearing balances, possible duplicate bills (same contact and amount within 14 days), debts over 90 days, uncoded bank lines, unusual one-off bills.", inputSchema: z.object({}), execute: () => findIssues(ctx) }),
  };
  return Object.fromEntries(Object.entries(all).filter(([k]) => allowed.has(k as DeepToolName))) as ToolSet;
}

export const __test = { accountTransactions, contactHistory, activityStatement, findIssues, payRuns, bankActivity, comparePeriods, journals };
