export type HistoryRow = { client_id: string; tenant_id: string; as_at: string; cash: number | null; protected_money?: number | null };
export type HistoryClient = { id: string; files: { tenantId: string; currency: string | null }[] };
export function previousMonthDay(day: string) {
  const [y, m, d] = day.split('-').map(Number);
  const last = new Date(Date.UTC(y, m - 1, 0));
  return new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), Math.min(d, last.getUTCDate()))).toISOString().slice(0, 10);
}
export function liabilityTotal(values: (number | null)[]) {
  const known = values.filter((v): v is number => v !== null && Number.isFinite(v));
  return { value: known.length ? known.reduce((a, v) => a + Math.max(v, 0), 0) : null, coverage: known.length };
}
/** Exact day, all currently linked files. Dedupe by client/file/day, never carry forward. */
export function historyTotals(rows: HistoryRow[], clients: HistoryClient[], day: string) {
  const currencies = new Set(clients.flatMap(c => c.files.map(f => f.currency)));
  const currency = currencies.size === 1 ? [...currencies][0] : null;
  if (!currency || clients.some(c => !c.files.length)) return { cash: null, protectedMoney: null, coverage: 0, currency: null };
  const byFile = new Map(rows.filter(r => r.as_at === day).map(r => [`${r.client_id}:${r.tenant_id}`, r]));
  let cash = 0, protectedMoney = 0, coverage = 0, taxCoverage = 0;
  for (const c of clients) {
    const files = c.files.map(f => byFile.get(`${c.id}:${f.tenantId}`));
    if (files.every(r => r?.cash !== null && r?.cash !== undefined && Number.isFinite(r.cash))) {
      cash += files.reduce((s, r) => s + Number(r?.cash), 0); coverage++;
    }
    if (files.every(r => r?.protected_money !== null && r?.protected_money !== undefined && Number.isFinite(r.protected_money))) {
      // Refunds net within this client, never across clients.
      protectedMoney += Math.max(files.reduce((s, r) => s + Number(r?.protected_money), 0), 0); taxCoverage++;
    }
  }
  return { cash: coverage === clients.length && coverage > 0 ? cash : null, protectedMoney: taxCoverage === clients.length && taxCoverage > 0 ? protectedMoney : null, coverage, currency };
}
export function comparison(now: number | null, before: number | null) {
  if (now === null || before === null) return null;
  return { difference: now - before, pct: before === 0 ? null : (now - before) / Math.abs(before) * 100 };
}
/** Weekly closing observations. A week with a gap is kept unavailable, not bridged. */
export function weeklyClosing<T extends { date: string; value: number | null }>(points: T[]): T[] {
  if (points.length <= 31) return points;
  const out: T[] = [];
  for (let i = 0; i < points.length; i += 7) {
    const week = points.slice(i, i + 7), last = week[week.length - 1];
    if (last) out.push({ ...last, value: week.some(p => p.value === null) ? null : last.value });
  }
  return out;
}
