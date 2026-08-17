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

async function clientFirmId(supabase: any, clientId: string): Promise<string | null> {
  const { data } = await supabase.from("clients").select("firm_id").eq("id", clientId).maybeSingle();
  return data?.firm_id ?? null;
}

async function firmMemberRole(
  supabase: any,
  userId: string,
  firmId: string | null,
): Promise<string | null> {
  if (!firmId) return null;
  const { data } = await supabase
    .from("firm_members")
    .select("role")
    .eq("user_id", userId)
    .eq("firm_id", firmId)
    .maybeSingle();
  return (data?.role as string | undefined) ?? null;
}

/** Only the platform super admin crosses organisation boundaries. */
async function isSuperAdminUser(supabase: any, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();
  return Boolean(data);
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
  const firmId = await clientFirmId(supabase, clientId);
  if (Boolean(await firmMemberRole(supabase, userId, firmId))) return true;
  if (await isSuperAdminUser(supabase, userId)) {
    // Platform staff need an active support-access grant to reach client figures.
    const { platformStaffCanAccessFirm } = await import("@/lib/support-access.server");
    return platformStaffCanAccessFirm(userId, firmId);
  }
  return false;
}


async function canReadClient(supabase: any, userId: string, clientId: string): Promise<boolean> {
  if (await canManageClient(supabase, userId, clientId)) return true;
  return hasClientAccess(supabase, userId, clientId);
}


async function getSupabaseAdmin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

