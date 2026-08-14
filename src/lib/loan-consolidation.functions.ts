import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---- Client-safe DTO types (mirror the .server.ts engines) ----------------
export type ReconRowSide = {
  tenantId: string;
  tenantName: string;
  accountId: string;
  accountCode: string | null;
  accountName: string;
  shortCode: string | null;
  direction: "payable" | "receivable";
  actualDirection: "payable" | "receivable" | null;
  balance: number | null;
  error?: string;
};

export type ReconRow = {
  id: string;
  account: ReconRowSide;
  counterparty: ReconRowSide | null;
  net: number;
  status: "balanced" | "mismatch" | "unpaired" | "missing";
};

export type ReconFile = {
  tenant: { tenantId: string; tenantName: string };
  rows: ReconRow[];
  tenantErrors: Array<{ tenantId: string; error: string }>;
};

export type ReconResult = {
  asAt: string;
  tenant: { tenantId: string; tenantName: string };
  rows: ReconRow[];
  tenantErrors: Array<{ tenantId: string; error: string }>;
  files: ReconFile[];
};

export type MismatchLine = {
  key: string;
  date: string | null;
  reference: string | null;
  description: string | null;
  contact: string | null;
  sourceType: string | null;
  sourceId: string | null;
  amount: number;
};

export type MismatchSideInfo = {
  tenantId: string;
  tenantName: string;
  accountId: string;
  accountCode: string | null;
  accountName: string;
  shortCode: string | null;
  balance: number | null;
  lineCount: number;
  error?: string;
};

export type MismatchDifference = {
  id: string;
  kind: "missing_counterparty" | "missing_this_file" | "amount" | "date";
  a: MismatchLine | null;
  b: MismatchLine | null;
  impact: number;
  note: string;
};

export type MismatchDetail = {
  asAt: string;
  net: number;
  account: MismatchSideInfo;
  counterparty: MismatchSideInfo;
  differences: MismatchDifference[];
  explained: number;
  unexplained: number;
};

export type LoanAccountRow = {
  id: string;
  client_id: string;
  tenant_id: string;
  tenant_name: string | null;
  account_id: string | null;
  account_code: string | null;
  account_name: string | null;
  account_type: string | null;
  direction: "payable" | "receivable";
  counterparty_account_id: string | null;
  counterparty_name: string | null;
  counterparty_tenant_name: string | null;
  sort_order: number;
};

const MANAGE_ROLES = ["advisor", "super_admin", "firm_owner"];

async function clientFirmId(supabase: any, clientId: string): Promise<string | null> {
  const { data } = await supabase.from("clients").select("firm_id").eq("id", clientId).maybeSingle();
  return data?.firm_id ?? null;
}

async function isFirmOwner(supabase: any, userId: string, firmId: string | null): Promise<boolean> {
  if (!firmId) return false;
  const { data } = await supabase
    .from("firm_members")
    .select("role")
    .eq("user_id", userId)
    .eq("firm_id", firmId)
    .maybeSingle();
  return data?.role === "owner";
}

async function hasManageRole(supabase: any, userId: string): Promise<boolean> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  return !!(data ?? []).some((r: any) => MANAGE_ROLES.includes(r.role));
}

async function hasClientAccess(supabase: any, userId: string, clientId: string): Promise<boolean> {
  const { data } = await supabase
    .from("client_access")
    .select("id")
    .eq("user_id", userId)
    .eq("client_id", clientId)
    .maybeSingle();
  return !!data;
}

async function canManageClient(supabase: any, userId: string, clientId: string): Promise<boolean> {
  if (await hasManageRole(supabase, userId)) return true;
  return isFirmOwner(supabase, userId, await clientFirmId(supabase, clientId));
}

async function canReadClient(supabase: any, userId: string, clientId: string): Promise<boolean> {
  if (await canManageClient(supabase, userId, clientId)) return true;
  return hasClientAccess(supabase, userId, clientId);
}

async function getSupabaseAdmin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

// ---- Tenant listing ---------------------------------------------------------
export const listClientTenants = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { clientId: string }) => i)
  .handler(async ({ data, context }) => {
    if (!(await canReadClient(context.supabase, context.userId, data.clientId))) {
      throw new Error("You don't have access to this client.");
    }
    const supabaseAdmin = await getSupabaseAdmin();
    const { data: orgs } = await supabaseAdmin
      .from("client_xero_orgs")
      .select("xero_connections(tenant_id, tenant_name, status)")
      .eq("client_id", data.clientId);
    const seen = new Set<string>();
    const tenants: { tenantId: string; tenantName: string; status: string | null }[] = [];
    for (const o of (orgs ?? []) as any[]) {
      const t = o?.xero_connections;
      if (t?.tenant_id && !seen.has(t.tenant_id)) {
        seen.add(t.tenant_id);
        tenants.push({
          tenantId: t.tenant_id,
          tenantName: t.tenant_name ?? "(unnamed)",
          status: t.status ?? "connected",
        });
      }
    }
    return { tenants };
  });

