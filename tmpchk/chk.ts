import { evaluateClient } from "@/lib/health/rules.server";
import { execSync } from "child_process";
const cid='8b7b6b31-d709-4ce9-8524-5031266a5c47';
const q=(s:string)=>JSON.parse(execSync(`psql -At -c "${s}"`,{maxBuffer:1e9}).toString()||"[]");
const snaps=q(`select coalesce(json_agg(t),'[]') from (select distinct on (report_key) * from xero_snapshots where client_id='${cid}' order by report_key, fetched_at desc) t`);
const v=evaluateClient({clientId:cid,connections:[{tenantId:snaps[0].tenant_id,status:'connected'}],snapshots:snaps,now:new Date()},{statutoryOverrides:new Map(),gstRegistered:false,withholdsPayg:false});
console.log(v.label, JSON.stringify((v as any).gaps));