async function tenantNameMap(supabaseAdmin: any): Promise<Map<string, string>> {
  const { data } = await supabaseAdmin.from("xero_connections").select("tenant_id, tenant_name");
  const m = new Map<string, string>();
  for (const r of (data ?? []) as any[]) {
    if (r?.tenant_id && !m.has(r.tenant_id)) m.set(r.tenant_id, r.tenant_name ?? "(unnamed)");
  }
  return m;
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
      .select("tenant_id")
      .eq("client_id", data.clientId);
    const names = await tenantNameMap(supabaseAdmin);
    const out: { tenantId: string; tenantName: string; count: number }[] = [];
    for (const r of (rows ?? []) as any[]) {
      let entry = out.find((o) => o.tenantId === r.tenant_id);
      if (!entry) {
        entry = {
          tenantId: r.tenant_id,
          tenantName: names.get(r.tenant_id) ?? "(unnamed)",
          count: 0,
        };
        out.push(entry);
      }
      entry.count += 1;
    }
    out.sort((a, b) => a.tenantName.localeCompare(b.tenantName));
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
        "id, client_id, tenant_id, account_id, account_code, account_name, account_type, direction, sort_order, counterparty_account_id, counterparty:counterparty_account_id(account_name, account_code, tenant_id)",
      )
      .eq("client_id", data.clientId)
      .order("sort_order", { ascending: true });
    if (data.tenantId) q = q.eq("tenant_id", data.tenantId);
    const { data: rows } = await q;
    const names = await tenantNameMap(supabaseAdmin);
    const out: LoanAccountRow[] = (rows ?? []).map((r: any) => {
      const cp = Array.isArray(r.counterparty) ? r.counterparty[0] : r.counterparty;
      return {
        id: r.id,
        client_id: r.client_id,
        tenant_id: r.tenant_id,
        tenant_name: names.get(r.tenant_id) ?? null,
        account_id: r.account_id,
        account_code: r.account_code,
        account_name: r.account_name,
        account_type: r.account_type,
        direction: r.direction === "receivable" ? "receivable" : "payable",
        counterparty_account_id: r.counterparty_account_id,
        counterparty_name: cp
          ? [cp.account_code, cp.account_name].filter(Boolean).join(" · ")
          : null,
        counterparty_tenant_name: cp ? names.get(cp.tenant_id) ?? null : null,
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

// ---- Group-scoped (Company Loan Consolidation screen) ----------------------

export const ALL_FILES = "__all__";

export type GroupLoanFile = {
  clientId: string;
  clientName: string;
  tenantId: string;
  tenantName: string;
  count: number;
};

type ResolvedLoanGroup = {
  firmId: string;
  groupId: string;
  groupName: string;
  clients: { clientId: string; clientName: string; tenantIds: string[] }[];
  clientIds: string[];
  clientNameByTenant: Map<string, string>;
  clientIdByTenant: Map<string, string>;
  tenantNameById: Map<string, string>;
};

async function resolveLoanGroup(
  supabase: any,
  userId: string,
  groupId: string,
): Promise<ResolvedLoanGroup> {
  const supabaseAdmin = await getSupabaseAdmin();
  const { data: group } = await supabaseAdmin
    .from("consolidation_groups")
    .select("id, firm_id, name")
    .eq("id", groupId)
    .maybeSingle();
  if (!group) throw new Error("Consolidation group not found.");

  const allowed =
    Boolean(await firmMemberRole(supabase, userId, (group as any).firm_id)) ||
    (await isSuperAdminUser(supabase, userId));
  if (!allowed) throw new Error("You don't have access to this organisation.");


  const { data: members } = await supabaseAdmin
    .from("consolidation_group_members")
    .select("client_id")
    .eq("group_id", groupId);
  const clientIds = ((members ?? []) as any[]).map((m) => m.client_id as string);

  const { data: clients } = clientIds.length
    ? await supabaseAdmin
        .from("clients")
        .select("id, name, client_xero_orgs(xero_connections(tenant_id, tenant_name))")
        .in("id", clientIds)
        .order("name")
    : { data: [] as any[] };

  const clientNameByTenant = new Map<string, string>();
  const clientIdByTenant = new Map<string, string>();
  const tenantNameById = new Map<string, string>();
  const list = ((clients ?? []) as any[]).map((c) => {
    const tenantIds: string[] = [];
    for (const o of c.client_xero_orgs ?? []) {
      const t = o?.xero_connections;
      if (!t?.tenant_id) continue;
      tenantIds.push(t.tenant_id);
      clientNameByTenant.set(t.tenant_id, c.name);
      clientIdByTenant.set(t.tenant_id, c.id);
      tenantNameById.set(t.tenant_id, t.tenant_name ?? "(unnamed)");
    }
    return { clientId: c.id as string, clientName: c.name as string, tenantIds };
  });

  return {
    firmId: (group as any).firm_id,
    groupId,
    groupName: (group as any).name ?? "Group",
    clients: list,
    clientIds,
    clientNameByTenant,
    clientIdByTenant,
    tenantNameById,
  };
}

/** Every Xero file in the group, with how many loan accounts are set up on it. */
export const listGroupLoanFiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { groupId: string }) => i)
  .handler(async ({ data, context }) => {
    const group = await resolveLoanGroup(context.supabase, context.userId, data.groupId);
    const supabaseAdmin = await getSupabaseAdmin();
    const tenantIds = [...group.tenantNameById.keys()];
    const { data: rows } = tenantIds.length
      ? await supabaseAdmin
          .from("loan_consolidation_accounts")
          .select("tenant_id")
          .in("tenant_id", tenantIds)
      : { data: [] as any[] };
    const counts = new Map<string, number>();
    for (const r of (rows ?? []) as any[]) {
      counts.set(r.tenant_id, (counts.get(r.tenant_id) ?? 0) + 1);
    }
    const files: GroupLoanFile[] = tenantIds
      .map((tid) => ({
        clientId: group.clientIdByTenant.get(tid)!,
        clientName: group.clientNameByTenant.get(tid) ?? "",
        tenantId: tid,
        tenantName: group.tenantNameById.get(tid) ?? "(unnamed)",
        count: counts.get(tid) ?? 0,
      }))
      .sort((a, b) => a.clientName.localeCompare(b.clientName));
    return { groupId: group.groupId, groupName: group.groupName, firmId: group.firmId, files };
  });

async function runGroupRecon(group: ResolvedLoanGroup, tenantId: string | null, asAt: string) {
  const supabaseAdmin = await getSupabaseAdmin();
  const { runLoanReconciliation } = await import("./loan-recon.server");
  const result = await runLoanReconciliation({
    supabase: supabaseAdmin,
    clientIds: group.clientIds,
    tenantIds: tenantId && tenantId !== ALL_FILES ? [tenantId] : null,
    asAt,
  });
  // Label every file with the company (client) it belongs to.
  const label = (t: { tenantId: string; tenantName: string }) => ({
    ...t,
    clientName: group.clientNameByTenant.get(t.tenantId) ?? t.tenantName,
  });
  return {
    ...result,
    groupName: group.groupName,
    tenant: label(result.tenant),
    files: result.files.map((f) => ({ ...f, tenant: label(f.tenant) })),
  };
}

export const getGroupLoanReconciliation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { groupId: string; tenantId?: string | null; asAt: string }) => i)
  .handler(async ({ data, context }) => {
    const group = await resolveLoanGroup(context.supabase, context.userId, data.groupId);
    return runGroupRecon(group, data.tenantId ?? null, data.asAt);
  });

