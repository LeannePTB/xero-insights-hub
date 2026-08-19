import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { AlertTriangle, Boxes, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { XeroErrorNotice } from "@/components/dashboard/XeroLoadState";
import { getFixedAssetsReconciliation } from "@/lib/xero/fixed-assets.functions";
import { money as fmt, periodOptions } from "@/components/dashboard/recon-periods";

export function FixedAssetsReconciliationWidget({
  clientId,
  tenantId,
  tenantName,
}: {
  clientId: string;
  tenantId: string;
  tenantName: string;
}) {
  const options = useMemo(periodOptions, []);
  const defaultAsAt = options[1]?.value ?? options[0]!.value;
  const [asAt, setAsAt] = useState(defaultAsAt);
  const fetchFa = useServerFn(getFixedAssetsReconciliation);

  const q = useQuery({
    queryKey: ["fixed-assets-reconciliation", clientId, tenantId, asAt],
    queryFn: () => fetchFa({ data: { clientId, tenantId, asAt } }),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const [recalculating, setRecalculating] = useState(false);
  async function recalculate() {
    setRecalculating(true);
    try {
      await fetchFa({ data: { clientId, tenantId, asAt, recalculate: true } });
      await q.refetch();
    } finally {
      setRecalculating(false);
    }
  }

  const data = q.data;
  const rows = data?.rows ?? [];
  const variances = rows.filter((r) => r.status === "variance").length;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {tenantName}
          </p>
          <h3 className="font-display text-lg font-semibold flex items-center gap-2">
            <Boxes className="h-4 w-4 text-primary" />
            Fixed assets reconciliation
          </h3>
          <p className="text-xs text-muted-foreground">
            Asset register against the general ledger as at{" "}
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
          <Loader2 className="h-4 w-4 animate-spin" /> Reading the asset register…
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
                {variances} account{variances === 1 ? "" : "s"} differ from the register
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary">
                <CheckCircle2 className="h-3.5 w-3.5" /> The register agrees with the ledger
              </span>
            )}
            {data?.registerEmpty && (data.draftAssetCount ?? 0) === 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 font-medium text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5" /> The Xero asset register is empty — every
                ledger balance shows as a difference
              </span>
            )}
            {data && (data.draftAssetCount ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 font-medium text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5" /> {data.draftAssetCount} draft asset
                {data.draftAssetCount === 1 ? " is" : "s are"} waiting to be registered — drafts do
                not depreciate, so the difference stands until they are registered
              </span>
            )}

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
                  <th className="py-2 px-3 text-right font-semibold">Balance sheet opening</th>
                  <th className="py-2 px-3 text-right font-semibold">Balance sheet closing</th>
                  <th className="py-2 px-3 text-right font-semibold">Register opening</th>
                  <th className="py-2 px-3 text-right font-semibold">Register closing</th>
                  <th className="py-2 pl-3 text-right font-semibold">Difference</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key} className="border-b border-border/50 last:border-0">
                    <td className="py-2 pr-3">
                      <div className="font-medium">{r.label}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {r.isAccumulated ? "Accumulated depreciation" : "Cost"}
                      </div>
                      {r.status === "unavailable" && r.reason && (
                        <div className="text-xs text-amber-600 dark:text-amber-400">
                          Unavailable — {r.reason}
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums">{fmt(r.bs.opening)}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{fmt(r.bs.closing)}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{fmt(r.register.opening)}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{fmt(r.register.closing)}</td>
                    <td
                      className={`py-2 pl-3 text-right tabular-nums font-semibold ${
                        r.status === "variance" ? "text-destructive" : "text-muted-foreground"
                      }`}
                    >
                      {fmt(r.difference.closing)}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-4 text-sm text-muted-foreground">
                      No fixed asset accounts appear on this organisation's balance sheet.
                    </td>
                  </tr>
                )}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr className="border-t border-border text-sm">
                    <td className="py-2 pr-3 font-semibold">Total</td>
                    <td colSpan={1} />
                    <td className="py-2 px-3 text-right tabular-nums font-semibold">
                      {fmt(data?.totals.bsClosing)}
                    </td>
                    <td colSpan={1} />
                    <td className="py-2 px-3 text-right tabular-nums font-semibold">
                      {fmt(data?.totals.registerClosing)}
                    </td>
                    <td className="py-2 pl-3 text-right tabular-nums font-semibold">
                      {fmt(data?.totals.differenceClosing)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {data?.registerAsAtToday && data.registerAvailable && !data.registerEmpty && (
            <p className="mt-3 text-[11px] text-muted-foreground">
              Xero's asset register reports depreciation as at today, so figures for a past period
              end are indicative.
            </p>
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
            </p>
          )}
        </>
      )}
    </div>
  );
}
