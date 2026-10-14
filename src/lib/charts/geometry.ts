/** Pure, bounded vector layout shared by the web and PDF adapters. */
export type ChartPoint = { label: string; values: (number | null)[] };
export type ChartSeries = { label: string; kind: 'line' | 'bar' };

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
  const finite = points.flatMap(p => p.values).filter((v): v is number => v !== null && Number.isFinite(v));
  const tickValues = niceTicks(finite.length ? Math.min(...finite) : 0, finite.length ? Math.max(...finite) : 1);
  const min = tickValues[0], max = tickValues[tickValues.length - 1];
  const span = max - min || 1;
  const y = (v: number) => 174 - (v - min) / span * 144;
  const x = (i: number) => 64 + (i + .5) * 516 / Math.max(points.length, 1);
  const bars = series.filter(s => s.kind === 'bar').length;
  const width = Math.min(36, 516 / Math.max(points.length, 1) * .7 / Math.max(bars, 1));
  return { min, max, zero: y(0), ticks: tickValues.map(value => ({value, y: y(value)})),
    series: series.map((s, si) => {
      const bi = series.slice(0, si).filter(s => s.kind === 'bar').length;
      return { ...s, points: points.map((p, i) => {
        const value = p.values[si];
        if (value === null || value === undefined || !Number.isFinite(value)) return null;
        return { value, label: p.label, x: x(i), y: y(value), barX: x(i) + (bi - bars / 2) * width, width, height: Math.abs(y(value) - y(0)), barY: Math.min(y(value), y(0)) };
      }) };
    }), labels: points.map((p, i) => ({ label: p.label, x: x(i) })) };
}
export function breakEvenComparison(revenue: number, target: number) {
  if (!Number.isFinite(revenue) || !Number.isFinite(target) || target <= 0) return null;
  return { difference: revenue - target, pct: (revenue - target) / target * 100, revenue, target };
}