export const getGroupLoanMismatchDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { groupId: string; rowId: string; asAt: string }) => i)
  .handler(async ({ data, context }) => {
    await resolveLoanGroup(context.supabase, context.userId, data.groupId);
    const supabaseAdmin = await getSupabaseAdmin();
    const { runLoanMismatchDetail } = await import("./loan-mismatch.server");
    return runLoanMismatchDetail({ supabase: supabaseAdmin, rowId: data.rowId, asAt: data.asAt });
  });

function safeFileName(s: string): string {
  return s.replace(/[^\w\s-]+/g, "").trim().replace(/\s+/g, "_") || "loan-consolidation";
}

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunk)) as unknown as number[],
    );
  }
  return btoa(bin);
}

function toExportSections(recon: any) {
  return (recon.files as any[]).map((f) => ({
    tenant: {
      tenantId: f.tenant.tenantId,
      tenantName: f.tenant.tenantName,
      crmCompanyName: f.tenant.clientName ?? f.tenant.tenantName,
    },
    rows: (f.rows as any[]).map((r) => ({
      id: r.id,
      account: {
        tenantCrmName: recon.groupName,
        tenantName: r.account.tenantName,
        accountCode: r.account.accountCode,
        accountName: r.account.accountName,
        direction: r.account.direction,
        balance: r.account.balance,
        error: r.account.error,
      },
      counterparty: r.counterparty
        ? {
            tenantCrmName: recon.groupName,
            tenantName: r.counterparty.tenantName,
            accountCode: r.counterparty.accountCode,
            accountName: r.counterparty.accountName,
            direction: r.counterparty.direction,
            balance: r.counterparty.balance,
            error: r.counterparty.error,
          }
        : null,
      net: r.net,
      status: r.status,
    })),
  }));
}

export const downloadGroupLoanReconciliation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { groupId: string; tenantId?: string | null; asAt: string; format: "pdf" | "xlsx" }) => i)
  .handler(async ({ data, context }) => {
    const group = await resolveLoanGroup(context.supabase, context.userId, data.groupId);
    const recon = await runGroupRecon(group, data.tenantId ?? null, data.asAt);
    const sections = toExportSections(recon);
    const all = !data.tenantId || data.tenantId === ALL_FILES;
    const label = all ? "All_Xero_Files" : safeFileName((recon.tenant as any).clientName ?? recon.tenant.tenantName);
    const builders = await import("./loan-consolidation-export.server");
    const payload = { groupName: group.groupName, asAt: data.asAt, sections };
    const bytes =
      data.format === "pdf"
        ? await builders.buildLoanReconciliationPdf(payload as any)
        : await builders.buildLoanReconciliationXlsx(payload as any);
    return {
      base64: toBase64(bytes),
      filename: `${safeFileName(group.groupName)}_${label}_Loan_Reconciliation_${data.asAt}.${data.format}`,
      mimeType:
        data.format === "pdf"
          ? "application/pdf"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
  });

export const saveGroupLoanSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { groupId: string; tenantId?: string | null; asAt: string }) => i)
  .handler(async ({ data, context }) => {
    const group = await resolveLoanGroup(context.supabase, context.userId, data.groupId);
    const recon = await runGroupRecon(group, data.tenantId ?? null, data.asAt);
    const all = !data.tenantId || data.tenantId === ALL_FILES;
    const supabaseAdmin = await getSupabaseAdmin();
    const { error } = await supabaseAdmin.from("loan_consolidation_snapshots").insert({
      group_id: data.groupId,
      as_at: data.asAt,
      label: all ? "All Xero files" : ((recon.tenant as any).clientName ?? recon.tenant.tenantName),
      payload: recon as any,
      generated_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listGroupLoanSnapshots = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { groupId: string }) => i)
  .handler(async ({ data, context }) => {
    await resolveLoanGroup(context.supabase, context.userId, data.groupId);
    const supabaseAdmin = await getSupabaseAdmin();
    const { data: rows } = await supabaseAdmin
      .from("loan_consolidation_snapshots")
      .select("id, as_at, label, generated_at")
      .eq("group_id", data.groupId)
      .order("generated_at", { ascending: false })
      .limit(20);
    return {
      snapshots: ((rows ?? []) as any[]).map((r) => ({
        id: r.id as string,
        asAt: r.as_at as string,
        label: (r.label as string) ?? "",
        generatedAt: r.generated_at as string,
      })),
    };
  });

export const getGroupLoanSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { groupId: string; snapshotId: string }) => i)
  .handler(async ({ data, context }) => {
    await resolveLoanGroup(context.supabase, context.userId, data.groupId);
    const supabaseAdmin = await getSupabaseAdmin();
    const { data: row } = await supabaseAdmin
      .from("loan_consolidation_snapshots")
      .select("id, as_at, label, payload, generated_at")
      .eq("id", data.snapshotId)
      .eq("group_id", data.groupId)
      .maybeSingle();
    if (!row) throw new Error("Saved report not found.");
    return {
      id: (row as any).id as string,
      asAt: (row as any).as_at as string,
      label: ((row as any).label as string) ?? "",
      generatedAt: (row as any).generated_at as string,
      payload: (row as any).payload,
    };
  });

