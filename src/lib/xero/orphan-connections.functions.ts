/**
 * Unassigned Xero connections — Path C platform metadata.
 *
 * A Xero authorisation can leave behind a connection row that belongs to no
 * organisation (older flows stored every tenant Xero returned). These are
 * invisible everywhere else, so a super admin needs a place to see them and
 * either place them or disconnect them.
 *
 * Strictly metadata: organisation name, status, who authorised it and when.
 * No tokens, no client financial data. Assignment is limit-checked by the
 * database trigger on xero_connections.firm_id — we surface its message and
 * never pre-empt or work around it.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertSuperAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

export type OrphanXeroConnection = {
  id: string;
  tenantName: string;
  tenantType: string | null;
  status: string;
  createdAt: string;
  authorisedBy: string | null;
};

export const listOrphanXeroConnections = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OrphanXeroConnection[]> => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Explicit column list — never select * from xero_connections.
    const { data, error } = await supabaseAdmin
      .from("xero_connections")
      .select("id, tenant_name, tenant_type, status, created_at, user_id")
      .is("firm_id", null)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Array<Record<string, any>>;
    if (rows.length === 0) return [];

    // Connections already linked to a client are not orphans.
    const { data: linked } = await supabaseAdmin
      .from("client_xero_orgs")
      .select("xero_connection_id")
      .in(
        "xero_connection_id",
        rows.map((r) => r.id),
      );
    const linkedIds = new Set((linked ?? []).map((l: any) => l.xero_connection_id));

    const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, email, display_name")
      .in("id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);
    const who = new Map(
      (profiles ?? []).map((p: any) => [p.id, p.display_name || p.email || null]),
    );

    return rows
      .filter((r) => !linkedIds.has(r.id))
      .map((r) => ({
        id: r.id as string,
        tenantName: (r.tenant_name as string) ?? "Unnamed Xero organisation",
        tenantType: (r.tenant_type as string) ?? null,
        status: (r.status as string) ?? "connected",
        createdAt: r.created_at as string,
        authorisedBy: who.get(r.user_id) ?? null,
      }));
  });

export const assignOrphanXeroConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { connectionId: string; firmId: string }) => i)
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing, error: readErr } = await supabaseAdmin
      .from("xero_connections")
      .select("id, tenant_id, tenant_name, firm_id")
      .eq("id", data.connectionId)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!existing) throw new Error("That Xero connection no longer exists.");
    if ((existing as any).firm_id)
      throw new Error("That Xero connection already belongs to an organisation.");

    // The database decides whether the organisation has room — never pre-check.
    const { error } = await (supabaseAdmin as any)
      .from("xero_connections")
      .update({ firm_id: data.firmId })
      .eq("id", data.connectionId)
      .is("firm_id", null);
    if (error) {
      const { friendlyPlanError } = await import("@/lib/plan-errors");
      throw new Error(friendlyPlanError(error));
    }

    await (supabaseAdmin as any).from("audit_log").insert({
      actor_user_id: context.userId,
      firm_id: data.firmId,
      action: "xero_connection_assigned",
      target_type: "xero_connection",
      target_id: (existing as any).tenant_id,
      meta: {
        firm_id: data.firmId,
        connection_id: data.connectionId,
        tenant_name: (existing as any).tenant_name,
      },
    });
    return { ok: true };
  });

export const disconnectOrphanXeroConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { connectionId: string }) => i)
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing, error: readErr } = await supabaseAdmin
      .from("xero_connections")
      .select("id, tenant_id, tenant_name, firm_id")
      .eq("id", data.connectionId)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!existing) throw new Error("That Xero connection no longer exists.");
    if ((existing as any).firm_id)
      throw new Error("That Xero connection belongs to an organisation — disconnect it there.");

    const { error } = await (supabaseAdmin as any)
      .from("xero_connections")
      .update({
        status: "disconnected",
        disconnected_at: new Date().toISOString(),
        access_token_enc: null,
        refresh_token_enc: null,
      })
      .eq("id", data.connectionId)
      .is("firm_id", null);
    if (error) throw new Error(error.message);

    await (supabaseAdmin as any).from("audit_log").insert({
      actor_user_id: context.userId,
      action: "xero_connection_disconnected",
      target_type: "xero_connection",
      target_id: (existing as any).tenant_id,
      meta: {
        connection_id: data.connectionId,
        tenant_name: (existing as any).tenant_name,
        reason: "unassigned_connection_cleanup",
      },
    });
    return { ok: true };
  });
