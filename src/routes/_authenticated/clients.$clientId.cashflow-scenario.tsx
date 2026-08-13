import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2, RefreshCw, RotateCcw } from "lucide-react";
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
  type ScenarioExpense,
  type ScenarioInvoice,
} from "@/lib/xero/scenario.functions";
import { buildMatrix, computeTotals, groupExpenses, monthKey } from "@/lib/scenario-calc";

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
  const resetMut = useMutation({
    mutationFn: () => reset({ data: { clientId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scenario", clientId] }),
    onError: (e: any) => toast.error(e?.message ?? "Could not reset the scenario"),
  });


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
    };
  }, [data, month]);

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
            {/* Summary */}
            <section className="mt-6 grid gap-3 sm:grid-cols-3">
              <Stat label="Baseline revenue (period)" value={fmt(view.rangeTotals.baselineRevenue)} />
              <Stat label="Current scenario (period)" value={fmt(view.rangeTotals.revenue)} />
              <Stat
                label="Difference"
                value={fmt(-view.rangeTotals.excludedRevenue)}
                tone={view.rangeTotals.excludedRevenue > 0 ? "text-rose-600" : "text-muted-foreground"}
              />
            </section>

            <section className="mt-3 grid gap-3 sm:grid-cols-4">
              <Stat label={`Revenue · ${monthLabelOf(month)}`} value={fmt(view.monthTotals.revenue)} />
              <Stat label="Fixed expenses" value={fmt(view.monthTotals.fixed)} />
              <Stat label="Variable expenses" value={fmt(view.monthTotals.variable)} />
              <Stat
                label="Net position"
                value={fmt(view.monthTotals.net)}
                tone={view.monthTotals.net >= 0 ? "text-emerald-600" : "text-rose-600"}
              />
            </section>

            {/* Matrix */}
            <section className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-display text-lg font-semibold">Revenue by customer per month</h2>
                <span className="text-xs text-muted-foreground">{monthLabelOf(month)}</span>
              </div>
              <div className="mt-4 overflow-x-auto">
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
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-display text-lg font-semibold">
                  Invoices · {monthLabelOf(month)}
                </h2>
                {view.monthInvoices.length > 0 && (
                  <div className="flex items-center gap-2">
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
              </div>

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
            </section>

            {/* Expenses */}
            <section className="mt-6 grid gap-6 md:grid-cols-2">
              {(["Fixed", "Variable"] as const).map((type) => {
                const groups = groupExpenses(view.monthExpenses, type);
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

            <p className="mt-6 text-xs text-muted-foreground">
              Expenses are split using the fixed/variable tags in client settings — untagged accounts
              are treated as variable.
            </p>
          </>
        ) : null}
      </main>
    </div>
  );
}

function Stat({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-semibold tracking-tight tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}
