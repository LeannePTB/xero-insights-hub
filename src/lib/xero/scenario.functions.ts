import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ScenarioCustomer = { id: string; name: string };

export type ScenarioInvoice = {
  id: string;
  customer_id: string | null;
  description: string;
  amount: number;
  issue_date: string;
  status: string;
  excluded: boolean;
};

export type ScenarioExpense = {
  id: string;
  name: string;
  amount: number;
  type: "Fixed" | "Variable";
  category: string;
  date: string;
};

export type ScenarioData = {
  months: string[];
  customers: ScenarioCustomer[];
  invoices: ScenarioInvoice[];
  expenses: ScenarioExpense[];
};

type XeroInvoice = {
  InvoiceID: string;
  Status?: string;
  Date?: string;
  DueDate?: string;
  Total?: number;
  Reference?: string;
  InvoiceNumber?: string;
  Contact?: { Name?: string };
};

function parseXeroDate(s?: string): Date | null {
  if (!s) return null;
  const m = s.match(/\/Date\((-?\d+)/);
  if (m) return new Date(parseInt(m[1] as string, 10));
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function monthKeyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Inclusive list of month keys between two dates, oldest first. */
function monthRange(from: Date, to: Date): string[] {
  const out: string[] = [];
  const cur = new Date(from.getFullYear(), from.getMonth(), 1);
  const end = new Date(to.getFullYear(), to.getMonth(), 1);
  while (cur <= end && out.length < 36) {
    out.push(monthKeyOf(cur));
    cur.setMonth(cur.getMonth() + 1);
  }
  return out;
}

function statusFor(inv: XeroInvoice): "Paid" | "Pending" | "Overdue" {
  const s = (inv.Status ?? "").toUpperCase();
  if (s === "PAID") return "Paid";
  const due = parseXeroDate(inv.DueDate);
  if (due && due.getTime() < Date.now()) return "Overdue";
  return "Pending";
}

function parseAmount(v: string | undefined): number {
  if (!v) return 0;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

type ReportRow = {
  RowType: string;
  Title?: string;
  Rows?: ReportRow[];
  Cells?: { Value: string }[];
};

/**
 * Parses a multi-column (timeframe=MONTH) P&L into expense lines per month.
 * Column month keys are taken from the header row where parseable, and fall
 * back to the requested month list when Xero's labels can't be read.
 */
function parseMonthlyExpenses(report: any, fallbackMonths: string[]): { name: string; month: string; amount: number }[] {
  const sections: ReportRow[] = report?.Rows ?? [];
  const header = sections.find((s) => s.RowType === "Header");
  const headerCells = (header?.Cells ?? []).slice(1).map((c) => c?.Value ?? "");
  const columns: string[] = headerCells.map((label, i) => {
    const d = new Date(label);
    if (!isNaN(d.getTime())) return monthKeyOf(d);
    return fallbackMonths[i] ?? "";
  });

  const out: { name: string; month: string; amount: number }[] = [];
  for (const section of sections) {
    if (section.RowType !== "Section") continue;
    const title = (section.Title || "").toLowerCase();
    const isExpense =
      title.includes("expense") || title.includes("cost of sales") || title.includes("operating");
    if (!isExpense) continue;
    for (const r of section.Rows ?? []) {
      if (r.RowType !== "Row" || !r.Cells || r.Cells.length < 2) continue;
      const name = r.Cells[0]?.Value;
      if (!name) continue;
      for (let i = 1; i < r.Cells.length; i++) {
        const month = columns[i - 1];
        if (!month) continue;
        const amount = parseAmount(r.Cells[i]?.Value);
        if (!amount) continue;
        out.push({ name, month, amount });
      }
    }
  }
  return out;
}

/** Live Cashflow Scenario data straight from the connected Xero organisation. */
export const getScenarioData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { clientId: string; tenantId: string; fromDate: string; toDate: string }) => i)
  .handler(async ({ data, context }): Promise<ScenarioData> => {
    const { getConnectionByTenant, xeroGet } = await import("./api.server");
    const { assertWidgetAccess, getClientReportBasis } = await import("./access.server");
    await assertWidgetAccess(context.userId, data.tenantId, "cashflow_scenario");

    const from = new Date(`${data.fromDate}T00:00:00`);
    const to = new Date(`${data.toDate}T00:00:00`);
    const months = monthRange(from, to);
    const conn = await getConnectionByTenant(data.tenantId);
    const basis = await getClientReportBasis(data.tenantId);

    const where =
      `Type=="ACCREC"&&Status!="VOIDED"&&Status!="DELETED"&&Status!="DRAFT"` +
      `&&Date>=DateTime(${from.getFullYear()},${from.getMonth() + 1},${from.getDate()})` +
      `&&Date<=DateTime(${to.getFullYear()},${to.getMonth() + 1},${to.getDate()})`;

    const rawInvoices: XeroInvoice[] = [];
    for (let page = 1; page <= 10; page++) {
      const res = await xeroGet<{ Invoices?: XeroInvoice[] }>(conn, "Invoices", {
        where,
        page: String(page),
        order: "Date ASC",
      });
      const batch = res.Invoices ?? [];
      rawInvoices.push(...batch);
      if (batch.length < 100) break;
    }

    // P&L for the expense side. Xero only accepts periods 1..11, so a single
    // month is fetched as a plain date-range report instead.
    const extraPeriods = Math.min(11, Math.max(0, months.length - 1));
    const plRes = await xeroGet<{ Reports: any[] }>(conn, "Reports/ProfitAndLoss", {
      ...(extraPeriods > 0
        ? { date: data.toDate, periods: String(extraPeriods), timeframe: "MONTH" }
        : { fromDate: data.fromDate, toDate: data.toDate }),
      ...(basis === "cash" ? { paymentsOnly: "true" } : {}),
    });
    const expenseLines = parseMonthlyExpenses(plRes.Reports?.[0], months);

    // Fixed / variable tags plus saved exclusions.
    const sb = context.supabase as any;
    const [tagsRes, exclRes] = await Promise.all([
      sb
        .from("client_cost_classifications")
        .select("account_name, classification")
        .eq("client_id", data.clientId)
        .eq("tenant_id", data.tenantId),
      sb.from("scenario_exclusions").select("xero_invoice_id").eq("client_id", data.clientId),
    ]);
    if (tagsRes.error) throw new Error(tagsRes.error.message);
    if (exclRes.error) throw new Error(exclRes.error.message);

    const tags = new Map<string, string>(
      ((tagsRes.data ?? []) as any[]).map((r) => [String(r.account_name).toLowerCase(), String(r.classification)]),
    );
    const excluded = new Set<string>(((exclRes.data ?? []) as any[]).map((r) => String(r.xero_invoice_id)));

    const customerNames = new Set<string>();
    const invoices: ScenarioInvoice[] = [];
    for (const inv of rawInvoices) {
      const issued = parseXeroDate(inv.Date);
      if (!issued) continue;
      const name = (inv.Contact?.Name ?? "").trim();
      if (name) customerNames.add(name);
      invoices.push({
        id: inv.InvoiceID,
        customer_id: name || null,
        description: inv.Reference?.trim() || inv.InvoiceNumber || "Invoice",
        amount: Number(inv.Total ?? 0),
        issue_date: iso(issued),
        status: statusFor(inv),
        excluded: excluded.has(inv.InvoiceID),
      });
    }
    invoices.sort((a, b) => b.issue_date.localeCompare(a.issue_date));

    const expenses: ScenarioExpense[] = [];
    for (const line of expenseLines) {
      const tag = tags.get(line.name.toLowerCase());
      if (tag === "excluded") continue;
      expenses.push({
        id: `${line.month}:${line.name}`,
        name: line.name,
        amount: line.amount,
        type: tag === "fixed" ? "Fixed" : "Variable",
        category: line.name,
        date: `${line.month}-01`,
      });
    }

    return {
      months,
      customers: [...customerNames].sort().map((n) => ({ id: n, name: n })),
      invoices,
      expenses,
    };
  });

export const setInvoiceExcluded = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { clientId: string; xeroInvoiceId: string; excluded: boolean }) => i)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    if (data.excluded) {
      const { error } = await sb
        .from("scenario_exclusions")
        .upsert(
          { client_id: data.clientId, xero_invoice_id: data.xeroInvoiceId },
          { onConflict: "client_id,xero_invoice_id" },
        );
      if (error) throw new Error(error.message);
    } else {
      const { error } = await sb
        .from("scenario_exclusions")
        .delete()
        .eq("client_id", data.clientId)
        .eq("xero_invoice_id", data.xeroInvoiceId);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const resetScenario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { clientId: string }) => i)
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("scenario_exclusions")
      .delete()
      .eq("client_id", data.clientId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
