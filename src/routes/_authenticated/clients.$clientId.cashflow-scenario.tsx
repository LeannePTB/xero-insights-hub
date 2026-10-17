import { useEffect, useMemo, useState } from "react";
import { PlanningPanel, type PlanningState } from "@/components/scenario/PlanningPanel";
import { getScenarioContext } from "@/lib/tax/tax-position.functions";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronRight, Loader2, RefreshCw, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { AdjustmentsPanel } from "@/components/scenario/AdjustmentsPanel";
import { ScenarioResults } from "@/components/scenario/ScenarioResults";
import { SavedScenariosBar } from "@/components/scenario/SavedScenariosBar";
import { debtAdjustment, lowestCash, salesForTarget, taxSetAside, belowZeroMonths, caseAdjustments, breakEvenImpact, filterInvoices, monthsAhead, project, selectAllState, toggleSelectAll, type Adjustment, type Baseline } from "@/lib/scenario/adjustments";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCanManageClient } from "@/hooks/useCanManageClient";
import { getClient } from "@/lib/clients.functions";
import { formatMoney, useTenantCurrency } from "@/components/dashboard/useTenantCurrency";
import { XeroErrorNotice } from "@/components/dashboard/XeroLoadState";
import {
  MonthPicker,
  monthBounds,
  monthLabelOf,
  usePersistedMonth,
} from "@/components/dashboard/MonthPicker";
import {
  getScenarioData,
  resetScenario,
  setInvoicesExcludedBulk,

  type ScenarioExpense,
  type ScenarioInvoice,
} from "@/lib/xero/scenario.functions";
import { buildMatrix, computeTotals, groupExpenses, monthKey } from "@/lib/scenario-calc";
import {
  basisNote,
  isModelled,
  resolveGroupCost,
  usePersistedCostBasis,
  type CostGroup,
} from "@/lib/scenario-basis";
import { UnclassifiedNotice } from "@/components/dashboard/UnclassifiedNotice";
import { CostBasisControls } from "@/components/dashboard/CostBasisControls";
import { PageContainer } from "@/components/PageContainer";

