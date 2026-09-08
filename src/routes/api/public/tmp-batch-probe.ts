// TEMPORARY diagnostic route. Reports only FIELD NAMES from the Xero Payments
// payload — no amounts, ids, names or tokens — so we can establish whether a
// BatchPayment object is present. Delete immediately after use.
import { createFileRoute } from "@tanstack/react-router";

const TENANT_ID = "7a684121-3a8f-4162-aef9-d176b55571a1";

export const Route = createFileRoute("/api/public/tmp-batch-probe")({
  server: {
    handlers: {
      GET: async () => {
        const { getConnectionByTenant, xeroGet } = await import("@/lib/xero/api.server");
        const conn = await getConnectionByTenant(TENANT_ID);
        const since = new Date(Date.now() - 365 * 86_400_000).toISOString();
        const res = await xeroGet<any>(conn, "Payments", {
          where: `Status=="AUTHORISED"&&Date>=DateTime(${since.slice(0, 10).replace(/-/g, ",")})`,
        });
        const payments: any[] = res?.Payments ?? [];
        const keys = new Set<string>();
        const invoiceKeys = new Set<string>();
        let withBatch = 0;
        let withInvoiceType = 0;
        for (const p of payments) {
          for (const k of Object.keys(p ?? {})) keys.add(k);
          for (const k of Object.keys(p?.Invoice ?? {})) invoiceKeys.add(k);
          if (p?.BatchPayment?.BatchPaymentID) withBatch++;
          if (p?.Invoice?.Type) withInvoiceType++;
        }
        const { rulePayments } = await import("@/lib/xero/audit/rules.server");
        const findings = rulePayments(payments as any, "SC");
        const cases: Record<string, number> = {};
        for (const f of findings) cases[String((f.evidence as any).case)] = (cases[String((f.evidence as any).case)] ?? 0) + 1;
        return Response.json({
          findings: findings.length,
          cases,
          withLink: findings.filter((f) => f.deepLink).length,
          total: payments.length,
          paymentKeys: [...keys].sort(),
          invoiceKeys: [...invoiceKeys].sort(),
          withBatch,
          withInvoiceType,
        });
      },
    },
  },
});
