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
  xero_invoice_id: string | null;
};
export type ScenarioExpense = {
  id: string;
  name: string;
  amount: number;
  type: string;
  category: string;
  date: string;
  recurring_monthly: boolean;
};
export type ScenarioData = {
  currency: string;
  customers: ScenarioCustomer[];
  invoices: ScenarioInvoice[];
  expenses: ScenarioExpense[];
};

export const INVOICE_STATUSES = ["Paid", "Pending", "Overdue"] as const;
export const EXPENSE_TYPES = ["Fixed", "Variable"] as const;

export const getScenario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { clientId: string }) => i)
  .handler(async ({ data, context }): Promise<ScenarioData> => {
    const sb = context.supabase as any;
    const [customers, invoices, expenses, settings] = await Promise.all([
      sb.from("scenario_customers").select("id, name").eq("client_id", data.clientId).order("name"),
      sb
        .from("scenario_invoices")
        .select("id, customer_id, description, amount, issue_date, status, excluded, xero_invoice_id")
        .eq("client_id", data.clientId)
        .order("issue_date", { ascending: false }),
      sb
        .from("scenario_expenses")
        .select("id, name, amount, type, category, date, recurring_monthly")
        .eq("client_id", data.clientId)
        .order("date", { ascending: false }),
      sb.from("scenario_settings").select("currency").eq("client_id", data.clientId).maybeSingle(),
    ]);
    for (const r of [customers, invoices, expenses, settings]) {
      if (r.error) throw new Error(r.error.message);
    }
    return {
      currency: (settings.data?.currency as string | undefined) ?? "AUD",
      customers: (customers.data ?? []) as ScenarioCustomer[],
      invoices: ((invoices.data ?? []) as any[]).map((r) => ({ ...r, amount: Number(r.amount) })),
      expenses: ((expenses.data ?? []) as any[]).map((r) => ({ ...r, amount: Number(r.amount) })),
    };
  });

export const saveScenarioCurrency = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { clientId: string; currency: string }) => i)
  .handler(async ({ data, context }) => {
    const currency = data.currency.trim().toUpperCase().slice(0, 8) || "AUD";
    const { error } = await (context.supabase as any)
      .from("scenario_settings")
      .upsert({ client_id: data.clientId, currency }, { onConflict: "client_id" });
    if (error) throw new Error(error.message);
    return { ok: true, currency };
  });

/* ---------------- customers ---------------- */

export const saveScenarioCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { clientId: string; id?: string; name: string }) => i)
  .handler(async ({ data, context }) => {
    const name = data.name.trim();
    if (!name) throw new Error("Customer name is required.");
    const sb = context.supabase as any;
    if (data.id) {
      const { error } = await sb.from("scenario_customers").update({ name }).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await sb
      .from("scenario_customers")
      .insert({ client_id: data.clientId, name })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const deleteScenarioCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("scenario_customers").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- invoices ---------------- */

export const saveScenarioInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (i: {
      clientId: string;
      id?: string;
      customer_id: string | null;
      description: string;
      amount: number;
      issue_date: string;
      status: string;
    }) => i,
  )
  .handler(async ({ data, context }) => {
    const status = (INVOICE_STATUSES as readonly string[]).includes(data.status) ? data.status : "Pending";
    const payload = {
      customer_id: data.customer_id,
      description: data.description.trim(),
      amount: Number.isFinite(data.amount) ? data.amount : 0,
      issue_date: data.issue_date,
      status,
    };
    const sb = context.supabase as any;
    if (data.id) {
      const { error } = await sb.from("scenario_invoices").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await sb
      .from("scenario_invoices")
      .insert({ client_id: data.clientId, ...payload })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const setInvoiceExcluded = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; excluded: boolean }) => i)
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("scenario_invoices")
      .update({ excluded: data.excluded })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resetScenario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { clientId: string }) => i)
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("scenario_invoices")
      .update({ excluded: false })
      .eq("client_id", data.clientId)
      .eq("excluded", true);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteScenarioInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("scenario_invoices").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- expenses ---------------- */

