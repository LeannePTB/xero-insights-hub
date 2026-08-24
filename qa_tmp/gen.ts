import { renderMonthlyReportPdf } from "../src/lib/reports/report-pdf.server";
const buckets=["Current","1–30 days","31–60 days","61–90 days","90+ days"];
const rows=(n:number,p:string)=>Array.from({length:n},(_,i)=>({name:`${p} Pty Ltd with a fairly long trading name ${i+1}`,buckets:[1234.5,-200.25,3000,0,150.75],total:4185,pctOfTotal:100/n}));
const payload:any={payloadVersion:3,complete:false,failedSections:[{section:"income_vs_expenses",message:"Xero returned 400 for Reports/ProfitAndLoss over the 12-month window; the section could not be built."}],
meta:{organisationName:"Positive Traction Bookkeeping",clientName:"Autotek NSW",tenantName:"Autotek NSW Pty Ltd",tenantId:"t",periodEnd:"2026-07-31",monthStart:"2026-07-01",monthLabel:"Jul 2026",fyStart:"2026-07-01",fyLabel:"FY27",priorFyLabel:"FY26",currency:"AUD",generatedAt:"2026-08-24T03:00:00Z"},
keyFigures:[{key:"revenue",label:"Revenue",unit:"money",month:71300,priorMonth:64000,monthVariance:7300,monthVariancePct:11.4,fyYtd:71300,priorFyYtd:52000,ytdVariance:19300,ytdVariancePct:37.1,sentence:"Revenue of $71,300 in Jul 2026, up 11.4% on the prior month."},
{key:"net_margin",label:"Net margin",unit:"percent",month:-27.1,priorMonth:3.2,monthVariance:-30.3,monthVariancePct:null,fyYtd:-27.1,priorFyYtd:4.0,ytdVariance:-31.1,ytdVariancePct:null,sentence:"Net margin of (27.1%) — the business ran at a loss this month."}],
profitAndLoss:{monthLabel:"Jul 2026",priorMonthLabel:"Jun 2026",fyLabel:"FY27 YTD",lines:Array.from({length:40},(_,i)=>({name:i%7===0?`Total section ${i}`:`Some quite long expense account name ${i}`,section:"exp",isTotal:i%7===0,month:-1234.56*(i+1),priorMonth:900*i,variance:-300*i,variancePct:i?-12.3:null,fyYtd:-2000*i})),totals:{revenue:71300,otherIncome:0,costOfSales:32000,grossProfit:39300,expenses:19350,netProfit:-19300,netMargin:-27.1}},
incomeVsExpenses:null,
receivables:{asAt:"2026-07-31",bucketLabels:buckets,rows:rows(9,"Customer"),totals:[1,2,3,4,5],total:31794.12,caveat:"Ageing is reconstructed as at 31 July 2026 from documents open at that date."},
payables:{asAt:"2026-07-31",bucketLabels:buckets,rows:rows(17,"Supplier"),totals:[1,2,3,4,5],total:114310.25,caveat:"Ageing is reconstructed as at 31 July 2026 from documents open at that date."},
notes:[{body:"Long note ".repeat(40),author:"Leanne",createdAt:"2026-08-01T00:00:00Z"},{body:"Short note.",author:"Sam",createdAt:"2026-07-20T00:00:00Z"}]};
for (const st of ["draft","final"]) {
  const b=renderMonthlyReportPdf({payload,status:st,version:3,title:"t",orgLogo:null,clientLogo:null});
  await Bun.write(`/tmp/qa/${st}.pdf`, b);
  console.log(st, b.length);
}
