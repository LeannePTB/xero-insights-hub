import { readMergedHistory } from '@/lib/charts/history-reader.server';
import { freezeReportCharts, type ReportCharts } from '@/lib/charts/report-history';
import { addMonths } from '@/lib/sydney-time';
export async function loadReportCharts(sb: any, clientId: string, tenantId: string, periodEnd: string, currency: string, profit: number | null): Promise<ReportCharts> {
  const from = addMonths(periodEnd, -12);
  const { rows, monthEnd } = await readMergedHistory(sb, [clientId], from, periodEnd, tenantId);
  const reports: {id:string;period_end:string;version:number;payload:any}[] = [];
  for(let offset=0;offset<5000;offset+=1000) {
    const {data,error} = await sb.from('client_reports').select('id, period_end, version, payload').eq('client_id',clientId).eq('tenant_id',tenantId).eq('report_key','monthly_management').in('status',['final','sent']).gte('period_end',from).lte('period_end',periodEnd).order('period_end').order('version').order('id').range(offset,offset+999);
    if(error) throw new Error('Report history could not be read.');
    reports.push(...(data ?? []));
    if((data ?? []).length < 1000) break;
    if(offset===4000) throw new Error('Report history exceeds the bounded window.');
  }
  const charts=freezeReportCharts(rows,reports,{periodEnd,currency,profit},monthEnd);
  (charts as any).pnlWages=charts.profit.map(p=>{
    const report=reports.filter(r=>r.period_end===p.date && (r.payload?.basis??'accrual')==='accrual').sort((a,b)=>b.version-a.version)[0];
    const w=report?.payload?.profitAndLoss?.totals?.wagesSplit?.wages;
    return typeof w==='number'?w:null;
  });
  charts.pnl=charts.profit.map(p=>{
    const report=reports.filter(r=>r.period_end===p.date && r.payload?.meta?.currency===currency && (r.payload?.basis??'accrual')==='accrual').sort((a,b)=>b.version-a.version)[0];
    const totals=report?.payload?.profitAndLoss?.totals;
    const filled=(monthEnd as any[]).find(m=>m.month_end===p.date);
    const n=(v:any)=>v===null||v===undefined?null:Number(v);
    return {label:p.label,values:[totals?totals.revenue+totals.otherIncome:n(filled?.income),totals?totals.costOfSales+totals.expenses:n(filled?.expenses),p.value]};
  });
  return charts;
}
