import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AgeingBucket, AgedReceivables } from "@/lib/xero/receivables.functions";
import type { AgeingBucket as PayableAgeingBucket, AgedPayables } from "@/lib/xero/payables.functions";

export type { AgeingBucket, AgedReceivables };
export type { PayableAgeingBucket, AgedPayables };

export type ConsolidatedAgeing = {
  asOf: string;
  tenantCount: number;
  tenantNames: string[];
  totalOutstanding: number;
  totalOverdue: number;
  invoiceCount: number;
  buckets: AgeingBucket[];
  topCustomers: { name: string; amount: number }[];
  elimination: number;
  byTenant: { tenantId: string; tenantName: string; totalOutstanding: number; totalOverdue: number }[];
};

export type ConsolidatedPayables = {
  asOf: string;
  tenantCount: number;
  tenantNames: string[];
  totalOutstanding: number;
  totalOverdue: number;
  invoiceCount: number;
  buckets: PayableAgeingBucket[];
  topSuppliers: { name: string; amount: number }[];
  elimination: number;
  byTenant: { tenantId: string; tenantName: string; totalOutstanding: number; totalOverdue: number }[];
};

const MANAGE_ROLES = ["advisor", "super_admin", "firm_owner"];

/** A consolidation group resolved to its firm, member clients and Xero tenants. */
type ResolvedGroup = {
  firmId: string;
  name: string;
  clientIds: string[];
  tenants: { tenantId: string; tenantName: string }[];
};

async function resolveGroup(supabase: any, userId: string, groupId: string): Promise<ResolvedGroup> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: group } = await supabaseAdmin
    .from("consolidation_groups")
    .select("id, firm_id, name")
    .eq("id", groupId)
    .maybeSingle();
  if (!group) throw new Error("Consolidation group not found.");

  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  let allowed = Boolean(roles?.some((r: any) => MANAGE_ROLES.includes(r.role)));
  if (!allowed) {
    const { data: member } = await supabase
      .from("firm_members")
      .select("id")
      .eq("firm_id", group.firm_id)
      .eq("user_id", userId)
      .maybeSingle();
    allowed = Boolean(member);
  }
  if (!allowed) throw new Error("You don't have access to this organisation.");

  const { data: members } = await supabaseAdmin
    .from("consolidation_group_members")
    .select("client_id")
    .eq("group_id", groupId);
  const clientIds = (members ?? []).map((m: any) => m.client_id as string);
  if (!clientIds.length) return { firmId: group.firm_id, name: group.name, clientIds: [], tenants: [] };

  const { data: orgs } = await supabaseAdmin
    .from("client_xero_orgs")
    .select("client_id, xero_connections(tenant_id, tenant_name)")
    .in("client_id", clientIds);

  const tenants: { tenantId: string; tenantName: string }[] = [];
  const seen = new Set<string>();
  for (const o of (orgs ?? []) as any[]) {
    const t = o?.xero_connections;
    if (!t?.tenant_id || seen.has(t.tenant_id)) continue;
    seen.add(t.tenant_id);
    tenants.push({ tenantId: t.tenant_id, tenantName: t.tenant_name ?? "Unknown" });
  }
  return { firmId: group.firm_id, name: group.name, clientIds, tenants };
}


