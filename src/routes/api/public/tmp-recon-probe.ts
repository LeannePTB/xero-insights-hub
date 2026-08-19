// TEMPORARY verification endpoint — deleted immediately after the one-off
// 30 June reconciliation check. Requires a one-time shared token.
import { createFileRoute } from "@tanstack/react-router";

const TOKEN = "b1f0c2a7-probe-9d4e-only";

export const Route = createFileRoute("/api/public/tmp-recon-probe")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("t") !== TOKEN) return new Response("nope", { status: 404 });
        const tenantId = url.searchParams.get("tenant") ?? "";
        const asAt = url.searchParams.get("asAt") ?? "2026-06-30";
        try {
          const { getConnectionByTenant } = await import("@/lib/xero/api.server");
          const { computeBalanceSheetReconciliation } = await import(
            "@/lib/xero/reconciliation.server"
          );
          const conn = await getConnectionByTenant(tenantId);
          if (url.searchParams.get("raw")) {
            const { xeroGet } = await import("@/lib/xero/api.server");
            const cn = await xeroGet<any>(conn, "CreditNotes", { where: 'Status!="DELETED"&&Status!="VOIDED"&&Status!="DRAFT"' });
            const op = await xeroGet<any>(conn, "Overpayments", {});
            const pp = await xeroGet<any>(conn, "Prepayments", {});
            const pay = await xeroGet<any>(conn, "Payments", { where: 'Status=="AUTHORISED"' });
            return Response.json({
              creditNotes: (cn.CreditNotes ?? []).map((c: any) => ({ id: c.CreditNoteID, type: c.Type, date: c.Date, total: c.Total, remaining: c.RemainingCredit, allocs: (c.Allocations ?? []).map((a: any) => ({ amt: a.Amount, date: a.Date, inv: a.Invoice?.InvoiceID })) })),
              overpayments: (op.Overpayments ?? []).map((c: any) => ({ id: c.OverpaymentID, type: c.Type, date: c.Date, total: c.Total, remaining: c.RemainingCredit })),
              prepayments: (pp.Prepayments ?? []).map((c: any) => ({ id: c.PrepaymentID, type: c.Type, date: c.Date, total: c.Total, remaining: c.RemainingCredit })),
              payments: (pay.Payments ?? []).slice(0, 200).map((p: any) => ({ amt: p.Amount, date: p.Date, type: p.PaymentType, inv: p.Invoice?.InvoiceID, invType: p.Invoice?.Type, cn: p.CreditNote?.CreditNoteID, op: p.Overpayment?.OverpaymentID, pp: p.Prepayment?.PrepaymentID })),
            });
          }
          const result = await computeBalanceSheetReconciliation(conn, asAt);
          return Response.json(result);
        } catch (e) {
          return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
        }
      },
    },
  },
});
