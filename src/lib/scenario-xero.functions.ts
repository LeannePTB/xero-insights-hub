import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type XeroInvoice = {
  InvoiceID: string;
  Type: string;
  Status: string;
  Date?: string;
  DueDate?: string;
  Total?: number;
  AmountDue?: number;
  Reference?: string;
  InvoiceNumber?: string;
  Contact?: { ContactID?: string; Name?: string };
};

function parseXeroDate(s?: string): Date | null {
  if (!s) return null;
  const m = s.match(/\/Date\((-?\d+)/);
  if (m) return new Date(parseInt(m[1] as string, 10));
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Maps a Xero invoice to the scenario status set. */
function statusFor(inv: XeroInvoice): "Paid" | "Pending" | "Overdue" {
  const s = (inv.Status ?? "").toUpperCase();
  if (s === "PAID") return "Paid";
  const due = parseXeroDate(inv.DueDate);
  if (due && due.getTime() < Date.now()) return "Overdue";
  return "Pending";
}

export const importScenarioFromXero = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { clientId: string; tenantId: string; monthsBack?: number }) => i)
  .handler(async ({ data, context }) => {
    const { getConnectionByTenant, xeroGet } = await import("@/lib/xero/api.server");
    const { assertWidgetAccess } = await import("@/lib/xero/access.server");
    await assertWidgetAccess(context.userId, data.tenantId, "cashflow_scenario");

    const months = Math.min(Math.max(data.monthsBack ?? 6, 1), 24);
    const from = new Date();
    from.setDate(1);
    from.setMonth(from.getMonth() - (months - 1));

    const conn = await getConnectionByTenant(data.tenantId);
    const where = `Type=="ACCREC"&&Status!="VOIDED"&&Status!="DELETED"&&Status!="DRAFT"&&Date>=DateTime(${from.getFullYear()},${from.getMonth() + 1},1)`;

    const invoices: XeroInvoice[] = [];
    for (let page = 1; page <= 10; page++) {
      const res = await xeroGet<{ Invoices?: XeroInvoice[] }>(conn, "Invoices", {
        where,
        page: String(page),
        order: "Date ASC",
      });
      const batch = res.Invoices ?? [];
      invoices.push(...batch);
      if (batch.length < 100) break;
    }

    const sb = context.supabase as any;

    // Existing customers, matched by name (case-insensitive).
    const { data: existingCustomers, error: cErr } = await sb
      .from("scenario_customers")
      .select("id, name")
      .eq("client_id", data.clientId);
    if (cErr) throw new Error(cErr.message);
    const byName = new Map<string, string>(
      ((existingCustomers ?? []) as any[]).map((c) => [String(c.name).toLowerCase(), c.id as string]),
    );

    const neededNames = new Set<string>();
    for (const inv of invoices) {
      const name = (inv.Contact?.Name ?? "").trim();
      if (name && !byName.has(name.toLowerCase())) neededNames.add(name);
    }
    if (neededNames.size > 0) {
      const { data: created, error } = await sb
        .from("scenario_customers")
        .insert([...neededNames].map((name) => ({ client_id: data.clientId, name })))
        .select("id, name");
      if (error) throw new Error(error.message);
      for (const c of (created ?? []) as any[]) byName.set(String(c.name).toLowerCase(), c.id as string);
    }

    // Existing Xero-sourced invoices so exclusions survive a re-import.
    const { data: existingInvoices, error: iErr } = await sb
      .from("scenario_invoices")
      .select("id, xero_invoice_id")
      .eq("client_id", data.clientId)
      .not("xero_invoice_id", "is", null);
    if (iErr) throw new Error(iErr.message);
    const existingByXeroId = new Map<string, string>(
      ((existingInvoices ?? []) as any[]).map((r) => [r.xero_invoice_id as string, r.id as string]),
    );

    let created = 0;
    let updated = 0;
    const toInsert: any[] = [];

    for (const inv of invoices) {
      const issued = parseXeroDate(inv.Date);
      if (!issued) continue;
      const name = (inv.Contact?.Name ?? "").trim();
      const row = {
        customer_id: name ? (byName.get(name.toLowerCase()) ?? null) : null,
        description: inv.Reference?.trim() || inv.InvoiceNumber || "Xero invoice",
        amount: Number(inv.Total ?? 0),
        issue_date: iso(issued),
        status: statusFor(inv),
      };
      const existingId = existingByXeroId.get(inv.InvoiceID);
      if (existingId) {
        const { error } = await sb.from("scenario_invoices").update(row).eq("id", existingId);
        if (error) throw new Error(error.message);
        updated++;
      } else {
        toInsert.push({
          client_id: data.clientId,
          xero_invoice_id: inv.InvoiceID,
          xero_tenant_id: data.tenantId,
          ...row,
        });
      }
    }

    if (toInsert.length > 0) {
      const { error } = await sb.from("scenario_invoices").insert(toInsert);
      if (error) throw new Error(error.message);
      created = toInsert.length;
    }

    return { created, updated, total: invoices.length };
  });
