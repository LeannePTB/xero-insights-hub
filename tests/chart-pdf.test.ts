import {describe,it,expect} from 'vitest';
import {writeFileSync,mkdirSync} from 'node:fs';
import {renderMonthlyReportPdf} from '../src/lib/reports/report-pdf.server';
import type {MonthlyReportPayload} from '../src/lib/reports/monthly-report';
const payload:MonthlyReportPayload={payloadVersion:12,complete:true,failedSections:[],meta:{organisationName:'Synthetic organisation',clientName:'Synthetic client',tenantName:'Synthetic file',tenantId:'synthetic',periodEnd:'2026-09-30',monthStart:'2026-09-01',monthLabel:'September 2026',fyStart:'2026-07-01',fyLabel:'2027',priorFyLabel:'2026',currency:'AUD',generatedAt:'2026-10-14T00:00:00Z'},keyFigures:[],profitAndLoss:null,receivables:null,payables:null,notes:[],charts:{cash:[{date:'2026-08-31',label:'2026-08',value:1000,source:'synthetic'},{date:'2026-09-30',label:'2026-09',value:2000,source:'synthetic'}],profit:[{date:'2026-08-31',label:'2026-08',value:-100,source:'synthetic'},{date:'2026-09-30',label:'2026-09',value:300,source:'synthetic'}],note:'Synthetic stored history'}};
describe('frozen PDF chart rendering',()=>{
 it('renders a synthetic Standard sample with P&L and ageing data',()=>{
   const sample:MonthlyReportPayload=structuredClone(payload);
   sample.meta.clientName='Demo Company (AU) — synthetic sample';
   sample.profitAndLoss={monthLabel:'September 2026',priorMonthLabel:'August 2026',fyLabel:'2027',lines:[],totals:{revenue:120000,otherIncome:0,costOfSales:40000,grossProfit:80000,expenses:50000,netProfit:30000,netMargin:25}};
   sample.keyFigures=[{key:'revenue',label:'Revenue',unit:'money',month:120000,priorMonth:110000,monthVariance:10000,monthVariancePct:9.09,fyYtd:350000,priorFyYtd:320000,ytdVariance:30000,ytdVariancePct:9.38,sentence:'Synthetic comparison.'}];
   sample.profitAndLoss.lines=[{name:'Revenue',section:'Income',isTotal:true,month:120000,priorMonth:110000,variance:10000,variancePct:9.09,fyYtd:350000}];
   const ageing={asAt:'2026-09-30',bucketLabels:['September','August','July','June','Older'],rows:[],totals:[12000,6000,3000,1000,500],total:22500,caveat:'Synthetic outstanding invoices, aged by document date.'};
   sample.receivables=ageing;sample.payables={...ageing,totals:[7000,3000,1000,500,200],total:11700};
   sample.verdict={state:'ok',headline:'Synthetic business health example',detail:'This sample contains no real client data.',findings:[],coverage:'Synthetic example only.',nextStep:null,comment:null,nonAdvice:'Not financial advice.'};
   if(sample.charts){sample.charts.profit=sample.charts.profit.map((p,i)=>({...p,value:i?30000:15000}));sample.charts.pnl=sample.charts.profit.map((p,i)=>({label:p.label,values:[i?120000:110000,i?90000:95000,p.value]}));}
   const before=JSON.stringify(sample),bytes=renderMonthlyReportPdf({payload:sample,status:'draft',version:1,title:'Standard report — synthetic sample'});
   expect(bytes.length).toBeGreaterThan(10000);expect(JSON.stringify(sample)).toBe(before);
   if(process.env['WRITE_STANDARD_SAMPLE']){mkdirSync('/tmp/browser/standard-launch',{recursive:true});writeFileSync('/tmp/browser/standard-launch/standard-sample.pdf',bytes);writeFileSync('/tmp/browser/standard-launch/standard-sample.json',JSON.stringify(sample));}
 }, 30000);
 it('renders chart payload directly to a real PDF without mutating a sent payload',()=>{const before=JSON.stringify(payload);const bytes=renderMonthlyReportPdf({payload,status:'sent',version:1,title:'Synthetic report'});expect(new TextDecoder().decode(bytes.slice(0,4))).toBe('%PDF');expect(bytes.length).toBeGreaterThan(3000);expect(JSON.stringify(payload)).toBe(before);});
 it('old final chart-less payload remains chart-less after render',()=>{const old={...payload,payloadVersion:11,charts:undefined};renderMonthlyReportPdf({payload:old,status:'final',version:1,title:'Old synthetic report'});expect(old.charts).toBeUndefined();expect(old.payloadVersion).toBe(11);});
});
