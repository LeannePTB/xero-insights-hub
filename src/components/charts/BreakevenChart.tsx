import { breakEvenComparison } from '@/lib/charts/geometry';
export function BreakevenChart({ revenue, target }: { revenue: number; target: number }) {
  const c = breakEvenComparison(revenue, target);
  if (!c) return <p className="mt-4 text-xs text-muted-foreground">No positive break-even target available.</p>;
  const fmt = (v: number) => v.toLocaleString('en-AU', { style: 'currency', signDisplay: 'negative', currency: 'AUD', maximumFractionDigits: 0 });
  const scale = Math.max(revenue, target) * 1.15;
  return <figure className="mt-4 space-y-2" aria-label="Monthly revenue versus break-even">
    <figcaption className="text-sm font-semibold">{c.difference >= 0 ? 'Above' : 'Below'} break-even by {fmt(Math.abs(c.difference))} ({Math.abs(c.pct).toFixed(1)}%)</figcaption>
    {revenue >= 0 && <svg viewBox="0 0 600 60" className="w-full" aria-hidden="true"><rect x="0" y="18" width="600" height="20" className="fill-muted"/><rect x="0" y="18" width={revenue / scale * 600} height="20" className="fill-chart-2"/><line x1={target / scale * 600} x2={target / scale * 600} y1="10" y2="46" className="stroke-foreground" strokeWidth="2"/></svg>}
    <p className="text-xs text-muted-foreground">Revenue {fmt(revenue)} · Break-even target {fmt(target)} · Both per month</p>
  </figure>;
}
