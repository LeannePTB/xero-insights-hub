import { useId, useState } from 'react';
import { chartGeometry, type ChartPoint, type ChartSeries } from '@/lib/charts/geometry';
const tones = ['text-chart-1', 'text-chart-3', 'text-chart-4', 'text-chart-2', 'text-chart-5'];
export function VectorChart({ title, points, series, currency = 'AUD', table = true }: { title: string; points: ChartPoint[]; series: ChartSeries[]; currency?: string; table?: boolean }) {
  const id = useId();
  const [selected, setSelected] = useState<string | null>(null);
  const g = chartGeometry(points, series);
  const fmt = (v: number | null) => v === null ? '—' : new Intl.NumberFormat('en-AU', { style: 'currency', currency, maximumFractionDigits: 0 }).format(v);
  const available = points.flatMap(p => p.values).filter(v => v !== null).length;
  return <figure className="min-w-0 space-y-2 py-3" aria-labelledby={id}>
    <figcaption id={id} className="text-sm font-semibold">{title} <span className="font-normal text-muted-foreground">· {currency}</span></figcaption>
    {!available ? <p className="text-xs text-muted-foreground">No reliable figures available for this period.</p> : <>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">{series.map((s, i) => <span key={s.label} className="inline-flex items-center gap-1.5"><span className={tones[i % tones.length]} aria-hidden="true">{s.kind === 'bar' ? '▥' : '●—'}</span>{s.label}</span>)}</div>
      <svg viewBox="0 0 600 210" className="block h-auto max-h-64 w-full overflow-visible" role="group" aria-label={title}>
        {g.ticks.map((t, i) => <g key={i}><line x1="62" x2="580" y1={t.y} y2={t.y} className="stroke-border" strokeDasharray="3 3"/><text x="57" y={t.y + 4} textAnchor="end" className="fill-muted-foreground" fontSize="11">{new Intl.NumberFormat('en-AU', {notation:'compact',maximumFractionDigits:1}).format(t.value)}</text></g>)}
        <line x1="62" x2="580" y1={g.zero} y2={g.zero} className="stroke-muted-foreground"/>
        {g.series.map((s, si) => <g key={s.label} className={tones[si % tones.length]}>
          {s.points.map((p, i) => {
            if (!p) return null;
            const prev = s.points[i - 1];
            const label = `${p.label} · ${s.label}: ${fmt(p.value)}`;
            return <g key={i}>
              {s.kind === 'line' && prev && series.length === 1 && <polygon points={`${prev.x},${g.zero} ${prev.x},${prev.y} ${p.x},${p.y} ${p.x},${g.zero}`} fill="currentColor" opacity=".1"/>}
              {s.kind === 'line' && prev && <line x1={prev.x} y1={prev.y} x2={p.x} y2={p.y} stroke="currentColor" strokeWidth="2" strokeDasharray={si > 1 ? '5 3' : undefined}/>}
              <g role="button" tabIndex={0} aria-label={label} onFocus={() => setSelected(label)} onClick={() => setSelected(label)} onKeyDown={e => { if(e.key === 'Enter' || e.key === ' ') {e.preventDefault();setSelected(label);} }} className="cursor-pointer outline-none focus:stroke-foreground" strokeWidth="2">
                <title>{label}</title>
                {s.kind === 'bar' ? <rect x={p.barX} y={p.barY} width={p.width} height={Math.max(p.height, 1)} fill="currentColor" stroke="var(--foreground)" strokeWidth=".5"/> : <circle cx={p.x} cy={p.y} r="4" fill="currentColor" stroke="var(--foreground)" strokeWidth=".8"/>}
              </g>
            </g>;
          })}
        </g>)}
        {g.labels.map((l, i) => (i === 0 || i === g.labels.length - 1 || i % Math.max(1, Math.ceil(g.labels.length / 4)) === 0) && <text key={i} x={l.x} y="197" fontSize="11" textAnchor="middle" className="fill-muted-foreground">{l.label}</text>)}
      </svg>
      <p className="min-h-4 text-xs text-muted-foreground" aria-live="polite">{selected ?? `${points.length} observations; gaps indicate unavailable figures.`}</p>
    </>}
    {table && points.length > 0 && <details className="text-xs"><summary className="cursor-pointer text-link">View chart values</summary><div className="overflow-x-auto"><table className="mt-2 w-full text-left"><caption className="sr-only">{title}</caption><thead><tr><th className="py-1">Period</th>{series.map(s => <th key={s.label} className="text-right">{s.label}</th>)}</tr></thead><tbody>{points.map((p, i) => <tr key={i} className="border-t border-border"><th scope="row" className="py-1 font-normal">{p.label}</th>{series.map((s, j) => <td key={s.label} className="text-right tabular-nums">{fmt(p.values[j] ?? null)}</td>)}</tr>)}</tbody></table></div></details>}
  </figure>;
}
