import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2, Plus } from "lucide-react";
import {
  belowZeroMonths, caseAdjustments, debtSchedule, lowestCash, project, salesForTarget, taxSetAside,
  DEFAULT_CASES, type Adjustment, type Baseline, type CasePair, type Debt, type ProjectionRow, type TaxDue,
} from "@/lib/scenario/adjustments";

export type PlanningState = {
  cases: CasePair | null;
  target: { amount: number; per: "month" | "year" } | null;
  debts: Debt[];
  tax: { pct: number; instalmentPct: number } | null;
};

const num = (v: string) => (v === "" ? 0 : Number(v));
const monthLabel = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleDateString("en-AU", { month: "short", year: "2-digit" });
const newId = () => Math.random().toString(36).slice(2, 10);

function Box({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)] sm:p-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-base font-semibold">{title} <span className="ml-1 text-xs font-normal text-muted-foreground">Projection</span></h2>
        {action}
      </div>
      {children}
    </section>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground"><span>{label}</span>{children}</label>;
}

export function PlanningPanel(props: {
  state: PlanningState;
  onChange: (s: PlanningState) => void;
  readOnly: boolean;
  fmt: (n: number) => string;
  baseline: Baseline;
  adjustments: Adjustment[];
  months: string[];
  openingCash: number | null;
  rows: ProjectionRow[];
  averageInvoice: number | null;
  knownDebts: { name: string; balance: number }[];
  dues: TaxDue[];
  defaultTaxPct: number | null;
}) {
  const { state, onChange, readOnly, fmt, baseline, rows } = props;
  const set = (p: Partial<PlanningState>) => onChange({ ...state, ...p });
  const start = props.months[0]!;

  // 1. Best / worst
  const cases = state.cases ? (["worst", "best"] as const).map((k) => ({ k, rows: project(baseline, caseAdjustments(props.adjustments, state.cases![k], start), props.months, props.openingCash) })) : null;
  const caseCols = cases ? [{ label: "Worst", rows: cases[0]!.rows }, { label: "Expected", rows }, { label: "Best", rows: cases[1]!.rows }] : null;

  // 2. Target profit
  const last = rows[rows.length - 1];
  const fixed = last ? last.scenario.costs - baseline.costs.cogs - baseline.costs.variable : 0;
  const targetMonthly = state.target ? (state.target.per === "year" ? state.target.amount / 12 : state.target.amount) : 0;
  const target = state.target ? salesForTarget({ baseline, fixedCosts: fixed, targetPerMonth: targetMonthly, averageInvoice: props.averageInvoice }) : null;

  // 4. Tax set-aside
  const setAside = state.tax ? taxSetAside(rows.map((r) => ({ month: r.month, amount: r.scenario.revenue })), state.tax.pct, state.tax.instalmentPct, props.dues) : null;

  const below = belowZeroMonths(rows);
  const setCase = (k: "best" | "worst", f: "salesPct" | "payDays" | "costsPct", v: number) => set({ cases: { ...state.cases!, [k]: { ...state.cases![k], [f]: v } } });
  const setDebt = (id: string, p: Partial<Debt>) => set({ debts: state.debts.map((d) => (d.id === id ? { ...d, ...p } : d)) });

  return (
    <>
      <Box title="Best case / worst case" action={!readOnly && (state.cases
        ? <Button size="sm" variant="outline" onClick={() => set({ cases: null })}>Remove cases</Button>
        : <Button size="sm" onClick={() => set({ cases: DEFAULT_CASES })}>Make best/worst case</Button>)}>
        {!caseCols ? <p className="text-sm text-muted-foreground">Create a linked best and worst case from this scenario. They're saved with it.</p> : <>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["worst", "best"] as const).map((k) => (
              <div key={k} className="rounded-xl border border-border bg-card p-3">
                <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{k === "best" ? "Best case" : "Worst case"}</p>
                {([["salesPct", "Sales ±%", -50, 50], ["payDays", "Customers pay ±days (negative = faster)", -60, 90], ["costsPct", "Costs ±%", -30, 30]] as const).map(([f, label, min, max]) => (
                  <Field key={f} label={`${label}: ${state.cases![k][f]}`}>
                    <input type="range" min={min} max={max} step={1} disabled={readOnly} value={state.cases![k][f]} onChange={(e) => setCase(k, f, Number(e.target.value))} className="accent-primary" />
                  </Field>
                ))}
              </div>
            ))}
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead><tr className="bg-muted/30 text-left text-xs text-muted-foreground"><th className="p-2">Month (net position)</th>{caseCols.map((c) => <th key={c.label} className="p-2 text-right">{c.label}</th>)}</tr></thead>
              <tbody>
                {props.months.map((m, i) => <tr key={m} className="border-t border-border"><td className="p-2">{monthLabel(m)}</td>{caseCols.map((c) => <td key={c.label} className="p-2 text-right tabular-nums">{fmt(c.rows[i]!.scenario.net)}</td>)}</tr>)}
                <tr className="border-t border-border font-medium"><td className="p-2">Lowest cash point</td>{caseCols.map((c) => { const l = lowestCash(c.rows); return <td key={c.label} className="p-2 text-right tabular-nums">{l ? `${fmt(l.amount)} · ${monthLabel(l.month)}` : "Needs opening cash"}</td>; })}</tr>
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Faster payment can't beat same-month collection in this flat projection, so best-case timing only removes delays.</p>
        </>}
      </Box>

      <Box title="How many extra sales do I need?">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Target net profit (A$)"><Input className="h-9 w-[160px]" type="number" disabled={readOnly} value={state.target?.amount ?? ""} onChange={(e) => set({ target: e.target.value === "" ? null : { amount: num(e.target.value), per: state.target?.per ?? "month" } })} /></Field>
          <Field label="Per">
            <select className="h-9 rounded-md border border-input bg-card px-2 text-sm" disabled={readOnly} value={state.target?.per ?? "month"} onChange={(e) => state.target && set({ target: { ...state.target, per: e.target.value as "month" | "year" } })}>
              <option value="month">Month</option><option value="year">Year</option>
            </select>
          </Field>
        </div>
        {state.target && (target ? (
          <ul className="mt-3 space-y-1 text-sm">
            <li>Sales needed: <strong>{fmt(target.salesNeeded)}</strong> per month (fixed costs incl. wages and hires {fmt(fixed)}).</li>
            <li>{target.gap > 0 ? `${fmt(target.gap)} more than now` : `${fmt(-target.gap)} less than now`}{target.gapPct !== null ? ` (${target.gapPct > 0 ? "+" : ""}${target.gapPct}%)` : ""} vs {fmt(baseline.revenue)} this month.</li>
            {target.invoices !== null && target.gap > 0 && props.averageInvoice && <li>≈ {target.invoices} more invoices at your average invoice of {fmt(props.averageInvoice)}.</li>}
            {target.priceRisePct !== null && target.priceRisePct > 0 && <li>Or a price rise of about {target.priceRisePct}% at the same volume.</li>}
          </ul>
        ) : <p className="mt-3 text-sm text-muted-foreground">Can't work this out: there are no sales this month, or costs of sales are higher than sales.</p>)}
      </Box>

      <Box title="Debt repayments" action={!readOnly && <Button size="sm" variant="outline" onClick={() => set({ debts: [...state.debts, { id: newId(), name: "Loan", balance: 0, ratePct: 0, mode: "payment", payment: 0, termMonths: 12, start }] })}><Plus className="mr-1 h-4 w-4" />Add debt</Button>}>
        {!readOnly && props.knownDebts.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2 text-xs">
            <span className="text-muted-foreground">From the balance sheet:</span>
            {props.knownDebts.map((k) => <Button key={k.name} size="sm" variant="outline" className="h-7 text-xs" onClick={() => set({ debts: [...state.debts, { id: newId(), name: k.name, balance: k.balance, ratePct: 0, mode: "term", termMonths: 12, payment: 0, start }] })}>{k.name} · {fmt(k.balance)}</Button>)}
          </div>
        )}
        {state.debts.length === 0 && <p className="text-sm text-muted-foreground">No debts added.</p>}
        <div className="space-y-3">
          {state.debts.map((d) => {
            const s = debtSchedule(d);
            const alt = d.mode === "payment" ? debtSchedule({ ...d, mode: "term", termMonths: s.rows.length || d.termMonths || 12 }) : debtSchedule({ ...d, mode: "payment", payment: s.monthlyPayment });
            return (
              <div key={d.id} className="rounded-xl border border-border bg-card p-3">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
                  <Field label="Name"><Input className="h-9" value={d.name} maxLength={80} disabled={readOnly} onChange={(e) => setDebt(d.id, { name: e.target.value })} /></Field>
                  <Field label="Balance (A$)"><Input className="h-9" type="number" min={0} value={d.balance} disabled={readOnly} onChange={(e) => setDebt(d.id, { balance: num(e.target.value) })} /></Field>
                  <Field label="Interest % a year"><Input className="h-9" type="number" min={0} step="0.1" value={d.ratePct} disabled={readOnly} onChange={(e) => setDebt(d.id, { ratePct: num(e.target.value) })} /></Field>
                  <Field label="Repay by">
                    <select className="h-9 rounded-md border border-input bg-card px-2 text-sm" disabled={readOnly} value={d.mode} onChange={(e) => setDebt(d.id, { mode: e.target.value as Debt["mode"] })}><option value="payment">A$ per month</option><option value="term">Pay off in N months</option></select>
                  </Field>
                  {d.mode === "payment"
                    ? <Field label="A$ per month"><Input className="h-9" type="number" min={0} value={d.payment ?? 0} disabled={readOnly} onChange={(e) => setDebt(d.id, { payment: num(e.target.value) })} /></Field>
                    : <Field label="Months"><Input className="h-9" type="number" min={1} max={360} value={d.termMonths ?? 12} disabled={readOnly} onChange={(e) => setDebt(d.id, { termMonths: Math.max(1, num(e.target.value)) })} /></Field>}
                  <Field label="Start month"><Input className="h-9" type="month" value={d.start} disabled={readOnly} onChange={(e) => setDebt(d.id, { start: e.target.value })} /></Field>
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                  {s.neverPaysOff ? <p className="text-destructive">This repayment doesn't cover the interest, so the debt never gets paid off.</p>
                    : <p>{fmt(s.monthlyPayment)}/month · paid off {s.payoffMonth ? monthLabel(s.payoffMonth) : "—"} · total interest {fmt(s.totalInterest)}</p>}
                  {!readOnly && <Button size="icon" variant="ghost" aria-label="Remove debt" onClick={() => set({ debts: state.debts.filter((x) => x.id !== d.id) })}><Trash2 className="h-4 w-4" /></Button>}
                </div>
                {!s.neverPaysOff && !alt.neverPaysOff && <p className="text-xs text-muted-foreground">Compare: {d.mode === "payment" ? `pay off in ${alt.rows.length} months` : `pay ${fmt(alt.monthlyPayment)}/month`} → total interest {fmt(alt.totalInterest)}.</p>}
              </div>
            );
          })}
        </div>
        {state.debts.length > 0 && (below.length
          ? <p className="mt-3 text-sm font-medium text-destructive">Cash goes below zero in {below.map(monthLabel).join(", ")} with these repayments.</p>
          : props.openingCash === null ? <p className="mt-3 text-xs text-muted-foreground">Enter opening cash to check for months below zero.</p> : <p className="mt-3 text-sm text-muted-foreground">Repayments are included in the scenario's cash. Cash stays above zero in the months shown.</p>)}
      </Box>

      <Box title="Tax set-aside" action={!readOnly && !state.tax && <Button size="sm" onClick={() => set({ tax: { pct: props.defaultTaxPct ?? 10, instalmentPct: 0 } })}>Plan tax set-aside</Button>}>
        {!state.tax || !setAside ? <p className="text-sm text-muted-foreground">Put a share of income aside for GST and PAYG{props.defaultTaxPct !== null ? ` (recently about ${props.defaultTaxPct}% of income)` : ""}.</p> : <>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="GST + PAYG, % of income"><Input className="h-9 w-[120px]" type="number" min={0} max={100} step="0.5" disabled={readOnly} value={state.tax.pct} onChange={(e) => set({ tax: { ...state.tax!, pct: num(e.target.value) } })} /></Field>
            <Field label="Income tax instalments, % (optional)"><Input className="h-9 w-[120px]" type="number" min={0} max={100} step="0.5" disabled={readOnly} value={state.tax.instalmentPct} onChange={(e) => set({ tax: { ...state.tax!, instalmentPct: num(e.target.value) } })} /></Field>
            {!readOnly && <Button size="sm" variant="ghost" onClick={() => set({ tax: null })}>Remove</Button>}
          </div>
          <p className="mt-3 text-sm">Transfer about <strong>{fmt(setAside.monthly[0] ?? 0)}</strong> a month (≈ {fmt(setAside.weeklyFirst)} a week) into a tax account.</p>
          {setAside.checks.length === 0 ? <p className="mt-2 text-xs text-muted-foreground">No tax due in the months shown.</p> : (
            <ul className="mt-2 space-y-1 text-sm">
              {setAside.checks.map((c) => <li key={c.label + c.due}>{c.covered ? `Covers ${c.label} of ~${fmt(c.amount)} (due ${c.due}) with ${fmt(c.difference)} to spare` : `Short by ${fmt(-c.difference)} for ${c.label} of ~${fmt(c.amount)} (due ${c.due})`}</li>)}
            </ul>
          )}
          <p className="mt-2 text-xs text-muted-foreground">Due amounts come from the Tax obligations card. Tax due this month is checked before this month's transfer.</p>
        </>}
      </Box>
    </>
  );
}