export const Route = createFileRoute("/_authenticated/clients/$clientId/cashflow-scenario")({
  staticData: { sitemap: false },
  validateSearch: (search: Record<string, unknown>) => ({
    tenantId: typeof search.tenantId === "string" ? search.tenantId : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Cashflow Scenario — Traction Advisory" },
      {
        name: "description",
        content:
          "Live money in versus money out from Xero, with what-if invoice exclusions and net position by month.",
      },
      { property: "og:title", content: "Cashflow Scenario — Traction Advisory" },
      {
        property: "og:description",
        content: "Live money in versus money out from Xero with what-if invoice exclusions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CashflowScenarioPage,
});

function CashflowScenarioPage() {
  const { clientId } = Route.useParams();
  const { canManage } = useCanManageClient(clientId);
  const search = Route.useSearch();
  const qc = useQueryClient();

  const fetchClient = useServerFn(getClient);
  const fetchScenario = useServerFn(getScenarioData);
  const reset = useServerFn(resetScenario);
  const toggleExcludedBulk = useServerFn(setInvoicesExcludedBulk);


  const clientQ = useQuery({
    queryKey: ["client", clientId],
    queryFn: () => fetchClient({ data: { clientId } }),
  });
  const client = clientQ.data?.client;
  const orgs = (client?.client_xero_orgs ?? []) as any[];
  const tenantId =
    search.tenantId ?? (orgs[0]?.xero_connections?.tenant_id as string | undefined);
  const tenantName =
    (orgs.find((o) => o.xero_connections?.tenant_id === tenantId)?.xero_connections
      ?.tenant_name as string | undefined) ?? "Xero organisation";

  const currency = useTenantCurrency(tenantId);
  const fmt = (n: number) => formatMoney(n, currency);

  const [month, setMonth] = usePersistedMonth(`scenario-month:${tenantId ?? "none"}`);
  const { from: fromStr, to: toStr } = monthBounds(month);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["scenario", clientId, tenantId, fromStr, toStr],
    enabled: !!tenantId,
    retry: false,
    queryFn: () =>
      fetchScenario({ data: { clientId, tenantId: tenantId!, fromDate: fromStr, toDate: toStr } }),
  });

  const bulkMut = useMutation({
    mutationFn: (v: { xeroInvoiceIds: string[]; excluded: boolean }) =>
      toggleExcludedBulk({ data: { clientId, ...v } }),
    onSuccess: (_r, v) => {
      qc.invalidateQueries({ queryKey: ["scenario", clientId] });
      toast.success(`${v.excluded ? "Excluded" : "Included"} ${v.xeroInvoiceIds.length} invoice${v.xeroInvoiceIds.length === 1 ? "" : "s"}`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not update these invoices"),
  });
  const resetMut = useMutation({

    mutationFn: () => reset({ data: { clientId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scenario", clientId] }),
    onError: (e: any) => toast.error(e?.message ?? "Could not reset the scenario"),
  });

  const [customer, setCustomer] = useState<string>("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [horizon, setHorizon] = useState(3);
  const [openingCash, setOpeningCash] = useState<number | null>(null);
  const [cashEdited, setCashEdited] = useState(false);
  const [planning, setPlanning] = useState<PlanningState>({ cases: null, target: null, debts: [], tax: null });
  const ctxQ = useQuery({
    queryKey: ["scenario-context", clientId, tenantId],
    enabled: !!tenantId,
    retry: false,
    queryFn: () => getScenarioContext({ data: { tenantId: tenantId! } }),
  });
  // Opening cash defaults to Cash Cover's cash at bank until someone edits it.
  useEffect(() => {
    if (!cashEdited && ctxQ.data?.cashAtBank != null) setOpeningCash(ctxQ.data.cashAtBank);
  }, [ctxQ.data, cashEdited]);
  const [loaded, setLoaded] = useState<{ id: string; name: string } | null>(null);
  /** Exclusions from a saved scenario opened read-only (never written). */
  const [excludedOverride, setExcludedOverride] = useState<Set<string> | null>(null);
  const [scope, setScope] = useState<"month" | "all">("month");
  const [matrixOpen, setMatrixOpen] = useState(false);
  const [invoicesOpen, setInvoicesOpen] = useState(false);
  const [costBasis, setCostBasis, resetCostBasis] = usePersistedCostBasis(
    `scenario-cost-basis:${clientId}:${tenantId ?? "none"}`,
  );

  const invoices = useMemo(() => (data?.invoices ?? []).map((i: ScenarioInvoice) => excludedOverride ? { ...i, excluded: excludedOverride.has(i.id) } : i), [data, excludedOverride]);
  const view = useMemo(() => {
    if (!data) return null;
    const months = data.months;
    const monthExpenses = data.expenses.filter((e: ScenarioExpense) => monthKey(e.date) === month);
    const sumGroups = (gs: { subtotal: number }[]) => gs.reduce((a, g) => a + g.subtotal, 0);
    const actuals: Record<CostGroup, number> = {
      cogs: sumGroups(groupExpenses(monthExpenses, "Variable", "cogs")),
      fixed: sumGroups(groupExpenses(monthExpenses, "Fixed")),
      variable: sumGroups(groupExpenses(monthExpenses, "Variable", "operating")),
    };
    const avg: Record<CostGroup, number> | null = data.avg3
      ? { cogs: data.avg3.cogs, fixed: data.avg3.fixed, variable: data.avg3.variable }
      : null;
    const applied: Record<CostGroup, number> = {
      cogs: resolveGroupCost(actuals.cogs, avg?.cogs ?? null, costBasis.cogs),
      fixed: resolveGroupCost(actuals.fixed, avg?.fixed ?? null, costBasis.fixed),
      variable: resolveGroupCost(actuals.variable, avg?.variable ?? null, costBasis.variable),
    };
    const monthTotals = computeTotals(invoices, data.expenses, month);
    const appliedCosts = applied.cogs + applied.fixed + applied.variable;
    return {
      months,
      month,
      matrix: buildMatrix(data.customers, invoices, months),
      monthTotals,
      costActuals: actuals,
      costAvg: avg,
      costApplied: applied,
      scenarioNet: monthTotals.revenue - appliedCosts,
      rangeTotals: computeTotals(invoices, data.expenses, null),
      monthInvoices: invoices.filter((i: ScenarioInvoice) => monthKey(i.issue_date) === month),
      monthExpenses,
      monthPnl: (data.pnl ?? []).find((p) => p.month === month) ?? null,
    };
  }, [data, invoices, month, costBasis]);



  const customerNames = useMemo(() => {
    const set = new Set<string>();
    for (const i of (data?.invoices ?? []) as ScenarioInvoice[]) {
      set.add(i.customer_id ?? "Unassigned");
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [data]);

  const shown = useMemo(() => filterInvoices(((scope === "month" ? view?.monthInvoices : invoices) ?? []) as ScenarioInvoice[], customer), [customer, scope, view, invoices]);
  const shownIds = shown.map((i) => i.id);
  const selState = selectAllState(shownIds, selected);
  const selectedShown = shown.filter((i) => selected.has(i.id));

  const projection = useMemo(() => {
    if (!view || !data) return null;
    const byCustomer: Record<string, number> = {};
    for (const inv of view.monthInvoices as ScenarioInvoice[]) if (!inv.excluded) byCustomer[inv.customer_id ?? "Unassigned"] = (byCustomer[inv.customer_id ?? "Unassigned"] ?? 0) + inv.amount;
    const accounts: Baseline["accounts"] = {};
    for (const e of view.monthExpenses as ScenarioExpense[]) {
      const group = e.section === "cogs" && e.type === "Variable" ? "cogs" : e.type === "Fixed" ? "fixed" : "variable";
      accounts[e.name] = { amount: (accounts[e.name]?.amount ?? 0) + e.amount, group };
    }
    const baseline: Baseline = { revenue: view.monthTotals.revenue, revenueByCustomer: byCustomer, costs: view.costApplied, accounts };
    const months = monthsAhead(month, horizon + 1);
    const debtAdj = debtAdjustment(planning.debts);
    const allAdj = debtAdj ? [...adjustments, debtAdj] : adjustments;
    const rows = project(baseline, allAdj, months, openingCash);
    const paid = (view.monthInvoices as ScenarioInvoice[]).filter((i) => !i.excluded);
    const averageInvoice = paid.length ? paid.reduce((t, i) => t + i.amount, 0) / paid.length : null;
    return { baseline, rows, months, allAdj, averageInvoice, breakEven: breakEvenImpact(baseline, rows), accountNames: Object.keys(accounts).sort() };
  }, [view, data, month, horizon, adjustments, openingCash, planning.debts]);

  // Recent GST + PAYG as a share of income: the accruing period's tax over its months of sales.
  const defaultTaxPct = useMemo(() => {
    const b = ctxQ.data?.building;
    if (!b?.amount || !projection || projection.baseline.revenue <= 0) return null;
    const [fy, fm] = b.from.slice(0, 7).split("-").map(Number);
    const [ty, tm] = (ctxQ.data!.today ?? b.to).slice(0, 7).split("-").map(Number);
    const n = Math.max(1, (ty! - fy!) * 12 + (tm! - fm!) + 1);
    return Math.round((b.amount / (projection.baseline.revenue * n)) * 1000) / 10;
  }, [ctxQ.data, projection]);

  const reportExtras = (): { label: string; value: string }[] => {
    if (!projection) return [];
    const out: { label: string; value: string }[] = [];
    const low = lowestCash(projection.rows);
    if (low) out.push({ label: "Lowest cash point", value: `${fmt(low.amount)} (${low.month})` });
    if (planning.cases) for (const k of ["worst", "best"] as const) {
      const r = project(projection.baseline, caseAdjustments(projection.allAdj, planning.cases[k], projection.months[0]!), projection.months, openingCash);
      const l = lowestCash(r);
      out.push({ label: k === "best" ? "Best case net (total)" : "Worst case net (total)", value: `${fmt(r.reduce((t, x) => t + x.scenario.net, 0))}${l ? ` · lowest cash ${fmt(l.amount)}` : ""}` });
    }
    if (planning.target) {
      const last = projection.rows[projection.rows.length - 1]!;
      const t = salesForTarget({ baseline: projection.baseline, fixedCosts: last.scenario.costs - projection.baseline.costs.cogs - projection.baseline.costs.variable, targetPerMonth: planning.target.per === "year" ? planning.target.amount / 12 : planning.target.amount, averageInvoice: projection.averageInvoice });
      if (t) out.push({ label: "Sales needed per month", value: `${fmt(t.salesNeeded)} (${t.gap >= 0 ? "+" : ""}${fmt(t.gap)})` });
    }
    if (planning.debts.length) {
      const below = belowZeroMonths(projection.rows);
      out.push({ label: "Debt repayments", value: `${planning.debts.length} debt${planning.debts.length === 1 ? "" : "s"}${below.length ? ` · cash below zero in ${below.join(", ")}` : ""}` });
    }
    if (planning.tax) {
      const sa = taxSetAside(projection.rows.map((r) => ({ month: r.month, amount: r.scenario.revenue })), planning.tax.pct, planning.tax.instalmentPct, ctxQ.data?.dues ?? []);
      const short = sa.checks.filter((c) => !c.covered).length;
      out.push({ label: "Tax set-aside", value: `${fmt(sa.monthly[0] ?? 0)}/month${sa.checks.length ? ` · ${short ? `short for ${short} of ${sa.checks.length} tax dues` : "covers the tax due shown"}` : ""}` });
    }
    return out;
  };

  const currentPayload = () => ({
    version: 1 as const, month, horizon, openingCash: cashEdited ? openingCash : null, adjustments, ...planning,
    excludedInvoiceIds: invoices.filter((i) => i.excluded).map((i) => i.id),
    costBasis,
  });

  return (
    <div className="min-h-screen bg-background">
      <PageContainer>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-lg font-semibold">Cashflow Scenario</h1>
            <p className="text-sm text-muted-foreground">
              {client?.name ?? "Client"} · {tenantName} · live from Xero
            </p>
          </div>
          <div className="flex items-center gap-2">
            {orgs.length > 1 && (
              <Select
                value={tenantId}
                onValueChange={(v) =>
                  window.location.assign(`/clients/${clientId}/cashflow-scenario?tenantId=${v}`)
                }
              >
                <SelectTrigger className="h-9 w-[220px] text-xs">
                  <SelectValue placeholder="Xero organisation" />
                </SelectTrigger>
                <SelectContent>
                  {orgs.map((o) => (
                    <SelectItem key={o.id} value={o.xero_connections?.tenant_id}>
                      {o.xero_connections?.tenant_name ?? "Xero organisation"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Refresh
            </Button>
            {canManage && <Button
              variant="outline"
              size="sm"
              onClick={() => resetMut.mutate()}
              disabled={resetMut.isPending}
            >
              <RotateCcw className="mr-2 h-4 w-4" /> Reset scenario
            </Button>}
          </div>
        </div>

        <div className="mt-4">
          <MonthPicker value={month} onChange={setMonth} />
        </div>

        {tenantId && data && (
          <SavedScenariosBar
            clientId={clientId}
            canManage={canManage}
            loaded={loaded}
            monthEnd={toStr}
            monthLabel={monthLabelOf(month)}
            currentPayload={currentPayload}
            reportTable={projection ? () => ({ kind: "cashflow_scenario", extras: reportExtras(), rows: projection.rows.map((r) => ({ month: r.month, baselineNet: r.baseline.net, scenarioNet: r.scenario.net, baselineCash: r.baseline.closingCash, scenarioCash: r.scenario.closingCash })) }) : () => null}
            onSaved={(sc) => setLoaded(sc)}
            onLoad={async (sc, payload) => {
              setLoaded(sc ? { id: sc.id, name: sc.name } : null);
              if (!sc || !payload) { setAdjustments([]); setExcludedOverride(null); setPlanning({ cases: null, target: null, debts: [], tax: null }); setCashEdited(false); return; }
              setAdjustments(payload.adjustments);
              setHorizon(payload.horizon);
              setPlanning({ cases: payload.cases ?? null, target: payload.target ?? null, debts: payload.debts ?? [], tax: payload.tax ?? null });
              if (payload.openingCash !== null) { setCashEdited(true); setOpeningCash(payload.openingCash); } else { setCashEdited(false); setOpeningCash(ctxQ.data?.cashAtBank ?? null); }
              if (payload.costBasis && typeof payload.costBasis === "object") for (const g of ["cogs", "fixed", "variable"] as const) { const b = (payload.costBasis as any)[g]; if (b?.mode) setCostBasis(g, b); }
              const saved = new Set(payload.excludedInvoiceIds);
              if (!canManage) { setExcludedOverride(saved); return; }
              // Managers: re-apply the saved exclusions through the audited writes.
              const ids = invoices.map((i) => i.id);
              const ex = ids.filter((id) => saved.has(id)); const inc = ids.filter((id) => !saved.has(id));
              if (ex.length) await toggleExcludedBulk({ data: { clientId, xeroInvoiceIds: ex, excluded: true } });
              if (inc.length) await toggleExcludedBulk({ data: { clientId, xeroInvoiceIds: inc, excluded: false } });
              qc.invalidateQueries({ queryKey: ["scenario", clientId] });
            }}
          />
        )}

        {!tenantId ? (
          <p className="mt-8 text-sm text-muted-foreground">
            Connect a Xero organisation to this client to use the Cashflow Scenario.
          </p>
        ) : isLoading ? (
          <div className="mt-16 flex items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading from Xero…
          </div>
        ) : error ? (
          <XeroErrorNotice error={error} onRetry={() => refetch()} isRetrying={isFetching} />
        ) : view ? (
          <>
            {/* Xero P&L reconciliation */}
            {view.monthPnl && (
              <section className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-display text-lg font-semibold">
                    Profit &amp; Loss · {monthLabelOf(month)}
                  </h2>
                  <span className="rounded-full border border-border px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Accrual basis
                  </span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-5">
                  <Stat label="Trading income" value={fmt(view.monthPnl.income)} />
                  <Stat label="Cost of sales" value={fmt(view.monthPnl.cogs)} />
                  <Stat label="Gross profit" value={fmt(view.monthPnl.grossProfit)} />
                  <Stat label="Operating expenses" value={fmt(view.monthPnl.operating)} />
                  <Stat
                    label="Net profit"
                    value={fmt(view.monthPnl.netProfit)}
                    tone={view.monthPnl.netProfit >= 0 ? "text-emerald-600" : "text-rose-600"}
                  />
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Straight from Xero. The scenario figures below use invoices raised in the month, so
                  they can differ from Trading Income.
                </p>
              </section>
            )}

            {/* Scenario */}
            <section className="mt-8">
              <UnclassifiedNotice clientId={clientId} count={data?.unclassifiedCount ?? 0} names={data?.unclassifiedNames} />
              <div className="mb-5 border-b border-border/60 pb-4">
                <h2 className="font-display text-lg font-semibold">Scenario</h2>
                <p className="text-sm text-muted-foreground">If this, then that</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Stat label="Baseline invoice revenue (period, excl. GST)" value={fmt(view.rangeTotals.baselineRevenue)} />
                <Stat label="Current scenario (period)" value={fmt(view.rangeTotals.revenue)} />
                <Stat
                  label="Excluded revenue (period)"
                  value={fmt(-view.rangeTotals.excludedRevenue)}
                  tone={view.rangeTotals.excludedRevenue > 0 ? "text-rose-600" : "text-muted-foreground"}
                />
              </div>

              <CostBasisControls
                basis={costBasis}
                onChange={setCostBasis}
                onReset={resetCostBasis}
                actuals={view.costActuals}
                avg={view.costAvg}
                fmt={fmt}
              />

              <div className="mt-3 grid gap-3 sm:grid-cols-5">
                <Stat label={`Scenario revenue · ${monthLabelOf(month)} (excl. GST)`} value={fmt(view.monthTotals.revenue)} />
                <Stat
                  label="Cost of sales"
                  value={fmt(view.costApplied.cogs)}
                  note={basisNote(view.costActuals.cogs, view.costAvg?.cogs ?? null, costBasis.cogs, fmt)}
                />
                <Stat
                  label="Fixed expenses"
                  value={fmt(view.costApplied.fixed)}
                  note={basisNote(view.costActuals.fixed, view.costAvg?.fixed ?? null, costBasis.fixed, fmt)}
                />
                <Stat
                  label="Variable expenses"
                  value={fmt(view.costApplied.variable)}
                  note={basisNote(
                    view.costActuals.variable,
                    view.costAvg?.variable ?? null,
                    costBasis.variable,
                    fmt,
                  )}
                />

                <Stat
                  label="Net position"
                  value={fmt(view.scenarioNet)}
                  tone={view.scenarioNet >= 0 ? "text-emerald-600" : "text-rose-600"}
                />
              </div>



            </section>

            {projection && (
              <>
                <AdjustmentsPanel
                  adjustments={adjustments}
                  onChange={setAdjustments}
                  months={monthsAhead(month, 6)}
                  month={month}
                  customers={customerNames}
                  accounts={projection.accountNames}
                  readOnly={!canManage}
                  fmt={fmt}
                />
                <div className="mt-4 flex flex-wrap items-end gap-3">
                  <label className="flex flex-col gap-1 text-xs text-muted-foreground">Months ahead
                    <Select value={String(horizon)} onValueChange={(v) => setHorizon(Number(v))}>
                      <SelectTrigger className="h-9 w-[110px] text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{[3, 4, 5, 6].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
                    </Select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                    {!cashEdited && ctxQ.data?.cashAtBank != null ? `Opening cash from Xero (as at ${ctxQ.data.cashAsAt ?? "latest"}) · edit` : "Opening cash (A$)"}
                    <Input className="h-9 w-[180px]" type="number" value={openingCash ?? ""} disabled={!canManage} onChange={(e) => { setCashEdited(true); setOpeningCash(e.target.value === "" ? null : Number(e.target.value)); }} />
                  </label>
                  {cashEdited && ctxQ.data?.cashAtBank != null && canManage && <Button size="sm" variant="ghost" onClick={() => { setCashEdited(false); setOpeningCash(ctxQ.data!.cashAtBank); }}>Use Xero figure</Button>}
                </div>
                <ScenarioResults rows={projection.rows} fmt={fmt} breakEven={projection.breakEven} title={loaded ? `${loaded.name} · compare with baseline` : undefined} />
                <PlanningPanel state={planning} onChange={setPlanning} readOnly={!canManage} fmt={fmt} baseline={projection.baseline}
                  adjustments={projection.allAdj} months={projection.months} openingCash={openingCash} rows={projection.rows}
                  averageInvoice={projection.averageInvoice} knownDebts={ctxQ.data?.knownDebts ?? []} dues={ctxQ.data?.dues ?? []} defaultTaxPct={defaultTaxPct} />
              </>
            )}

            <section>
            {/* Matrix */}
            <section className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
              <button
                type="button"
                onClick={() => setMatrixOpen((v) => !v)}
                className="flex w-full flex-wrap items-center justify-between gap-3 text-left"
                aria-expanded={matrixOpen}
              >
                <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
                  <ChevronRight
                    className={`h-4 w-4 text-muted-foreground transition-transform ${matrixOpen ? "rotate-90" : ""}`}
                  />
                  Revenue by customer per month
                </h2>
                <span className="text-xs text-muted-foreground">{monthLabelOf(month)}</span>
              </button>
              <div className={`mt-4 overflow-x-auto ${matrixOpen ? "" : "hidden"}`}>

                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="py-2 pr-4 font-semibold">Customer</th>
                      {view.months.map((m) => (
                        <th key={m} className="py-2 px-2 text-right font-semibold">
                          {monthLabelOf(m)}
                        </th>
                      ))}
                      <th className="py-2 pl-2 text-right font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {view.matrix.rows.map((r) => (
                      <tr key={r.customerId ?? "none"} className="border-b border-border/50">
                        <td className="py-2 pr-4">{r.name}</td>
                        {r.cells.map((c, i) => (
                          <td key={i} className="py-2 px-2 text-right tabular-nums">
                            {c ? fmt(c) : "—"}
                          </td>
                        ))}
                        <td className="py-2 pl-2 text-right font-semibold tabular-nums">{fmt(r.total)}</td>
                      </tr>
                    ))}
                    <tr>
                      <td className="py-2 pr-4 font-semibold">Total</td>
                      {view.matrix.columnTotals.map((c, i) => (
                        <td key={i} className="py-2 px-2 text-right font-semibold tabular-nums">
                          {fmt(c)}
                        </td>
                      ))}
                      <td className="py-2 pl-2 text-right font-semibold tabular-nums">
                        {fmt(view.matrix.grandTotal)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* Invoices for the month */}
            <section className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
              <button
                type="button"
                onClick={() => setInvoicesOpen((v) => !v)}
                className="flex w-full flex-wrap items-center justify-between gap-3 text-left"
                aria-expanded={invoicesOpen}
              >
                <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
                  <ChevronRight
                    className={`h-4 w-4 text-muted-foreground transition-transform ${invoicesOpen ? "rotate-90" : ""}`}
                  />
                  Invoices · {monthLabelOf(month)}
                  <span className="ml-2 rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {view.monthInvoices.length}
                  </span>
                </h2>
              </button>

              <div className={`${invoicesOpen ? "" : "hidden"}`}>
                {customerNames.length > 0 && (
                  <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-card p-3">
                    <span className="text-xs text-muted-foreground">What if</span>
                    <Select value={customer || "__all"} onValueChange={(v) => { setCustomer(v === "__all" ? "" : v); setSelected(new Set()); }}>
                      <SelectTrigger className="h-9 w-[240px] text-xs"><SelectValue placeholder="Select a customer" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all">All customers</SelectItem>
                        {customerNames.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={scope} onValueChange={(v) => { setScope(v as "month" | "all"); setSelected(new Set()); }}>
                      <SelectTrigger className="h-9 w-[170px] text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="month">This month</SelectItem>
                        <SelectItem value="all">All months shown</SelectItem>
                      </SelectContent>
                    </Select>
                    {customer && (
                      <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/30 px-3 py-1 text-xs">
                        Showing {customer}
                        <button type="button" className="font-medium text-link hover:underline" onClick={() => { setCustomer(""); setSelected(new Set()); }}>Clear</button>
                      </span>
                    )}
                  </div>
                )}

                {canManage && !excludedOverride && shown.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={selState === "all" ? true : selState === "some" ? "indeterminate" : false}
                        onCheckedChange={() => setSelected((cur) => toggleSelectAll(shownIds, cur))}
                        aria-label="Select all shown invoices"
                      />
                      Select all
                    </label>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {selectedShown.length} selected · {fmt(selectedShown.reduce((t, i) => t + i.amount, 0))}
                    </span>
                    <Button variant="outline" size="sm" disabled={!selectedShown.length || bulkMut.isPending}
                      onClick={() => bulkMut.mutate({ xeroInvoiceIds: selectedShown.map((i) => i.id), excluded: true }, { onSuccess: () => setSelected(new Set()) })}>
                      {bulkMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Exclude selected (not paid)
                    </Button>
                    <Button variant="ghost" size="sm" disabled={!selectedShown.length || bulkMut.isPending}
                      onClick={() => bulkMut.mutate({ xeroInvoiceIds: selectedShown.map((i) => i.id), excluded: false }, { onSuccess: () => setSelected(new Set()) })}>
                      Include selected
                    </Button>
                  </div>
                )}

              {shown.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">{customer ? `No invoices for ${customer} here.` : "No invoices in this month."}</p>
              ) : (
                <div className="mt-3 divide-y divide-border/60">
                  {shown.map((inv: ScenarioInvoice) => (
                    <div key={inv.id} className={`flex items-center justify-between gap-3 py-2 ${inv.excluded ? "opacity-50" : ""}`}>
                      <div className="flex min-w-0 items-center gap-3">
                        {canManage && !excludedOverride && (
                          <Checkbox
                            checked={selected.has(inv.id)}
                            onCheckedChange={(on) => setSelected((cur) => { const n = new Set(cur); if (on) n.add(inv.id); else n.delete(inv.id); return n; })}
                            aria-label={`Tick invoice ${inv.description}`}
                          />
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {inv.customer_id ?? "Unassigned"}
                            {inv.excluded && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs uppercase tracking-wider">Excluded</span>}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">{inv.description} · {inv.issue_date} · {inv.status}</p>
                        </div>
                      </div>
                      <span className="shrink-0 tabular-nums text-sm">{fmt(inv.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            </section>

            {/* Expenses */}
            <section className="mt-6 grid gap-6 md:grid-cols-3">
              <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-lg font-semibold">Cost of sales, variable</h2>
                  <span className="tabular-nums text-sm font-semibold">{fmt(view.costActuals.cogs)}</span>
                </div>
                {isModelled(costBasis.cogs) && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Scenario uses {fmt(view.costApplied.cogs)} — lines below are the actual Xero
                    accounts.
                  </p>
                )}
                {groupExpenses(view.monthExpenses, "Variable", "cogs").length === 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    No variable cost of sales in this month.
                  </p>
                ) : (
                  <ul className="mt-4 space-y-1.5">
                    {groupExpenses(view.monthExpenses, "Variable", "cogs").map((g) => (
                      <li key={g.category} className="flex items-center justify-between text-sm">
                        <span className="truncate pr-3">{g.category}</span>
                        <span className="tabular-nums">{fmt(g.subtotal)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {(["Fixed", "Variable"] as const).map((type) => {
                // Fixed spans both P&L sections: wages posted to cost of sales and
                // tagged Fixed are fixed costs here too, matching the break-even card.
                const groups = groupExpenses(view.monthExpenses, type, type === "Fixed" ? undefined : "operating");
                const total = groups.reduce((a, g) => a + g.subtotal, 0);
                const key: CostGroup = type === "Fixed" ? "fixed" : "variable";
                return (
                  <div
                    key={type}
                    className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]"
                  >
                    <div className="flex items-center justify-between">
                      <h2 className="font-display text-lg font-semibold">{type} expenses</h2>
                      <span className="tabular-nums text-sm font-semibold">{fmt(total)}</span>
                    </div>
                    {isModelled(costBasis[key]) && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Scenario uses {fmt(view.costApplied[key])} — lines below are the actual Xero
                        accounts.
                      </p>
                    )}
                    {groups.length === 0 ? (
                      <p className="mt-3 text-sm text-muted-foreground">
                        Nothing tagged as {type.toLowerCase()} in this month.
                      </p>
                    ) : (

                      <ul className="mt-4 space-y-1.5">
                        {groups.map((g) => (
                          <li key={g.category} className="flex items-center justify-between text-sm">
                            <span className="truncate pr-3">{g.category}</span>
                            <span className="tabular-nums">{fmt(g.subtotal)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </section>
            {(() => {
              const names = new Set((data?.wageAccounts ?? []).map((n: string) => n.trim().toLowerCase()));
              const wl = view.monthExpenses.filter((e: ScenarioExpense) => names.has(e.name.trim().toLowerCase()));
              if (!wl.length) return null;
              return <section className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-lg font-semibold">Wages</h2>
                  <span className="tabular-nums text-sm font-semibold">{fmt(wl.reduce((t: number, e: ScenarioExpense) => t + e.amount, 0))}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Accounts marked Wages in Cost classification. Shown on their own; each is still counted in the group above that matches its fixed or variable tag, so the scenario figures are unchanged.</p>
                <ul className="mt-4 space-y-1.5">{wl.map((e: ScenarioExpense) => <li key={e.id} className="flex items-center justify-between text-sm">
                  <span className="truncate pr-3">{e.name} <span className="text-xs text-muted-foreground">({e.section === "cogs" ? "cost of sales, " : ""}{e.type.toLowerCase()})</span></span>
                  <span className="tabular-nums">{fmt(e.amount)}</span></li>)}</ul>
              </section>;
            })()}

            {/* Excluded income */}
            <section className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold">Excluded income</h2>
                <span className="tabular-nums text-sm font-semibold text-rose-600">
                  {fmt(view.monthInvoices.filter((i: ScenarioInvoice) => i.excluded).reduce((a, i) => a + i.amount, 0))}
                </span>
              </div>
              {view.monthInvoices.filter((i: ScenarioInvoice) => i.excluded).length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No invoices have been excluded for this month.</p>
              ) : (
                <ul className="mt-4 space-y-1.5">
                  {view.monthInvoices
                    .filter((i: ScenarioInvoice) => i.excluded)
                    .map((inv: ScenarioInvoice) => (
                      <li key={inv.id} className="flex items-center justify-between text-sm">
                        <span className="truncate pr-3">
                          {inv.customer_id ?? "Unassigned"} · {inv.description}
                        </span>
                        <span className="tabular-nums">{fmt(inv.amount)}</span>
                      </li>
                    ))}
                </ul>
              )}
            </section>
            </section>

            <p className="mt-6 text-xs text-muted-foreground">
              Figures come from the Xero Profit &amp; Loss on the accrual basis, so wages and
              superannuation are included. Operating expenses are split using the fixed/variable tags
              in client settings — an untagged operating expense is treated as fixed, and untagged cost of sales as variable, the same rule as break-even.
            </p>

          </>
        ) : null}
      </PageContainer>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "",
  note,
}: {
  label: string;
  value: string;
  tone?: string;
  note?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-semibold tracking-normal tabular-nums ${tone}`}>{value}</p>
      {note ? <p className="mt-1 text-xs text-muted-foreground tabular-nums">{note}</p> : null}
    </div>
  );
}

