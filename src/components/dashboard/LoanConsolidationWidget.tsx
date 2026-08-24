import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Building2, Loader2, RefreshCw, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getLoanReconciliation, type ReconRow } from "@/lib/loan-consolidation.functions";
import { XeroErrorNotice, XeroLoadPrompt } from "@/components/dashboard/XeroLoadState";
import { useTenantCurrency, formatMoneyExact } from "@/components/dashboard/useTenantCurrency";

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Inter-company loan account balances, reconciled across the client's Xero files. */
export function LoanConsolidationWidget({
  clientId,
  tenantId,
  tenantName,
  loadDelayMs = 0,
}: {
  clientId: string;
  tenantId: string;
  tenantName: string;
  loadDelayMs?: number;
}) {
  const fetchRecon = useServerFn(getLoanReconciliation);
  const currency = useTenantCurrency(tenantId);
  const fmt = (n: number) => formatMoneyExact(n, currency);
  const [shouldLoad, setShouldLoad] = useState(loadDelayMs <= 0);
  const asAt = todayISO();

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["loan-recon-card", clientId, tenantId, asAt],
    queryFn: () => fetchRecon({ data: { clientId, tenantId, asAt } }),
    enabled: shouldLoad,
    retry: false,
  });

  const rows: ReconRow[] = data?.rows ?? [];
  const mismatches = rows.filter((r) => r.status === "mismatch");
  const unpaired = rows.filter((r) => r.status === "unpaired" || r.status === "missing");
  const balanced = rows.filter((r) => r.status === "balanced");
  const totalOut = mismatches.reduce((sum, r) => sum + Math.abs(r.net), 0);

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{tenantName}</p>
          <h3 className="font-display text-lg font-semibold flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" /> Loan Consolidation
          </h3>
          <p className="text-xs text-muted-foreground">Inter-company loan accounts as at {asAt}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { setShouldLoad(true); refetch(); }}
          disabled={isFetching}
          title="Refresh"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {!shouldLoad ? (
        <XeroLoadPrompt
          label="Load Loan Consolidation"
          description="Load this report only when needed to avoid Xero rate limits."
          onLoad={() => setShouldLoad(true)}
        />
      ) : isLoading ? (
        <div className="flex h-32 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Reconciling loan accounts…
        </div>
      ) : error ? (
        <XeroErrorNotice error={error} onRetry={() => refetch()} isRetrying={isFetching} />
      ) : rows.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          No loan accounts selected yet. Choose the loan accounts to reconcile to start using this card.
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-3 gap-3">
            <Stat label="Balanced" value={String(balanced.length)} tone="text-emerald-600" />
            <Stat label="Out of balance" value={String(mismatches.length)} tone={mismatches.length ? "text-rose-600" : "text-muted-foreground"} />
            <Stat label="Unpaired" value={String(unpaired.length)} tone={unpaired.length ? "text-amber-600" : "text-muted-foreground"} />
          </div>

          <div className="mt-3 rounded-lg border border-border/60 bg-background p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Total difference
            </p>
            <p className={`mt-1 text-2xl font-semibold tabular-nums ${totalOut > 0 ? "text-rose-600" : "text-muted-foreground"}`}>
              {fmt(totalOut)}
            </p>
          </div>

          {mismatches.length > 0 && (
            <div className="mt-3 divide-y divide-border/60">
              {mismatches.slice(0, 3).map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="truncate">
                    {r.account.accountName}
                    {r.counterparty ? ` ↔ ${r.counterparty.accountName}` : ""}
                  </span>
                  <span className="shrink-0 tabular-nums text-rose-600">{fmt(Math.abs(r.net))}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link to="/clients/$clientId/loans" params={{ clientId }}>
            Open reconciliation <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/clients/$clientId/loans-accounts" params={{ clientId }}>
            Choose accounts
          </Link>
        </Button>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}
