import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getTaxLiabilities } from "@/lib/xero/reports.functions";
import { Loader2, Receipt, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

function fmt(n: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(n);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

const categoryLabel: Record<string, string> = {
  gst: "GST",
  payg: "PAYG",
  super: "Super",
  "other-tax": "Other tax",
};

export function TaxLiabilityWidget({ tenantId, tenantName }: { tenantId: string; tenantName: string }) {
  const fetchTax = useServerFn(getTaxLiabilities);
  const asAt = today();

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["xero-tax", tenantId, asAt],
    queryFn: () => fetchTax({ data: { tenantId, date: asAt } }),
  });

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {tenantName}
          </p>
          <h3 className="font-display text-lg font-semibold">Tax liabilities</h3>
          <p className="text-xs text-muted-foreground">As at {asAt}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching} title="Refresh">
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {isLoading ? (
        <div className="flex h-32 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading tax balances…
        </div>
      ) : error ? (
        <div className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {(error as Error).message}
          <p className="mt-2 text-xs text-destructive/80">
            If this says "unauthorized" or mentions a missing scope, disconnect and reconnect Xero
            to grant Balance Sheet access.
          </p>
        </div>
      ) : data ? (
        <>
          <div className="mt-6 grid grid-cols-3 gap-3">
            <TaxKpi label="GST" value={data.gst} />
            <TaxKpi label="PAYG" value={data.payg} />
            <TaxKpi label="Total" value={data.totalTaxLiability} emphasis />
          </div>

          {data.lines.length === 0 ? (
            <p className="mt-6 rounded-lg border border-dashed border-border bg-background p-4 text-center text-xs text-muted-foreground">
              No GST or PAYG accounts found on the balance sheet.
            </p>
          ) : (
            <div className="mt-6">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Breakdown
              </p>
              <ul className="divide-y divide-border/60 rounded-lg border border-border/60 bg-background">
                {data.lines.map((l) => (
                  <li key={l.name} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <div className="flex min-w-0 items-center gap-2">
                      <Receipt className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">{l.name}</span>
                      <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        {categoryLabel[l.category] ?? l.category}
                      </span>
                    </div>
                    <span className="shrink-0 font-medium tabular-nums">{fmt(l.amount)}</span>
                  </li>
                ))}
              </ul>
              {data.superannuation > 0 && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Includes superannuation payable of {fmt(data.superannuation)}.
                </p>
              )}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

function TaxKpi({ label, value, emphasis }: { label: string; value: number; emphasis?: boolean }) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        emphasis ? "border-primary/30 bg-primary/5" : "border-border/60 bg-background"
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums">{fmt(value)}</p>
    </div>
  );
}
