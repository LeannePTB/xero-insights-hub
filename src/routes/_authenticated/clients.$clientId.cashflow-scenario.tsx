import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ChevronRight, Loader2, RefreshCw, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BrandMark } from "@/components/BrandMark";
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
  setInvoiceExcluded,
  setInvoicesExcludedBulk,

  type ScenarioExpense,
  type ScenarioInvoice,
} from "@/lib/xero/scenario.functions";
import { buildMatrix, computeTotals, groupBySection, groupExpenses, monthKey } from "@/lib/scenario-calc";

export const Route = createFileRoute("/_authenticated/clients/$clientId/cashflow-scenario")({
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
  const search = Route.useSearch();
  const qc = useQueryClient();

  const fetchClient = useServerFn(getClient);
  const fetchScenario = useServerFn(getScenarioData);
  const toggleExcluded = useServerFn(setInvoiceExcluded);
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

  const excludeMut = useMutation({
    mutationFn: (v: { xeroInvoiceId: string; excluded: boolean }) =>
      toggleExcluded({ data: { clientId, ...v } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scenario", clientId] }),
    onError: (e: any) => toast.error(e?.message ?? "Could not update this invoice"),
  });
  const bulkMut = useMutation({
    mutationFn: (v: { xeroInvoiceIds: string[]; excluded: boolean }) =>
      toggleExcludedBulk({ data: { clientId, ...v } }),
    onSuccess: (_r, v) => {
      qc.invalidateQueries({ queryKey: ["scenario", clientId] });
      toast.success(v.excluded ? "All invoices excluded for this month" : "All invoices included");
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not update these invoices"),
  });
  const customerMut = useMutation({
    mutationFn: (v: { xeroInvoiceIds: string[]; excluded: boolean; label: string }) =>
      toggleExcludedBulk({ data: { clientId, xeroInvoiceIds: v.xeroInvoiceIds, excluded: v.excluded } }),
    onSuccess: (_r, v) => {
      qc.invalidateQueries({ queryKey: ["scenario", clientId] });
      toast.success(
        `${v.excluded ? "Excluded" : "Included"} ${v.xeroInvoiceIds.length} invoice${
          v.xeroInvoiceIds.length === 1 ? "" : "s"
        } for ${v.label}`,
      );
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not update these invoices"),
  });
  const resetMut = useMutation({

    mutationFn: () => reset({ data: { clientId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scenario", clientId] }),
    onError: (e: any) => toast.error(e?.message ?? "Could not reset the scenario"),
  });

  const [customer, setCustomer] = useState<string>("");
  const [scope, setScope] = useState<"month" | "all">("month");
  const [matrixOpen, setMatrixOpen] = useState(false);
  const [invoicesOpen, setInvoicesOpen] = useState(false);

  const view = useMemo(() => {
    if (!data) return null;
    const months = data.months;
    return {
      months,
      month,
      matrix: buildMatrix(data.customers, data.invoices, months),
      monthTotals: computeTotals(data.invoices, data.expenses, month),
      rangeTotals: computeTotals(data.invoices, data.expenses, null),
      monthInvoices: data.invoices.filter((i: ScenarioInvoice) => monthKey(i.issue_date) === month),
      monthExpenses: data.expenses.filter((e: ScenarioExpense) => monthKey(e.date) === month),
      monthPnl: (data.pnl ?? []).find((p) => p.month === month) ?? null,
    };
  }, [data, month]);


  const customerNames = useMemo(() => {
    const set = new Set<string>();
    for (const i of (data?.invoices ?? []) as ScenarioInvoice[]) {
      set.add(i.customer_id ?? "Unassigned");
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [data]);

  const customerInvoiceIds = useMemo(() => {
    if (!customer) return [] as string[];
    const pool = (scope === "month" ? view?.monthInvoices : data?.invoices) ?? [];
    return (pool as ScenarioInvoice[])
      .filter((i) => (i.customer_id ?? "Unassigned") === customer)
      .map((i) => i.id);
  }, [customer, scope, view, data]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <BrandMark logoHeightClass="h-9" />
          <Button variant="ghost" size="sm" asChild>
            <Link to="/clients/$clientId" params={{ clientId }}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold">Cashflow Scenario</h1>
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => resetMut.mutate()}
              disabled={resetMut.isPending}
            >
              <RotateCcw className="mr-2 h-4 w-4" /> Reset scenario
            </Button>
          </div>
        </div>

        <div className="mt-4">
          <MonthPicker value={month} onChange={setMonth} />
        </div>

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
                  <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
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
              <div className="mb-5 border-b border-border/60 pb-4">
                <h2 className="font-display text-xl font-semibold">Scenario</h2>
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

              <div className="mt-3 grid gap-3 sm:grid-cols-5">
                <Stat label={`Scenario revenue · ${monthLabelOf(month)} (excl. GST)`} value={fmt(view.monthTotals.revenue)} />
                <Stat label="Cost of sales" value={fmt(view.monthTotals.cogs)} />
                <Stat label="Fixed expenses" value={fmt(view.monthTotals.fixed)} />
                <Stat label="Variable expenses" value={fmt(view.monthTotals.variable)} />
                <Stat
                  label="Net position"
                  value={fmt(view.monthTotals.net)}
                  tone={view.monthTotals.net >= 0 ? "text-emerald-600" : "text-rose-600"}
                />
              </div>


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
                  <span className="ml-2 rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {view.monthInvoices.length}
                  </span>
                </h2>
                {view.monthInvoices.length > 0 && (
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={bulkMut.isPending}
                      onClick={() =>
                        bulkMut.mutate({
                          xeroInvoiceIds: view.monthInvoices.map((i: ScenarioInvoice) => i.id),
                          excluded: true,
                        })
                      }
                    >
                      {bulkMut.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Exclude all (nobody paid)
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={bulkMut.isPending}
                      onClick={() =>
                        bulkMut.mutate({
                          xeroInvoiceIds: view.monthInvoices.map((i: ScenarioInvoice) => i.id),
                          excluded: false,
                        })
                      }
                    >
                      Include all
                    </Button>
                  </div>
                )}
              </button>

              <div className={`${invoicesOpen ? "" : "hidden"}`}>
                {customerNames.length > 0 && (
                  <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-muted/30 p-3">
                    <span className="text-xs text-muted-foreground">What if</span>
                    <Select value={customer} onValueChange={setCustomer}>
                      <SelectTrigger className="h-9 w-[240px] text-xs">
                        <SelectValue placeholder="Select a customer" />
                      </SelectTrigger>
                      <SelectContent>
                        {customerNames.map((n) => (
                          <SelectItem key={n} value={n}>
                            {n}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={scope} onValueChange={(v) => setScope(v as "month" | "all")}>
                      <SelectTrigger className="h-9 w-[150px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="month">This month</SelectItem>
                        <SelectItem value="all">All months shown</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!customer || customerInvoiceIds.length === 0 || customerMut.isPending}
                      onClick={() =>
                        customerMut.mutate({
                          xeroInvoiceIds: customerInvoiceIds,
                          excluded: true,
                          label: customer,
                        })
                      }
                    >
                      {customerMut.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Mark as unpaid
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!customer || customerInvoiceIds.length === 0 || customerMut.isPending}
                      onClick={() =>
                        customerMut.mutate({
                          xeroInvoiceIds: customerInvoiceIds,
                          excluded: false,
                          label: customer,
                        })
                      }
                    >
                      Mark as paid
                    </Button>
                    {customer && (
                      <span className="text-xs text-muted-foreground">
                        {customerInvoiceIds.length} invoice
                        {customerInvoiceIds.length === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                )}



              {view.monthInvoices.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No invoices in this month.</p>
              ) : (
                <div className="mt-4 divide-y divide-border/60">
                  {view.monthInvoices.map((inv: ScenarioInvoice) => (
                    <div
                      key={inv.id}
                      className={`flex items-center justify-between gap-3 py-2 ${inv.excluded ? "opacity-50" : ""}`}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {inv.customer_id ?? "Unassigned"}
                          {inv.excluded && (
                            <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wider">
                              Excluded
                            </span>
                          )}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {inv.description} · {inv.issue_date} · {inv.status}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="tabular-nums text-sm">{fmt(inv.amount)}</span>
                        <Switch
                          checked={!inv.excluded}
                          onCheckedChange={(on) =>
                            excludeMut.mutate({ xeroInvoiceId: inv.id, excluded: !on })
                          }
                          aria-label="Include in scenario"
                        />
                      </div>
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
                  <h2 className="font-display text-lg font-semibold">Cost of sales</h2>
                  <span className="tabular-nums text-sm font-semibold">{fmt(view.monthTotals.cogs)}</span>
                </div>
                {groupBySection(view.monthExpenses, "cogs").length === 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    No cost of sales in this month.
                  </p>
                ) : (
                  <ul className="mt-4 space-y-1.5">
                    {groupBySection(view.monthExpenses, "cogs").map((g) => (
                      <li key={g.category} className="flex items-center justify-between text-sm">
                        <span className="truncate pr-3">{g.category}</span>
                        <span className="tabular-nums">{fmt(g.subtotal)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {(["Fixed", "Variable"] as const).map((type) => {
                const groups = groupExpenses(view.monthExpenses, type, "operating");
                const total = groups.reduce((a, g) => a + g.subtotal, 0);
                return (
                  <div
                    key={type}
                    className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]"
                  >
                    <div className="flex items-center justify-between">
                      <h2 className="font-display text-lg font-semibold">{type} expenses</h2>
                      <span className="tabular-nums text-sm font-semibold">{fmt(total)}</span>
                    </div>
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
              in client settings — untagged accounts are treated as variable.
            </p>

          </>
        ) : null}
      </main>
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
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-semibold tracking-tight tabular-nums ${tone}`}>{value}</p>
      {note ? <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">{note}</p> : null}
    </div>
  );
}

