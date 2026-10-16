import type { HistoryRow } from './history';
import { mergeHistory } from '@/lib/overview/figure-backfill';
/** Caller client only; bounded pages. Never privileged. */
export async function readFigureHistory(sb: any, ids: string[], from: string, to: string, tenantId?: string): Promise<HistoryRow[]> {
  const out: HistoryRow[] = [];
  for (let i = 0; i < ids.length; i += 25) {
    for (let offset = 0; offset < 25000; offset += 1000) {
      let query = sb.from('client_key_figures').select('client_id, tenant_id, as_at, cash, protected_money')
        .in('client_id', ids.slice(i, i + 25)).gte('as_at', from).lte('as_at', to)
        .order('as_at').order('client_id').order('tenant_id').range(offset, offset + 999);
      if (tenantId) query = query.eq('tenant_id', tenantId);
      const { data, error } = await query;
      if (error) throw new Error('Stored figure history could not be read.');
      out.push(...(data ?? []));
      if ((data ?? []).length < 1000) break;
      if (offset === 24000) throw new Error('Stored history exceeds the bounded chart window.');
    }
  }
  return out;
}

export type MonthEndRow = { client_id: string; tenant_id: string; month_end: string; cash: number | null; net_profit: number | null; income?: number | null; expenses?: number | null };
/** Backfilled month-end points, through the caller's own session (same RLS as key figures). */
export async function readMonthEndHistory(sb: any, ids: string[], from: string, to: string, tenantId?: string): Promise<MonthEndRow[]> {
  const out: MonthEndRow[] = [];
  const n = (v: any) => (v === null || v === undefined ? null : Number(v));
  for (let i = 0; i < ids.length; i += 25) {
    let query = sb.from('client_figure_history').select('client_id, tenant_id, month_end, cash, net_profit, income, expenses')
      .in('client_id', ids.slice(i, i + 25)).gte('month_end', from).lte('month_end', to).order('month_end').range(0, 999);
    if (tenantId) query = query.eq('tenant_id', tenantId);
    const { data, error } = await query;
    if (error) throw new Error('Month-end history could not be read.');
    out.push(...((data ?? []) as MonthEndRow[]).map(r => ({ ...r, cash: n(r.cash), net_profit: n(r.net_profit), income: n(r.income), expenses: n(r.expenses) })));
  }
  return out;
}

/** Nightly rows plus backfilled month-ends; a nightly row always wins on the same date. */
export async function readMergedHistory(sb: any, ids: string[], from: string, to: string, tenantId?: string) {
  const [daily, monthEnd] = await Promise.all([readFigureHistory(sb, ids, from, to, tenantId), readMonthEndHistory(sb, ids, from, to, tenantId)]);
  return { rows: mergeHistory(daily, monthEnd) as (HistoryRow & { source: 'daily' | 'month_end' })[], monthEnd };
}
