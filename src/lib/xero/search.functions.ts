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
  .inputValidator(
    (input: {
      clientId: string;
      query: string;
      fromDate?: string | null;
      toDate?: string | null;
      page?: number;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const query = data.query.trim();
    if (query.length > 200) throw new Error("Search query is too long.");
    const isoRe = /^\d{4}-\d{2}-\d{2}$/;
    const fromDate = data.fromDate && isoRe.test(data.fromDate) ? data.fromDate : null;
    const toDate = data.toDate && isoRe.test(data.toDate) ? data.toDate : null;
    if (!query && !fromDate && !toDate) {
      throw new Error("Enter a search term or a date range before searching.");
    }
    const page = Math.max(1, Math.min(50, Math.floor(Number(data.page ?? 1)) || 1));

    // Access control, in this order and never skipped:
    //  1. can this caller reach this client at all (database decides)
    //  2. is this widget in the client's plan (database decides)
    // The client id from the request is a FILTER, never a GRANT.
    const { assertClientDataAccessForClient } = await import("@/lib/support-access.server");
    await assertClientDataAccessForClient(context.userId, data.clientId);
    const { assertClientWidget } = await import("@/lib/widget-access.server");
    await assertClientWidget(context.supabase, data.clientId, "transaction_search");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: orgs, error } = await supabaseAdmin
      .from("client_xero_orgs")
      .select("xero_connections!inner(tenant_id, tenant_name)")
      .eq("client_id", data.clientId);
    if (error) throw new Error(error.message);
    const tenants = (orgs ?? [])
      .map((o: any) => o.xero_connections)
      .filter((t: any) => t?.tenant_id) as { tenant_id: string; tenant_name: string }[];
    if (tenants.length === 0) {
      // Fail loudly: a silent empty result would hide a broken link.
      throw new Error("This client has no Xero organisation linked, so there is nothing to search.");
    }

    const { getConnectionByTenant, xeroGet } = await import("./api.server");

    function dateClauses() {
      const parts: string[] = [];
      if (fromDate) {
        const [y, m, d] = fromDate.split("-").map(Number);
        parts.push(`Date >= DateTime(${y}, ${m}, ${d})`);
      }
      if (toDate) {
        const [y, m, d] = toDate.split("-").map(Number);
        parts.push(`Date <= DateTime(${y}, ${m}, ${d})`);
      }
      return parts;
    }
    function combine(textClause: string | null): string {
      const parts = dateClauses();
      if (textClause) parts.push(`(${textClause})`);
      return parts.join(" AND ");
    }

    const q = esc(query);
    const qLower = esc(query.toLowerCase());
    const invoicesText = query
      ? `(Contact.Name!=null AND Contact.Name.ToLower().Contains("${qLower}")) OR (InvoiceNumber!=null AND InvoiceNumber.Contains("${q}")) OR (Reference!=null AND Reference.Contains("${q}"))`
      : null;
    const creditNotesText = query
      ? `(Contact.Name!=null AND Contact.Name.ToLower().Contains("${qLower}")) OR (CreditNoteNumber!=null AND CreditNoteNumber.Contains("${q}")) OR (Reference!=null AND Reference.Contains("${q}"))`
      : null;
    const prepaymentsText = query
      ? `(Contact.Name!=null AND Contact.Name.ToLower().Contains("${qLower}")) OR (Reference!=null AND Reference.Contains("${q}"))`
      : null;
    const overpaymentsText = query
      ? `Contact.Name!=null AND Contact.Name.ToLower().Contains("${qLower}")`
      : null;

    const invoicesWhere = combine(invoicesText);
    const creditNotesWhere = combine(creditNotesText);
    const prepaymentsWhere = combine(prepaymentsText);
    const overpaymentsWhere = combine(overpaymentsText);

    function isExcludedStatus(s: any) {
      const v = String(s ?? "").toUpperCase();
      return v === "DELETED" || v === "VOIDED";
    }

    const hits: SearchHit[] = [];
    const pageParam = String(page);
    const PAGE_SIZE = 100;
    let sawFullPage = false;

    await Promise.all(
      tenants.map(async (t) => {
        let conn;
        try {
          conn = await getConnectionByTenant(t.tenant_id);
        } catch {
          return;
        }

        // Fetch organisation short code so deep links open the correct org.
        let shortCode: string | null = null;
        try {
          const orgRes = await xeroGet<{ Organisations?: { ShortCode?: string }[] }>(
            conn,
            "Organisations",
          );
          shortCode = orgRes.Organisations?.[0]?.ShortCode ?? null;
        } catch {
          shortCode = null;
        }
        function deepLink(path: string): string {
          if (shortCode) {
            return `https://go.xero.com/organisationlogin/default.aspx?shortcode=${encodeURIComponent(shortCode)}&redirecturl=${encodeURIComponent(path)}`;
          }
          return `https://go.xero.com${path}`;
        }

        const [invRes, cnRes, ppRes, opRes] = await Promise.all([
          xeroGet<{ Invoices?: any[] }>(conn, "Invoices", { where: invoicesWhere, page: pageParam, order: "Date DESC" }).catch(() => ({ Invoices: [] })),
          xeroGet<{ CreditNotes?: any[] }>(conn, "CreditNotes", { where: creditNotesWhere, page: pageParam }).catch(() => ({ CreditNotes: [] })),
          xeroGet<{ Prepayments?: any[] }>(conn, "Prepayments", { where: prepaymentsWhere, page: pageParam }).catch(() => ({ Prepayments: [] })),
          xeroGet<{ Overpayments?: any[] }>(conn, "Overpayments", { where: overpaymentsWhere, page: pageParam }).catch(() => ({ Overpayments: [] })),
        ]);

        // Xero pages at 100 rows per endpoint; a full page means there is more.
        if (
          (invRes.Invoices?.length ?? 0) >= PAGE_SIZE ||
          (cnRes.CreditNotes?.length ?? 0) >= PAGE_SIZE ||
          (ppRes.Prepayments?.length ?? 0) >= PAGE_SIZE ||
          (opRes.Overpayments?.length ?? 0) >= PAGE_SIZE
        ) {
          sawFullPage = true;
        }

        for (const i of invRes.Invoices ?? []) {
          if (isExcludedStatus(i.Status)) continue;
          const isBill = i.Type === "ACCPAY";
          const path = isBill
            ? `/AccountsPayable/Edit.aspx?InvoiceID=${i.InvoiceID}`
            : `/AccountsReceivable/Edit.aspx?InvoiceID=${i.InvoiceID}`;
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
            deepLink: i.InvoiceID ? deepLink(path) : null,
          });
        }
        for (const c of cnRes.CreditNotes ?? []) {
          if (isExcludedStatus(c.Status)) continue;
          const isBillCredit = c.Type === "ACCPAYCREDIT";
          const path = isBillCredit
            ? `/AccountsPayable/ViewCreditNote.aspx?creditNoteID=${c.CreditNoteID}`
            : `/AccountsReceivable/ViewCreditNote.aspx?creditNoteID=${c.CreditNoteID}`;
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
            deepLink: c.CreditNoteID ? deepLink(path) : null,
          });
        }
        for (const p of ppRes.Prepayments ?? []) {
          if (isExcludedStatus(p.Status)) continue;
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
          if (isExcludedStatus(o.Status)) continue;
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
    return { hits, page, hasMore: sawFullPage };
  });
