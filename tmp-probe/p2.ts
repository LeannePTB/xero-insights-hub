import { getConnectionByTenant } from "@/lib/xero/api.server";
import { fetchPayRuns, payRunsInPeriod } from "@/lib/xero/payroll.server";
import { computeGstReconciliation } from "@/lib/xero/gst.server";
const conn = await getConnectionByTenant("7a684121-3a8f-4162-aef9-d176b55571a1");
const runs = await fetchPayRuns(conn);
console.log("status", runs.status, runs.status === "available" ? runs.payRuns.length : "");
if (runs.status === "available") {
  console.log(runs.payRuns.slice(0,3));
  console.log("in Jun-q", payRunsInPeriod(runs.payRuns, "2026-04-01", "2026-06-30").map(r=>[r.paymentDate,r.tax,r.super]));
}
const g = await computeGstReconciliation(conn, "2026-06-30", "quarter");
console.log({period:[g.periodFrom,g.periodTo], sales:g.gstOnSales, purch:g.gstOnPurchases, paygPayroll:g.paygPayroll, est:g.estimatedPayable, complete:g.complete, issues:g.issues});
