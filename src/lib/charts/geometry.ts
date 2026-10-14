/** Pure, bounded vector layout shared by the web and PDF adapters. */
export type ChartPoint = { label: string; values: (number | null)[] };
export type ChartSeries = { label: string; kind: 'line' | 'bar' };
export function chartGeometry(points: ChartPoint[], series: ChartSeries[]) {
  const finite = points.flatMap(p => p.values).filter((v): v is number => v !== null && Number.isFinite(v));
  const min = Math.min(0, ...finite), max = Math.max(0, ...finite);
  const span = max - min || 1;
  const y = (v: number) => 174 - (v - min) / span * 144;
  const x = (i: number) => 64 + (i + .5) * 516 / Math.max(points.length, 1);
  const bars = series.filter(s => s.kind === 'bar').length;
  const width = Math.min(36, 516 / Math.max(points.length, 1) * .7 / Math.max(bars, 1));
  return { min, max, zero: y(0), ticks: [min, min + span / 2, max].map(value => ({value, y: y(value)})),
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
