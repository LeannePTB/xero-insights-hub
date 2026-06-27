import { type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2, RefreshCw, Target, AlertTriangle, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { XeroErrorNotice, XeroLoadPrompt } from "@/components/dashboard/XeroLoadState";
import { BasisBadge } from "@/components/dashboard/BasisBadge";
import { DateRangeControls } from "@/components/dashboard/DateRangeControls";
import { cn } from "@/lib/utils";
import { useBreakevenData, fmtAUD, fmtPct } from "@/components/dashboard/useBreakevenData";

export function AccountingBreakevenWidget({
  tenantId,
  tenantName,
  clientId,
  loadDelayMs = 0,
  basis = "accrual",
}: {
  tenantId: string;
  tenantName: string;
  clientId?: string;
  loadDelayMs?: number;
  basis?: "accrual" | "cash";
}) {
  const s = useBreakevenData({ tenantId, clientId, basis, loadDelayMs });

  const operatingResult = s.income - s.totalVariable - s.fixedOpex;
  const isProfit = operatingResult >= 0;
  const aboveBreakeven = s.monthlyIncome >= s.breakevenRevenue / s.months;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{tenantName}</p>
          <h3 className="font-display text-lg font-semibold flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" /> Accounting Break-Even
            <BasisBadge basis={basis} />
          </h3>
          <p className="text-xs text-muted-foreground">
            Period: {s.fromStr} → {s.toStr} ({s.months.toFixed(1)} mo)
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => { s.setShouldLoad(true); s.refetch(); }} disabled={s.isFetching} title="Refresh">
          <RefreshCw className={`h-4 w-4 ${s.isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <DateRangeControls
        fromDate={s.fromDate}
        toDate={s.toDate}
        onFromChange={s.setFromDate}
        onToChange={s.setToDate}
      />

      {!s.shouldLoad ? (
        <XeroLoadPrompt
          label="Load break-even"
          description="Load this report only when needed to avoid Xero rate limits."
          onLoad={() => s.setShouldLoad(true)}
        />
      ) : s.isLoading ? (
        <div className="flex h-40 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Calculating…
        </div>
      ) : s.error ? (
        <XeroErrorNotice error={s.error} onRetry={() => s.refetch()} isRetrying={s.isFetching} />
      ) : s.data ? (
        s.income <= 0 || s.grossMargin <= 0 ? (
          <div className="mt-6 flex items-start gap-3 rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Not enough income or positive gross margin in this period to compute a break-even.</span>
          </div>
        ) : (
          <>
            <div className="mt-6 overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <tbody>
                  {(
                    [
                      { label: "Total Fixed Costs", value: fmtAUD(s.fixedOpex) },
                      { label: "Gross Margin %", value: fmtPct(s.grossMargin) },
                      {
                        label: (
                          <>
                            Break-Even Revenue{" "}
                            <span className="italic text-muted-foreground">(Fixed Costs ÷ Gross Margin %)</span>
                          </>
                        ),
                        value: fmtAUD(s.breakevenRevenue),
                      },
                      { label: "Monthly Revenue", value: fmtAUD(s.monthlyIncome) },
                      {
                        label: "Above or Below Break-Even?",
                        value: aboveBreakeven ? "Above" : "Below",
                        tone: aboveBreakeven ? "positive" : "negative",
                      },
                      {
                        label: isProfit ? "Operating Profit" : "Operating Loss",
                        value: fmtAUD(operatingResult),
                        tone: isProfit ? "positive" : "negative",
                      },
                    ] as { label: ReactNode; value: ReactNode; tone?: "positive" | "negative" }[]
                  ).map((r, i, arr) => (
                    <tr key={i} className={cn(i !== arr.length - 1 && "border-b border-border")}>
                      <th scope="row" className="w-1/2 bg-muted/40 px-3 py-2 text-left font-medium text-foreground">
                        {r.label}
                      </th>
                      <td
                        className={cn(
                          "px-3 py-2 text-right font-mono tabular-nums",
                          r.tone === "positive" && "text-emerald-600 font-semibold",
                          r.tone === "negative" && "text-rose-600 font-semibold",
                        )}
                      >
                        {r.value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <details className="mt-3 rounded-lg border border-border/60 bg-background/50">
              <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground">
                Show calculation breakdown
              </summary>
              <div className="space-y-4 border-t border-border/60 px-3 py-3 text-xs">
                <div>
                  <p className="mb-1 font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">Formula</p>
                  <p className="font-mono text-foreground">Break-Even Revenue = Fixed Costs ÷ Gross Margin %</p>
                  <p className="mt-1 font-mono text-muted-foreground">
                    {fmtAUD(s.breakevenRevenue)} = {fmtAUD(s.fixedOpex)} ÷ {fmtPct(s.grossMargin)}
                  </p>
                </div>
                <div>
                  <p className="mb-1 font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">Gross Margin %</p>
                  <p className="font-mono text-foreground">
                    ({fmtAUD(s.income)} − {fmtAUD(s.totalVariable)}) ÷ {fmtAUD(s.income)} = {fmtPct(s.grossMargin)}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    Variable costs = Cost of Sales ({fmtAUD(s.cogs)})
                    {s.variableOpex > 0 && <> + Variable opex ({fmtAUD(s.variableOpex)})</>}
                  </p>
                </div>
                <div>
                  <p className="mb-1 flex items-center justify-between font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">
                    <span>Fixed Costs ({s.fixedLines.length})</span>
                    <span>{fmtAUD(s.fixedOpex)}</span>
                  </p>
                  {s.fixedLines.length === 0 ? (
                    <p className="text-muted-foreground">No fixed cost accounts in this period.</p>
                  ) : (
                    <ul className="divide-y divide-border/40">
                      {s.fixedLines.map((l) => (
                        <li key={l.name} className="flex items-center justify-between gap-2 py-1">
                          <span className="truncate">
                            {l.name}
                            {l.unclassified && (
                              <span className="ml-1.5 text-[10px] text-amber-600">(unclassified)</span>
                            )}
                          </span>
                          <span className="font-mono tabular-nums text-foreground">{fmtAUD(l.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {s.variableLines.length > 0 && (
                  <div>
                    <p className="mb-1 flex items-center justify-between font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">
                      <span>Variable Opex ({s.variableLines.length})</span>
                      <span>{fmtAUD(s.variableOpex)}</span>
                    </p>
                    <ul className="divide-y divide-border/40">
                      {s.variableLines.map((l) => (
                        <li key={l.name} className="flex items-center justify-between gap-2 py-1">
                          <span className="truncate">{l.name}</span>
                          <span className="font-mono tabular-nums text-foreground">{fmtAUD(l.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </details>

            {clientId && s.classificationEnabled && s.unclassifiedCount > 0 && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-900 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div className="flex-1">
                  <strong>{s.unclassifiedCount}</strong> expense {s.unclassifiedCount === 1 ? "account is" : "accounts are"} unclassified and treated as fixed.{" "}
                  <Link
                    to="/clients/$clientId/settings"
                    params={{ clientId }}
                    hash="cost-classification"
                    className="font-medium underline underline-offset-2"
                  >
                    Classify accounts
                  </Link>
                </div>
              </div>
            )}

            {s.classificationEnabled && s.excludedCount > 0 && (
              <p className="mt-3 text-[11px] text-muted-foreground">
                Excluding {s.excludedCount} account{s.excludedCount === 1 ? "" : "s"} ({fmtAUD(s.excludedOpex)}) from break-even.
              </p>
            )}

            {clientId && (
              <p className="mt-4 text-[11px] text-muted-foreground">
                <Link
                  to="/clients/$clientId/settings"
                  params={{ clientId }}
                  hash="cost-classification"
                  className="inline-flex items-center gap-1 font-medium text-foreground underline underline-offset-2"
                >
                  <Settings2 className="h-3 w-3" /> Cost classification settings
                </Link>
              </p>
            )}
          </>
        )
      ) : null}
    </div>
  );
}
