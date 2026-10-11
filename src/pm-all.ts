import { analyseBalanceSheet, buildProtectedMoney, statutoryOverrideMap } from "@/lib/xero/tax-lines";
import { execSync } from "child_process";
const q=(s:string)=>execSync(`psql -At -c "${s}"`,{maxBuffer:1e9}).toString();
for (const line of q("select id||'|'||name from clients").trim().split("\n")) {
  const [c,n]=line.split("|");
  const bsr=q(`select payload from xero_snapshots where client_id='${c}' and report_key='balance_sheet' order by fetched_at desc limit 1`).trim();
  const acr=q(`select payload from xero_snapshots where client_id='${c}' and report_key='accounts' order by fetched_at desc limit 1`).trim();
  if(!bsr||!acr) continue;
  const ov=JSON.parse(q(`select coalesce(json_agg(t),'[]') from client_statutory_accounts t where client_id='${c}'`));
  const a=analyseBalanceSheet(JSON.parse(bsr),JSON.parse(acr),statutoryOverrideMap(ov));
  if(a.taxLines.status!=="assessed") continue;
  const pm=buildProtectedMoney("d",a.taxLines.lines);
  const all=pm.components.flatMap(x=>x.status==="resolved"?x.accounts:[]);
  const old=all.reduce((s,x)=>s+x.amount,0);
  const cash=a.cashAtBank.status==="assessed"?a.cashAtBank.total:null;
  if(Math.abs(old-pm.total)>0.005||pm.total<0) console.log([n,all.map(x=>`${x.name} ${x.amount}${x.counted?"":"*"}`).join("; "),old.toFixed(2),pm.total.toFixed(2),cash?.toFixed(2),cash&&cash>0&&pm.total>=0?(pm.total/cash*100).toFixed(0)+"%":"—"].join(" | "));
}
