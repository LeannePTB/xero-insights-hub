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
import { ReconAgeNotice } from "@/components/dashboard/ReconAgeNotice";
import { XeroErrorNotice } from "@/components/dashboard/XeroLoadState";
import { getGstReconciliation, type GstResponse } from "@/lib/xero/gst.functions";
import {
  money as fmt,
  gstPeriodOptions,
  type GstPeriodOption,
  type GstWindowKind,
} from "@/components/dashboard/recon-periods";
import { usePersistedDisclosure } from "@/hooks/usePersistedDisclosure";

/**
 * The activity statement front page reports the PERIOD only — what happened
 * between the two dates. No opening or closing balances appear on it, because
 * a balance is a position on a date and answers a different question. The
 * balance-based reconciliation still exists, but it is a preparer's check and
 * lives behind `showWarnings`, exactly like every other preparer-only surface.
 */

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

function netGst(data: GstResponse) {
  const sales = data.gstOnSales ?? 0;
  const purchases = data.gstOnPurchases ?? 0;
  return { net: sales - purchases, sales, purchases };
}

export type GstCycle = "monthly" | "quarterly" | "annual" | "not_registered";

/** The period the card opens on for a lodgement cycle. `null` (cycle not
 *  set) keeps the long-standing default — the last completed month — and the
 *  card says so rather than guessing a cycle. */
function defaultPeriodValue(cycle: GstCycle | null | undefined, options: GstPeriodOption[]) {
  const want: Record<Exclude<GstCycle, "not_registered">, GstWindowKind> = {
    monthly: "month",
    quarterly: "quarter",
    annual: "year",
  };
  const kind = cycle && cycle !== "not_registered" ? want[cycle] : null;
  if (kind) {
    // The current-period "to date" option is listed first for each kind.
    const hit = options.find((o) => o.kind === kind);
    if (hit) return hit.value;
  }
  return options[1]?.value ?? options[0]!.value;
}

export function GstReconciliationWidget({
  clientId,
  tenantId,
  tenantName,
  gstCycle = null,
  showWarnings = false,
}: {
  clientId: string;
  tenantId: string;
  tenantName: string;
  /** The client's GST lodgement cycle, set on the client settings page. */
  gstCycle?: GstCycle | null;
  /** Preparer-only surfaces: the balance-based reconciliation and its issues. */
  showWarnings?: boolean;
}) {
  const options = useMemo(gstPeriodOptions, []);
  const [periodValue, setPeriodValue] = useState(() => defaultPeriodValue(gstCycle, options));
  const selected = options.find((o) => o.value === periodValue) ?? options[0]!;
  const asAt = selected.asAt;
  const window = selected.kind;
  const fetchGst = useServerFn(getGstReconciliation);
  const [detailOpen, setDetailOpen] = usePersistedDisclosure(
    `gst-detail:${clientId}:${tenantId}`,
  );

  const notRegistered = gstCycle === "not_registered";
  const q = useQuery({
    queryKey: ["gst-reconciliation", clientId, tenantId, window, asAt],
    queryFn: () => fetchGst({ data: { clientId, tenantId, asAt, window } }),
    retry: false,
    staleTime: 5 * 60 * 1000,
    // A client who is not registered for GST has no period to fetch.
    enabled: !notRegistered,
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
            Activity statement — GST (indicative)
          </h3>
          <p className="text-xs text-muted-foreground">
            {notRegistered
              ? "Goods and services tax"
              : data
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
        {!notRegistered && (
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
        )}
      </div>

      {notRegistered ? (
        <p className="mt-6 text-sm text-muted-foreground">
          This client is not registered for GST, so there is no activity statement period to show.
          If that changes, set the new cycle on the client settings page under “GST (business
          activity statement)”.
        </p>
      ) : q.isLoading || recalculating ? (
        <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Working out this period's GST…
        </div>
      ) : q.error ? (
        <div className="mt-4">
          <XeroErrorNotice error={q.error} onRetry={() => q.refetch()} isRetrying={q.isFetching} />
        </div>
      ) : data ? (
        <>
          <div className="mt-6">
            {(() => {
              const { net } = netGst(data);
              const isRefund = net < 0;
              return (
                <>
                  <p className="text-xs text-muted-foreground">
                    {isRefund
                      ? "Estimated GST refund for this period"
                      : "Estimated GST payable for this period"}
                  </p>
                  <p className="font-display text-5xl font-semibold tabular-nums tracking-tight text-foreground">
                    {fmt(isRefund ? -net : net)}
                  </p>
                  {isRefund && (
                    <p className="text-xs text-muted-foreground">
                      GST on purchases exceeded GST on sales
                    </p>
                  )}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Indicative, not a lodgement figure
                  </p>
                </>
              );
            })()}
          </div>

          {/* The parts. Every line is a period figure — nothing here is a balance. */}
          <div className="mt-5 rounded-xl border border-border p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              How it is made up
            </p>
            <div className="mt-1">
              <Line label="GST on sales" value={data.gstOnSales} />
              <Line label="GST on purchases" value={data.gstOnPurchases} />
              <Line label="GST net" value={netGst(data).net} strong />
            </div>
          </div>



          {showWarnings && !data.complete && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-100">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <p className="font-medium">Incomplete — some data could not be loaded</p>
            </div>
          )}

          {/* Preparer-only: the balance-based check, and the only place any
              balance appears on this card. */}
          {showWarnings && (
            <div className="mt-5">
              <button
                type="button"
                onClick={() => setDetailOpen(!detailOpen)}
                aria-expanded={detailOpen}
                className="flex w-full items-center justify-between rounded-xl border border-border bg-background/60 px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/40"
              >
                <span>Check the figures tie (preparer only)</span>
                <span className="flex items-center gap-2">
                  {data.ties ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Ties
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-1 text-[11px] font-medium text-destructive">
                      <AlertTriangle className="h-3.5 w-3.5" /> {fmt(data.difference)} unexplained
                    </span>
                  )}
                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground transition-transform ${detailOpen ? "rotate-180" : ""}`}
                  />
                </span>
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
                    Xero's API does not expose the Activity Statement, so these figures are rebuilt
                    from transaction tax amounts and the GST account movements. Treat them as
                    indicative.
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
                  <ReconAgeNotice
                    generatedAt={data.generatedAt}
                    fromSnapshot={data.fromSnapshot}
                    canRecalculate={data.canRecalculate}
                  />
                </div>
              )}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
