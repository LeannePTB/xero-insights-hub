import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { HandCoins, CreditCard, Loader2, RefreshCw, AlertCircle, Building2 } from "lucide-react";
import {
  getConsolidatedReceivables,
  getConsolidatedPayables,
  type ConsolidatedAgeing,
  type ConsolidatedPayables,
} from "@/lib/xero/consolidated.functions";
import { Button } from "@/components/ui/button";

function fmt(n: number, ccy = "AUD") {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: ccy, maximumFractionDigits: 2 }).format(n);
}

export function ConsolidatedReceivablesWidget({
  groupId,
  asAt,
  label = "Consolidated Accounts Receivable",
}: {
  groupId: string;
  asAt: string;
  label?: string;
}) {
  const fetch = useServerFn(getConsolidatedReceivables);
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["consolidated-receivables", groupId, asAt],
    queryFn: () => fetch({ data: { groupId, asAt } }),
    retry: false,
  });

  return (
    <AgeingCard
      label={label}
      icon={<HandCoins className="h-4 w-4 text-primary" />}
      data={data}
      isLoading={isLoading}
      error={error}
      isFetching={isFetching}
      onRefresh={() => refetch()}
      topEntities={data?.topCustomers}
      entityLabel="Top customers"
    />
  );
}

export function ConsolidatedPayablesWidget({
  groupId,
  asAt,
  label = "Consolidated Accounts Payable",
}: {
  groupId: string;
  asAt: string;
  label?: string;
}) {
  const fetch = useServerFn(getConsolidatedPayables);
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["consolidated-payables", groupId, asAt],
    queryFn: () => fetch({ data: { groupId, asAt } }),
    retry: false,
  });

  return (
    <AgeingCard
      label={label}
      icon={<CreditCard className="h-4 w-4 text-primary" />}
      data={data}
      isLoading={isLoading}
      error={error}
      isFetching={isFetching}
      onRefresh={() => refetch()}
      topEntities={data?.topSuppliers}
      entityLabel="Top suppliers"
    />
  );
}


function AgeingCard({
  label,
  icon,
  data,
  isLoading,
  error,
  isFetching,
  onRefresh,
  topEntities,
  entityLabel,
}: {
  label: string;
  icon: React.ReactNode;
  data: ConsolidatedAgeing | ConsolidatedPayables | undefined;
  isLoading: boolean;
  error: Error | null;
  isFetching: boolean;
  onRefresh: () => void;
  topEntities: { name: string; amount: number }[] | undefined;
  entityLabel: string;
}) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const isReceivables = "topCustomers" in (data ?? {});

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)] [column-span:all]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {data?.tenantNames.join(" + ") ?? "Consolidated"}
          </p>
          <h3 className="font-display text-lg font-semibold flex items-center gap-2">
            {icon} {label}
          </h3>
          <p className="text-xs text-muted-foreground">
            Combined across {data?.tenantCount ?? tenantIdsPlaceholder.length} companies · as of {data?.asOf ?? "—"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={isFetching}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {isLoading && !data ? (
        <div className="mt-6 flex h-40 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading consolidated ageing…
        </div>
      ) : error ? (
        <div className="mt-6 rounded-lg bg-destructive/10 p-3 text-sm text-destructive flex items-start gap-2">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error.message}
        </div>
      ) : data ? (
        <div className="mt-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi title="Total outstanding" value={fmt(data.totalOutstanding)} />
            <Kpi title="Total overdue" value={fmt(data.totalOverdue)} />
            <Kpi title="Invoices" value={String(data.invoiceCount)} />
            <Kpi
              title="Intercompany elimination"
              value={fmt(data.elimination)}
              note="Loan balances removed from consolidated total"
            />
          </div>

          <div className="mt-6 overflow-x-auto rounded-lg border border-border bg-background">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Ageing bucket</th>
                  <th className="px-4 py-3 text-right font-semibold">Count</th>
                  <th className="px-4 py-3 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.buckets.map((b) => (
                  <tr key={b.label} className="border-t border-border/60">
                    <td className="px-4 py-2.5 font-medium">{b.label}</td>
                    <td className="px-4 py-2.5 text-right">{b.count}</td>
                    <td className="px-4 py-2.5 text-right font-medium">{fmt(b.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {topEntities && topEntities.length > 0 && (
            <div className="mt-6">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{entityLabel}</p>
              <div className="flex flex-wrap gap-2">
                {topEntities.map((e) => (
                  <span
                    key={e.name}
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-sm"
                  >
                    <span className="font-medium">{e.name}</span>
                    <span className="text-muted-foreground">{fmt(e.amount)}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6">
            <button
              type="button"
              onClick={() => setShowBreakdown((v) => !v)}
              className="text-sm font-medium text-primary hover:underline"
            >
              {showBreakdown ? "Hide company breakdown" : "Show company breakdown"}
            </button>
            {showBreakdown && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.byTenant.map((t) => (
                  <div key={t.tenantId} className="rounded-lg border border-border bg-background p-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      {t.tenantName}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-muted-foreground">Outstanding</p>
                        <p className="font-medium">{fmt(t.totalOutstanding)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Overdue</p>
                        <p className="font-medium">{fmt(t.totalOverdue)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

const tenantIdsPlaceholder: string[] = [];

function Kpi({ title, value, note }: { title: string; value: string; note?: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <p className="text-xs text-muted-foreground">{title}</p>
      <p className="mt-1 font-display text-2xl font-semibold">{value}</p>
      {note && <p className="mt-1 text-[11px] text-muted-foreground">{note}</p>}
    </div>
  );
}
