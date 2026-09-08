import { getConnectionByTenant } from "@/lib/xero/api.server";
import { computeGstReconciliation } from "@/lib/xero/gst.server";
const AUTOTEK="7a684121-3a8f-4162-aef9-d176b55571a1";
const conn = await getConnectionByTenant(AUTOTEK);
const g = await computeGstReconciliation(conn, "2026-09-30", "quarter");
const p:any = g.paygPayroll;
console.log(JSON.stringify({period:[g.periodFrom,g.periodTo], sales:g.gstOnSales, purchases:g.gstOnPurchases, net:(g.gstOnSales!-g.gstOnPurchases!).toFixed(2), payg:p.status==="available"?p.withheld:p, paydays:p.payRuns?.length, est:g.estimatedPayable, complete:g.complete, issues:g.issues},null,1));
if (p.payRuns) console.log(p.payRuns.map((r:any)=>`${r.paymentDate} ${r.tax}`).join("\n"));
