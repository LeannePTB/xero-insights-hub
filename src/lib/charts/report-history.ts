import type { HistoryRow } from './history';
export type FrozenTrend = { label: string; date: string; value: number | null; source: string | null };
export type ReportCharts = { cash: FrozenTrend[]; profit: FrozenTrend[]; pnl?: {label:string;values:(number|null)[]}[]; note: string };
export function freezeReportCharts(rows: HistoryRow[], reports: { id: string; period_end: string; version: number; payload: any }[], current: {periodEnd:string;currency:string;profit:number|null}, monthEnd: {month_end:string;net_profit:number|null}[] = []): ReportCharts {
  const months: string[] = [];
  const [year,month] = current.periodEnd.split('-').map(Number);
  for(let i=11;i>=0;i--) months.push(new Date(Date.UTC(year,month-i,0)).toISOString().slice(0,10));
  const cash = months.map(date => {
    const row = rows.find(r => r.as_at === date);
    return {date,label:date.slice(0,7),value:row?.cash ?? null,source:row ? ((row as any).source === 'month_end' ? `xero_backfill:${date}` : `key_figures:${date}`) : null};
  });
  const profit = months.map(date => {
    if(date === current.periodEnd) return {date,label:date.slice(0,7),value:current.profit,source:'current_report'};
    const report = reports.filter(r => r.period_end === date && r.payload?.meta?.currency === current.currency).sort((a,b) => b.version-a.version || a.id.localeCompare(b.id))[0];
    const value = report?.payload?.profitAndLoss?.totals?.netProfit;
    if (!(typeof value === 'number' && Number.isFinite(value))) {
      const filled = monthEnd.find(m => m.month_end === date)?.net_profit;
      if (typeof filled === 'number' && Number.isFinite(filled)) return {date,label:date.slice(0,7),value:filled,source:`xero_backfill:${date}`};
    }
    return {date,label:date.slice(0,7),value:typeof value === 'number' && Number.isFinite(value) ? value : null,source:report ? `report:${report.id}:v${report.version}` : null};
  });
  return {cash,profit,note:'Stored month-end cash observations, authorised monthly reports and month-end figures filled from Xero (marked as such). Missing months are unavailable, not zero. Historical cash retains the bank settings used when saved.'};
}
