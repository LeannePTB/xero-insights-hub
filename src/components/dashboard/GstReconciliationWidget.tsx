import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { AlertTriangle, CheckCircle2, ChevronDown, Loader2, Percent, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { XeroErrorNotice } from "@/components/dashboard/XeroLoadState";
import { getGstReconciliation, type GstResponse } from "@/lib/xero/gst.functions";
import { money as fmt, gstPeriodOptions } from "@/components/dashboard/recon-periods";
import { usePersistedDisclosure } from "@/hooks/usePersistedDisclosure";

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

function netGst(data: NonNullable<ReturnType<typeof useQuery>["data"]>) {
  const sales = data.gstOnSales ?? 0;
  const purchases = data.gstOnPurchases ?? 0;
  return { net: sales - purchases, sales, purchases };
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
  const options = useMemo(gstPeriodOptions, []);
  const defaultValue = options[1]?.value ?? options[0]!.value;
  const [periodValue, setPeriodValue] = useState(defaultValue);
  const selected = options.find((o) => o.value === periodValue) ?? options[0]!;
  const asAt = selected.asAt;
  const window = selected.kind;
  const fetchGst = useServerFn(getGstReconciliation);
  const [detailOpen, setDetailOpen] = usePersistedDisclosure(
    `gst-detail:${clientId}:${tenantId}`,
  );

  const q = useQuery({
    queryKey: ["gst-reconciliation", clientId, tenantId, window, asAt],
    queryFn: () => fetchGst({ data: { clientId, tenantId, asAt, window } }),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const [recalculating, setRecalculating] = useState(false);
  async function recalculate() {
    setRecalculating(true);
    try {
      await fetchGst({ data: { clientId, tenantId, asAt, window, recalculate: true } });
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
              : `${format(new Date(`${selected.from}T00:00:00`), "d MMM")} – ${format(
                  new Date(`${selected.to}T00:00:00`),
                  "d MMM yyyy",
                )}`}{" "}
            · a review aid, not a lodgement figure
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={periodValue} onValueChange={setPeriodValue}>
            <SelectTrigger className="h-8 w-[260px] text-xs">
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
      ) : data ? (
        <>
          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              {(() => {
                const { net } = netGst(data);
                const isRefund = net < 0;
                return (
                  <>
                    <p className="text-xs text-muted-foreground">
                      {isRefund ? "GST refund position" : "Approximate GST for this period"}
                    </p>
                    <p className="font-display text-5xl font-semibold tabular-nums tracking-tight text-foreground">
                      {fmt(isRefund ? -net : net)}
                    </p>
                    {isRefund && (
                      <p className="text-xs text-muted-foreground">
                        GST on purchases exceeded GST on sales
                      </p>
                    )}
                  </>
                );
              })()}
              <p className="mt-1 text-[11px] text-muted-foreground">
                Indicative, not a lodgement figure
              </p>
            </div>

            {data.ties ? (
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" /> Ties to control account
              </span>
            ) : (
              <div className="flex shrink-0 items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-semibold">Does not tie — do not trust the headline</p>
                  <p className="opacity-90">{fmt(data.difference)} unexplained</p>
                </div>
              </div>
            )}
          </div>

          {data && !data.complete && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-100">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <p className="font-medium">Incomplete — some data could not be loaded</p>
            </div>
          )}

          <div className="mt-5">
            <button
              type="button"
              onClick={() => setDetailOpen(!detailOpen)}
              aria-expanded={detailOpen}
              className="flex w-full items-center justify-between rounded-xl border border-border bg-background/60 px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/40"
            >
              <span>Check the figures tie</span>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform ${detailOpen ? "rotate-180" : ""}`}
              />
            </button>
            {detailOpen && (
              <div className="mt-3 space-y-4">
                <div className="rounded-xl border border-border p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {data.controlAccountName ?? "GST"} control account
                  </p>
                  <div className="mt-1">
                    <Line label="Opening balance" value={data.openingBalance} />
                    <Line label="GST on sales" value={data.gstOnSales} />
                    <Line label="GST on purchases" value={data.gstOnPurchases} />
                    <Line label="Paid to the ATO and journals" value={data.movementsTotal} />
                    <Line label="Expected closing balance" value={data.expectedClosing} strong />
                    <Line label="Balance sheet closing balance" value={data.closingBalance} strong />
                    <Line label="Difference" value={data.difference} strong />
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    GST account transactions in the period
                  </p>
                  {(data.accountMovements.length ?? 0) === 0 ? (
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
                          {data.accountMovements.map((m, i) => (
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

                <p className="text-[11px] text-muted-foreground">
                  Xero's API does not expose the Activity Statement, so these figures are rebuilt from
                  transaction tax amounts and the GST account movements. Treat them as indicative.
                </p>

                {(data.issues.length ?? 0) > 0 && (
                  <ul className="space-y-1 text-xs text-amber-600 dark:text-amber-400">
                    {data.issues.map((m, i) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>
                )}

                {data.generatedAt && (
                  <p className="text-[11px] text-muted-foreground">
                    {data.fromSnapshot ? "Snapshot taken" : "Calculated"}{" "}
                    {format(new Date(data.generatedAt), "d MMM yyyy, h:mm a")}
                  </p>
                )}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

