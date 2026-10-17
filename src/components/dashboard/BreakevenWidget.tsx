import { DashboardCardHeader, CompactCardState } from "./DashboardCardHeader";
import { BreakevenChart } from "@/components/charts/BreakevenChart";
import { type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2, RefreshCw, Target, AlertTriangle, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { XeroErrorNotice, XeroLoadPrompt } from "@/components/dashboard/XeroLoadState";
import { BasisBadge } from "@/components/dashboard/BasisBadge";
import { DateRangeControls } from "@/components/dashboard/DateRangeControls";
import { CardFreshness } from "@/components/dashboard/CardFreshness";
import { cn } from "@/lib/utils";
import { useBreakevenData, fmtAUD, fmtPct } from "@/components/dashboard/useBreakevenData";
import { useCanManageClient } from "@/hooks/useCanManageClient";

export function BreakevenWidget({
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
  /** The `true_breakeven` card key: loan repayments, tax and drawings, as a
   * section of this card. */
}) {
  const s = useBreakevenData({ tenantId, clientId, basis, loadDelayMs });
  // Cost-classification prompts are preparer tooling; clients never see them.
  const { canManage: isAdvisor } = useCanManageClient(clientId);

  // One basis for the whole card: every money figure is monthly. Null until the
  // report, the stored classifications and the account list have all resolved —
  // figures are never calculated from partial inputs.
  const f = s.figures;
  const isProfit = (f?.monthlyOperatingResult ?? 0) >= 0;
  const aboveBreakeven = f?.aboveBreakeven ?? false;

  return (
    <div className="rounded-lg border border-border bg-card p-4 sm:p-5 shadow-soft">
      <DashboardCardHeader label={tenantName} title="Break-even" icon={<Target className="h-4 w-4"/>} description="The sales you need to cover your costs" badge={<BasisBadge basis={basis}/>} from={s.fromDate} to={s.toDate} source={s.data?.source} isFetching={s.isFetching} actions={<Button variant="ghost" size="icon-sm" onClick={() => { s.setShouldLoad(true); s.refetch(); }} disabled={s.isFetching} title="Refresh" aria-label="Refresh"><RefreshCw className={`h-4 w-4 ${s.isFetching ? "animate-spin" : ""}`}/></Button>}/>

      <DateRangeControls fullMonthPresets
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
      ) : s.classificationError ? (
        // A failed classification read is said out loud. Falling back to the
        // defaults here would show a confident, wrong fixed-cost figure.
        <div className="mt-6 flex items-start gap-3 rounded-lg border border-info/30 bg-info/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-info" />
          <div className="space-y-2">
            <p className="font-medium text-foreground">Break-even cannot be worked out just now</p>
            <p className="text-muted-foreground">
              The saved fixed and variable cost settings could not be read, so this figure would be
              wrong. Nothing is missing from your records — please try again in a moment.
            </p>
            <Button variant="outline" size="sm" onClick={() => s.refetchClassifications()}>
              Try again
            </Button>
          </div>
        </div>
      ) : s.data && f ? (
        s.income <= 0 || s.grossMargin <= 0 ? (
          <div className="mt-6 flex items-start gap-3 rounded-lg bg-card p-4 text-sm text-muted-foreground">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Not enough income in this period to work out a break-even — income did not cover the costs that rise and fall with the work.</span>
          </div>
        ) : (
          <>
            {s.months < 1 && (
              <p className="mt-4 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
                This period is shorter than a full month, so the monthly figures below
                are scaled up from what has happened so far. Treat them as a running
                estimate, not a settled month.
              </p>
            )}
            <BreakevenChart revenue={f.monthlyIncome} target={f.monthlyBreakeven} />
            <div className="mt-6 overflow-hidden rounded-lg border border-border">

              <table className="w-full text-sm">
                <tbody>
                  {(
                    [
                      {
                        // Plain English on the face of the card (owner decision):
                        // "fixed costs" reads as accountant's language. The
                        // technical terms live in the breakdown below.
                        label: (
                          <>
                            Costs you have anyway (per month){" "}
                            <span className="italic text-muted-foreground">(fixed costs)</span>
                          </>
                        ),
                        value: fmtAUD(f.monthlyFixed),
                      },
                      {
                        // This is a contribution margin, not gross margin — any
                        // cost of sales classified as fixed is excluded from
                        // variable costs here. The label says what the figure
                        // means rather than naming the accounting measure, and
                        // the breakdown explains the difference properly.
                        label: (
                          <>
                            Left from each sale (%){" "}
                            <span className="italic text-muted-foreground">
                              (after the costs that rise and fall with the work — this is what pays
                              your fixed costs. Not the same as the gross margin in Xero)
                            </span>
                          </>
                        ),
                        value: fmtPct(s.grossMargin),
                      },
                      {
                        label: (
                          <>
                            Break-Even Revenue (per month){" "}
                            <span className="italic text-muted-foreground">
                              (Costs you have anyway ÷ Left from each sale %)
                            </span>
                          </>
                        ),
                        value: fmtAUD(f.monthlyBreakeven),
                      },
                      { label: "Revenue (per month)", value: fmtAUD(f.monthlyIncome) },
                      {
                        label: "Above or Below Break-Even?",
                        value: aboveBreakeven ? "Above" : "Below",
                        tone: aboveBreakeven ? "positive" : "negative",
                      },
                      {
                        label: isProfit ? "Operating Profit (per month)" : "Operating Loss (per month)",
                        value: fmtAUD(f.monthlyOperatingResult),
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

            <details className="mt-3 rounded-lg border border-border/60 bg-card">
              <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground">
                Show calculation breakdown
              </summary>
              <div className="space-y-4 border-t border-border/60 px-3 py-3 text-xs">
                <div>
                  <p className="mb-1 font-semibold uppercase tracking-wider text-xs text-muted-foreground">Formula</p>
                  <p className="font-mono text-foreground">Break-Even Revenue (per month) = Monthly Fixed Costs ÷ Contribution Margin %</p>
                  <p className="mt-1 text-muted-foreground">
                    Contribution margin is what is left from each dollar of revenue after the variable
                    costs — the costs that rise and fall with the work. It differs from gross margin in
                    the Xero profit and loss because it splits costs by how they behave rather than by
                    which section of the profit and loss they sit in: a cost-of-sales account classified
                    as fixed is counted as a fixed cost here, not a variable one.
                  </p>
                  <p className="mt-1 font-mono text-muted-foreground">
                    {fmtAUD(f.monthlyBreakeven)} = {fmtAUD(f.monthlyFixed)} ÷ {fmtPct(s.grossMargin)}
                  </p>
                  {Math.abs(s.months - 1) > 0.01 && (
                    <p className="mt-1 text-muted-foreground">
                      The selected range is {s.months.toFixed(2)} months. Period figures (fixed costs{" "}
                      {fmtAUD(s.fixedOpex)}) are divided by {s.months.toFixed(2)} to give the monthly basis
                      shown above.
                    </p>
                  )}
                </div>
                <div>
                  <p className="mb-1 font-semibold uppercase tracking-wider text-xs text-muted-foreground">Contribution Margin %</p>
                  <p className="font-mono text-foreground">
                    ({fmtAUD(s.income)} − {fmtAUD(s.totalVariable)}) ÷ {fmtAUD(s.income)} = {fmtPct(s.grossMargin)}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    Variable costs = Cost of sales, variable ({fmtAUD(s.variableCogs)})
                    {s.variableOpex > 0 && <> + Variable opex ({fmtAUD(s.variableOpex)})</>}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    Cost of sales in total is {fmtAUD(s.cogs)}. A cost-of-sales account classified as
                    fixed is counted in fixed costs below, not here.
                  </p>
                </div>
                {(() => {
                  const wl = [...s.fixedLines.map((l) => ({ ...l, tag: "fixed" })), ...s.variableLines.map((l) => ({ ...l, tag: "variable" }))].filter((l) => l.isWages);
                  if (!wl.length) return null;
                  return <div>
                    <p className="mb-1 flex items-center justify-between font-semibold uppercase tracking-wider text-xs text-muted-foreground">
                      <span>Wages ({wl.length})</span>
                      <span>{fmtAUD(wl.reduce((t, l) => t + l.amount, 0))}</span>
                    </p>
                    <ul className="divide-y divide-border/40">{wl.map((l) => <li key={`w-${l.name}`} className="flex items-center justify-between gap-2 py-1">
                      <span className="truncate">{l.name}<span className="ml-1.5 text-xs text-muted-foreground">({l.section === "cogs" ? "cost of sales, " : ""}{l.tag})</span></span>
                      <span className="font-mono tabular-nums text-foreground">{fmtAUD(l.amount)}</span>
                    </li>)}</ul>
                    <p className="mt-1 text-xs text-muted-foreground">Shown separately; each wage account still counts as its fixed or variable tag in the break-even result.</p>
                  </div>;
                })()}
                <div>
                  <p className="mb-1 flex items-center justify-between font-semibold uppercase tracking-wider text-xs text-muted-foreground">
                    <span>Fixed Costs{s.fixedLines.some((l) => l.isWages) ? " (excl. wages)" : ""} ({s.fixedLines.filter((l) => !l.isWages).length})</span>
                    <span>{fmtAUD(s.fixedOpex - s.fixedLines.filter((l) => l.isWages).reduce((t, l) => t + l.amount, 0))}</span>
                  </p>
                  {s.fixedLines.length === 0 && s.unitemisedBalance === 0 ? (
                    <p className="text-muted-foreground">No fixed cost accounts in this period.</p>
                  ) : (
                    <ul className="divide-y divide-border/40">
                      {s.fixedLines.filter((l) => !l.isWages).map((l) => (
                        <li key={l.name} className="flex items-center justify-between gap-2 py-1">
                          <span className="truncate">
                            {l.name}
                            {l.section === "cogs" && (
                              <span className="ml-1.5 text-xs text-muted-foreground">(cost of sales)</span>
                            )}
                            {l.unclassified && (
                              <span className="ml-1.5 text-xs text-info">(unclassified)</span>
                            )}
                          </span>
                          <span className="font-mono tabular-nums text-foreground">{fmtAUD(l.amount)}</span>
                        </li>
                      ))}
                      {s.unitemisedBalance !== 0 && (
                        <li className="flex items-start justify-between gap-2 py-1">
                          <span className="text-muted-foreground">
                            Unitemised balance{" "}
                            <span className="italic">
                              (difference between Xero's reported total and the listed accounts)
                            </span>
                          </span>
                          <span className="font-mono tabular-nums text-foreground">
                            {fmtAUD(s.unitemisedBalance)}
                          </span>
                        </li>
                      )}
                    </ul>
                  )}
                </div>
                {(() => {
                  const varOpex = s.variableLines.filter((l) => l.section === "operating" && !l.isWages);
                  const varCogs = s.variableLines.filter((l) => l.section === "cogs" && !l.isWages);
                  const wOpex = s.variableLines.filter((l) => l.section === "operating" && l.isWages).reduce((t, l) => t + l.amount, 0);
                  const wCogs = s.variableLines.filter((l) => l.section === "cogs" && l.isWages).reduce((t, l) => t + l.amount, 0);
                  return (
                    <>
                      {varOpex.length > 0 && (
                        <div>
                          <p className="mb-1 flex items-center justify-between font-semibold uppercase tracking-wider text-xs text-muted-foreground">
                            <span>Variable Opex ({varOpex.length})</span>
                            <span>{fmtAUD(s.variableOpex - wOpex)}</span>
                          </p>
                          <ul className="divide-y divide-border/40">
                            {varOpex.map((l) => (
                              <li key={l.name} className="flex items-center justify-between gap-2 py-1">
                                <span className="truncate">{l.name}</span>
                                <span className="font-mono tabular-nums text-foreground">{fmtAUD(l.amount)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {(varCogs.length > 0 || s.variableCogs !== 0) && (
                        <div>
                          <p className="mb-1 flex items-center justify-between font-semibold uppercase tracking-wider text-xs text-muted-foreground">
                            <span>Cost of Sales, variable ({varCogs.length})</span>
                            <span>{fmtAUD(s.variableCogs - wCogs)}</span>
                          </p>
                          <ul className="divide-y divide-border/40">
                            {varCogs.map((l) => (
                              <li key={l.name} className="flex items-center justify-between gap-2 py-1">
                                <span className="truncate">{l.name}</span>
                                <span className="font-mono tabular-nums text-foreground">{fmtAUD(l.amount)}</span>
                              </li>
                            ))}
                            {s.cogsUnitemisedBalance !== 0 && (
                              <li className="flex items-start justify-between gap-2 py-1">
                                <span className="text-muted-foreground">
                                  Unitemised balance{" "}
                                  <span className="italic">
                                    (difference between Xero's reported cost of sales and the listed
                                    accounts)
                                  </span>
                                </span>
                                <span className="font-mono tabular-nums text-foreground">
                                  {fmtAUD(s.cogsUnitemisedBalance)}
                                </span>
                              </li>
                            )}
                          </ul>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </details>

            {s.unitemisedBalance !== 0 && s.unitemisedMaterial && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-info/30 bg-info/10 p-3 text-xs text-info">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div className="flex-1">
                  {fmtAUD(s.unitemisedBalance)} of the fixed costs below could not be matched to a
                  named account, which is a large enough share of the total that this break-even
                  should not be relied on until it is explained.
                </div>
              </div>
            )}

            {/* A client may not see the practice's tooling, but must be told when
                a figure they are shown rests on an assumption. Same disclosure
                either way; only the action link is preparer-facing. */}
            {s.classificationEnabled && s.unclassifiedCount > 0 && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-info/30 bg-info/10 p-3 text-xs text-info">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div className="flex-1">
                  {isAdvisor && clientId ? (
                    <>
                      <strong>{s.unclassifiedCount}</strong> expense{" "}
                      {s.unclassifiedCount === 1 ? "account is" : "accounts are"} unclassified and treated as fixed.{" "}
                      <Link
                        to="/clients/$clientId/settings"
                        params={{ clientId }}
                        hash="cost-classification"
                        className="font-medium underline underline-offset-2"
                      >
                        Classify accounts
                      </Link>
                    </>
                  ) : (
                    <>
                      <strong>{s.unclassifiedCount}</strong> expense{" "}
                      {s.unclassifiedCount === 1 ? "account is" : "accounts are"} not yet categorised
                      and {s.unclassifiedCount === 1 ? "is" : "are"} treated as fixed costs, which may
                      make this figure higher than it should be. Your bookkeeper is reviewing them.
                    </>
                  )}
                </div>
              </div>
            )}

            {s.classificationEnabled && s.excludedCount > 0 && (
              <p className="mt-3 text-xs text-muted-foreground">
                Excluding {s.excludedCount} account{s.excludedCount === 1 ? "" : "s"} ({fmtAUD(s.excludedOpex)}) from break-even.
              </p>
            )}

            {isAdvisor && clientId && (
              <p className="mt-4 text-xs text-muted-foreground">
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
