import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Wallet, Loader2 } from "lucide-react";
import { BasisBadge } from "@/components/dashboard/BasisBadge";
import { getPayablesList } from "@/lib/xero/payables.functions";

function fmt(n: number, ccy = "AUD") {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: ccy,
    maximumFractionDigits: 0,
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
  const { data, isLoading, error } = useQuery({
    queryKey: ["xero-ap-list", tenantId],
    queryFn: () => fetchList({ data: { tenantId } }),
    retry: false,
  });

  const oldest = [...(data?.invoices ?? [])]
    .sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"))
    .slice(0, 5);

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {tenantName}
          </p>
          <h3 className="font-display text-lg font-semibold flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" /> Accounts Payable Ageing
            <BasisBadge basis={basis} />
          </h3>
          <p className="text-xs text-muted-foreground">Oldest outstanding supplier bills.</p>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-border bg-background p-4">
        {isLoading ? (
          <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">{(error as Error).message}</p>
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
          className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          View all payables <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
