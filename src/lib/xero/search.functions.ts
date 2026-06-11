import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SearchHit = {
  tenantId: string;
  tenantName: string;
  type: "Invoice" | "Bill" | "CreditNote" | "Prepayment" | "Overpayment";
  id: string;
  number: string;
  reference: string;
  contact: string;
  date: string | null;
  dueDate: string | null;
  status: string;
  total: number;
  amountDue: number;
  currency: string;
  deepLink: string | null;
};

function parseXeroDate(s?: string): Date | null {
  if (!s) return null;
  const m = s.match(/\/Date\((-?\d+)/);
  if (m) return new Date(parseInt(m[1], 10));
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
function fmtDate(s?: string) {
  const d = parseXeroDate(s);
  return d ? d.toISOString().slice(0, 10) : null;
}
function esc(q: string) {
  // Escape double-quotes for Xero where clause
  return q.replace(/"/g, '\\"');
}

export const searchClientTransactions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { clientId: string; query: string }) => input)
  .handler(async ({ data, context }) => {
    const query = data.query.trim();
    if (!query) return { hits: [] as SearchHit[] };
    if (query.length > 200) throw new Error("Search query is too long.");

    // Advisor-only
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "advisor");
    if (!roles || roles.length === 0) throw new Error("Only advisors can search transactions.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: orgs, error } = await supabaseAdmin
      .from("client_xero_orgs")
      .select("xero_connections!inner(tenant_id, tenant_name)")
      .eq("client_id", data.clientId);
    if (error) throw new Error(error.message);
    const tenants = (orgs ?? [])
      .map((o: any) => o.xero_connections)
      .filter((t: any) => t?.tenant_id) as { tenant_id: string; tenant_name: string }[];
    if (tenants.length === 0) return { hits: [] as SearchHit[] };

    const { getConnectionByTenant, xeroGet } = await import("./api.server");

    const q = esc(query);
    const qLower = esc(query.toLowerCase());
    const invoicesWhere = `(Contact.Name!=null AND Contact.Name.ToLower().Contains("${qLower}")) OR (InvoiceNumber!=null AND InvoiceNumber.Contains("${q}")) OR (Reference!=null AND Reference.Contains("${q}"))`;
    const creditNotesWhere = `(Contact.Name!=null AND Contact.Name.ToLower().Contains("${qLower}")) OR (CreditNoteNumber!=null AND CreditNoteNumber.Contains("${q}")) OR (Reference!=null AND Reference.Contains("${q}"))`;
    const prepaymentsWhere = `(Contact.Name!=null AND Contact.Name.ToLower().Contains("${qLower}")) OR (Reference!=null AND Reference.Contains("${q}"))`;
    const overpaymentsWhere = `Contact.Name!=null AND Contact.Name.ToLower().Contains("${qLower}")`;

    const hits: SearchHit[] = [];

    await Promise.all(
      tenants.map(async (t) => {
        let conn;
        try {
          conn = await getConnectionByTenant(t.tenant_id);
        } catch {
          return;
        }

        const [invRes, cnRes, ppRes, opRes] = await Promise.all([
          xeroGet<{ Invoices?: any[] }>(conn, "Invoices", { where: invoicesWhere, page: "1", order: "Date DESC" }).catch(() => ({ Invoices: [] })),
          xeroGet<{ CreditNotes?: any[] }>(conn, "CreditNotes", { where: creditNotesWhere, page: "1" }).catch(() => ({ CreditNotes: [] })),
          xeroGet<{ Prepayments?: any[] }>(conn, "Prepayments", { where: prepaymentsWhere, page: "1" }).catch(() => ({ Prepayments: [] })),
          xeroGet<{ Overpayments?: any[] }>(conn, "Overpayments", { where: overpaymentsWhere, page: "1" }).catch(() => ({ Overpayments: [] })),
        ]);

        for (const i of invRes.Invoices ?? []) {
          const isBill = i.Type === "ACCPAY";
          hits.push({
            tenantId: t.tenant_id,
            tenantName: t.tenant_name,
            type: isBill ? "Bill" : "Invoice",
            id: i.InvoiceID,
            number: i.InvoiceNumber ?? "",
            reference: i.Reference ?? "",
            contact: i.Contact?.Name ?? "Unknown",
            date: fmtDate(i.Date),
            dueDate: fmtDate(i.DueDate),
            status: i.Status ?? "",
            total: Number(i.Total) || 0,
            amountDue: Number(i.AmountDue) || 0,
            currency: i.CurrencyCode ?? "AUD",
            deepLink: i.InvoiceID
              ? `https://go.xero.com/app/!${"_"}/invoicing/view/${i.InvoiceID}`
              : null,
          });
        }
        for (const c of cnRes.CreditNotes ?? []) {
          hits.push({
            tenantId: t.tenant_id,
            tenantName: t.tenant_name,
            type: "CreditNote",
            id: c.CreditNoteID,
            number: c.CreditNoteNumber ?? "",
            reference: c.Reference ?? "",
            contact: c.Contact?.Name ?? "Unknown",
            date: fmtDate(c.Date),
            dueDate: null,
            status: c.Status ?? "",
            total: Number(c.Total) || 0,
            amountDue: Number(c.RemainingCredit) || 0,
            currency: c.CurrencyCode ?? "AUD",
            deepLink: null,
          });
        }
        for (const p of ppRes.Prepayments ?? []) {
          hits.push({
            tenantId: t.tenant_id,
            tenantName: t.tenant_name,
            type: "Prepayment",
            id: p.PrepaymentID,
            number: "",
            reference: p.Reference ?? "",
            contact: p.Contact?.Name ?? "Unknown",
            date: fmtDate(p.Date),
            dueDate: null,
            status: p.Status ?? "",
            total: Number(p.Total) || 0,
            amountDue: Number(p.RemainingCredit) || 0,
            currency: p.CurrencyCode ?? "AUD",
            deepLink: null,
          });
        }
        for (const o of opRes.Overpayments ?? []) {
          hits.push({
            tenantId: t.tenant_id,
            tenantName: t.tenant_name,
            type: "Overpayment",
            id: o.OverpaymentID,
            number: "",
            reference: "",
            contact: o.Contact?.Name ?? "Unknown",
            date: fmtDate(o.Date),
            dueDate: null,
            status: o.Status ?? "",
            total: Number(o.Total) || 0,
            amountDue: Number(o.RemainingCredit) || 0,
            currency: o.CurrencyCode ?? "AUD",
            deepLink: null,
          });
        }
      }),
    );

    hits.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
    return { hits: hits.slice(0, 200) };
  });
