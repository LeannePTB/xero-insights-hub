import { test, expect } from 'bun:test';
import { ageingPoints, pnlPoints } from './standard';
test('five ageing buckets retain their exact amounts and exclude settled invoices', () => {
  expect(ageingPoints([{daysOverdue:0,amountDue:10},{daysOverdue:30,amountDue:20},{daysOverdue:60,amountDue:30},{daysOverdue:90,amountDue:40},{daysOverdue:91,amountDue:50},{daysOverdue:1,amountDue:-2}]).map(p=>p.values[0])).toEqual([10,20,30,40,50]);
});
test('profit-only backfill never invents income and expense bars', () => {
  const points=pnlPoints([{date:'2026-09-30',income:null,expenses:null,profit:764,partial:false,source:'backfill'}],'2026-10-14');
  expect(points.find(p=>p.label==='2026-09')?.values).toEqual([null,null,764]);
  expect(points[0].values).toEqual([null,null,null]);
});
test('month to date is marked partial and a genuine zero stays zero', () => {
  expect(pnlPoints([{date:'2026-10-14',income:0,expenses:0,profit:0,partial:true,source:'daily'}],'2026-10-14').at(-1)).toEqual({label:'2026-10 *',values:[0,0,0]});
});