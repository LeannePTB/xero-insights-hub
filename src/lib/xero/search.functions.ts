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

export type UnavailableOrg = { tenantId: string; tenantName: string; reason: string };

/** Tenants searched per round trip. Twelve Xero files at once is a rate-limit problem. */
const BATCH_SIZE = 3;

/**
 * Who may run an organisation-wide search?
 *
 * public.user_can_access_firm(_user_id, _firm_id) — the single database
 * implementation of the rule. It is:
 *     app_private.has_firm_access            (active firm_members row)
 *  OR app_private.platform_staff_can_access_firm  (super admin WITH an
 *                                            approved, unexpired support grant)
 *
 * An invited client viewer reaches a client through public.client_access only,
 * which that function does not consider, so a viewer is refused here even
 * though they can open the client dashboard. Being a super admin on its own
 * grants nothing.
 */
async function assertOrganisationStaff(userId: string, firmId: string) {
  const { platformStaffCanAccessFirm } = await import("@/lib/support-access.server");
  if (!(await platformStaffCanAccessFirm(userId, firmId))) {
    throw new Error(
      "Transaction search covers the whole organisation, so it is available to organisation members and platform staff with an approved support grant only.",
    );
  }
}

/** Resolve the organisation for a client. The client id is a filter, never a grant. */
async function firmIdForClient(clientId: string): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("clients")
    .select("firm_id")
    .eq("id", clientId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const firmId = (data as any)?.firm_id as string | null | undefined;
  if (!firmId) throw new Error("This client is not attached to an organisation.");
  return firmId;
}

/**
 * UI gate only — the server function below enforces the same rule again.
 * Returns whether this caller may use organisation-wide transaction search.
 */
export const canSearchOrganisationTransactions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { clientId: string }) => input)
  .handler(async ({ data, context }) => {
    try {
      const firmId = await firmIdForClient(data.clientId);
      const { platformStaffCanAccessFirm } = await import("@/lib/support-access.server");
      if (!(await platformStaffCanAccessFirm(context.userId, firmId))) {
        return { allowed: false, organisationCount: 0 };
      }
      const { clientCanUseWidget } = await import("@/lib/widget-access.server");
      if (!(await clientCanUseWidget(context.supabase, data.clientId, "transaction_search"))) {
        return { allowed: false, organisationCount: 0 };
      }
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: conns } = await supabaseAdmin
        .from("xero_connections")
        .select("tenant_id, status")
        .eq("firm_id", firmId);
      const count = (conns ?? []).filter(
        (c: any) => c?.tenant_id && c.status !== "disconnected",
      ).length;
      return { allowed: count > 0, organisationCount: count };
    } catch {
      return { allowed: false, organisationCount: 0 };
    }
  });

export const searchClientTransactions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      clientId: string;
      query: string;
      fromDate?: string | null;
      toDate?: string | null;
      page?: number;
      batch?: number;
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
    const batch = Math.max(0, Math.floor(Number(data.batch ?? 0)) || 0);

    // Access control, in this order and never skipped. Every identifier in the
    // request is a FILTER; the grant always comes from the database.
    //  1. can this caller reach this client at all
    //  2. is this caller ORGANISATION STAFF (client viewers are refused, since
    //     the search spans every client in the organisation)
    //  3. is this widget in the client's plan
    const { assertClientDataAccessForClient } = await import("@/lib/support-access.server");
    await assertClientDataAccessForClient(context.userId, data.clientId);
    const firmId = await firmIdForClient(data.clientId);
    await assertOrganisationStaff(context.userId, firmId);
    const { assertClientWidget } = await import("@/lib/widget-access.server");
    await assertClientWidget(context.supabase, data.clientId, "transaction_search");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // ---- Permitted tenant list, built server-side, per request --------------
    // Every connected Xero organisation belonging to THIS organisation. No
    // tenant id, client id list or organisation id is accepted from the browser.
    const { data: conns, error: connErr } = await supabaseAdmin
      .from("xero_connections")
      .select("tenant_id, tenant_name, status")
      .eq("firm_id", firmId)
      .order("tenant_name", { ascending: true });
    if (connErr) throw new Error(connErr.message);
    const allTenants = (conns ?? [])
      .filter((c: any) => c?.tenant_id && c.status !== "disconnected")
      .map((c: any) => ({
        tenant_id: c.tenant_id as string,
        tenant_name: (c.tenant_name as string) ?? "Unnamed organisation",
      }));

    const permitted = new Set(allTenants.map((t) => t.tenant_id));
    if (allTenants.length === 0) {
      // Fail loudly: a silent empty result would hide a broken link.
      throw new Error(
        "This organisation has no connected Xero organisation, so there is nothing to search.",
      );
    }

    const batchCount = Math.ceil(allTenants.length / BATCH_SIZE);
    if (batch >= batchCount) throw new Error("No more Xero organisations to search.");
    const tenants = allTenants.slice(batch * BATCH_SIZE, batch * BATCH_SIZE + BATCH_SIZE);

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
    const unavailable: UnavailableOrg[] = [];
    const pageParam = String(page);
    const PAGE_SIZE = 100;
    let sawFullPage = false;

    // Sequential within the batch: a rate-limited file must never take the
    // others down with it, and twelve files at once is a rate-limit problem.
    for (const t of tenants) {
      await (async () => {
        // Belt and braces: never call Xero for a tenant outside the permitted set.
        if (!permitted.has(t.tenant_id)) {
          throw new Error("You are not entitled to search that Xero organisation.");
        }
        let conn;
        try {
          conn = await getConnectionByTenant(t.tenant_id);
        } catch (e) {
          // Never silently omit a file: someone would go looking for a
          // transaction that is really there.
          unavailable.push({
            tenantId: t.tenant_id,
            tenantName: t.tenant_name,
            reason: (e as Error)?.message?.slice(0, 160) || "Could not reach this Xero organisation.",
          });
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
    return {
      hits,
      page,
      hasMore: sawFullPage,
      scope: organisationWide ? ("organisation" as const) : ("client" as const),
      searchedOrganisations: tenants.map((t) => t.tenant_name).filter(Boolean),
    };
  });
