import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DEFAULT_SG_RATE, hireMonthlyCost, type Adjustment } from "@/lib/scenario/adjustments";

const KINDS: { kind: Adjustment["kind"]; label: string }[] = [
  { kind: "hire", label: "Hire a staff member" },
  { kind: "price", label: "Price / sales change" },
  { kind: "new_cost", label: "New regular cost" },
  { kind: "cut_cost", label: "Cut an existing cost" },
  { kind: "slower_pay", label: "Customers pay slower" },
  { kind: "one_off", label: "One-off purchase" },
  { kind: "injection", label: "Cash injection / loan" },
];

const newId = () => Math.random().toString(36).slice(2, 10);

export function blankAdjustment(kind: Adjustment["kind"], month: string): Adjustment {
  const id = newId();
  switch (kind) {
    case "hire": return { id, kind, label: "New staff member", pay: "salary", salary: 0, hourlyRate: 0, hoursPerWeek: 38, superPct: DEFAULT_SG_RATE, onCostPct: 0, start: month, end: null };
    case "price": return { id, kind, label: "Price change", pct: 5, customers: [], start: month };
    case "new_cost": return { id, kind, label: "New cost", amount: 0, category: "fixed", start: month, end: null };
    case "cut_cost": return { id, kind, label: "Cost cut", target: "fixed", mode: "pct", value: 10, start: month };
    case "slower_pay": return { id, kind, label: "Customers pay slower", days: 30, start: month };
    case "one_off": return { id, kind, label: "One-off purchase", amount: 0, month };
    case "injection": return { id, kind, label: "Cash injection", amount: 0, month, repayment: 0 };
  }
}