export const saveScenarioExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (i: {
      clientId: string;
      id?: string;
      name: string;
      amount: number;
      type: string;
      category: string;
      date: string;
      recurring_monthly: boolean;
    }) => i,
  )
  .handler(async ({ data, context }) => {
    const payload = {
      name: data.name.trim() || "Expense",
      amount: Number.isFinite(data.amount) ? data.amount : 0,
      type: (EXPENSE_TYPES as readonly string[]).includes(data.type) ? data.type : "Fixed",
      category: data.category.trim() || "General",
      date: data.date,
      recurring_monthly: !!data.recurring_monthly,
    };
    const sb = context.supabase as any;
    if (data.id) {
      const { error } = await sb.from("scenario_expenses").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await sb
      .from("scenario_expenses")
      .insert({ client_id: data.clientId, ...payload })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const deleteScenarioExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("scenario_expenses").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- example data ---------------- */

function monthsBack(n: number): string {
  const d = new Date();
  d.setDate(15);
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 10);
}

/** Creates a small worked example so the dashboard is useful before any Xero import. */
export const seedScenarioExamples = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { clientId: string }) => i)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { count } = await sb
      .from("scenario_invoices")
      .select("id", { count: "exact", head: true })
      .eq("client_id", data.clientId);
    if ((count ?? 0) > 0) return { seeded: false };

    const names = ["Northside Builders", "Harbour Cafe Group", "Ridgeway Logistics", "Bluegum Dental"];
    const { data: customers, error: cErr } = await sb
      .from("scenario_customers")
      .insert(names.map((name) => ({ client_id: data.clientId, name })))
      .select("id, name");
    if (cErr) throw new Error(cErr.message);
    const byName = new Map<string, string>((customers ?? []).map((c: any) => [c.name, c.id]));

    const invoices: any[] = [];
    const plan: [string, number, number, string, string][] = [
      ["Northside Builders", 0, 18400, "Monthly retainer", "Pending"],
      ["Northside Builders", 1, 17600, "Monthly retainer", "Paid"],
      ["Northside Builders", 2, 16900, "Monthly retainer", "Paid"],
      ["Harbour Cafe Group", 0, 7200, "Bookkeeping + payroll", "Pending"],
      ["Harbour Cafe Group", 1, 6800, "Bookkeeping + payroll", "Paid"],
      ["Harbour Cafe Group", 3, 12500, "Systems setup project", "Overdue"],
      ["Ridgeway Logistics", 0, 24500, "Fleet finance review", "Pending"],
      ["Ridgeway Logistics", 2, 9800, "Quarterly BAS", "Paid"],
      ["Bluegum Dental", 1, 4300, "Advisory session", "Paid"],
      ["Bluegum Dental", 3, 5100, "Advisory session", "Overdue"],
    ];
    for (const [name, back, amount, description, status] of plan) {
      invoices.push({
        client_id: data.clientId,
        customer_id: byName.get(name) ?? null,
        description,
        amount,
        issue_date: monthsBack(back),
        status,
      });
    }
    const { error: iErr } = await sb.from("scenario_invoices").insert(invoices);
    if (iErr) throw new Error(iErr.message);

    const expenses = [
      { name: "Office rent", amount: 4200, type: "Fixed", category: "Premises", recurring_monthly: true },
      { name: "Software subscriptions", amount: 1150, type: "Fixed", category: "Technology", recurring_monthly: true },
      { name: "Insurance", amount: 620, type: "Fixed", category: "Insurance", recurring_monthly: true },
      { name: "Team wages", amount: 21500, type: "Fixed", category: "People", recurring_monthly: true },
      { name: "Contractor labour", amount: 6400, type: "Variable", category: "People", recurring_monthly: false },
      { name: "Materials", amount: 3900, type: "Variable", category: "Cost of delivery", recurring_monthly: false },
      { name: "Fuel & travel", amount: 1450, type: "Variable", category: "Travel", recurring_monthly: false },
      { name: "Advertising", amount: 2100, type: "Variable", category: "Marketing", recurring_monthly: false },
    ];
    const rows: any[] = [];
    for (const e of expenses) {
      for (const back of [0, 1, 2]) {
        rows.push({ client_id: data.clientId, ...e, date: monthsBack(back) });
      }
    }
    const { error: eErr } = await sb.from("scenario_expenses").insert(rows);
    if (eErr) throw new Error(eErr.message);

    return { seeded: true };
  });
