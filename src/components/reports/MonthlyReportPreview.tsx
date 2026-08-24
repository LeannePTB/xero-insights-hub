import { AlertTriangle } from "lucide-react";
import {
  SECTION_LABELS,
  renderableFailedSections,
  money,
  pct,
  pctMagnitude,
  resolveDisclaimer,
  namesEqual,
  uniqueNames,
  type AgeingDetail,
  type MonthlyReportPayload,
} from "@/lib/reports/monthly-report";
import {
  judgeVariance,
  keyFigurePolarity,
  sectionPolarity,
  toneClass,
  type Polarity,
} from "@/lib/reports/variance-polarity";

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return iso;
  }
}

function SectionShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/**
 * A variance cell. The arrow carries direction, the colour carries judgement,
 * and the title carries both in words so neither colour blindness nor a
 * black-and-white printout loses the meaning.
 */
function Variance({
  variance,
  prior,
  polarity,
  variancePct,
  unit = "money",
  cents = false,
}: {
  variance: number;
  prior: number;
  polarity: Polarity;
  variancePct?: number | null;
  unit?: "money" | "percent";
  cents?: boolean;
}) {
  const j = judgeVariance({ variance, prior, polarity, variancePct, unit });
  const amount = unit === "money" ? money(variance, { cents }) : pct(variance);
  return (
    <span className={toneClass(j.tone)} title={j.label} aria-label={j.label}>
      {j.arrow ? <span aria-hidden="true">{j.arrow} </span> : null}
      {amount}
      {j.showPct ? ` (${pctMagnitude(variancePct as number)})` : ""}
    </span>
  );
}

function Missing({ message }: { message: string }) {
  return (
    <p className="flex items-start gap-2 text-sm text-destructive">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {message}
    </p>
  );
}

/** Label/value pair used by the stacked (narrow screen) layouts. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 tabular-nums">{children}</dd>
    </div>
  );
}

function AgeingTable({ detail, label }: { detail: AgeingDetail; label: string }) {
  return (
    <div>
      {/* Table from 900px up. No scroll container — the page scrolls, not the table. */}
      <table className="hidden w-full table-fixed text-sm min-[900px]:table">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
            <th className="w-[26%] py-2 pr-2 text-left">{label}</th>
            {detail.bucketLabels.map((b) => (
              <th key={b} className="py-2 pl-2 text-right">{b}</th>
            ))}
            <th className="py-2 pl-2 text-right">Total</th>
            <th className="w-[9%] py-2 pl-2 text-right">% of total</th>
          </tr>
        </thead>
        <tbody>
          {detail.rows.map((r) => (
            <tr key={r.name} className="border-b border-border/50 align-top">
              <td className="py-1.5 pr-2 break-words hyphens-auto">{r.name}</td>
              {r.buckets.map((v, i) => (
                <td key={i} className="py-1.5 pl-2 text-right tabular-nums whitespace-nowrap">
                  {money(v, { cents: true })}
                </td>
              ))}
              <td className="py-1.5 pl-2 text-right font-medium tabular-nums whitespace-nowrap">
                {money(r.total, { cents: true })}
              </td>
              <td className="py-1.5 pl-2 text-right tabular-nums whitespace-nowrap text-muted-foreground">
                {pct(r.pctOfTotal)}
              </td>
            </tr>
          ))}
          <tr className="font-semibold">
            <td className="py-2 pr-2">Total</td>
            {detail.totals.map((v, i) => (
              <td key={i} className="py-2 pl-2 text-right tabular-nums whitespace-nowrap">
                {money(v, { cents: true })}
              </td>
            ))}
            <td className="py-2 pl-2 text-right tabular-nums whitespace-nowrap">
              {money(detail.total, { cents: true })}
            </td>
            <td className="py-2 pl-2 text-right tabular-nums whitespace-nowrap">
              {pct(detail.total === 0 ? 0 : 100)}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Stacked blocks below 900px — every row still renders. */}
      <div className="space-y-3 min-[900px]:hidden">
        {detail.rows.map((r) => (
          <div key={r.name} className="rounded-lg border border-border/60 bg-background p-3 text-sm">
            <p className="font-medium break-words">{r.name}</p>
            <dl className="mt-2 grid grid-cols-2 gap-2">
              {r.buckets.map((v, i) => (
                <Field key={i} label={detail.bucketLabels[i]}>{money(v, { cents: true })}</Field>
              ))}
            </dl>
            <div className="mt-2 flex justify-between gap-3 border-t border-border/50 pt-2">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Total</span>
              <span className="font-medium tabular-nums">
                {money(r.total, { cents: true })}{" "}
                <span className="text-muted-foreground">({pct(r.pctOfTotal)})</span>
              </span>
            </div>
          </div>
        ))}
        <div className="rounded-lg border border-border bg-background p-3 text-sm font-semibold">
          <div className="flex justify-between gap-3">
            <span>Total</span>
            <span className="tabular-nums">{money(detail.total, { cents: true })}</span>
          </div>
          <dl className="mt-2 grid grid-cols-2 gap-2 font-normal">
            {detail.totals.map((v, i) => (
              <Field key={i} label={detail.bucketLabels[i]}>{money(v, { cents: true })}</Field>
            ))}
          </dl>
        </div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">{detail.caveat}</p>
    </div>
  );
}