export const deleteGroupLoanSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { groupId: string; snapshotId: string }) => i)
  .handler(async ({ data, context }) => {
    await resolveLoanGroup(context.supabase, context.userId, data.groupId);
    const supabaseAdmin = await getSupabaseAdmin();
    const { error } = await supabaseAdmin
      .from("loan_consolidation_snapshots")
      .delete()
      .eq("id", data.snapshotId)
      .eq("group_id", data.groupId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Suggest loan accounts + pairings for every file in the group, from Xero. */
export const autoSetupGroupLoanAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { groupId: string; apply?: boolean }) => i)
  .handler(async ({ data, context }) => {
    const group = await resolveLoanGroup(context.supabase, context.userId, data.groupId);
    if (!(await isSuperAdminUser(context.supabase, context.userId))) {
      const role = await firmMemberRole(context.supabase, context.userId, group.firmId);
      if (!role) {
        throw new Error("Only the organisation's members can set up loan accounts.");
      }
    }

    const { autoSetupLoanAccounts } = await import("./loan-autosetup.server");
    const supabaseAdmin = await getSupabaseAdmin();
    return autoSetupLoanAccounts({
      supabase: supabaseAdmin,
      clients: group.clients.map((c) => ({
        clientId: c.clientId,
        clientName: c.clientName,
        tenantIds: c.tenantIds,
      })),
      tenantNameById: Object.fromEntries(group.tenantNameById),
      apply: data.apply !== false,
    });
  });

/** Where a client's loan consolidation lives now: its organisation + group. */
export const getLoanScreenTarget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { clientId: string }) => i)
  .handler(async ({ data, context }) => {
    if (!(await canReadClient(context.supabase, context.userId, data.clientId))) {
      throw new Error("You don't have access to this client.");
    }
    const supabaseAdmin = await getSupabaseAdmin();
    const [{ data: client }, { data: membership }] = await Promise.all([
      supabaseAdmin.from("clients").select("firm_id").eq("id", data.clientId).maybeSingle(),
      supabaseAdmin
        .from("consolidation_group_members")
        .select("group_id")
        .eq("client_id", data.clientId)
        .maybeSingle(),
    ]);
    return {
      firmId: ((client as any)?.firm_id as string) ?? null,
      groupId: ((membership as any)?.group_id as string) ?? null,
    };
  });

// ---- Pairing-first API (Hub parity) ----------------------------------------
export type LoanPairSide = {
  id: string;
  clientId: string;
  clientName: string;
  tenantId: string;
  tenantName: string;
  accountId: string | null;
  accountCode: string | null;
  accountName: string | null;
  accountType: string | null;
  direction: "payable" | "receivable";
};

export type LoanPair = {
  key: string;
  a: LoanPairSide;
  b: LoanPairSide;
};

