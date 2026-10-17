import { sydneyDate, addMonths, endOfMonth } from '@/lib/sydney-time';
import { readMergedHistory } from './history-reader.server';
import { parsePnl, totalsForPeriod } from '@/lib/reports/monthly-report.server';
import type { PnlObservation } from './standard';
/** Stored reads only. A separate result per existing card gate, never a combined data grant. */
export async function loadStandardHistory(db: any, clientId: string, tenantId: string, card: string, basis: string) {
  const today = sydneyDate(), from = addMonths(today,-13);
  const result: {today:string;wagesSplit:boolean;pnl:PnlObservation[];cash:{date:string;value:number|null}[];overdue:{date:string;value:number|null}[];scores:{date:string;value:number|null}[];note:string;cashNote:string|null} = {today,wagesSplit:false,pnl:[],cash:[],overdue:[],scores:[],note:'Stored observations only. Missing periods are unavailable, not zero.',cashNote:null};
  if(card==='health') {
    const {rows} = await readMergedHistory(db,[clientId],from,today,tenantId);
    result.cash=rows.filter(r=>r.as_at>=addMonths(today,-12)).map(r=>({date:r.as_at,value:r.cash===null?null:Number(r.cash)}));
    // Display-only context: where the bank would stand if everything coded
    // were reconciled. The ledger figure is never replaced by this.
    const {data: latest} = await db.from('client_key_figures').select('cash, bank_reconciliation').eq('client_id',clientId).eq('tenant_id',tenantId).order('as_at',{ascending:false}).limit(1);
    const kf = (latest??[])[0];
    if(kf) {
      const { parseStored, statementPosition } = await import('@/lib/overview/bank-reconciliation');
      const pos = statementPosition(parseStored(kf.bank_reconciliation), kf.cash===null?null:Number(kf.cash));
      if(pos) {
        const aud = (n:number)=>n.toLocaleString('en-AU',{style:'currency',currency:'AUD',signDisplay:'negative'});
        result.cashNote = `Reconciled bank position ${aud(pos.reconciled)} — ${aud(Math.abs(pos.unreconciled))} not yet reconciled in Xero (last 90 days).`;
      }
    }
    // No historical health scores are stored; never infer them from incomplete old snapshots.
    result.note+=' Cash includes nightly observations and backfilled month-ends using the bank settings at capture. Historical health scores are not stored.';
  }
  if(card==='receivables') {
    const {data,error}=await db.from('client_key_figures').select('as_at,debtors_overdue').eq('client_id',clientId).eq('tenant_id',tenantId).gte('as_at',from).lte('as_at',today).order('as_at').limit(500);
    if(error) throw new Error('Chart history is unavailable.');
    result.overdue=(data??[]).map((r:any)=>({date:r.as_at,value:r.debtors_overdue===null?null:Number(r.debtors_overdue)}));
  }
  if(card==='pnl') {
    const { wageAccountNames, wagesFromSections } = await import('@/lib/wages-split');
    const marks = await db.from('account_setup_cost_v').select('account_name,classification,is_wages').eq('client_id',clientId).eq('tenant_id',tenantId);
    const names = wageAccountNames(marks.data);
    result.wagesSplit = names.size > 0;
    const [reports,snapshots,filled] = await Promise.all([
      db.from('client_reports').select('id,period_end,version,payload').eq('client_id',clientId).eq('tenant_id',tenantId).eq('report_key','monthly_management').in('status',['final','sent']).gte('period_end',from).lte('period_end',today).order('period_end').order('version',{ascending:false}).limit(500),
      db.from('xero_snapshots').select('payload,params,as_at,fetched_at').eq('client_id',clientId).eq('tenant_id',tenantId).eq('report_key','profit_and_loss_mtd').eq('complete',true).gte('as_at',from).order('fetched_at',{ascending:false}).limit(500),
      db.from('client_figure_history').select('month_end,net_profit,income,expenses').eq('client_id',clientId).eq('tenant_id',tenantId).gte('month_end',from).lte('month_end',today).order('month_end').limit(20),
    ]);
    if(reports.error||snapshots.error||filled.error) throw new Error('Chart history is unavailable.');
    const months = new Map<string,PnlObservation>();
    const num=(v:any)=>v===null||v===undefined?null:Number(v);
    // Backfill currently uses accrual. Never blend it into a cash-basis chart.
    if(basis==='accrual') for(const r of filled.data??[]) months.set(r.month_end.slice(0,7),{date:r.month_end,income:num(r.income),expenses:num(r.expenses),profit:num(r.net_profit),partial:false,source:'Xero month-end backfill',basis});
    for(const r of reports.data??[]) {
      const totals=r.payload?.profitAndLoss?.totals;
      // This report generator historically requests accrual; explicit future basis wins.
      if(!totals || (r.payload?.basis??'accrual')!==basis || months.get(r.period_end.slice(0,7))?.income!==null && months.get(r.period_end.slice(0,7))?.income!==undefined) continue;
      months.set(r.period_end.slice(0,7),{date:r.period_end,income:totals.revenue+totals.otherIncome,expenses:totals.costOfSales+totals.expenses,profit:totals.netProfit,wages:names.size&&typeof totals.wages==='number'?totals.wages:null,partial:false,source:'Stored monthly report',basis});
    }
    for(const r of snapshots.data??[]) {
      const params=r.params??{}, date=params.toDate;
      if(typeof date!=='string' || params.fromDate!==date.slice(0,7)+'-01' || date>today || ((params.paymentsOnly==='true')?'cash':'accrual')!==basis) continue;
      const key=date.slice(0,7), old=months.get(key);
      if(old?.income!==null && old?.income!==undefined && old.date>=date) continue;
      const report=r.payload?.Reports?.[0];if(!report) continue;
      const parsed=parsePnl(report,endOfMonth(date));
      const totals=totalsForPeriod(parsed,0);
      months.set(key,{date,income:totals.revenue+totals.otherIncome,expenses:totals.costOfSales+totals.expenses,profit:totals.netProfit,wages:wagesFromSections(parsed.sections,0,names),partial:date!==endOfMonth(date),source:'Stored P&L snapshot',basis});
    }
    result.pnl=[...months.values()].sort((a,b)=>a.date.localeCompare(b.date));
    result.note+=' * Month-to-date is partial. Profit-only backfill has no income/expense breakdown. Unknown report bases are not mixed.';
  }
  return result;
}