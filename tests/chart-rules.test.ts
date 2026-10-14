import {describe,it,expect} from 'vitest';
import {chartGeometry,breakEvenComparison} from '../src/lib/charts/geometry';
import {historyTotals,liabilityTotal,previousMonthDay,comparison,weeklyClosing} from '../src/lib/charts/history';
import {freezeReportCharts} from '../src/lib/charts/report-history';
const clients=[{id:'a',files:[{tenantId:'a1',currency:'AUD'},{tenantId:'a2',currency:'AUD'}]},{id:'b',files:[{tenantId:'b1',currency:'AUD'}]}];
const rows=[{client_id:'a',tenant_id:'a1',as_at:'2026-09-14',cash:100,protected_money:50},{client_id:'a',tenant_id:'a2',as_at:'2026-09-14',cash:50,protected_money:-20},{client_id:'b',tenant_id:'b1',as_at:'2026-09-14',cash:200,protected_money:-100},{client_id:'outside',tenant_id:'z',as_at:'2026-09-14',cash:999999,protected_money:999999}];
describe('chart financial rules',()=>{
 it('refunds never reduce another client liability',()=>expect(liabilityTotal([42289.06,-10608,0,null])).toEqual({value:42289.06,coverage:3}));
 it('consolidates each file once and nets refunds within one client',()=>expect(historyTotals([...rows,rows[0]],clients,'2026-09-14')).toEqual({cash:350,protectedMoney:30,coverage:2,currency:'AUD'}));
 it('does not turn missing file balances into zero',()=>expect(historyTotals(rows.slice(1),clients,'2026-09-14').cash).toBeNull());
 it('cannot combine unlike currencies',()=>expect(historyTotals(rows,[clients[0],{id:'b',files:[{tenantId:'b1',currency:'NZD'}]}],'2026-09-14').currency).toBeNull());
 it('does not use a nearby date for missing comparison',()=>expect(historyTotals(rows,clients,'2026-09-13').cash).toBeNull());
 it('uses previous month last day when date absent',()=>expect(previousMonthDay('2026-03-31')).toBe('2026-02-28'));
 it('zero baseline has dollar difference but no percentage',()=>expect(comparison(300,0)).toEqual({difference:300,pct:null}));
 it('weekly closing is not the sum of seven balances',()=>expect(weeklyClosing(Array.from({length:35},(_,i)=>({date:String(i),value:i+1})))[0]?.value).toBe(7));
 it('weekly gaps stay unavailable',()=>expect(weeklyClosing(Array.from({length:35},(_,i)=>({date:String(i),value:i===3?null:i+1})))[0]?.value).toBeNull());
 it('net line handles negative values on the same dollar axis',()=>{const g=chartGeometry([{label:'Month',values:[100,200,-100]}],[{label:'in',kind:'bar'},{label:'out',kind:'bar'},{label:'net',kind:'line'}]);expect(g.min).toBe(-100);expect(g.max).toBe(200);expect(g.series[2]?.points[0]?.y).toBeGreaterThan(g.zero);});
 it('failed projection endpoints stay null and are not interpolated',()=>{const g=chartGeometry([{label:'Now',values:[100]},{label:'30',values:[null]},{label:'60',values:[null]},{label:'90',values:[null]}],[{label:'cash',kind:'line'}]);expect(g.series[0]?.points.map(p=>p?.value??null)).toEqual([100,null,null,null]);});
 it('compares revenue and target on the same monthly basis',()=>expect(breakEvenComparison(12000,10000)).toEqual({revenue:12000,target:10000,difference:2000,pct:20}));
 it('non-positive break-even has no misleading percentage',()=>expect(breakEvenComparison(12000,0)).toBeNull());
 it('negative revenue is retained not clipped',()=>expect(breakEvenComparison(-1000,10000)?.difference).toBe(-11000));
 it('does not call intra-month observations month-end cash',()=>expect(freezeReportCharts(rows,[],{periodEnd:'2026-09-30',currency:'AUD',profit:7}).cash.every(p=>p.value===null)).toBe(true));
 it('uses one highest-version monthly profit, not YTD or daily MTD totals',()=>{
 const reports=[{id:'old',period_end:'2026-08-31',version:1,payload:{meta:{currency:'AUD'},profitAndLoss:{totals:{netProfit:100}},keyFigures:[{fyYtd:9999}]}},{id:'new',period_end:'2026-08-31',version:2,payload:{meta:{currency:'AUD'},profitAndLoss:{totals:{netProfit:-50}}}}];
 const result=freezeReportCharts([] ,reports,{periodEnd:'2026-09-30',currency:'AUD',profit:200});expect(result.profit.find(p=>p.date==='2026-08-31')?.value).toBe(-50);expect(result.profit.at(-1)?.value).toBe(200);expect(result.profit.find(p=>p.date==='2026-07-31')?.value).toBeNull();expect(reports[0].version).toBe(1);
 });
});