export const listClientTenantsWithAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { clientId: string }) => i)
  .handler(async ({ data, context }) => {
    if (!(await canReadClient(context.supabase, context.userId, data.clientId))) {
      throw new Error("You don't have access to this client.");
    }
    const supabaseAdmin = await getSupabaseAdmin();
    const { data: rows } = await supabaseAdmin
      .from("loan_consolidation_accounts")
      .select("tenant_id, client_xero_orgs(xero_connections(tenant_name))")
      .eq("client_id", data.clientId);
    const names = new Map<string, string>();
    const seen = new Set<string>();
    const out: { tenantId: string; tenantName: string; count: number }[] = [];
    for (const r of (rows ?? []) as any[]) {
      const name = r?.client_xero_orgs?.[0]?.xero_connections?.tenant_name ?? "(unnamed)";
      if (!seen.has(r.tenant_id)) {
        seen.add(r.tenant_id);
        names.set(r.tenant_id, name);
        out.push({ tenantId: r.tenant_id, tenantName: name, count: 0 });
      }
    }
    for (const r of (rows ?? []) as any[]) {
      const entry = out.find((o) => o.tenantId === r.tenant_id);
      if (entry) entry.count += 1;
    }
    return { tenants: out };
  });

// ---- Account selection / pairing ------------------------------------------
export const listLiabilityAccountsForTenant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { clientId: string; tenantId: string }) => i)
  .handler(async ({ data, context }) => {
    if (!(await canManageClient(context.supabase, context.userId, data.clientId))) {
      throw new Error("Only the firm's owners and advisors can set up loan accounts.");
    }
    const { listAllAccounts } = await import("./xero/loan-xero.server");
    const accounts = await listAllAccounts(data.tenantId);
    const mapped = (accounts ?? [])
      .filter((a: any) => {
        const cls = a.Class;
        const type = a.Type;
        const status = a.Status;
        if (status && status !== "ACTIVE") return false;
        if (cls !== "LIABILITY" && cls !== "ASSET") return false;
        if (type === "BANK") return false;
        return true;
      })
      .map((a: any) => ({
        accountId: a.AccountID ?? null,
        code: a.Code ?? null,
        name: a.Name ?? null,
        type: a.Type ?? null,
        class: a.Class ?? null,
      }))
      .sort((a: any, b: any) => {
        const g = (a.class ?? "").localeCompare(b.class ?? "");
        if (g !== 0) return g;
        const c = (a.code ?? "").localeCompare(b.code ?? "");
        if (c !== 0) return c;
        return (a.name ?? "").localeCompare(b.name ?? "");
      });
    return { accounts: mapped };
  });

export const listSelectedAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { clientId: string; tenantId?: string | null }) => i)
  .handler(async ({ data, context }) => {
    if (!(await canReadClient(context.supabase, context.userId, data.clientId))) {
      throw new Error("You don't have access to this client.");
    }
    const supabaseAdmin = await getSupabaseAdmin();
    let q = supabaseAdmin
      .from("loan_consolidation_accounts")
      .select(
        "id, client_id, tenant_id, account_id, account_code, account_name, account_type, direction, sort_order, counterparty_account_id, counterparty:counterparty_account_id(account_name, tenant_id), client_xero_orgs(xero_connections(tenant_name))",
      )
      .eq("client_id", data.clientId)
      .order("sort_order", { ascending: true });
    if (data.tenantId) q = q.eq("tenant_id", data.tenantId);
    const { data: rows } = await q;
    const byId = new Map<string, any>();
    for (const r of (rows ?? []) as any[]) byId.set(r.id, r);
    const out: LoanAccountRow[] = (rows ?? []).map((r: any) => {
      const cp = r.counterparty_account_id ? byId.get(r.counterparty_account_id) : null;
      return {
        id: r.id,
        client_id: r.client_id,
        tenant_id: r.tenant_id,
        tenant_name: r.client_xero_orgs?.[0]?.xero_connections?.tenant_name ?? null,
        account_id: r.account_id,
        account_code: r.account_code,
        account_name: r.account_name,
        account_type: r.account_type,
        direction: r.direction === "receivable" ? "receivable" : "payable",
        counterparty_account_id: r.counterparty_account_id,
        counterparty_name: cp?.account_name ?? null,
        counterparty_tenant_name: cp ? byId.get(cp.id)?.tenant_name ?? null : null,
        sort_order: r.sort_order,
      };
    });
    return { rows: out };
  });

