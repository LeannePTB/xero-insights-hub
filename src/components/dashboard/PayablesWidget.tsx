import { DashboardCardHeader, CompactCardState } from "./DashboardCardHeader";
import { staggered, xeroQueryRetry } from "@/lib/xero/live-load";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Wallet, Loader2 } from "lucide-react";
import { BasisBadge } from "@/components/dashboard/BasisBadge";
import { AwaitingSnapshot, DataSourceLine } from "@/components/dashboard/DataSourceLine";
import { getPayablesList } from "@/lib/xero/payables.functions";
import { VectorChart } from '@/components/charts/VectorChart';
import { ageingPoints } from '@/lib/charts/standard';
import { useTenantCurrency } from './useTenantCurrency';

function fmt(n: number, ccy = "AUD") {
  return new Intl.NumberFormat(undefined, {
    style: "currency", signDisplay: "negative",
    currency: ccy,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function PayablesWidget({
  tenantId,
  tenantName,
  clientId,
  basis = "accrual",
}: {
  tenantId: string;
  tenantName: string;
  clientId: string;
  loadDelayMs?: number;
  basis?: "accrual" | "cash";
}) {
  const fetchList = useServerFn(getPayablesList);
  const currency = useTenantCurrency(tenantId);
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["xero-ap-list", tenantId],
    queryFn: () => staggered(() => fetchList({ data: { tenantId } })),
    ...xeroQueryRetry,
    // Figures come from the nightly save (or a manual Refresh); no background
    // re-pulling, so the card never spins on its own.
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const oldest = [...(data?.invoices ?? [])]
    .sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"))
    .slice(0, 5);

  return (
    <div className="rounded-lg border border-border bg-card p-4 sm:p-5 shadow-soft">
      <DashboardCardHeader label={tenantName} title="Payables" icon={<Wallet className="h-4 w-4"/>} description="Oldest outstanding supplier bills" badge={<BasisBadge basis={basis}/>} source={data?.source} isFetching={isFetching}/>

      {data && data.source?.mode !== 'pending' && <VectorChart title="Payables ageing" points={ageingPoints(data.invoices)} series={[{label:'Outstanding',kind:'bar'}]} currency={currency}/>}
      <div className="mt-6 rounded-lg border border-border bg-background p-4">
        {isLoading ? (
          <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">{(error as Error).message}</p>
        ) : data?.source?.mode === "pending" ? (
          <AwaitingSnapshot />
        ) : !oldest.length ? (
          <p className="text-sm text-muted-foreground">No outstanding bills.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {oldest.map((inv) => (
              <li key={inv.invoiceId} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{inv.contact}</p>
                  <p className="text-xs text-muted-foreground">
                    {inv.invoiceNumber || "—"} · {inv.date ?? "—"}
                    {inv.daysOverdue > 0 ? ` · ${inv.daysOverdue}d overdue` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums">
                  {fmt(inv.amountDue, inv.currency)}
                </span>
              </li>
            ))}
          </ul>
        )}

        <Link
          to="/clients/$clientId/payables/$tenantId"
          params={{ clientId, tenantId }}
          className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-emphasis hover:underline"
        >
          View all payables <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
