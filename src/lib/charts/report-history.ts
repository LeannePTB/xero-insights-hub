import type { HistoryRow } from './history';
export type FrozenTrend = { label: string; date: string; value: number | null; source: string | null };
export type ReportCharts = { cash: FrozenTrend[]; profit: FrozenTrend[]; note: string };
export function freezeReportCharts(rows: HistoryRow[], reports: { id: string; period_end: string; version: number; payload: any }[], current: {periodEnd:string;currency:string;profit:number|null}): ReportCharts {
  const months: string[] = [];
  const [year,month] = current.periodEnd.split('-').map(Number);
  for(let i=11;i>=0;i--) months.push(new Date(Date.UTC(year,month-i,0)).toISOString().slice(0,10));
  const cash = months.map(date => {
    const row = rows.find(r => r.as_at === date);
    return {date,label:date.slice(0,7),value:row?.cash ?? null,source:row ? `key_figures:${date}` : null};
  });
  const profit = months.map(date => {
    if(date === current.periodEnd) return {date,label:date.slice(0,7),value:current.profit,source:'current_report'};
    const report = reports.filter(r => r.period_end === date && r.payload?.meta?.currency === current.currency).sort((a,b) => b.version-a.version || a.id.localeCompare(b.id))[0];
    const value = report?.payload?.profitAndLoss?.totals?.netProfit;
    return {date,label:date.slice(0,7),value:typeof value === 'number' && Number.isFinite(value) ? value : null,source:report ? `report:${report.id}:v${report.version}` : null};
  });
  return {cash,profit,note:'Stored month-end cash observations and authorised monthly reports only. Missing months are unavailable, not zero. Historical cash retains the bank settings used when saved.'};
}
