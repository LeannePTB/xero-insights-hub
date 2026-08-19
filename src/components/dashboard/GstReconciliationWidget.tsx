import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { AlertTriangle, CheckCircle2, Loader2, Percent, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { XeroErrorNotice } from "@/components/dashboard/XeroLoadState";
import { getGstReconciliation } from "@/lib/xero/gst.functions";
import { money as fmt, periodOptions } from "@/components/dashboard/recon-periods";

function Line({
  label,
  value,
  strong,
}: {
  label: string;
  value: number | null | undefined;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between border-b border-border/50 py-2 last:border-0 ${
        strong ? "font-semibold" : ""
      }`}
    >
      <span className="text-sm">{label}</span>
      <span className="tabular-nums text-sm">{fmt(value)}</span>
    </div>
  );
}

export function GstReconciliationWidget({
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
  const fetchGst = useServerFn(getGstReconciliation);

  const q = useQuery({
    queryKey: ["gst-reconciliation", clientId, tenantId, asAt],
    queryFn: () => fetchGst({ data: { clientId, tenantId, asAt } }),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const [recalculating, setRecalculating] = useState(false);
  async function recalculate() {
    setRecalculating(true);
    try {
      await fetchGst({ data: { clientId, tenantId, asAt, recalculate: true } });
      await q.refetch();
    } finally {
      setRecalculating(false);
    }
  }

  const data = q.data;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {tenantName}
          </p>
          <h3 className="font-display text-lg font-semibold flex items-center gap-2">
            <Percent className="h-4 w-4 text-primary" />
            GST — indicative
          </h3>
          <p className="text-xs text-muted-foreground">
            {data
              ? `${format(new Date(`${data.periodFrom}T00:00:00`), "d MMM")} – ${format(
                  new Date(`${data.periodTo}T00:00:00`),
                  "d MMM yyyy",
                )}`
              : format(new Date(`${asAt}T00:00:00`), "d MMMM yyyy")}{" "}
            · a review aid, not a lodgement figure
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
          <Loader2 className="h-4 w-4 animate-spin" /> Rebuilding the GST movement…
        </div>
      ) : q.error ? (
        <div className="mt-4">
          <XeroErrorNotice error={q.error} onRetry={() => q.refetch()} isRetrying={q.isFetching} />
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            {data?.ties ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary">
                <CheckCircle2 className="h-3.5 w-3.5" /> The movement ties to the control account
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-1 font-medium text-destructive">
                <AlertTriangle className="h-3.5 w-3.5" /> The movement does not tie —{" "}
                {fmt(data?.difference)} unexplained
              </span>
            )}
            {data && !data.complete && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 font-medium text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5" /> Incomplete — some data could not be loaded
              </span>
            )}
          </div>

          <div className="mt-4 rounded-xl border border-border p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {data?.controlAccountName ?? "GST"} control account
            </p>
            <div className="mt-1">
              <Line label="Opening balance" value={data?.openingBalance} />
              <Line label="GST on sales" value={data?.gstOnSales} />
              <Line label="GST on purchases" value={data?.gstOnPurchases} />
              <Line label="Paid to the ATO and journals" value={data?.movementsTotal} />
              <Line label="Expected closing balance" value={data?.expectedClosing} strong />
              <Line label="Balance sheet closing balance" value={data?.closingBalance} strong />
              <Line label="Difference" value={data?.difference} strong />
            </div>
          </div>

          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              GST account transactions in the period
            </p>
            {(data?.accountMovements.length ?? 0) === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Nothing was coded directly to the GST account in this period.
              </p>
            ) : (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                      <th className="py-2 pr-3 font-semibold">Date</th>
                      <th className="py-2 px-3 font-semibold">Source</th>
                      <th className="py-2 px-3 font-semibold">Reference</th>
                      <th className="py-2 pl-3 text-right font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data!.accountMovements.map((m, i) => (
                      <tr key={i} className="border-b border-border/50 last:border-0">
                        <td className="py-2 pr-3 whitespace-nowrap">
                          {m.date ? format(new Date(`${m.date}T00:00:00`), "d MMM yyyy") : "—"}
                        </td>
                        <td className="py-2 px-3">{m.source}</td>
                        <td className="py-2 px-3 text-muted-foreground">
                          {m.contact ? `${m.contact}${m.reference ? " · " : ""}` : ""}
                          {m.reference ?? ""}
                        </td>
                        <td className="py-2 pl-3 text-right tabular-nums">{fmt(m.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <p className="mt-3 text-[11px] text-muted-foreground">
            Xero's API does not expose the Activity Statement, so these figures are rebuilt from
            transaction tax amounts and the GST account movements. Treat them as indicative.
          </p>

          {(data?.issues.length ?? 0) > 0 && (
            <ul className="mt-3 space-y-1 text-xs text-amber-600 dark:text-amber-400">
              {data!.issues.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          )}

          {data?.generatedAt && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              {data.fromSnapshot ? "Snapshot taken" : "Calculated"}{" "}
              {format(new Date(data.generatedAt), "d MMM yyyy, h:mm a")}
            </p>
          )}
        </>
      )}
    </div>
  );
}