function parseXeroDate(s?: string): Date | null {
  if (!s) return null;
  const m = s.match(/\/Date\((-?\d+)/);
  if (m) return new Date(parseInt(m[1], 10));
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function bucketFor(daysOverdue: number): string {
  if (daysOverdue <= 0) return "Current";
  if (daysOverdue <= 30) return "1–30 days";
  if (daysOverdue <= 60) return "31–60 days";
  if (daysOverdue <= 90) return "61–90 days";
  return "90+ days";
}

type XeroInvoice = {
  InvoiceID: string;
  Type: "ACCPAY" | "ACCREC";
  Status: string;
  DueDate?: string;
  AmountDue: number;
  Contact?: { Name?: string };
};

async function fetchUnpaidInvoicesForTenant(
  tenantId: string,
  type: "ACCREC" | "ACCPAY",
  maxPages = 5,
): Promise<XeroInvoice[]> {
  const { getConnectionByTenant, xeroGet } = await import("./api.server");
  const conn = await getConnectionByTenant(tenantId);
  const invoices: XeroInvoice[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const res = await xeroGet<{ Invoices?: XeroInvoice[] }>(conn, "Invoices", {
      where: `Type=="${type}"&&Status!="PAID"&&Status!="VOIDED"&&Status!="DELETED"&&Status!="DRAFT"`,
      page: String(page),
      order: "DueDate ASC",
    });
    const batch = res.Invoices ?? [];
    invoices.push(...batch);
    if (batch.length < 100) break;
  }
  return invoices;
}

async function getTenantAgeing(
  tenantId: string,
  type: "ACCREC" | "ACCPAY",
  tenantName: string,
): Promise<{
  totalOutstanding: number;
  totalOverdue: number;
  invoiceCount: number;
  buckets: AgeingBucket[];
  topContacts: { name: string; amount: number }[];
}> {
  const invoices = await fetchUnpaidInvoicesForTenant(tenantId, type);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const labels = ["Current", "1–30 days", "31–60 days", "61–90 days", "90+ days"];
  const bucketMap = new Map<string, AgeingBucket>(labels.map((l) => [l, { label: l, count: 0, amount: 0 }]));
  const contactMap = new Map<string, number>();
  let totalOutstanding = 0;
  let totalOverdue = 0;

  for (const inv of invoices) {
    const due = parseXeroDate(inv.DueDate);
    const amount = Number(inv.AmountDue) || 0;
    if (amount <= 0) continue;
    const daysOverdue = due ? Math.floor((today.getTime() - due.getTime()) / 86400000) : 0;
    const label = bucketFor(daysOverdue);
    const b = bucketMap.get(label)!;
    b.count += 1;
    b.amount += amount;
    totalOutstanding += amount;
    if (daysOverdue > 0) totalOverdue += amount;
    const contact = inv.Contact?.Name ?? "Unknown";
    contactMap.set(contact, (contactMap.get(contact) ?? 0) + amount);
  }

  return {
    totalOutstanding,
    totalOverdue,
    invoiceCount: invoices.filter((i) => (Number(i.AmountDue) || 0) > 0).length,
    buckets: labels.map((l) => bucketMap.get(l)!),
    topContacts: [...contactMap.entries()]
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5),
  };
}

async function getLoanElimination(
  clientId: string,
  tenantIds: string[],
  asAt: string,
  side: "receivable" | "payable",
): Promise<number> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { runLoanReconciliation } = await import("@/lib/loan-recon.server");
    const result = await runLoanReconciliation({
      supabase: supabaseAdmin,
      clientId,
      tenantIds,
      asAt,
    });
    const selectedSet = new Set(tenantIds);
    let elimination = 0;
    for (const file of result.files) {
      for (const row of file.rows) {
        if (!row.counterparty) continue;
        if (!selectedSet.has(row.account.tenantId) || !selectedSet.has(row.counterparty.tenantId)) continue;
        if (row.account.direction === side) {
          const bal = row.account.balance ?? 0;
          elimination += side === "receivable" ? Math.max(0, bal) : Math.max(0, -bal);
        } else if (row.counterparty.direction === side) {
          const bal = row.counterparty.balance ?? 0;
          elimination += side === "receivable" ? Math.max(0, bal) : Math.max(0, -bal);
        }
      }
    }
    return Math.round(elimination * 100) / 100;
  } catch {
    return 0;
  }
}

async function eliminationForGroup(
  clientIds: string[],
  tenantIds: string[],
  asAt: string,
  side: "receivable" | "payable",
) {
  let total = 0;
  for (const clientId of clientIds) {
    total += await getLoanElimination(clientId, tenantIds, asAt, side);
  }
  return Math.round(total * 100) / 100;
}

