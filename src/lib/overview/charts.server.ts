import { readFigureHistory } from '@/lib/charts/history-reader.server';
import { comparison, historyTotals, liabilityTotal, previousMonthDay, weeklyClosing } from '@/lib/charts/history';
import { addDays, addMonths } from '@/lib/sydney-time';
import type { OverviewContext } from './overview.server';
import type { OverviewRow } from './overview.functions';
export type OverviewCharts = {
  currency: string | null; cash: number | null; tax: number | null; cashCoverage: number; taxCoverage: number;
  count: number; comparisonDate: string; cashChange: ReturnType<typeof comparison>; taxChange: ReturnType<typeof comparison>;
  trend: {date: string; value: number | null; coverage: number}[]; note: string;
};
export async function buildOverviewCharts(sb: any, ctx: OverviewContext, rows: OverviewRow[]): Promise<OverviewCharts> {
  const clients = ctx.clients.map(c => ({ id: c.client_id, files: (ctx.connections.get(c.client_id) ?? []).map(f => ({tenantId:f.tenantId, currency:f.currency ?? null})) }));
  const currencies = new Set(clients.flatMap(c => c.files.map(f => f.currency)));
  const currency = currencies.size === 1 && !clients.some(c => !c.files.length) ? [...currencies][0] ?? null : null;
  // Existing Overview rows have one assessed snapshot set, not multi-file consolidated figures.
  const singleFile = clients.every(c => c.files.length === 1);
  const knownCash = rows.filter(r => r.cash !== null);
  const tax = liabilityTotal(rows.map(r => r.protectedMoney ?? null));
  const cash = currency && singleFile && knownCash.length ? knownCash.reduce((s, r) => s + (r.cash ?? 0), 0) : null;
  const protectedMoney = currency && singleFile ? tax.value : null;
  const comparisonDate = previousMonthDay(ctx.today);
  const start = addMonths(ctx.today, -6);
  let history: Awaited<ReturnType<typeof readFigureHistory>> = [];
  let failed = false;
  try { history = await readFigureHistory(sb, clients.map(c => c.id), start, ctx.today); } catch { failed = true; }
  const before = historyTotals(history, clients, comparisonDate);
  const first = history.reduce<string | null>((a,r) => !a || r.as_at < a ? r.as_at : a, null);
  const trend: OverviewCharts['trend'] = [];
  if (first && currency) for (let d = first; d <= ctx.today; d = addDays(d, 1)) {
    const t = historyTotals(history, clients, d);
    trend.push({date:d, value:t.cash, coverage:t.coverage});
  }
  return { currency, cash, tax:protectedMoney, cashCoverage:knownCash.length, taxCoverage:tax.coverage, count:rows.length, comparisonDate,
    cashChange:knownCash.length === rows.length && singleFile ? comparison(cash,before.cash) : null,
    taxChange:tax.coverage === rows.length && singleFile ? comparison(protectedMoney,before.protectedMoney) : null,
    trend:weeklyClosing(trend), note: !currency ? 'A combined total is unavailable: file currencies are missing or differ.' : !singleFile ? 'Current combined totals are unavailable for multi-file clients; the existing rows are not consolidated.' : failed ? 'Stored history could not be loaded.' : 'Current visible clients only. Historical balances retain the bank settings used when saved; settings changes are not recorded. Missing files or dates appear as gaps.' };
}