/** Every two-sided loan pairing inside a consolidation group. */
export const listGroupLoanPairings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { groupId: string }) => i)
  .handler(async ({ data, context }) => {
    const group = await resolveLoanGroup(context.supabase, context.userId, data.groupId);
    const supabaseAdmin = await getSupabaseAdmin();
    const { data: rows } = group.clientIds.length
      ? await supabaseAdmin
          .from("loan_consolidation_accounts")
          .select(
            "id, client_id, tenant_id, account_id, account_code, account_name, account_type, direction, counterparty_account_id",
          )
          .in("client_id", group.clientIds)
      : { data: [] as any[] };

    const byId = new Map<string, any>();
    for (const r of (rows ?? []) as any[]) byId.set(r.id, r);

    const toSide = (r: any): LoanPairSide => ({
      id: r.id,
      clientId: r.client_id,
      clientName: group.clientNameByTenant.get(r.tenant_id) ?? "",
      tenantId: r.tenant_id,
      tenantName: group.tenantNameById.get(r.tenant_id) ?? "(unnamed)",
      accountId: r.account_id ?? null,
      accountCode: r.account_code ?? null,
      accountName: r.account_name ?? null,
      accountType: r.account_type ?? null,
      direction: r.direction === "receivable" ? "receivable" : "payable",
    });

    const seen = new Set<string>();
    const pairs: LoanPair[] = [];
    for (const r of byId.values()) {
      if (!r.counterparty_account_id) continue;
      const other = byId.get(r.counterparty_account_id);
      if (!other) continue;
      const key = [r.id, other.id].sort().join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push({ key, a: toSide(r), b: toSide(other) });
    }
    pairs.sort((x, y) => {
      const c = x.a.clientName.localeCompare(y.a.clientName);
      if (c !== 0) return c;
      return (x.a.accountCode ?? "").localeCompare(y.a.accountCode ?? "");
    });
    return {
      groupId: group.groupId,
      groupName: group.groupName,
      firmId: group.firmId,
      pairs,
    };
  });

type PairingSideInput = {
  clientId: string;
  tenantId: string;
  accountId: string | null;
  accountCode: string | null;
  accountName: string | null;
  accountType: string | null;
  direction?: "payable" | "receivable";
};

/** Create (or replace) a pairing between two loan accounts, adding them if needed. */
export const saveLoanPairing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (i: { a: PairingSideInput; b: PairingSideInput; replaceIds?: string[] }) => i,
  )
  .handler(async ({ data, context }) => {
    for (const side of [data.a, data.b]) {
      if (!(await canManageClient(context.supabase, context.userId, side.clientId))) {
        throw new Error("Only the firm's owners and advisors can pair loan accounts.");
      }
    }
    if (
      data.a.tenantId === data.b.tenantId &&
      data.a.accountId &&
      data.a.accountId === data.b.accountId
    ) {
      throw new Error("Pick two different loan accounts.");
    }

    const supabaseAdmin = await getSupabaseAdmin();

    // Clear the pairing being edited (both directions) before relinking.
    for (const id of data.replaceIds ?? []) {
      await supabaseAdmin
        .from("loan_consolidation_accounts")
        .update({ counterparty_account_id: null })
        .eq("id", id);
      await supabaseAdmin
        .from("loan_consolidation_accounts")
        .update({ counterparty_account_id: null })
        .eq("counterparty_account_id", id);
    }

    const ensure = async (side: PairingSideInput): Promise<string> => {
      let existing: any = null;
      if (side.accountId) {
        const { data: found } = await supabaseAdmin
          .from("loan_consolidation_accounts")
          .select("id")
          .eq("client_id", side.clientId)
          .eq("tenant_id", side.tenantId)
          .eq("account_id", side.accountId)
          .maybeSingle();
        existing = found;
      }
      if (existing?.id) return existing.id as string;
      const { data: inserted, error } = await supabaseAdmin
        .from("loan_consolidation_accounts")
        .insert({
          client_id: side.clientId,
          tenant_id: side.tenantId,
          account_id: side.accountId,
          account_code: side.accountCode,
          account_name: side.accountName,
          account_type: side.accountType,
          direction: side.direction ?? "payable",
          sort_order: 0,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return inserted!.id as string;
    };

    const aId = await ensure(data.a);
    const bId = await ensure(data.b);
    if (aId === bId) throw new Error("Pick two different loan accounts.");

    // A loan account can only have one counterparty — release any old links.
    for (const id of [aId, bId]) {
      await supabaseAdmin
        .from("loan_consolidation_accounts")
        .update({ counterparty_account_id: null })
        .eq("counterparty_account_id", id);
    }
    await supabaseAdmin
      .from("loan_consolidation_accounts")
      .update({ counterparty_account_id: bId })
      .eq("id", aId);
    await supabaseAdmin
      .from("loan_consolidation_accounts")
      .update({ counterparty_account_id: aId })
      .eq("id", bId);

    return { ok: true, a: aId, b: bId };
  });
