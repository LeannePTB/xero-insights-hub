import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Loader2,
  RefreshCw,
  Scale,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { XeroErrorNotice } from "@/components/dashboard/XeroLoadState";
import { getBalanceSheetReconciliation } from "@/lib/xero/reconciliation.functions";
import { money as fmt, periodOptions } from "@/components/dashboard/recon-periods";

type Row = {
  key: string;
  label: string;
  section: string;
  kind: string;
  treatment: "reconciled" | "indicative" | "review";
  group?: "loans";
  glBalance: number | null;
  subledgerBalance: number | null;
  variance: number | null;
  status: "balanced" | "variance" | "indicative" | "review" | "unavailable";
  reason?: string;
};

function TreatmentBadge({ row }: { row: Row }) {
  const map: Record<string, { text: string; cls: string }> = {
    variance: { text: "Out of balance", cls: "bg-destructive/10 text-destructive" },
    balanced: { text: "Reconciled", cls: "bg-primary/10 text-primary" },
    indicative: {
      text: "Indicative",
      cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    },
    review: { text: "Review only", cls: "bg-muted text-muted-foreground" },
    unavailable: {
      text: "Unavailable",
      cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    },
  };
  const v = map[row.status] ?? map.review;
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${v.cls}`}>
      {v.text}
    </span>
  );
}

function BodyRow({ row }: { row: Row }) {
  return (
    <tr className="border-b border-border/50 last:border-0">
      <td className="py-2 pr-3">
        <div className="font-medium">{row.label}</div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          {row.section && <span>{row.section}</span>}
          <TreatmentBadge row={row} />
        </div>
        {row.status === "unavailable" && row.reason && (
          <div className="text-xs text-amber-600 dark:text-amber-400">Unavailable — {row.reason}</div>
        )}
      </td>
      <td className="py-2 px-3 text-right tabular-nums">{fmt(row.glBalance)}</td>
      <td className="py-2 px-3 text-right tabular-nums">
        {row.treatment === "review" ? "—" : fmt(row.subledgerBalance)}
      </td>
      <td
        className={`py-2 pl-3 text-right tabular-nums font-semibold ${
          row.status === "variance" ? "text-destructive" : "text-muted-foreground"
        }`}
      >
        {row.treatment === "review" || row.status === "unavailable" ? "—" : fmt(row.variance)}
      </td>
    </tr>
  );
}

export function BalanceSheetReconciliationWidget({
  clientId,
  tenantId,
  tenantName,
  loanConsolidationHref,
}: {
  clientId: string;
  tenantId: string;
  tenantName: string;
  loanConsolidationHref?: string;
}) {
  const options = useMemo(periodOptions, []);
  const defaultAsAt = options[1]?.value ?? options[0]!.value; // last month end
  const [asAt, setAsAt] = useState(defaultAsAt);
  const [loansOpen, setLoansOpen] = useState(false);
  const fetchRecon = useServerFn(getBalanceSheetReconciliation);

  const q = useQuery({
    queryKey: ["bs-reconciliation", clientId, tenantId, asAt],
    queryFn: () => fetchRecon({ data: { clientId, tenantId, asAt } }),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const [recalculating, setRecalculating] = useState(false);
  async function recalculate() {
    setRecalculating(true);
    try {
      await fetchRecon({ data: { clientId, tenantId, asAt, recalculate: true } });
      await q.refetch();
    } finally {
      setRecalculating(false);
    }
  }

  const data = q.data;
  const rows: Row[] = (data?.rows ?? []) as Row[];
  const mainRows = rows.filter((r) => r.group !== "loans");
  const loanRows = rows.filter((r) => r.group === "loans");
  const loanSubtotal = loanRows.reduce((s, r) => s + (r.glBalance ?? 0), 0);
  const variances = rows.filter((r) => r.status === "variance").length;
  const unavailable = rows.filter((r) => r.status === "unavailable").length;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {tenantName}
          </p>
          <h3 className="font-display text-lg font-semibold flex items-center gap-2">
            <Scale className="h-4 w-4 text-primary" />
            Balance sheet reconciliation
          </h3>
          <p className="text-xs text-muted-foreground">
            Every balance sheet account as at{" "}
            {format(new Date(`${asAt}T00:00:00`), "d MMMM yyyy")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={asAt} onValueChange={setAsAt}>
            <SelectTrigger className="h-8 w-[230px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {data?.canRecalculate && (
            <Button variant="ghost" size="sm" onClick={recalculate} disabled={recalculating} title="Recalculate">
              <RefreshCw className={`h-4 w-4 ${recalculating ? "animate-spin" : ""}`} />
            </Button>
          )}
        </div>
      </div>

      {q.isLoading || recalculating ? (
        <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Reconstructing the subledgers as at this date…
        </div>
      ) : q.error ? (
        <div className="mt-4">
          <XeroErrorNotice error={q.error} onRetry={() => q.refetch()} isRetrying={q.isFetching} />
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            {variances > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-1 font-medium text-destructive">
                <AlertTriangle className="h-3.5 w-3.5" />
                {variances} account{variances === 1 ? "" : "s"} out of balance
              </span>
            ) : unavailable === 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary">
                <CheckCircle2 className="h-3.5 w-3.5" /> All control accounts reconcile
              </span>
            ) : null}
            {data && !data.complete && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 font-medium text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5" /> Incomplete — some data could not be loaded
              </span>
            )}
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="py-2 pr-3 font-semibold">Account</th>
                  <th className="py-2 px-3 text-right font-semibold">General ledger</th>
                  <th className="py-2 px-3 text-right font-semibold">Subledger</th>
                  <th className="py-2 pl-3 text-right font-semibold">Variance</th>
                </tr>
              </thead>
              <tbody>
                {mainRows.map((r) => (
                  <BodyRow key={r.key} row={r} />
                ))}

                {loanRows.length > 0 && (
                  <>
                    <tr className="border-b border-border/50 bg-muted/30">
                      <td className="py-2 pr-3">
                        <button
                          type="button"
                          onClick={() => setLoansOpen((v) => !v)}
                          className="inline-flex items-center gap-1.5 font-medium"
                        >
                          {loansOpen ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          Loan accounts ({loanRows.length})
                        </button>
                        {loanConsolidationHref && (
                          <Link
                            to={loanConsolidationHref}
                            className="ml-3 inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                          >
                            Loan consolidation <ExternalLink className="h-3 w-3" />
                          </Link>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums font-semibold">
                        {fmt(loanSubtotal)}
                      </td>
                      <td className="py-2 px-3 text-right text-muted-foreground">—</td>
                      <td className="py-2 pl-3 text-right text-muted-foreground">—</td>
                    </tr>
                    {loansOpen && loanRows.map((r) => <BodyRow key={r.key} row={r} />)}
                  </>
                )}

                {rows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-4 text-sm text-muted-foreground">
                      No balance sheet accounts found for this organisation.
                    </td>
                  </tr>
                )}
              </tbody>
              {data?.totals && (
                <tfoot className="text-xs">
                  <tr className="border-t border-border">
                    <td className="py-2 pr-3 font-semibold">Total assets</td>
                    <td className="py-2 px-3 text-right tabular-nums font-semibold">
                      {fmt(data.totals.totalAssets)}
                    </td>
                    <td colSpan={2} />
                  </tr>
                  <tr>
                    <td className="py-1 pr-3 font-semibold">Total current liabilities</td>
                    <td className="py-1 px-3 text-right tabular-nums font-semibold">
                      {fmt(data.totals.totalCurrentLiabilities)}
                    </td>
                    <td colSpan={2} />
                  </tr>
                  <tr>
                    <td className="py-1 pr-3 font-semibold">Net assets</td>
                    <td className="py-1 px-3 text-right tabular-nums font-semibold">
                      {fmt(data.totals.netAssets)}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {(data?.unreconciled.length ?? 0) > 0 && (
            <div className="mt-4 rounded-xl border border-border bg-muted/30 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Unreconciled items
              </p>
              <ul className="mt-2 space-y-2">
                {data!.unreconciled.map((u, i) => (
                  <li key={i} className="text-xs">
                    <span className="font-medium">{u.label}</span>
                    {u.amount !== undefined && <span className="tabular-nums"> — {fmt(u.amount)}</span>}
                    <div className="text-muted-foreground">{u.detail}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(data?.issues.length ?? 0) > 0 && (
            <ul className="mt-3 space-y-1 text-xs text-amber-600 dark:text-amber-400">
              {data!.issues.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          )}

          {data?.generatedAt && (
            <p className="mt-3 text-[11px] text-muted-foreground">
              {data.fromSnapshot ? "Snapshot taken" : "Calculated"}{" "}
              {format(new Date(data.generatedAt), "d MMM yyyy, h:mm a")}
              {data.fromSnapshot ? " — figures are locked so they don't drift." : ""}
            </p>
          )}
        </>
      )}
    </div>
  );
}