export const addLoanAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (i: {
      clientId: string;
      tenantId: string;
      accountId?: string | null;
      accountCode?: string | null;
      accountName?: string | null;
      accountType?: string | null;
      direction: "payable" | "receivable";
      sortOrder?: number;
    }) => i,
  )
  .handler(async ({ data, context }) => {
    if (!(await canManageClient(context.supabase, context.userId, data.clientId))) {
      throw new Error("Only the firm's owners and advisors can set up loan accounts.");
    }
    const { data: inserted, error } = await context.supabase
      .from("loan_consolidation_accounts")
      .insert({
        client_id: data.clientId,
        tenant_id: data.tenantId,
        account_id: data.accountId ?? null,
        account_code: data.accountCode ?? null,
        account_name: data.accountName ?? null,
        account_type: data.accountType ?? null,
        direction: data.direction,
        sort_order: data.sortOrder ?? 0,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted?.id };
  });

export const updateLoanAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; direction: "payable" | "receivable"; sortOrder?: number }) => i)
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("loan_consolidation_accounts")
      .select("client_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) throw new Error("Loan account not found");
    if (!(await canManageClient(context.supabase, context.userId, row.client_id))) {
      throw new Error("Only the firm's owners and advisors can edit loan accounts.");
    }
    const { error } = await context.supabase
      .from("loan_consolidation_accounts")
      .update({ direction: data.direction, sort_order: data.sortOrder ?? 0 })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const pairLoanAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { a: string; b: string }) => i)
  .handler(async ({ data, context }) => {
    const { data: rows } = await context.supabase
      .from("loan_consolidation_accounts")
      .select("id, client_id")
      .in("id", [data.a, data.b]);
    const found = new Set((rows ?? []).map((r: any) => r.id));
    if (!found.has(data.a) || !found.has(data.b)) throw new Error("Both loan accounts are required");
    const clientId = (rows ?? []).find((r: any) => r.id === data.a)?.client_id;
    if (!clientId || !(await canManageClient(context.supabase, context.userId, clientId))) {
      throw new Error("Only the firm's owners and advisors can pair loan accounts.");
    }
    const supabaseAdmin = await getSupabaseAdmin();
    await supabaseAdmin
      .from("loan_consolidation_accounts")
      .update({ counterparty_account_id: data.b })
      .eq("id", data.a);
    await supabaseAdmin
      .from("loan_consolidation_accounts")
      .update({ counterparty_account_id: data.a })
      .eq("id", data.b);
    return { ok: true };
  });

export const unpairLoanAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("loan_consolidation_accounts")
      .select("client_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) throw new Error("Loan account not found");
    if (!(await canManageClient(context.supabase, context.userId, row.client_id))) {
      throw new Error("Only the firm's owners and advisors can unpair loan accounts.");
    }
    const supabaseAdmin = await getSupabaseAdmin();
    await supabaseAdmin
      .from("loan_consolidation_accounts")
      .update({ counterparty_account_id: null })
      .eq("id", data.id);
    await supabaseAdmin
      .from("loan_consolidation_accounts")
      .update({ counterparty_account_id: null })
      .eq("counterparty_account_id", data.id);
    return { ok: true };
  });

export const deleteLoanAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("loan_consolidation_accounts")
      .select("client_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) throw new Error("Loan account not found");
    if (!(await canManageClient(context.supabase, context.userId, row.client_id))) {
      throw new Error("Only the firm's owners and advisors can remove loan accounts.");
    }
    const supabaseAdmin = await getSupabaseAdmin();
    await supabaseAdmin
      .from("loan_consolidation_accounts")
      .update({ counterparty_account_id: null })
      .eq("counterparty_account_id", data.id);
    const { error } = await context.supabase
      .from("loan_consolidation_accounts")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---- Reconciliation / drill-down -------------------------------------------
export const getLoanReconciliation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { clientId: string; tenantId?: string | null; asAt: string }) => i)
  .handler(async ({ data, context }) => {
    if (!(await canReadClient(context.supabase, context.userId, data.clientId))) {
      throw new Error("You don't have access to this client.");
    }
    const supabaseAdmin = await getSupabaseAdmin();
    const { runLoanReconciliation } = await import("./loan-recon.server");
    return runLoanReconciliation({
      supabase: supabaseAdmin,
      clientIds: [data.clientId],
      tenantIds: data.tenantId ? [data.tenantId] : null,
      asAt: data.asAt,
    });
  });

export const getLoanMismatchDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { clientId: string; rowId: string; asAt: string }) => i)
  .handler(async ({ data, context }) => {
    if (!(await canReadClient(context.supabase, context.userId, data.clientId))) {
      throw new Error("You don't have access to this client.");
    }
    const supabaseAdmin = await getSupabaseAdmin();
    const { runLoanMismatchDetail } = await import("./loan-mismatch.server");
    return runLoanMismatchDetail({ supabase: supabaseAdmin, rowId: data.rowId, asAt: data.asAt });
  });
