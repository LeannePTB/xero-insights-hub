/** Pure, bounded vector layout shared by the web and PDF adapters. */
export type ChartPoint = { label: string; values: (number | null)[] };
/** 'stack' series share one bar slot, drawn on top of each other in order. */
export type ChartSeries = { label: string; kind: 'line' | 'bar' | 'stack' };

/** Rounded 1/2/2.5/5 × 10^n step so axis labels read as round numbers. */
export function niceStep(span: number, targetTicks = 4): number {
  if (!Number.isFinite(span) || span <= 0) return 1;
  const raw = span / targetTicks;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / mag;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * mag;
}

/** Axis range widened to whole steps, always including zero. */
export function niceTicks(dataMin: number, dataMax: number): number[] {
  const lo = Math.min(0, dataMin), hi = Math.max(0, dataMax);
  const step = niceStep(hi - lo || 1);
  const start = Math.floor(lo / step) * step, end = Math.ceil(hi / step) * step;
  const out: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) out.push(Math.abs(v) < step / 1e6 ? 0 : Number(v.toPrecision(12)));
  return out;
}

export function chartGeometry(points: ChartPoint[], series: ChartSeries[]) {
  const stackIdx = series.map((s, i) => s.kind === 'stack' ? i : -1).filter(i => i >= 0);
  const stackTotals = points.map(p => stackIdx.reduce((t, i) => t + (Number.isFinite(p.values[i] as number) ? (p.values[i] as number) : 0), 0));
  const finite = [...points.flatMap(p => p.values), ...(stackIdx.length ? stackTotals : [])].filter((v): v is number => v !== null && Number.isFinite(v));
  const tickValues = niceTicks(finite.length ? Math.min(...finite) : 0, finite.length ? Math.max(...finite) : 1);
  const min = tickValues[0], max = tickValues[tickValues.length - 1];
  const span = max - min || 1;
  const y = (v: number) => 174 - (v - min) / span * 144;
  const x = (i: number) => 64 + (i + .5) * 516 / Math.max(points.length, 1);
  // Bar slots: each 'bar' series is one slot; all 'stack' series share one slot.
  const slotOf = (si: number) => series.slice(0, si).reduce((n, s, k) => n + (s.kind === 'bar' || (s.kind === 'stack' && stackIdx[0] === k) ? 1 : 0), 0);
  const bars = series.filter(s => s.kind === 'bar').length + (stackIdx.length ? 1 : 0);
  const width = Math.min(36, 516 / Math.max(points.length, 1) * .7 / Math.max(bars, 1));
  return { min, max, zero: y(0), ticks: tickValues.map(value => ({value, y: y(value)})),
    series: series.map((s, si) => {
      const bi = s.kind === 'stack' ? slotOf(stackIdx[0]) : slotOf(si);
      return { ...s, points: points.map((p, i) => {
        const value = p.values[si];
        if (value === null || value === undefined || !Number.isFinite(value)) return null;
        const base = s.kind === 'stack' ? stackIdx.filter(k => k < si).reduce((t, k) => t + (Number.isFinite(p.values[k] as number) ? (p.values[k] as number) : 0), 0) : 0;
        const top = base + value;
        return { value, label: p.label, x: x(i), y: y(top), barX: x(i) + (bi - bars / 2) * width, width, height: Math.abs(y(top) - y(base)), barY: Math.min(y(top), y(base)) };
      }) };
    }), labels: points.map((p, i) => ({ label: p.label, x: x(i) })) };
}
export function breakEvenComparison(revenue: number, target: number) {
  if (!Number.isFinite(revenue) || !Number.isFinite(target) || target <= 0) return null;
  return { difference: revenue - target, pct: (revenue - target) / target * 100, revenue, target };
}
