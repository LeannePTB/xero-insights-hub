import { Link } from '@tanstack/react-router';
import { VectorChart } from '@/components/charts/VectorChart';
import type { OverviewCharts as Charts } from '@/lib/overview/charts.server';
export function OverviewCharts({ data, latest }: {data: Charts; latest?: {clientId:string;clientName:string;periodEnd:string;sentAt:string} | null}) {
  const fmt = (v: number | null) => v === null ? '—' : v.toLocaleString('en-AU',{style: 'currency', signDisplay: 'negative',currency:data.currency ?? 'AUD',maximumFractionDigits:0});
  const change = (c: Charts['cashChange']) => !c ? '— · Last-month comparison unavailable' : `${c.difference >= 0 ? '+' : '−'}${fmt(Math.abs(c.difference))}${c.pct === null ? '' : ` (${c.pct >= 0 ? '+' : ''}${c.pct.toFixed(1)}%)`} vs ${data.comparisonDate}`;
  return <section className="space-y-3 border-y border-border py-4">
    <div className="grid gap-4 sm:grid-cols-3">
      <div><h2 className="text-xs text-muted-foreground">Total cash at bank</h2><p className="mt-1 text-lg font-semibold tabular-nums">{fmt(data.cash)}</p><p className="text-xs text-muted-foreground">{data.cashCoverage}/{data.count} clients with figures</p><p className="text-xs text-muted-foreground">{change(data.cashChange)}</p></div>
      <div><h2 className="text-xs text-muted-foreground">Total tax &amp; super owed</h2><p className="mt-1 text-lg font-semibold tabular-nums">{fmt(data.tax)}</p><p className="text-xs text-muted-foreground">{data.taxCoverage}/{data.count} clients with figures · refunds never offset another client</p><p className="text-xs text-muted-foreground">{change(data.taxChange)}</p></div>
      <div><h2 className="text-xs text-muted-foreground">Active clients</h2><p className="mt-1 text-lg font-semibold tabular-nums">{data.count}</p><p className="text-xs text-muted-foreground">Clients included in this Overview</p><p className="text-xs text-muted-foreground">— · Historical client count unavailable</p></div>
    </div>
    <p className="text-xs text-muted-foreground">{data.note}</p>
    {data.trend.length > 0 && <><p className="text-xs text-muted-foreground">Available history: {data.trend[0]?.date} – {data.trend[data.trend.length-1]?.date}. Only dates covering all {data.count} visible clients are plotted.</p><VectorChart title="Total cash at bank — available history" currency={data.currency ?? 'AUD'} points={data.trend.map(p => ({label:p.date.slice(5),values:[p.value]}))} series={[{label:'Cash at bank',kind:'line'}]}/></>}
    {latest && <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-3 text-xs"><span className="font-semibold">Latest monthly report</span><Link className="text-link underline" to="/clients/$clientId/reports" params={{clientId:latest.clientId}}>{latest.clientName} · {latest.periodEnd}</Link><span className="text-muted-foreground">Sent {new Date(latest.sentAt).toLocaleDateString('en-AU')}</span></div>}
  </section>;
}
