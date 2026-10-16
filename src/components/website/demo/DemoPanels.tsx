import type { ReactNode } from "react";
import { Activity, LineChart, Landmark, Users, Scale, LayoutDashboard, Building2, Sparkles } from "lucide-react";
import trixieIcon from "@/assets/trixie-icon.png";
import { ReportHealthChecks } from "@/components/reports/ReportHealthChecks";
import { VectorChart } from "@/components/charts/VectorChart";
import { BreakevenChart } from "@/components/charts/BreakevenChart";
import { PnlKpi } from "@/components/dashboard/PnlKpi";
import { TaxObligationsBody } from "@/components/dashboard/TaxObligationsBody";
import { STATUS_LABEL } from "@/lib/health/health-checks";
import { DEMO_BREAKEVEN, DEMO_BUSINESS, DEMO_GROUP, DEMO_TRIXIE, DEMO_FILE, DEMO_HEALTH, DEMO_OVERVIEW, DEMO_PNL_MONTHS, DEMO_PNL_TILES, DEMO_SUPER, DEMO_TAX } from "./demo-fixture";

const money = (n: number) => n.toLocaleString("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });

/** Browser-style frame around a static, fictional product view. */
export function AppWindow({ title, children }: { title: string; children: ReactNode }) {
  return <div className="sales-product overflow-hidden bg-background text-left">
    <div className="flex items-center gap-2 border-b border-border bg-card px-4 py-2.5">
      <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" /><span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" /><span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
      <span className="ml-3 truncate text-xs text-muted-foreground">{title}</span>
    </div>
    <div className="p-3 sm:p-5">{children}</div>
    <div className="sales-demo-label">Illustrative preview · fictional data</div>
  </div>;
}

function Card({ icon, title, label = DEMO_FILE, children }: { icon: ReactNode; title: string; label?: string; children: ReactNode }) {
  return <div className="rounded-lg border border-border bg-card p-4 shadow-soft sm:p-5">
    <p className="text-xs text-muted-foreground">{label}</p>
    <h3 className="mt-0.5 flex items-center gap-2 font-display text-base font-semibold">{icon}{title}</h3>
    {children}
  </div>;
}

export function DemoHealth() {
  return <ReportHealthChecks checks={DEMO_HEALTH} />;
}

export function DemoPnl() {
  return <Card icon={<LineChart className="h-4 w-4" />} title="Profit & loss">
    <div className="mt-3"><VectorChart title="Income, expenses and net profit · FY 2026–27 to date" points={DEMO_PNL_MONTHS} series={[{ label: "Income", kind: "bar" }, { label: "Expenses (including cost of sales)", kind: "bar" }, { label: "Net profit", kind: "line" }]} table={false} /></div>
    <h4 className="mt-4 text-sm font-normal text-foreground">How {DEMO_PNL_TILES.currentLabel} compares with {DEMO_PNL_TILES.priorLabel}</h4>
    <p className="mt-1 text-xs text-muted-foreground">{DEMO_PNL_TILES.note}</p>
    <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
      {DEMO_PNL_TILES.tiles.map((t) => <PnlKpi key={t.label} {...t} priorLabel={DEMO_PNL_TILES.priorLabel} />)}
    </div>
  </Card>;
}

export function DemoTax() {
  return <Card icon={<Landmark className="h-4 w-4" />} title="Tax obligations">
    <TaxObligationsBody forward={DEMO_TAX} buildingLabel="October" money={money} partPaid={[false]} paygRegistered
      details={<><p>Unfiled GST from earlier periods: none.</p><p>Last lodged period: Sep 2026 · GST $2,890 · PAYG $1,160</p></>} />
  </Card>;
}

export function DemoSuper() {
  return <Card icon={<Users className="h-4 w-4" />} title="Superannuation">
    <p className="mt-4 text-xs text-muted-foreground">Super not yet paid</p>
    <p className="mt-1 font-display text-lg font-semibold tabular-nums">{money(DEMO_SUPER.outstanding)}</p>
    <div className="mt-3 divide-y divide-border">
      <div className="hidden grid-cols-[1fr_1fr_1.4fr] gap-3 pb-2 text-xs text-muted-foreground sm:grid"><span>Payday</span><span>Super</span><span>Due (7 business days)</span></div>
      {DEMO_SUPER.rows.map((r) => <div key={r.payday} className="grid grid-cols-2 gap-x-3 gap-y-1 py-3 text-sm sm:grid-cols-[1fr_1fr_1.4fr]">
        <span><span className="text-muted-foreground sm:hidden">Payday </span>{r.payday}</span>
        <span className="tabular-nums">{money(r.amount)}</span>
        <span><span className="text-muted-foreground sm:hidden">Due </span>{r.due}</span>
      </div>)}
    </div>
  </Card>;
}

export function DemoBreakeven() {
  return <Card icon={<Scale className="h-4 w-4" />} title="Break-even">
    <BreakevenChart revenue={DEMO_BREAKEVEN.revenue} target={DEMO_BREAKEVEN.target} />
    <p className="mt-2 text-xs text-muted-foreground">Monthly fixed costs {money(DEMO_BREAKEVEN.monthlyFixed)} ÷ contribution margin {DEMO_BREAKEVEN.margin}%</p>
  </Card>;
}

function Badge({ onTrack, red }: { onTrack: number; red: boolean }) {
  const tone = onTrack === 3 ? "border-success/30 bg-success/10 text-success" : red ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-info/30 bg-info/10 text-info";
  const word = onTrack === 3 ? STATUS_LABEL.green : red ? STATUS_LABEL.red : STATUS_LABEL.watch;
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-1 text-xs font-medium ${tone}`}><Activity className="h-3 w-3" />{word} · {onTrack} of 3</span>;
}

export function DemoOverview() {
  return <div className="rounded-lg border border-border bg-card shadow-soft">
    <div className="flex items-center gap-2 border-b border-border px-4 py-3"><LayoutDashboard className="h-4 w-4" /><h3 className="font-display text-base font-semibold">Overview</h3><span className="text-xs text-muted-foreground">· 5 clients</span></div>
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] text-sm">
        <thead className="bg-muted/40 text-left text-xs text-muted-foreground"><tr><th className="p-3">Client</th><th className="p-3">Business health</th><th className="p-3 text-right">Cash at bank</th><th className="p-3 text-right">Tax &amp; super owed</th></tr></thead>
        <tbody className="divide-y divide-border">
          {DEMO_OVERVIEW.map((r) => <tr key={r.name}>
            <td className="p-3 font-medium">{r.name}</td>
            <td className="p-3"><Badge onTrack={r.onTrack} red={r.red} /></td>
            <td className="p-3 text-right tabular-nums">{money(r.cash)}</td>
            <td className="p-3 text-right tabular-nums"><span className={r.overdue ? "font-semibold text-destructive" : ""}>Next due: {r.next}{r.overdue ? " · overdue" : ""}</span><span className="block text-xs text-muted-foreground">{r.building}</span></td>
          </tr>)}
        </tbody>
      </table>
    </div>
  </div>;
}

/** Hero: Overview above the client dashboard's first cards. */
export function DemoHero() {
  return <AppWindow title={`Traction Advisory · ${DEMO_BUSINESS} · Live Dashboard`}>
    <div className="space-y-4"><DemoOverview /><DemoHealth /></div>
  </AppWindow>;
}

const aud = (n: number) => `${n < 0 ? "-" : ""}A$${Math.abs(n).toLocaleString("en-AU", { maximumFractionDigits: 0 })}`;

/** Multi-company group view in the consolidation card style. */
export function DemoGroup() {
  const c = DEMO_GROUP.companies;
  const sum = (k: "revenue" | "profit" | "cash" | "loan") => c.reduce((t, r) => t + r[k], 0);
  return <Card icon={<Building2 className="h-4 w-4" />} title="Group consolidation" label={DEMO_GROUP.name}>
    <p className="mt-1 text-xs text-muted-foreground">Financial year to {DEMO_GROUP.asAt} · 4 companies</p>
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[34rem] text-sm">
        <thead className="text-left text-xs text-muted-foreground"><tr><th className="pb-2">Company</th><th className="pb-2 text-right">Revenue</th><th className="pb-2 text-right">Net profit</th><th className="pb-2 text-right">Cash at bank</th></tr></thead>
        <tbody className="divide-y divide-border">
          {c.map((r) => <tr key={r.name}><td className="py-2.5">{r.name}</td><td className="py-2.5 text-right tabular-nums">{aud(r.revenue)}</td><td className="py-2.5 text-right tabular-nums">{aud(r.profit)}</td><td className="py-2.5 text-right tabular-nums">{aud(r.cash)}</td></tr>)}
          <tr className="font-semibold"><td className="py-2.5">Group total</td><td className="py-2.5 text-right tabular-nums">{aud(sum("revenue"))}</td><td className="py-2.5 text-right tabular-nums">{aud(sum("profit"))}</td><td className="py-2.5 text-right tabular-nums">{aud(sum("cash"))}</td></tr>
        </tbody>
      </table>
    </div>
    <div className="mt-4 rounded-lg border border-border bg-background p-4">
      <p className="text-xs font-semibold uppercase text-muted-foreground">Inter-company loans</p>
      <div className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        {c.filter((r) => r.loan !== 0).map((r) => <div key={r.name} className="flex justify-between gap-3"><span className="truncate">{r.name}</span><span className="shrink-0 tabular-nums">{aud(r.loan)}</span></div>)}
      </div>
      <p className="mt-3 text-sm font-semibold text-success">Nets to {aud(sum("loan"))} across the group · balanced</p>
    </div>
  </Card>;
}

/** Trixie chat in the current app style. */
export function DemoTrixie() {
  return <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
    <div className="rounded-lg border border-border bg-card p-4 shadow-soft sm:p-5">
      <h3 className="flex items-center gap-2 font-display text-base font-semibold"><img src={trixieIcon} alt="Trixie" className="h-5 w-5 object-contain" />Trixie</h3>
      <div className="mt-4 space-y-4">
        <div className="ml-auto w-fit max-w-[85%] rounded-lg bg-primary px-4 py-2.5 text-sm text-primary-foreground">{DEMO_TRIXIE.question}</div>
        <div className="max-w-[92%] space-y-2 rounded-lg border border-border bg-background px-4 py-3 text-sm leading-relaxed">{DEMO_TRIXIE.answer.map((a) => <p key={a}>{a}</p>)}</div>
      </div>
      <div className="mt-4 rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground">Ask about {DEMO_BUSINESS}…</div>
    </div>
    <aside className="rounded-lg border border-border bg-card p-4 shadow-soft">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground"><Sparkles className="h-3.5 w-3.5" />Key numbers</p>
      <dl className="mt-3 divide-y divide-border text-sm">{DEMO_TRIXIE.keyNumbers.map(([k, v]) => <div key={k} className="flex justify-between gap-3 py-2"><dt className="text-muted-foreground">{k}</dt><dd className="font-semibold tabular-nums">{v}</dd></div>)}</dl>
    </aside>
  </div>;
}