export const getConsolidatedReceivables = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { groupId: string; asAt: string }) => i)
  .handler(async ({ data, context }) => {
    const group = await resolveGroup(context.supabase, context.userId, data.groupId);
    if (group.tenants.length < 2) {
      throw new Error("Add at least two companies with a linked Xero file to this group.");
    }

    const labels = ["Current", "1–30 days", "31–60 days", "61–90 days", "90+ days"];
    const bucketMap = new Map<string, AgeingBucket>(labels.map((l) => [l, { label: l, count: 0, amount: 0 }]));
    const customerMap = new Map<string, number>();
    let totalOutstanding = 0;
    let totalOverdue = 0;
    let invoiceCount = 0;
    const byTenant: { tenantId: string; tenantName: string; totalOutstanding: number; totalOverdue: number }[] = [];
    const tenantNames: string[] = [];

    for (const { tenantId, tenantName } of group.tenants) {
      tenantNames.push(tenantName);
      const ageing = await getTenantAgeing(tenantId, "ACCREC", tenantName);
      invoiceCount += ageing.invoiceCount;
      totalOutstanding += ageing.totalOutstanding;
      totalOverdue += ageing.totalOverdue;
      byTenant.push({ tenantId, tenantName, totalOutstanding: ageing.totalOutstanding, totalOverdue: ageing.totalOverdue });
      for (const b of ageing.buckets) {
        const target = bucketMap.get(b.label)!;
        target.count += b.count;
        target.amount += b.amount;
      }
      for (const c of ageing.topContacts) {
        customerMap.set(c.name, (customerMap.get(c.name) ?? 0) + c.amount);
      }
    }

    const tenantIds = group.tenants.map((t) => t.tenantId);
    const elimination = await eliminationForGroup(group.clientIds, tenantIds, data.asAt, "receivable");
    const netOutstanding = Math.max(0, Math.round((totalOutstanding - elimination) * 100) / 100);

    const result: ConsolidatedAgeing = {
      asOf: data.asAt,
      tenantCount: group.tenants.length,
      tenantNames,
      totalOutstanding: netOutstanding,
      totalOverdue: Math.max(0, totalOverdue - elimination),
      invoiceCount,
      buckets: labels.map((l) => bucketMap.get(l)!),
      topCustomers: [...customerMap.entries()]
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5),
      elimination,
      byTenant,
    };
    return result;
  });

export const getConsolidatedPayables = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { groupId: string; asAt: string }) => i)
  .handler(async ({ data, context }) => {
    const group = await resolveGroup(context.supabase, context.userId, data.groupId);
    if (group.tenants.length < 2) {
      throw new Error("Add at least two companies with a linked Xero file to this group.");
    }

    const labels = ["Current", "1–30 days", "31–60 days", "61–90 days", "90+ days"];
    const bucketMap = new Map<string, PayableAgeingBucket>(labels.map((l) => [l, { label: l, count: 0, amount: 0 }]));
    const supplierMap = new Map<string, number>();
    let totalOutstanding = 0;
    let totalOverdue = 0;
    let invoiceCount = 0;
    const byTenant: { tenantId: string; tenantName: string; totalOutstanding: number; totalOverdue: number }[] = [];
    const tenantNames: string[] = [];

    for (const { tenantId, tenantName } of group.tenants) {
      tenantNames.push(tenantName);
      const ageing = await getTenantAgeing(tenantId, "ACCPAY", tenantName);
      invoiceCount += ageing.invoiceCount;
      totalOutstanding += ageing.totalOutstanding;
      totalOverdue += ageing.totalOverdue;
      byTenant.push({ tenantId, tenantName, totalOutstanding: ageing.totalOutstanding, totalOverdue: ageing.totalOverdue });
      for (const b of ageing.buckets) {
        const target = bucketMap.get(b.label)!;
        target.count += b.count;
        target.amount += b.amount;
      }
      for (const c of ageing.topContacts) {
        supplierMap.set(c.name, (supplierMap.get(c.name) ?? 0) + c.amount);
      }
    }

    const tenantIds = group.tenants.map((t) => t.tenantId);
    const elimination = await eliminationForGroup(group.clientIds, tenantIds, data.asAt, "payable");
    const netOutstanding = Math.max(0, Math.round((totalOutstanding - elimination) * 100) / 100);

    const result: ConsolidatedPayables = {
      asOf: data.asAt,
      tenantCount: group.tenants.length,
      tenantNames,
      totalOutstanding: netOutstanding,
      totalOverdue: Math.max(0, totalOverdue - elimination),
      invoiceCount,
      buckets: labels.map((l) => bucketMap.get(l)!),
      topSuppliers: [...supplierMap.entries()]
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5),
      elimination,
      byTenant,
    };
    return result;
  });
