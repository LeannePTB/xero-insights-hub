import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type FirmClientCapacity = {
  firmId: string;
  firmName: string;
  limit: number;
  used: number;
  remaining: number;
};

/**
 * Resolve how many more client subscriptions a firm may create.
 *
 * Limits and usage come from `public.firm_plan_limits` — the same source the
 * database triggers enforce. Never recompute either in TypeScript.
 */
export async function getFirmClientCapacity(firmId: string): Promise<FirmClientCapacity> {
  const { getFirmPlanLimits } = await import("@/lib/xero/client-orgs.server");
  const [{ data: firmRow }, { data: subRow }, limits] = await Promise.all([
    supabaseAdmin.from("firms").select("name, is_always_free").eq("id", firmId).maybeSingle(),
    supabaseAdmin
      .from("subscriptions")
      .select("status")
      .eq("firm_id", firmId)
      .maybeSingle(),
    getFirmPlanLimits(firmId),
  ]);

  if (!firmRow) throw new Error("Organisation not found.");

  const status = (subRow as any)?.status ?? null;
  const okStatus =
    !status ||
    ["active", "trialing", "past_due"].includes(status) ||
    (firmRow as any)?.is_always_free;
  if (!okStatus) {
    throw new Error("This business has no active subscription. Please renew before adding clients.");
  }

  const limit = Math.max(1, limits.client_limit);
  const used = limits.clients_used;
  return {
    firmId,
    firmName: (firmRow as any).name as string,
    limit,
    used,
    remaining: Math.max(0, limit - used),
  };
}

/** Caller must belong to the firm (or be a platform admin) and have room for one more client. */
export async function assertFirmCanAddClient(firmId: string, userId: string) {
  const [{ data: membership }, { data: superRow }] = await Promise.all([
    supabaseAdmin
      .from("firm_members")
      .select("id")
      .eq("firm_id", firmId)
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "super_admin")
      .maybeSingle(),
  ]);
  if (!membership && !superRow) throw new Error("You are not a member of that business.");

  const capacity = await getFirmClientCapacity(firmId);
  if (capacity.remaining < 1) {
    throw new Error(
      `Client limit reached (${capacity.used}/${capacity.limit}). Upgrade the subscription to add more clients.`,
    );
  }
  return capacity;
}

export type OnboardOutcome = {
  created: Array<{ clientId: string; name: string }>;
  skippedAssigned: string[];
  skippedLimit: string[];
};

/**
 * Create one client subscription per newly authorised Xero organisation,
 * named after the Xero organisation, and link the file to it.
 */
export async function createClientsFromTenants(params: {
  firmId: string;
  userId: string;
  tenantIds: string[];
}): Promise<OnboardOutcome> {
  const { firmId, userId, tenantIds } = params;
  const outcome: OnboardOutcome = { created: [], skippedAssigned: [], skippedLimit: [] };
  if (!tenantIds.length) return outcome;

  const { data: connections, error: connError } = await supabaseAdmin
    .from("xero_connections")
    .select("id, tenant_id, tenant_name")
    .in("tenant_id", tenantIds)
    .eq("user_id", userId);
  if (connError) throw new Error(connError.message);
  if (!connections?.length) return outcome;

  const { data: assigned, error: assignedError } = await supabaseAdmin
    .from("client_xero_orgs")
    .select("xero_connection_id");
  if (assignedError) throw new Error(assignedError.message);
  const assignedIds = new Set((assigned ?? []).map((r) => r.xero_connection_id));

  let capacity = await getFirmClientCapacity(firmId);
  let remaining = capacity.remaining;

  for (const connection of connections) {
    const name = (connection.tenant_name ?? "Untitled organisation").trim();
    if (assignedIds.has(connection.id)) {
      outcome.skippedAssigned.push(name);
      continue;
    }
    if (remaining < 1) {
      outcome.skippedLimit.push(name);
      continue;
    }

    const { data: client, error: clientError } = await supabaseAdmin
      .from("clients")
      .insert({ name, owner_user_id: userId, firm_id: firmId })
      .select("id")
      .single();
    if (clientError) {
      const { isPlanLimitError, friendlyPlanError } = await import("@/lib/plan-errors");
      if (isPlanLimitError(clientError)) {
        if (outcome.created.length) {
          outcome.skippedLimit.push(name);
          break;
        }
        throw new Error(friendlyPlanError(clientError));
      }
      throw new Error(clientError.message);
    }

    const { error: linkError } = await supabaseAdmin
      .from("client_xero_orgs")
      .insert({ client_id: client.id, xero_connection_id: connection.id });
    if (linkError) {
      await supabaseAdmin.from("clients").delete().eq("id", client.id);
      const { friendlyPlanError } = await import("@/lib/plan-errors");
      throw new Error(friendlyPlanError(linkError));
    }

    await supabaseAdmin
      .from("xero_connections")
      .update({ firm_id: firmId })
      .eq("id", connection.id);

    await supabaseAdmin.from("audit_log").insert([
      {
        actor_user_id: userId,
        firm_id: firmId,
        action: "client_created_from_xero",
        target_type: "client",
        target_id: client.id,
        meta: { tenant_id: connection.tenant_id, tenant_name: name },
      },
      {
        actor_user_id: userId,
        firm_id: firmId,
        action: "xero_file_linked",
        target_type: "xero_connection",
        target_id: connection.id,
        meta: { client_id: client.id, firm_id: firmId },
      },
    ]);

    // First link for this tenant: prepare its figures now rather than leaving
    // the dashboard blank until 3am. Fire-and-forget — the connection has
    // already succeeded and nothing below depends on this.
    try {
      const { scheduleFirstLinkRefresh } = await import("./first-link-refresh.server");
      scheduleFirstLinkRefresh(connection.tenant_id);
    } catch {
      /* never blocks the connection flow */
    }

    outcome.created.push({ clientId: client.id, name });
    remaining -= 1;
  }

  return outcome;
}
