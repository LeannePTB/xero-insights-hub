import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Download, Loader2, Plus, RotateCcw, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BrandMark } from "@/components/BrandMark";
import { getClient } from "@/lib/clients.functions";
import { formatMoney } from "@/components/dashboard/useTenantCurrency";
import {
  deleteScenarioCustomer,
  deleteScenarioExpense,
  deleteScenarioInvoice,
  getScenario,
  resetScenario,
  saveScenarioCurrency,
  saveScenarioCustomer,
  saveScenarioExpense,
  saveScenarioInvoice,
  seedScenarioExamples,
  setInvoiceExcluded,
  type ScenarioExpense,
  type ScenarioInvoice,
} from "@/lib/scenario.functions";
import { importScenarioFromXero } from "@/lib/scenario-xero.functions";
import {
  buildMatrix,
  computeTotals,
  currentMonthKey,
  groupExpenses,
  monthKey,
  monthLabel,
  monthsFrom,
} from "@/lib/scenario-calc";

export const Route = createFileRoute("/_authenticated/clients/$clientId/cashflow-scenario")({
  head: () => ({
    meta: [
      { title: "Cashflow Scenario — Traction Advisory" },
      {
        name: "description",
        content: "Money in versus money out by month, with what-if invoice exclusions and net position.",
      },
      { property: "og:title", content: "Cashflow Scenario — Traction Advisory" },
      {
        property: "og:description",
        content: "Model revenue, fixed and variable expenses, and see the impact of excluding invoices.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ScenarioPage,
});

function ScenarioPage() {
  const { clientId } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const fetchClient = useServerFn(getClient);
  const fetchScenario = useServerFn(getScenario);
  const seed = useServerFn(seedScenarioExamples);
  const reset = useServerFn(resetScenario);
  const toggle = useServerFn(setInvoiceExcluded);
  const saveCurrency = useServerFn(saveScenarioCurrency);
  const importXero = useServerFn(importScenarioFromXero);

  const clientQ = useQuery({ queryKey: ["client", clientId], queryFn: () => fetchClient({ data: { clientId } }) });
  const scenarioQ = useQuery({
    queryKey: ["scenario", clientId],
    queryFn: () => fetchScenario({ data: { clientId } }),
    retry: false,
  });

  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthKey());
  const invalidate = () => qc.invalidateQueries({ queryKey: ["scenario", clientId] });

  const mut = <T,>(fn: (v: T) => Promise<unknown>, ok?: string) =>
    useMutation({
      mutationFn: fn,
      onSuccess: () => {
        invalidate();
        if (ok) toast.success(ok);
      },
      onError: (e: any) => toast.error(e?.message ?? "Something went wrong"),
    });

  const toggleMut = mut((v: { id: string; excluded: boolean }) => toggle({ data: v }));
  const resetMut = mut(() => reset({ data: { clientId } }), "Scenario reset — all invoices included");
  const seedMut = mut(() => seed({ data: { clientId } }), "Example data added");
  const currencyMut = mut((currency: string) => saveCurrency({ data: { clientId, currency } }), "Currency saved");
  const importMut = useMutation({
    mutationFn: (tenantId: string) => importXero({ data: { clientId, tenantId, monthsBack: 12 } }),
    onSuccess: (r: any) => {
      invalidate();
      toast.success(`Imported from Xero — ${r.created} new, ${r.updated} updated`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Xero import failed"),
  });

  const data = scenarioQ.data;
  const currency = data?.currency ?? "AUD";
  const fmt = (n: number) => formatMoney(n, currency);

  const orgs: any[] = clientQ.data?.client?.client_xero_orgs ?? [];
  const tenantId: string | undefined = orgs[0]?.xero_connections?.tenant_id;

  const view = useMemo(() => {
    if (!data) return null;
    const months = monthsFrom(data.invoices, data.expenses);
    return {
      months,
      matrix: buildMatrix(data.customers, data.invoices, months),
      month: computeTotals(data.invoices, data.expenses, selectedMonth),
      year: computeTotals(data.invoices, data.expenses, null),
    };
  }, [data, selectedMonth]);

  const monthInvoices = (data?.invoices ?? []).filter((i) => monthKey(i.issue_date) === selectedMonth);
  const monthExpenses = (data?.expenses ?? []).filter((e) => monthKey(e.date) === selectedMonth);

  if (scenarioQ.isLoading || clientQ.isLoading) {
    return (
      <div className="grid min-h-screen place-items-center text-muted-foreground">
        <div className="flex items-center">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
        </div>
      </div>
    );
  }
  if (scenarioQ.error) {
    return (
      <div className="grid min-h-screen place-items-center p-6">
        <div className="max-w-md rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center">
          <p className="text-sm text-destructive">{(scenarioQ.error as Error).message}</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate({ to: "/dashboard" })}>
            Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <BrandMark logoHeightClass="h-9" />
          <Button variant="ghost" asChild>
            <Link to="/clients/$clientId" params={{ clientId }}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to dashboard
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold sm:text-3xl">Cashflow Scenario</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {clientQ.data?.client?.name} · money in vs money out, with what-if exclusions
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <CurrencyControl current={currency} onSave={(c) => currencyMut.mutate(c)} saving={currencyMut.isPending} />
            {tenantId && (
              <Button variant="outline" onClick={() => importMut.mutate(tenantId)} disabled={importMut.isPending}>
                {importMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Import from Xero
              </Button>
            )}
            {(data?.invoices.length ?? 0) === 0 && (
              <Button variant="outline" onClick={() => seedMut.mutate(undefined as never)} disabled={seedMut.isPending}>
                Add example data
              </Button>
            )}
          </div>
        </div>

        {/* Scenario impact */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
              <Stat label="Baseline revenue (all invoices)" value={fmt(view?.year.baselineRevenue ?? 0)} />
              <Stat label="Current scenario" value={fmt(view?.year.revenue ?? 0)} />
              <Stat
                label="Difference"
                value={fmt(-(view?.year.excludedRevenue ?? 0))}
                tone={(view?.year.excludedRevenue ?? 0) > 0 ? "text-rose-600" : "text-muted-foreground"}
              />
            </div>
            <Button variant="outline" onClick={() => resetMut.mutate(undefined as never)} disabled={resetMut.isPending}>
              <RotateCcw className="mr-2 h-4 w-4" /> Reset scenario
            </Button>
          </div>
        </section>

        {/* Summary */}
        <section className="grid gap-4 lg:grid-cols-2">
          <SummaryCard
            title={`Selected month · ${monthLabel(selectedMonth)}`}
            totals={view?.month}
            fmt={fmt}
            months={view?.months ?? []}
            selectedMonth={selectedMonth}
            onSelectMonth={setSelectedMonth}
          />
          <SummaryCard title="All months" totals={view?.year} fmt={fmt} />
        </section>

        {/* Revenue matrix */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Revenue by customer per month</h2>
            <CustomerDialog clientId={clientId} onSaved={invalidate} />
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Customer</th>
                  {(view?.months ?? []).map((m) => (
                    <th key={m} className="px-3 py-2 text-right font-medium">
                      {monthLabel(m)}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {(view?.matrix.rows ?? []).map((r) => (
                  <tr key={r.customerId ?? "none"} className="border-t border-border/40">
                    <td className="py-2 pr-3">
                      <span className="flex items-center gap-1">
                        {r.name}
                        {r.customerId && (
                          <CustomerRowActions
                            clientId={clientId}
                            customer={{ id: r.customerId, name: r.name }}
                            onSaved={invalidate}
                          />
                        )}
                      </span>
                    </td>
                    {r.cells.map((c, i) => (
                      <td key={i} className="px-3 py-2 text-right tabular-nums">
                        {c ? fmt(c) : "—"}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right font-medium tabular-nums">{fmt(r.total)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-border bg-muted/40 font-semibold">
                  <td className="py-2 pr-3">Total</td>
                  {(view?.matrix.columnTotals ?? []).map((c, i) => (
                    <td key={i} className="px-3 py-2 text-right tabular-nums">
                      {fmt(c)}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(view?.matrix.grandTotal ?? 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Month drill-down */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold">Invoices · {monthLabel(selectedMonth)}</h2>
            <div className="flex items-center gap-2">
              <MonthSelect months={view?.months ?? []} value={selectedMonth} onChange={setSelectedMonth} />
              <InvoiceDialog clientId={clientId} customers={data?.customers ?? []} onSaved={invalidate} />
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Date</th>
                  <th className="py-2 pr-3 font-medium">Customer</th>
                  <th className="py-2 pr-3 font-medium">Description</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="px-3 py-2 text-right font-medium">Amount</th>
                  <th className="px-3 py-2 text-right font-medium">Include</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {monthInvoices.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-muted-foreground">
                      No invoices in this month.
                    </td>
                  </tr>
                )}
                {monthInvoices.map((inv) => {
                  const name = data?.customers.find((c) => c.id === inv.customer_id)?.name ?? "Unassigned";
                  return (
                    <tr
                      key={inv.id}
                      className={`border-t border-border/40 ${inv.excluded ? "opacity-50" : ""}`}
                    >
                      <td className="py-2 pr-3 tabular-nums">{inv.issue_date}</td>
                      <td className="py-2 pr-3">{name}</td>
                      <td className="py-2 pr-3">
                        <span className="flex items-center gap-2">
                          {inv.description || "—"}
                          {inv.excluded && (
                            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                              Excluded
                            </span>
                          )}
                          {inv.xero_invoice_id && (
                            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                              Xero
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="py-2 pr-3">{inv.status}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmt(inv.amount)}</td>
                      <td className="px-3 py-2 text-right">
                        <Switch
                          checked={!inv.excluded}
                          onCheckedChange={(checked) => toggleMut.mutate({ id: inv.id, excluded: !checked })}
                          aria-label={inv.excluded ? "Include invoice" : "Exclude invoice"}
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <InvoiceRowActions
                          clientId={clientId}
                          invoice={inv}
                          customers={data?.customers ?? []}
                          onSaved={invalidate}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Expenses */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold">Expenses · {monthLabel(selectedMonth)}</h2>
            <ExpenseDialog clientId={clientId} onSaved={invalidate} defaultDate={`${selectedMonth}-01`} />
          </div>

          <div className="mt-4 grid gap-6 lg:grid-cols-2">
            {(["Fixed", "Variable"] as const).map((type) => {
              const groups = groupExpenses(monthExpenses, type);
              const subtotal = groups.reduce((a, g) => a + g.subtotal, 0);
              return (
                <div key={type} className="rounded-xl border border-border/60 bg-background p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">{type} expenses</h3>
                    <span className="text-sm font-semibold tabular-nums">{fmt(subtotal)}</span>
                  </div>
                  {groups.length === 0 && (
                    <p className="mt-3 text-sm text-muted-foreground">No {type.toLowerCase()} expenses this month.</p>
                  )}
                  {groups.map((g) => (
                    <div key={g.category} className="mt-4">
                      <div className="flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground">
                        <span>{g.category}</span>
                        <span className="tabular-nums">{fmt(g.subtotal)}</span>
                      </div>
                      <div className="mt-1 space-y-1">
                        {g.items.map((e) => (
                          <div key={e.id} className="flex items-center justify-between gap-2 text-sm">
                            <span className="flex min-w-0 items-center gap-2 truncate">
                              <span className="truncate">{e.name}</span>
                              {e.recurring_monthly && (
                                <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                                  Monthly
                                </span>
                              )}
                            </span>
                            <span className="flex shrink-0 items-center gap-1">
                              <span className="tabular-nums">{fmt(e.amount)}</span>
                              <ExpenseRowActions clientId={clientId} expense={e} onSaved={invalidate} />
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-between rounded-xl border border-border/60 bg-muted/40 p-4">
            <span className="text-sm font-semibold">Total expenses</span>
            <span className="text-sm font-semibold tabular-nums">{fmt(view?.month.expenses ?? 0)}</span>
          </div>

          <ExpenseBars expenses={monthExpenses} fmt={fmt} />
        </section>
      </main>
    </div>
  );
}

/* ---------------- presentational bits ---------------- */

function Stat({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-semibold tracking-tight tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}

function SummaryCard({
  title,
  totals,
  fmt,
  months,
  selectedMonth,
  onSelectMonth,
}: {
  title: string;
  totals: ReturnType<typeof computeTotals> | undefined;
  fmt: (n: number) => string;
  months?: string[];
  selectedMonth?: string;
  onSelectMonth?: (m: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        {months && selectedMonth && onSelectMonth && (
          <MonthSelect months={months} value={selectedMonth} onChange={onSelectMonth} />
        )}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Stat label="Total revenue" value={fmt(totals?.revenue ?? 0)} />
        <Stat label="Fixed expenses" value={fmt(totals?.fixed ?? 0)} />
        <Stat label="Variable expenses" value={fmt(totals?.variable ?? 0)} />
        <Stat
          label="Net position"
          value={fmt(totals?.net ?? 0)}
          tone={(totals?.net ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600"}
        />
      </div>
    </div>
  );
}

function MonthSelect({
  months,
  value,
  onChange,
}: {
  months: string[];
  value: string;
  onChange: (m: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[150px]">
        <SelectValue placeholder="Month" />
      </SelectTrigger>
      <SelectContent>
        {months.map((m) => (
          <SelectItem key={m} value={m}>
            {monthLabel(m)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ExpenseBars({ expenses, fmt }: { expenses: ScenarioExpense[]; fmt: (n: number) => string }) {
  const byCategory = new Map<string, number>();
  for (const e of expenses) byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount);
  const rows = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);
  const max = Math.max(...rows.map((r) => r[1]), 1);
  if (rows.length === 0) return null;
  return (
    <div className="mt-6">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Expenses by category
      </p>
      <div className="space-y-3">
        {rows.map(([category, amount]) => (
          <div key={category} className="grid grid-cols-[8rem_1fr_6rem] items-center gap-3 text-xs">
            <span className="truncate text-muted-foreground">{category}</span>
            <div className="h-2 rounded-full bg-muted">
              <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.max(4, (amount / max) * 100)}%` }} />
            </div>
            <span className="text-right font-medium tabular-nums">{fmt(amount)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CurrencyControl({
  current,
  onSave,
  saving,
}: {
  current: string;
  onSave: (c: string) => void;
  saving: boolean;
}) {
  const [value, setValue] = useState(current);
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="currency" className="text-xs text-muted-foreground">
        Currency
      </Label>
      <Input
        id="currency"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-9 w-24"
        maxLength={8}
      />
      <Button variant="outline" size="sm" onClick={() => onSave(value)} disabled={saving || value === current}>
        Save
      </Button>
    </div>
  );
}

/* ---------------- dialogs ---------------- */

function CustomerDialog({
  clientId,
  onSaved,
  existing,
  trigger,
}: {
  clientId: string;
  onSaved: () => void;
  existing?: { id: string; name: string };
  trigger?: React.ReactNode;
}) {
  const save = useServerFn(saveScenarioCustomer);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(existing?.name ?? "");
  const m = useMutation({
    mutationFn: () => save({ data: { clientId, id: existing?.id, name } }),
    onSuccess: () => {
      setOpen(false);
      if (!existing) setName("");
      onSaved();
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not save customer"),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline">
            <Plus className="mr-1 h-4 w-4" /> Customer
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{existing ? "Edit customer" : "Add customer"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="cust-name">Name</Label>
          <Input id="cust-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <DialogFooter>
          <Button onClick={() => m.mutate()} disabled={m.isPending || !name.trim()}>
            {m.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CustomerRowActions({
  clientId,
  customer,
  onSaved,
}: {
  clientId: string;
  customer: { id: string; name: string };
  onSaved: () => void;
}) {
  const del = useServerFn(deleteScenarioCustomer);
  const m = useMutation({
    mutationFn: () => del({ data: { id: customer.id } }),
    onSuccess: onSaved,
    onError: (e: any) => toast.error(e?.message ?? "Could not delete customer"),
  });
  return (
    <span className="inline-flex items-center">
      <CustomerDialog
        clientId={clientId}
        existing={customer}
        onSaved={onSaved}
        trigger={
          <Button variant="ghost" size="icon" className="h-6 w-6" title="Edit customer">
            <Pencil className="h-3 w-3" />
          </Button>
        }
      />
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        title="Delete customer"
        onClick={() => m.mutate()}
        disabled={m.isPending}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </span>
  );
}

function InvoiceDialog({
  clientId,
  customers,
  onSaved,
  existing,
  trigger,
}: {
  clientId: string;
  customers: { id: string; name: string }[];
  onSaved: () => void;
  existing?: ScenarioInvoice;
  trigger?: React.ReactNode;
}) {
  const save = useServerFn(saveScenarioInvoice);
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState(existing?.customer_id ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [amount, setAmount] = useState(String(existing?.amount ?? ""));
  const [issueDate, setIssueDate] = useState(existing?.issue_date ?? new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState(existing?.status ?? "Pending");

  const m = useMutation({
    mutationFn: () =>
      save({
        data: {
          clientId,
          id: existing?.id,
          customer_id: customerId || null,
          description,
          amount: Number(amount) || 0,
          issue_date: issueDate,
          status,
        },
      }),
    onSuccess: () => {
      setOpen(false);
      onSaved();
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not save invoice"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus className="mr-1 h-4 w-4" /> Invoice
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{existing ? "Edit invoice" : "Add invoice"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="space-y-1">
            <Label>Customer</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a customer" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="inv-desc">Description</Label>
            <Input id="inv-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="inv-amt">Amount</Label>
              <Input id="inv-amt" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="inv-date">Issue date</Label>
              <Input id="inv-date" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["Paid", "Pending", "Overdue"].map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => m.mutate()} disabled={m.isPending}>
            {m.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InvoiceRowActions({
  clientId,
  invoice,
  customers,
  onSaved,
}: {
  clientId: string;
  invoice: ScenarioInvoice;
  customers: { id: string; name: string }[];
  onSaved: () => void;
}) {
  const del = useServerFn(deleteScenarioInvoice);
  const m = useMutation({
    mutationFn: () => del({ data: { id: invoice.id } }),
    onSuccess: onSaved,
    onError: (e: any) => toast.error(e?.message ?? "Could not delete invoice"),
  });
  return (
    <span className="inline-flex items-center">
      <InvoiceDialog
        clientId={clientId}
        customers={customers}
        existing={invoice}
        onSaved={onSaved}
        trigger={
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit invoice">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        }
      />
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        title="Delete invoice"
        onClick={() => m.mutate()}
        disabled={m.isPending}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </span>
  );
}

function ExpenseDialog({
  clientId,
  onSaved,
  existing,
  trigger,
  defaultDate,
}: {
  clientId: string;
  onSaved: () => void;
  existing?: ScenarioExpense;
  trigger?: React.ReactNode;
  defaultDate?: string;
}) {
  const save = useServerFn(saveScenarioExpense);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(existing?.name ?? "");
  const [amount, setAmount] = useState(String(existing?.amount ?? ""));
  const [type, setType] = useState(existing?.type ?? "Fixed");
  const [category, setCategory] = useState(existing?.category ?? "General");
  const [date, setDate] = useState(existing?.date ?? defaultDate ?? new Date().toISOString().slice(0, 10));
  const [recurring, setRecurring] = useState(existing?.recurring_monthly ?? false);

  const m = useMutation({
    mutationFn: () =>
      save({
        data: {
          clientId,
          id: existing?.id,
          name,
          amount: Number(amount) || 0,
          type,
          category,
          date,
          recurring_monthly: recurring,
        },
      }),
    onSuccess: () => {
      setOpen(false);
      onSaved();
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not save expense"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus className="mr-1 h-4 w-4" /> Expense
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{existing ? "Edit expense" : "Add expense"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="space-y-1">
            <Label htmlFor="exp-name">Name</Label>
            <Input id="exp-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="exp-amt">Amount</Label>
              <Input id="exp-amt" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="exp-date">Date</Label>
              <Input id="exp-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Fixed">Fixed</SelectItem>
                  <SelectItem value="Variable">Variable</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="exp-cat">Category</Label>
              <Input id="exp-cat" value={category} onChange={(e) => setCategory(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch id="exp-rec" checked={recurring} onCheckedChange={setRecurring} />
            <Label htmlFor="exp-rec">Recurring monthly</Label>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => m.mutate()} disabled={m.isPending || !name.trim()}>
            {m.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExpenseRowActions({
  clientId,
  expense,
  onSaved,
}: {
  clientId: string;
  expense: ScenarioExpense;
  onSaved: () => void;
}) {
  const del = useServerFn(deleteScenarioExpense);
  const m = useMutation({
    mutationFn: () => del({ data: { id: expense.id } }),
    onSuccess: onSaved,
    onError: (e: any) => toast.error(e?.message ?? "Could not delete expense"),
  });
  return (
    <span className="inline-flex items-center">
      <ExpenseDialog
        clientId={clientId}
        existing={expense}
        onSaved={onSaved}
        trigger={
          <Button variant="ghost" size="icon" className="h-6 w-6" title="Edit expense">
            <Pencil className="h-3 w-3" />
          </Button>
        }
      />
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        title="Delete expense"
        onClick={() => m.mutate()}
        disabled={m.isPending}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </span>
  );
}
