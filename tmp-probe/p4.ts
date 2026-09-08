import { getConnectionByTenant } from "@/lib/xero/api.server";
import { fetchPayRuns } from "@/lib/xero/payroll.server";
import { computeGstReconciliation } from "@/lib/xero/gst.server";
const conn = await getConnectionByTenant("c1fe4172-a56b-4441-8afd-41429748539e");
console.log("payruns:", JSON.stringify(await fetchPayRuns(conn)));
const g = await computeGstReconciliation(conn, "2026-06-30", "quarter");
console.log(JSON.stringify({sales:g.gstOnSales, purchases:g.gstOnPurchases, payg:g.paygPayroll, est:g.estimatedPayable, complete:g.complete, issues:g.issues}));