const num = (v: string) => (v === "" ? 0 : Number(v));

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground"><span>{label}</span>{children}</label>;
}
function MonthSelect({ value, months, onChange, optional }: { value: string | null | undefined; months: string[]; onChange: (v: string | null) => void; optional?: boolean }) {
  return <Select value={value ?? "none"} onValueChange={(v) => onChange(v === "none" ? null : v)}>
    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
    <SelectContent>{optional && <SelectItem value="none">No end</SelectItem>}{months.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
  </Select>;
}

export function AdjustmentsPanel({ adjustments, onChange, months, month, customers, accounts, readOnly, fmt }: {
  adjustments: Adjustment[];
  onChange: (next: Adjustment[]) => void;
  months: string[];
  month: string;
  customers: string[];
  accounts: string[];
  readOnly: boolean;
  fmt: (n: number) => string;
}) {
  const set = (id: string, patch: Partial<Adjustment>) => onChange(adjustments.map((a) => (a.id === id ? ({ ...a, ...patch } as Adjustment) : a)));
  return (
    <section aria-label="Adjustments" className="mt-6 rounded-2xl border border-border bg-card p-4 sm:p-6 shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-semibold">Adjustments</h2>
          <p className="text-xs text-muted-foreground">What-if changes. Projection only — nothing is changed in Xero.</p>
        </div>
        {!readOnly && <Select value="" onValueChange={(k) => onChange([...adjustments, blankAdjustment(k as Adjustment["kind"], month)])}>
          <SelectTrigger className="h-9 w-[220px] text-xs"><Plus className="mr-1 h-4 w-4" /><SelectValue placeholder="Add adjustment" /></SelectTrigger>
          <SelectContent>{KINDS.map((k) => <SelectItem key={k.kind} value={k.kind}>{k.label}</SelectItem>)}</SelectContent>
        </Select>}
      </div>
      {adjustments.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No adjustments yet.</p> : (
        <ul className="mt-4 space-y-3">
          {adjustments.map((a) => (
            <li key={a.id} className="rounded-xl border border-border bg-card p-3">
              <fieldset disabled={readOnly} className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">{KINDS.find((k) => k.kind === a.kind)?.label}</p>
                  {!readOnly && <Button variant="ghost" size="icon-sm" aria-label="Remove adjustment" onClick={() => onChange(adjustments.filter((x) => x.id !== a.id))}><Trash2 className="h-4 w-4" /></Button>}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Field label={a.kind === "hire" ? "Name / role" : "Description"}><Input className="h-9" value={a.label} maxLength={80} onChange={(e) => set(a.id, { label: e.target.value })} /></Field>
                  {a.kind === "hire" && <>
                    <Field label="Pay"><Select value={a.pay} onValueChange={(v) => set(a.id, { pay: v as "salary" | "hourly" })}><SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="salary">Annual salary</SelectItem><SelectItem value="hourly">Hourly rate</SelectItem></SelectContent></Select></Field>
                    {a.pay === "salary"
                      ? <Field label="Annual salary (A$)"><Input className="h-9" type="number" min={0} value={a.salary ?? 0} onChange={(e) => set(a.id, { salary: num(e.target.value) })} /></Field>
                      : <><Field label="Hourly rate (A$)"><Input className="h-9" type="number" min={0} value={a.hourlyRate ?? 0} onChange={(e) => set(a.id, { hourlyRate: num(e.target.value) })} /></Field>
                         <Field label="Hours per week"><Input className="h-9" type="number" min={0} value={a.hoursPerWeek ?? 0} onChange={(e) => set(a.id, { hoursPerWeek: num(e.target.value) })} /></Field></>}
                    <Field label="Super %"><Input className="h-9" type="number" min={0} step="0.5" value={a.superPct} onChange={(e) => set(a.id, { superPct: num(e.target.value) })} /></Field>
                    <Field label="On-costs % (optional)"><Input className="h-9" type="number" min={0} step="0.5" value={a.onCostPct} onChange={(e) => set(a.id, { onCostPct: num(e.target.value) })} /></Field>
                    <Field label="Start month"><MonthSelect value={a.start} months={months} onChange={(v) => set(a.id, { start: v ?? month })} /></Field>
                    <Field label="End month"><MonthSelect optional value={a.end} months={months} onChange={(v) => set(a.id, { end: v })} /></Field>
                  </>}
                  {a.kind === "price" && <>
                    <Field label="Change % (+/-)"><Input className="h-9" type="number" step="0.5" value={a.pct} onChange={(e) => set(a.id, { pct: num(e.target.value) })} /></Field>
                    <Field label="Applies to"><Select value={a.customers?.[0] ?? "all"} onValueChange={(v) => set(a.id, { customers: v === "all" ? [] : [v] })}><SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All income</SelectItem>{customers.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></Field>
                    <Field label="From month"><MonthSelect value={a.start} months={months} onChange={(v) => set(a.id, { start: v ?? month })} /></Field>
                  </>}
                  {a.kind === "new_cost" && <>
                    <Field label="Per month (A$)"><Input className="h-9" type="number" min={0} value={a.amount} onChange={(e) => set(a.id, { amount: num(e.target.value) })} /></Field>
                    <Field label="Category"><Select value={a.category} onValueChange={(v) => set(a.id, { category: v as "fixed" | "variable" })}><SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="fixed">Fixed</SelectItem><SelectItem value="variable">Variable</SelectItem></SelectContent></Select></Field>
                    <Field label="Start month"><MonthSelect value={a.start} months={months} onChange={(v) => set(a.id, { start: v ?? month })} /></Field>
                    <Field label="End month"><MonthSelect optional value={a.end} months={months} onChange={(v) => set(a.id, { end: v })} /></Field>
                  </>}
                  {a.kind === "cut_cost" && <>
                    <Field label="Cost to cut"><Select value={a.target} onValueChange={(v) => set(a.id, { target: v as any })}><SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="fixed">All fixed expenses</SelectItem><SelectItem value="variable">All variable expenses</SelectItem><SelectItem value="cogs">All cost of sales</SelectItem>{accounts.map((n) => <SelectItem key={n} value={`account:${n}`}>{n}</SelectItem>)}</SelectContent></Select></Field>
                    <Field label="Cut by"><Select value={a.mode} onValueChange={(v) => set(a.id, { mode: v as "pct" | "amount" })}><SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pct">Percent</SelectItem><SelectItem value="amount">A$ per month</SelectItem></SelectContent></Select></Field>
                    <Field label={a.mode === "pct" ? "%" : "A$"}><Input className="h-9" type="number" min={0} value={a.value} onChange={(e) => set(a.id, { value: num(e.target.value) })} /></Field>
                    <Field label="From month"><MonthSelect value={a.start} months={months} onChange={(v) => set(a.id, { start: v ?? month })} /></Field>
                  </>}
                  {a.kind === "slower_pay" && <>
                    <Field label="Extra days to pay"><Input className="h-9" type="number" min={0} max={180} value={a.days} onChange={(e) => set(a.id, { days: Math.min(180, num(e.target.value)) })} /></Field>
                    <Field label="From month"><MonthSelect value={a.start} months={months} onChange={(v) => set(a.id, { start: v ?? month })} /></Field>
                  </>}
                  {(a.kind === "one_off" || a.kind === "injection") && <>
                    <Field label="Amount (A$)"><Input className="h-9" type="number" min={0} value={a.amount} onChange={(e) => set(a.id, { amount: num(e.target.value) })} /></Field>
                    <Field label="Month"><MonthSelect value={a.month} months={months} onChange={(v) => set(a.id, { month: v ?? month })} /></Field>
                    {a.kind === "injection" && <Field label="Monthly repayment (A$, optional)"><Input className="h-9" type="number" min={0} value={a.repayment ?? 0} onChange={(e) => set(a.id, { repayment: num(e.target.value) })} /></Field>}
                  </>}
                </div>
                {a.kind === "hire" && <p className="text-sm font-medium">+{fmt(hireMonthlyCost(a))}/month incl. super · added to Wages (fixed)</p>}
              </fieldset>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
