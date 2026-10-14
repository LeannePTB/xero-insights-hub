import { readFigureHistory } from '@/lib/charts/history-reader.server';
import { freezeReportCharts, type ReportCharts } from '@/lib/charts/report-history';
import { addMonths } from '@/lib/sydney-time';
export async function loadReportCharts(sb: any, clientId: string, tenantId: string, periodEnd: string, currency: string, profit: number | null): Promise<ReportCharts> {
  const from = addMonths(periodEnd, -12);
  const rows = await readFigureHistory(sb, [clientId], from, periodEnd, tenantId);
  const reports: {id:string;period_end:string;version:number;payload:any}[] = [];
  for(let offset=0;offset<5000;offset+=1000) {
    const {data,error} = await sb.from('client_reports').select('id, period_end, version, payload').eq('client_id',clientId).eq('tenant_id',tenantId).eq('report_key','monthly_management').in('status',['final','sent']).gte('period_end',from).lte('period_end',periodEnd).order('period_end').order('version').order('id').range(offset,offset+999);
    if(error) throw new Error('Report history could not be read.');
    reports.push(...(data ?? []));
    if((data ?? []).length < 1000) break;
    if(offset===4000) throw new Error('Report history exceeds the bounded window.');
  }
  return freezeReportCharts(rows,reports,{periodEnd,currency,profit});
}
