import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AgeingBucket = {
  label: string;
  count: number;
  amount: number;
};

export type AgedPayables = {
  asOf: string;
  totalOutstanding: number;
  totalOverdue: number;
  invoiceCount: number;
  buckets: AgeingBucket[];
  topSuppliers: { name: string; amount: number }[];
};

type XeroInvoice = {
  InvoiceID: string;
  Type: "ACCPAY" | "ACCREC";
  Status: string;
  DueDate?: string;
  AmountDue: number;
  Contact?: { Name?: string };
};

function bucketFor(daysOverdue: number): string {
  if (daysOverdue <= 0) return "Current";
  if (daysOverdue <= 30) return "1–30 days";
  if (daysOverdue <= 60) return "31–60 days";
  if (daysOverdue <= 90) return "61–90 days";
  return "90+ days";
}

// Xero serialises dates like "/Date(1700000000000+0000)/"
function parseXeroDate(s?: string): Date | null {
  if (!s) return null;
  const m = s.match(/\/Date\((-?\d+)/);
  if (m) return new Date(parseInt(m[1], 10));
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export const getAgedPayables = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string }) => input)
  .handler(async ({ data, context }) => {
    const { getConnectionByTenant, xeroGet } = await import("./api.server");
    const { assertWidgetAccess } = await import("./access.server");
    await assertWidgetAccess(context.userId, data.tenantId, "payables");
    const conn = await getConnectionByTenant(data.tenantId);

    // Fetch all unpaid bills (ACCPAY = supplier invoices)
    // Paginate up to 5 pages (500 invoices) to keep response fast.
    const invoices: XeroInvoice[] = [];
    for (let page = 1; page <= 5; page++) {
      const res = await xeroGet<{ Invoices?: XeroInvoice[] }>(conn, "Invoices", {
        where: 'Type=="ACCPAY"&&Status!="PAID"&&Status!="VOIDED"&&Status!="DELETED"&&Status!="DRAFT"',
        page: String(page),
        order: "DueDate ASC",
      });
      const batch = res.Invoices ?? [];
      invoices.push(...batch);
      if (batch.length < 100) break;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const labels = ["Current", "1–30 days", "31–60 days", "61–90 days", "90+ days"];
    const bucketMap = new Map<string, AgeingBucket>(
      labels.map((l) => [l, { label: l, count: 0, amount: 0 }]),
    );
    const supplierMap = new Map<string, number>();

    let totalOutstanding = 0;
    let totalOverdue = 0;

    for (const inv of invoices) {
      const due = parseXeroDate(inv.DueDate);
      const amount = Number(inv.AmountDue) || 0;
      if (amount <= 0) continue;
      const daysOverdue = due
        ? Math.floor((today.getTime() - due.getTime()) / 86400000)
        : 0;
      const label = bucketFor(daysOverdue);
      const b = bucketMap.get(label)!;
      b.count += 1;
      b.amount += amount;
      totalOutstanding += amount;
      if (daysOverdue > 0) totalOverdue += amount;

      const supplier = inv.Contact?.Name ?? "Unknown";
      supplierMap.set(supplier, (supplierMap.get(supplier) ?? 0) + amount);
    }

    const topSuppliers = [...supplierMap.entries()]
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    const result: AgedPayables = {
      asOf: today.toISOString().slice(0, 10),
      totalOutstanding,
      totalOverdue,
      invoiceCount: invoices.filter((i) => (Number(i.AmountDue) || 0) > 0).length,
      buckets: labels.map((l) => bucketMap.get(l)!),
      topSuppliers,
    };
    return result;
  });