export function MonthlyReportPreview({
  payload,
  status,
  version,
}: {
  payload: MonthlyReportPayload;
  status?: string;
  version?: number;
}) {
  const m = payload.meta;
  const shownFailures = renderableFailedSections(payload);
  const failed = new Map(shownFailures.map((f) => [f.section, f.message]));

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="rounded-2xl border border-border bg-card p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {m.organisationName}
        </p>
        <h2 className="font-display text-2xl font-semibold">{m.clientName}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Monthly Management Report · {m.monthLabel} (period ended {fmtDate(m.periodEnd)}) ·{" "}
          {m.tenantName}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Generated {fmtDate(m.generatedAt)} by Traction Advisory
          {version ? ` · Version ${version}` : ""}
          {status ? ` · ${status}` : ""} · payload v{payload.payloadVersion} · amounts in {m.currency}
        </p>
      </header>

      {!payload.complete && shownFailures.length > 0 && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <p className="font-medium text-destructive">This report is incomplete.</p>
          <ul className="mt-2 space-y-1">
            {shownFailures.map((f) => (
              <li key={f.section} className="text-muted-foreground">
                <span className="font-medium text-foreground">
                  {SECTION_LABELS[f.section] ?? f.section}:
                </span>{" "}
                {f.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 1. Notes — the practice's commentary is read BEFORE the tables, so it
          sits directly under the header. Do not move it back below Payables. */}
      <SectionShell title="Notes">
        {!payload.notes ? (
          <Missing message={failed.get("notes") ?? "Not computed."} />
        ) : payload.notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No notes recorded for this client.</p>
        ) : (
          <ul className="space-y-3">
            {[...payload.notes]
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .map((n, i) => (
                <li key={i} className="rounded-lg bg-background p-3 text-sm">
                  <p className="whitespace-pre-wrap break-words">{n.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {n.author} · {fmtDate(n.createdAt)}
                  </p>
                </li>
              ))}
          </ul>
        )}
      </SectionShell>

      {/* 2. Key figures */}
      <SectionShell title="Key figures">

        {!payload.keyFigures ? (
          <Missing message={failed.get("key_figures") ?? "Not computed."} />
        ) : (
          <div>
            <table className="hidden w-full table-fixed text-sm min-[900px]:table">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="w-[22%] py-2 pr-2 text-left">Measure</th>
                  <th className="py-2 pl-2 text-right">{m.monthLabel}</th>
                  <th className="py-2 pl-2 text-right">Prior month</th>
                  <th className="py-2 pl-2 text-right">Change</th>
                  <th className="py-2 pl-2 text-right">{m.fyLabel} YTD</th>
                  <th className="py-2 pl-2 text-right">{m.priorFyLabel} YTD</th>
                  <th className="py-2 pl-2 text-right">Change</th>
                </tr>
              </thead>
              <tbody>
                {payload.keyFigures.map((k) => {
                  const f = (n: number) => (k.unit === "money" ? money(n) : pct(n));
                  return (
                    <tr key={k.key} className="border-b border-border/50 align-top">
                      <td className="py-2 pr-2 font-medium break-words">{k.label}</td>
                      <td className="py-2 pl-2 text-right tabular-nums whitespace-nowrap">{f(k.month)}</td>
                      <td className="py-2 pl-2 text-right tabular-nums whitespace-nowrap">{f(k.priorMonth)}</td>
                      <td className="py-2 pl-2 text-right tabular-nums whitespace-nowrap">
                        <Variance
                          variance={k.monthVariance}
                          prior={k.priorMonth}
                          polarity={keyFigurePolarity(k.key)}
                          variancePct={k.monthVariancePct}
                          unit={k.unit}
                        />
                      </td>
                      <td className="py-2 pl-2 text-right tabular-nums whitespace-nowrap">{f(k.fyYtd)}</td>
                      <td className="py-2 pl-2 text-right tabular-nums whitespace-nowrap">{f(k.priorFyYtd)}</td>
                      <td className="py-2 pl-2 text-right tabular-nums whitespace-nowrap">
                        <Variance
                          variance={k.ytdVariance}
                          prior={k.priorFyYtd}
                          polarity={keyFigurePolarity(k.key)}
                          variancePct={k.ytdVariancePct}
                          unit={k.unit}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Stacked blocks below 900px */}
            <div className="space-y-3 min-[900px]:hidden">
              {payload.keyFigures.map((k) => {
                const f = (n: number) => (k.unit === "money" ? money(n) : pct(n));
                return (
                  <div key={k.key} className="rounded-lg border border-border/60 bg-background p-3 text-sm">
                    <p className="font-medium break-words">{k.label}</p>
                    <dl className="mt-2 grid grid-cols-2 gap-2">
                      <Field label={m.monthLabel}>{f(k.month)}</Field>
                      <Field label="Prior month">{f(k.priorMonth)}</Field>
                      <Field label="Change">
                        <Variance
                          variance={k.monthVariance}
                          prior={k.priorMonth}
                          polarity={keyFigurePolarity(k.key)}
                          variancePct={k.monthVariancePct}
                          unit={k.unit}
                        />
                      </Field>
                      <Field label={`${m.fyLabel} YTD`}>{f(k.fyYtd)}</Field>
                      <Field label={`${m.priorFyLabel} YTD`}>{f(k.priorFyYtd)}</Field>
                      <Field label="Change">
                        <Variance
                          variance={k.ytdVariance}
                          prior={k.priorFyYtd}
                          polarity={keyFigurePolarity(k.key)}
                          variancePct={k.ytdVariancePct}
                          unit={k.unit}
                        />
                      </Field>
                    </dl>
                  </div>
                );
              })}
            </div>

            <ul className="mt-4 space-y-1 text-sm text-muted-foreground">
              {payload.keyFigures.map((k) => {
                const j = judgeVariance({
                  variance: k.monthVariance,
                  prior: k.priorMonth,
                  polarity: keyFigurePolarity(k.key),
                  variancePct: k.monthVariancePct,
                  unit: k.unit,
                });
                return (
                  <li key={`${k.key}-sentence`} className={toneClass(j.tone)} title={j.label}>
                    {j.arrow ? <span aria-hidden="true">{j.arrow} </span> : null}
                    {k.sentence}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </SectionShell>

      {/* 3. Profit and Loss */}
      <SectionShell title="Profit and Loss">
        {!payload.profitAndLoss ? (
          <Missing message={failed.get("profit_and_loss") ?? "Not computed."} />
        ) : (
          <div>
            <table className="hidden w-full table-fixed text-sm min-[900px]:table">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="w-[30%] py-2 pr-2 text-left">Account</th>
                  <th className="py-2 pl-2 text-right">{payload.profitAndLoss.monthLabel}</th>
                  <th className="py-2 pl-2 text-right">{payload.profitAndLoss.priorMonthLabel}</th>
                  <th className="py-2 pl-2 text-right">Variance</th>
                  <th className="w-[11%] py-2 pl-2 text-right">Variance %</th>
                  <th className="py-2 pl-2 text-right">{payload.profitAndLoss.fyLabel}</th>
                </tr>
              </thead>
              <tbody>
                {payload.profitAndLoss.lines.map((l, i) => (
                  <tr
                    key={`${l.section}-${l.name}-${i}`}
                    className={
                      l.isTotal
                        ? "border-b border-border font-semibold align-top"
                        : "border-b border-border/40 align-top"
                    }
                  >
                    <td className={`py-1.5 pr-2 break-words ${l.isTotal ? "" : "pl-2 text-muted-foreground"}`}>
                      {l.name}
                    </td>
                    <td className="py-1.5 pl-2 text-right tabular-nums whitespace-nowrap">{money(l.month, { cents: true })}</td>
                    <td className="py-1.5 pl-2 text-right tabular-nums whitespace-nowrap">{money(l.priorMonth, { cents: true })}</td>
                    <td className="py-1.5 pl-2 text-right tabular-nums whitespace-nowrap">
                      <Variance
                        variance={l.variance}
                        prior={l.priorMonth}
                        polarity={sectionPolarity(l.section)}
                        variancePct={l.variancePct}
                        cents
                      />
                    </td>
                    <td className="py-1.5 pl-2 text-right tabular-nums whitespace-nowrap">
                      {(() => {
                        const j = judgeVariance({
                          variance: l.variance,
                          prior: l.priorMonth,
                          polarity: sectionPolarity(l.section),
                          variancePct: l.variancePct,
                        });
                        if (!j.showPct) return <span className="text-muted-foreground">—</span>;
                        return (
                          <span className={toneClass(j.tone)} title={j.label} aria-label={j.label}>
                            {pct(l.variancePct)}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="py-1.5 pl-2 text-right tabular-nums whitespace-nowrap">{money(l.fyYtd, { cents: true })}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Stacked blocks below 900px */}
            <div className="space-y-3 min-[900px]:hidden">
              {payload.profitAndLoss.lines.map((l, i) => (
                <div
                  key={`${l.section}-${l.name}-${i}-stacked`}
                  className={`rounded-lg border bg-background p-3 text-sm ${
                    l.isTotal ? "border-border font-semibold" : "border-border/60"
                  }`}
                >
                  <p className="break-words">{l.name}</p>
                  <dl className="mt-2 grid grid-cols-2 gap-2 font-normal">
                    <Field label={payload.profitAndLoss!.monthLabel}>{money(l.month, { cents: true })}</Field>
                    <Field label={payload.profitAndLoss!.priorMonthLabel}>{money(l.priorMonth, { cents: true })}</Field>
                    <Field label="Variance">
                      <Variance
                        variance={l.variance}
                        prior={l.priorMonth}
                        polarity={sectionPolarity(l.section)}
                        variancePct={l.variancePct}
                        cents
                      />
                    </Field>
                    <Field label={payload.profitAndLoss!.fyLabel}>{money(l.fyYtd, { cents: true })}</Field>
                  </dl>
                </div>
              ))}
            </div>

            <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
              {[
                ["Revenue (sales)", payload.profitAndLoss.totals.revenue],
                ["Other income", payload.profitAndLoss.totals.otherIncome],
                ["Cost of sales", payload.profitAndLoss.totals.costOfSales],
                ["Gross Profit", payload.profitAndLoss.totals.grossProfit],
                ["Expenses (excl. cost of sales)", payload.profitAndLoss.totals.expenses],
                ["Net Profit/Loss", payload.profitAndLoss.totals.netProfit],
              ].map(([label, value]) => (
                <div key={label as string} className="flex justify-between gap-3 rounded-lg bg-background px-3 py-2">
                  <dt className="text-muted-foreground">{label as string}</dt>
                  <dd className="font-medium tabular-nums">{money(value as number)}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-3 rounded-lg bg-background px-3 py-2">
                <dt className="text-muted-foreground">Net margin</dt>
                <dd className="font-medium tabular-nums">{pct(payload.profitAndLoss.totals.netMargin)}</dd>
              </div>
            </dl>
          </div>
        )}
      </SectionShell>

      {/* 4. Receivables */}
      <SectionShell title="Receivables detail">
        {!payload.receivables ? (
          <Missing message={failed.get("receivables") ?? "Not computed."} />
        ) : (
          <AgeingTable detail={payload.receivables} label="Customer" />
        )}
      </SectionShell>

      {/* 5. Payables */}
      <SectionShell title="Payables detail">
        {!payload.payables ? (
          <Missing message={failed.get("payables") ?? "Not computed."} />
        ) : (
          <AgeingTable detail={payload.payables} label="Supplier" />
        )}
      </SectionShell>




      {/* 6. Disclaimer — fine print, always last, never collapsible */}
      <section className="px-6">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Disclaimer
        </h4>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          {resolveDisclaimer(payload)}
        </p>
      </section>

      {/* Footer */}
      <footer className="rounded-2xl border border-border bg-card px-6 py-4 text-xs text-muted-foreground">
        {m.organisationName} · {m.clientName} · {m.monthLabel} · generated {fmtDate(m.generatedAt)} by Traction Advisory · Version {version}
      </footer>
    </div>
  );
}
