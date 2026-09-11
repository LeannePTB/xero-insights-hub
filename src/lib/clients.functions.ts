import { createServerFn } from "@tanstack/react-start";
import { findVerifiedAuthUserByEmail, listVerifiedAuthUsers } from "@/lib/auth-users.server";
import { siteUrl } from "@/lib/site-origin";
import { requireAal2 } from "@/lib/auth/require-aal2";
import {
  ALL_TIERS,
  DEFAULT_TIER_WIDGETS,
  type DashboardTier,
  type WidgetKey,
} from "@/lib/tiers";

export const listClients = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: { firmId?: string } | undefined) => i ?? {})
  .handler(async ({ data, context }) => {
    // Determine the firm scope. Invariant 3: a global role is never a shortcut
    // into an organisation's client list — active membership decides for everyone.
    let firmId: string | null = data?.firmId ?? null;
    {
      const { data: memberships } = await context.supabase
        .from("firm_members")
        .select("firm_id")
        .eq("user_id", context.userId)
        .eq("status", "active")
        .order("created_at", { ascending: true });
      const myFirms = ((memberships ?? []) as any[]).map((m) => m.firm_id as string);
      if (firmId && !myFirms.includes(firmId)) throw new Error("Not a member of that business.");
      firmId = firmId ?? myFirms[0] ?? null;
      if (!firmId) return { clients: [] };
    }


    // Reads always go through the caller's session, so RLS scopes them to the
    // organisations the caller is actually a member of.
    const db: any = context.supabase;

    let q = db
      .from("clients")
      .select(
        "id, name, firm_id, created_at, client_xero_orgs(id, xero_connection_id, xero_connections(tenant_id, tenant_name)), client_access(tier)",
      )
      .order("name");
    if (firmId) q = q.eq("firm_id", firmId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const clientIds = (rows ?? []).map((c: any) => c.id);
    // Cards per tier come from the deny-list model: plan ceiling minus the
    // organisation's exclusions, plus each client's own exclusions.
    const { tierCeilings, ceilingFor, fetchExclusions, ExclusionIndex, visibleWidgets } =
      await import("@/lib/widget-resolve.server");
    const ceilings = await tierCeilings(context.supabase);
    const exIndex = new ExclusionIndex(
      clientIds.length
        ? await fetchExclusions(context.supabase, { firmId, clientIds })
        : await fetchExclusions(context.supabase, { firmId }),
    );
    const tierKeys: string[] = ceilings.size ? Array.from(ceilings.keys()) : [...ALL_TIERS];
    function resolveTierWidgets(clientId: string): Record<DashboardTier, WidgetKey[]> {
      return Object.fromEntries(
        tierKeys.map((t) => [
          t,
          visibleWidgets(ceilingFor(ceilings, t), exIndex.effective(t, { firmId, clientId })),
        ]),
      ) as Record<DashboardTier, WidgetKey[]>;
    }


    // Effective dashboard tier per client comes from public.client_entitlement,
    // read through the caller's session. It is never recomputed here, and any
    // failure resolves to Standard (fail closed) inside the helper.
    const { clientEntitlement } = await import("@/lib/entitlement.server");
    const entitlementByClient = new Map<string, any>(
      await Promise.all(
        (rows ?? []).map(
          async (c: any) =>
            [c.id, await clientEntitlement(context.supabase, c.id)] as [string, any],
        ),
      ),
    );

    // Business Health entitlement per client, keyed by client id — never by
    // position. It reuses the deny-list reads already made above (plan ceiling,
    // organisation and client exclusions), so it costs no extra round trip and
    // mirrors public.client_allowed_widgets, so this can under-permit but
    // never over-permit. Any failure resolves to false for that
    // client and never fails the list.
    const healthByClient = new Map<string, boolean>();
    for (const c of (rows ?? []) as any[]) {
      try {
        const tier = entitlementByClient.get(c.id)?.tier as string | undefined;
        const widgets = tier
          ? visibleWidgets(ceilingFor(ceilings, tier), exIndex.effective(tier, { firmId, clientId: c.id }))
          : [];
        healthByClient.set(c.id, widgets.includes("health"));
      } catch (err) {
        console.error("[listClients] health entitlement failed", { clientId: c.id, err });
        healthByClient.set(c.id, false);
      }
    }

    const clients = (rows ?? []).map((c: any) => {

      const grantedTiers = Array.from(
        new Set(((c.client_access ?? []) as { tier: DashboardTier }[]).map((a) => a.tier)),
      ) as DashboardTier[];
      const overrideTiers = Array.from(
        new Set(exIndex.clientTiers(c.id) as DashboardTier[]),
      ) as DashboardTier[];
      const clientTiers = Array.from(
        new Set<DashboardTier>([...overrideTiers, ...grantedTiers]),
      ) as DashboardTier[];
      return {
        ...c,
        grantedTiers,
        // Per-viewer grants + per-client widget overrides. NOT the client's
        // dashboard tier — use `entitlement` for that.
        clientTiers,
        entitlement: entitlementByClient.get(c.id) ?? null,
        tierWidgets: resolveTierWidgets(c.id),
        healthAllowed: healthByClient.get(c.id) === true,
      };
    });
    return { clients };
  });

export const getClient = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: { clientId: string }) => i)
  .handler(async ({ data, context }) => {
    // This feeds the client settings page, which reports Xero connectivity.
    // Scoped to this client's own Xero files, rate-limited to one /connections
    // call per scope per 10 minutes and never awaited, so the page renders with
    // the status we hold either way.
    {
      const { ensureAuthorisationFresh } = await import(
        "@/lib/xero/authorisation-freshness.server"
      );
      ensureAuthorisationFresh({ clientId: data.clientId });
    }

    const SELECT =
      "id, name, owner_user_id, firm_id, report_basis, gst_cycle, payg_withholding_cycle, max_xero_orgs, consolidation_mode, consolidation_org_ids, client_xero_orgs(id, xero_connection_id, xero_connections(tenant_id, tenant_name, status, disconnected_at))";
    const { data: client, error } = await context.supabase
      .from("clients")
      .select(SELECT)
      .eq("id", data.clientId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (client) return { client: client as any };

    // Platform admins can open clients in organisations they're not a member of.
    const { data: roleRows } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const isSuper = !!roleRows?.some((r: any) => r.role === "super_admin");
    if (isSuper) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { assertClientDataAccessForClient } = await import("@/lib/support-access.server");
      await assertClientDataAccessForClient(context.userId, data.clientId);
      const { data: adminClient } = await supabaseAdmin
        .from("clients")
        .select(SELECT)
        .eq("id", data.clientId)
        .maybeSingle();
      if (adminClient) return { client: adminClient as any };
    }

    throw new Error("Client not found.");
  });

export const listClientNotes = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: { clientId: string }) => i)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("client_notes")
      .select("id, body, author_id, created_at, updated_at, include_in_report")
      .eq("client_id", data.clientId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((rows ?? []).map((r: any) => r.author_id).filter(Boolean)));
    let authorMap = new Map<string, { display_name: string | null; email: string | null }>();
    if (ids.length) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, display_name, email")
        .in("id", ids);
      authorMap = new Map(
        (profiles ?? []).map((p: any) => [p.id, { display_name: p.display_name, email: p.email }]),
      );
    }
    const { canManageClientNotes } = await import("@/lib/notes-access.server");
    const canFlag = await canManageClientNotes(context.userId, data.clientId);
    return {
      canFlagForReport: canFlag,
      notes: (rows ?? []).map((r: any) => ({
        ...r,
        author_name:
          authorMap.get(r.author_id)?.display_name ??
          authorMap.get(r.author_id)?.email ??
          "Unknown",
        is_mine: r.author_id === context.userId,
      })),
    };
  });

export const addClientNote = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: { clientId: string; body: string; includeInReport?: boolean }) => i)
  .handler(async ({ data, context }) => {
    const body = data.body.trim();
    if (!body) throw new Error("Note can't be empty.");
    if (body.length > 20000) throw new Error("Note is too long (20,000 char max).");
    // Internal by default; promoting a note into the client-facing report is
    // staff-only and enforced here, not by hiding the control.
    const include = data.includeInReport === true;
    if (include) {
      const { assertCanManageClientNotes } = await import("@/lib/notes-access.server");
      await assertCanManageClientNotes(context.userId, data.clientId);
    }
    const { error } = await context.supabase
      .from("client_notes")
      .insert({
        client_id: data.clientId,
        body,
        author_id: context.userId,
        include_in_report: include,
      });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateClientNote = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: { noteId: string; body: string; includeInReport?: boolean }) => i)
  .handler(async ({ data, context }) => {
    const body = data.body.trim();
    if (!body) throw new Error("Note can't be empty.");
    if (body.length > 20000) throw new Error("Note is too long (20,000 char max).");
    const patch: { body: string; include_in_report?: boolean } = { body };
    if (data.includeInReport !== undefined) {
      const { data: row, error: readErr } = await context.supabase
        .from("client_notes")
        .select("client_id, include_in_report")
        .eq("id", data.noteId)
        .maybeSingle();
      if (readErr) throw new Error(readErr.message);
      if (!row) throw new Error("Note not found.");
      if (row.include_in_report !== data.includeInReport) {
        const { assertCanManageClientNotes } = await import("@/lib/notes-access.server");
        await assertCanManageClientNotes(context.userId, row.client_id);
        patch.include_in_report = data.includeInReport;
      }
    }
    const { error } = await context.supabase
      .from("client_notes")
      .update(patch)
      .eq("id", data.noteId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteClientNote = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: { noteId: string }) => i)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("client_notes").delete().eq("id", data.noteId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createClient = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: { name: string; xeroConnectionIds: string[]; firmId?: string }) => i)
  .handler(async ({ data, context }) => {
    const name = data.name.trim();
    if (!name) throw new Error("Client name is required.");
    if (data.xeroConnectionIds.length > 1) {
      throw new Error(
        "Only the Multi company tier can link more than one Xero organisation. Create the client with one org, then grant a viewer the Multi company tier to link more.",
      );
    }
    // Resolve target firm: explicit firmId (must be a member) OR caller's first firm.
    let firmId: string | null = data.firmId ?? null;
    if (firmId) {
      const { data: membership } = await context.supabase
        .from("firm_members")
        .select("firm_id")
        .eq("user_id", context.userId)
        .eq("firm_id", firmId)
        .eq("status", "active")
        .maybeSingle();
      // Invariant 3: super_admin alone grants nothing. Membership decides.
      if (!membership) throw new Error("You are not a member of that business.");
    } else {
      const { data: membership } = await context.supabase
        .from("firm_members")
        .select("firm_id")
        .eq("user_id", context.userId)
        .eq("status", "active")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      firmId = membership?.firm_id ?? null;
    }

    if (!firmId) throw new Error("No business associated with your account.");

    if (data.xeroConnectionIds.length > 0) {
      const { getUnassignedConnectionsForFirm } = await import("@/lib/xero/client-orgs.server");
      const available = await getUnassignedConnectionsForFirm(firmId, true);
      if (
        data.xeroConnectionIds.some((id) => !available.some((connection) => connection.id === id))
      ) {
        throw new Error(
          "A selected Xero organisation is already assigned or belongs to another organisation.",
        );
      }
    }

    // Enforce firm subscription client quota.
    const { clientLimitFor, firmLimitCatalogue } = await import("@/lib/firmPlans");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: firmRow }, { data: subRow }, { count: usedCount }, { data: planRows }] =
      await Promise.all([
        supabaseAdmin.from("firms").select("is_always_free").eq("id", firmId).maybeSingle(),
        supabaseAdmin
          .from("subscriptions")
          .select("tier, status, client_limit_override")
          .eq("firm_id", firmId)
          .maybeSingle(),
        supabaseAdmin
          .from("clients")
          .select("id", { count: "exact", head: true })
          .eq("firm_id", firmId),
        (supabaseAdmin as any).from("plan_levels").select("key, client_limit").eq("scope", "firm"),
      ]);
    const limit = clientLimitFor((subRow as any)?.tier, (firmRow as any)?.is_always_free, {
      override: (subRow as any)?.client_limit_override ?? null,
      catalogue: firmLimitCatalogue(planRows as any),
    });

    const status = (subRow as any)?.status ?? null;
    const okStatus =
      !status ||
      ["active", "trialing", "past_due"].includes(status) ||
      (firmRow as any)?.is_always_free;
    if (!okStatus) {
      throw new Error(
        "This business has no active subscription. Please renew before adding clients.",
      );
    }
    if ((usedCount ?? 0) >= limit) {
      throw new Error(
        `Client limit reached (${usedCount}/${limit}). Upgrade the subscription to add more clients.`,
      );
    }

    // Super admins manage organisations they don't belong to; RLS scopes inserts to firm owners.
    const writer: any = supabaseAdmin;

    const { friendlyPlanError } = await import("@/lib/plan-errors");
    const planLabel = ((subRow as any)?.tier as string | null) ?? null;

    const { data: client, error } = await writer
      .from("clients")
      .insert({ name, owner_user_id: context.userId, firm_id: firmId })
      .select("id")
      .single();
    if (error) throw new Error(friendlyPlanError(error, { planLabel }));

    if (data.xeroConnectionIds.length) {
      const rows = data.xeroConnectionIds.map((xero_connection_id) => ({
        client_id: client.id,
        xero_connection_id,
      }));
      const { error: e2 } = await writer.from("client_xero_orgs").insert(rows);
      if (e2) throw new Error(friendlyPlanError(e2, { planLabel }));
      await supabaseAdmin
        .from("xero_connections")
        .update({ firm_id: firmId })
        .in("id", data.xeroConnectionIds);
    }

    return { id: client.id };
  });

export const deleteClient = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: { clientId: string; disconnectXeroFiles?: boolean }) => i)
  .handler(async ({ data, context }) => {
    // Authorisation for the removal itself lives in the database routine
    // called below (owner, active organisation member, or super admin).


    // Optional, opt-in: detach this client's Xero files first. Read through the
    // caller's own permissions, so someone who cannot see the client's links
    // cannot disconnect anything. Each file is detached on its own; the refresh
    // token is never revoked (that is account-wide).
    const xero: Array<{ tenantName: string | null; result: string; detail?: string }> = [];
    if (data.disconnectXeroFiles) {
      const { data: links } = await context.supabase
        .from("client_xero_orgs")
        .select("xero_connection_id, xero_connections(tenant_id, tenant_name)")
        .eq("client_id", data.clientId);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { detachTenantFromXero } = await import("@/lib/xero/disconnect.server");

      for (const link of links ?? []) {
        const conn = (link as any).xero_connections as {
          tenant_id: string;
          tenant_name: string | null;
        } | null;
        if (!conn?.tenant_id) continue;

        // A Xero file linked to more than one client is left connected: the
        // other client still needs it. The database forbids this today, so it
        // is a guard rather than an expected path.
        const { count } = await supabaseAdmin
          .from("client_xero_orgs")
          .select("id", { count: "exact", head: true })
          .eq("xero_connection_id", (link as any).xero_connection_id);
        if ((count ?? 1) > 1) {
          xero.push({ tenantName: conn.tenant_name, result: "shared" });
          continue;
        }

        const outcome = await detachTenantFromXero(conn.tenant_id);
        if (outcome.result === "failed") {
          await supabaseAdmin.from("audit_log").insert({
            actor_user_id: context.userId,
            action: "xero_disconnect_failed",
            target_type: "xero_connection",
            target_id: conn.tenant_id,
            meta: {
              tenant_name: conn.tenant_name,
              reason: outcome.reason,
              source: "client_removal",
            },
          });
          xero.push({ tenantName: conn.tenant_name, result: "failed", detail: outcome.reason });
          continue;
        }

        await supabaseAdmin.from("audit_log").insert({
          actor_user_id: context.userId,
          action: "xero_disconnected",
          target_type: "xero_connection",
          target_id: conn.tenant_id,
          meta: {
            tenant_name: conn.tenant_name,
            outcome: outcome.result,
            other_files_still_connected: outcome.remaining,
            source: "client_removal",
          },
        });
        await supabaseAdmin.from("xero_connections").delete().eq("tenant_id", conn.tenant_id);
        xero.push({ tenantName: conn.tenant_name, result: outcome.result });
      }
    }

    // One database call does the whole removal in a single transaction:
    // it unmatches other clients' loan accounts that point at this client,
    // drops its consolidation group memberships, writes the audit row, then
    // deletes the client. Either all of it happens or none of it does.
    const { data: cleared, error } = await (context.supabase as any).rpc("remove_client", {
      _client_id: data.clientId,
    });
    if (error) throw new Error(error.message);
    const row = Array.isArray(cleared) ? cleared[0] : cleared;
    return {
      ok: true,
      xero,
      cleared: {
        groupsRemoved: row?.groups_removed ?? 0,
        pairingsCleared: row?.pairings_cleared ?? 0,
        referencingClients: (row?.referencing_clients ?? []) as string[],
      },
    };
  });

/**
 * What removing this client would clear elsewhere. Read through the same
 * gate as the removal itself; the rule lives in the database.
 */
export const getClientRemovalImpact = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: { clientId: string }) => i)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await (context.supabase as any).rpc("client_removal_impact", {
      _client_id: data.clientId,
    });
    if (error) throw new Error(error.message);
    const row = Array.isArray(rows) ? rows[0] : rows;
    return {
      groupCount: (row?.group_count ?? 0) as number,
      referencingClients: (row?.referencing_clients ?? []) as string[],
    };
  });


export const renameClient = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: { clientId: string; name: string }) => i)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("clients")
      .update({ name: data.name.trim() })
      .eq("id", data.clientId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateClientReportBasis = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: { clientId: string; basis: "accrual" | "cash" }) => i)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("clients")
      .update({ report_basis: data.basis })
      .eq("id", data.clientId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Lodgement cycles. Same authorisation as `updateClientReportBasis`: the write
 * goes through `context.supabase`, so the `clients` RLS policies decide — the
 * rule lives in one place (invariant 7) and is not restated here. Unlike report
 * basis these are ATO obligations, so a change is recorded in the audit log.
 */
export const updateClientLodgementCycles = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator(
    (i: {
      clientId: string;
      gstCycle?: "monthly" | "quarterly" | "annual" | "not_registered" | null;
      paygWithholdingCycle?: "monthly" | "quarterly" | "not_registered" | null;
    }) => i,
  )
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {};
    if ("gstCycle" in data) patch.gst_cycle = data.gstCycle ?? null;
    if ("paygWithholdingCycle" in data)
      patch.payg_withholding_cycle = data.paygWithholdingCycle ?? null;
    if (Object.keys(patch).length === 0) return { ok: true };

    const { data: rows, error } = await context.supabase
      .from("clients")
      .update(patch as any)
      .eq("id", data.clientId)
      .select("id, firm_id, gst_cycle, payg_withholding_cycle");
    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) throw new Error("You cannot change this client.");

    const { writeAudit } = await import("@/lib/audit.server");
    await writeAudit({
      actorUserId: context.userId,
      firmId: (rows[0] as any).firm_id ?? null,
      action: "client_lodgement_cycle_changed",
      targetType: "client",
      targetId: data.clientId,
      meta: patch,
    });
    return { ok: true };
  });

export const attachXeroOrg = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: { clientId: string; xeroConnectionId: string }) => i)
  .handler(async ({ data, context }) => {
    const {
      getClientOrgAllowance,
      getUnassignedConnectionsForFirm,
      userCanManageClient,
      getClientFirmId,
    } = await import("@/lib/xero/client-orgs.server");
    if (!(await userCanManageClient(context.userId, data.clientId)))
      throw new Error("You cannot manage this subscription.");
    const allowance = await getClientOrgAllowance(data.clientId);
    if (allowance.remaining < 1)
      throw new Error(
        `This subscription has reached its Xero file allowance of ${allowance.allowance}.`,
      );
    const firmId = await getClientFirmId(data.clientId);
    if (!firmId) throw new Error("This client is not attached to an organisation.");
    const available = await getUnassignedConnectionsForFirm(firmId, true);
    if (!available.some((connection) => connection.id === data.xeroConnectionId)) {
      throw new Error(
        "That Xero organisation is already assigned to another client subscription or is not yours to link.",
      );
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("client_xero_orgs")
      .insert({ client_id: data.clientId, xero_connection_id: data.xeroConnectionId });
    if (error) throw new Error(error.message);
    await supabaseAdmin
      .from("xero_connections")
      .update({ firm_id: firmId })
      .eq("id", data.xeroConnectionId);
    return { ok: true };
  });

export const setClientXeroAllowance = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: { clientId: string; allowance: number }) => i)
  .handler(async ({ data, context }) => {
    const allowance = Math.floor(data.allowance);
    if (!Number.isFinite(allowance) || allowance < 1 || allowance > 100) {
      throw new Error("Xero file allowance must be between 1 and 100.");
    }
    const { userCanManageClient, getClientOrgAllowance } =
      await import("@/lib/xero/client-orgs.server");
    if (!(await userCanManageClient(context.userId, data.clientId)))
      throw new Error("You cannot manage this subscription.");
    const current = await getClientOrgAllowance(data.clientId);
    if (!current.isMulti && allowance !== 1)
      throw new Error("Only Multi company subscriptions can allow more than one Xero file.");
    if (allowance < current.used)
      throw new Error(`Unlink Xero files before reducing the allowance below ${current.used}.`);
    // Super admins manage every organisation; RLS scopes updates to their own firms.
    const { data: superRow } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "super_admin")
      .maybeSingle();
    if (superRow) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error: adminErr } = await supabaseAdmin
        .from("clients")
        .update({ max_xero_orgs: allowance })
        .eq("id", data.clientId);
      if (adminErr) throw new Error(adminErr.message);
      return { allowance };
    }
    const { data: updated, error } = await context.supabase
      .from("clients")
      .update({ max_xero_orgs: allowance })
      .eq("id", data.clientId)
      .select("id");
    if (error) throw new Error(error.message);
    if (!updated || updated.length === 0)
      throw new Error("You cannot change this subscription's Xero file allowance.");

    return { allowance };
  });

export const detachXeroOrg = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error: readErr } = await supabaseAdmin
      .from("client_xero_orgs")
      .select("client_id, xero_connection_id")
      .eq("id", data.id)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!row) throw new Error("Xero link not found.");
    const { userCanManageClient } = await import("@/lib/xero/client-orgs.server");
    if (!(await userCanManageClient(context.userId, row.client_id)))
      throw new Error("You cannot unlink this Xero file.");
    const { error } = await supabaseAdmin.from("client_xero_orgs").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    // Release the organisation stamp so the file can be linked elsewhere.
    if (row?.xero_connection_id) {
      const { count } = await supabaseAdmin
        .from("client_xero_orgs")
        .select("id", { count: "exact", head: true })
        .eq("xero_connection_id", row.xero_connection_id);
      if ((count ?? 0) === 0)
        await supabaseAdmin
          .from("xero_connections")
          .update({ firm_id: null })
          .eq("id", row.xero_connection_id);
      await supabaseAdmin.from("audit_log").insert({
        actor_user_id: context.userId,
        action: "xero_file_unlinked",
        target_type: "xero_connection",
        target_id: row.xero_connection_id,
        meta: { client_id: row.client_id },
      });
    }
    return { ok: true };
  });

export const listClientAccess = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: { clientId: string }) => i)
  .handler(async ({ data, context }) => {
    // RLS: only advisors can SELECT access rows other than their own
    const { data: rows, error } = await context.supabase
      .from("client_access")
      .select("id, user_id, tier, created_at")
      .eq("client_id", data.clientId);
    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) return { access: [] };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name")
      .in(
        "id",
        rows.map((r) => r.user_id),
      );
    const map = new Map((profiles ?? []).map((p) => [p.id, p]));
    const authUsers = await listVerifiedAuthUsers(supabaseAdmin as any);
    const emailById = new Map(authUsers.map((user) => [user.id, user.email]));
    return {
      access: rows.map((r) => ({
        ...r,
        email: emailById.get(r.user_id) ?? null,
        display_name: map.get(r.user_id)?.display_name ?? null,
      })),
    };
  });

export const updateClientAccessTier = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: { id: string; tier: DashboardTier }) => i)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("client_access")
      .select("client_id")
      .eq("id", data.id)
      .maybeSingle();
    if (row?.client_id) {
      const { assertTierInPlanForClient } = await import("@/lib/plan-tiers.server");
      await assertTierInPlanForClient(context.userId, row.client_id, data.tier);
    }
    const { error } = await context.supabase
      .from("client_access")
      .update({ tier: data.tier })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const revokeClientAccess = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("client_access").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const inviteClientViewer = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: { clientId: string; email: string; tier: DashboardTier }) => i)
  .handler(async ({ data, context }) => {
    const email = data.email.trim().toLowerCase();
    if (!email.includes("@")) throw new Error("Please enter a valid email address.");

    // Advisor auth check: RLS on clients prevents non-advisors from reading any client they don't access.
    // But we want to make sure caller is advisor specifically.
    const { data: advisorRoles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "advisor");
    if (!advisorRoles || advisorRoles.length === 0) {
      throw new Error("Only advisors can invite client viewers.");
    }

    const { assertTierInPlanForClient } = await import("@/lib/plan-tiers.server");
    await assertTierInPlanForClient(context.userId, data.clientId, data.tier);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Identity is resolved from the verified authentication email, never mutable profile data.
    const existing = await findVerifiedAuthUserByEmail(supabaseAdmin as any, email);
    let userId = existing?.id;

    if (!userId) {
      const redirectTo = siteUrl("/auth");
      const { data: invited, error: e } = await (supabaseAdmin as any).auth.admin.inviteUserByEmail(
        email,
        redirectTo ? { redirectTo } : undefined,
      );
      if (e) throw new Error(e.message);
      userId = invited?.user?.id;
      if (!userId) throw new Error("Could not create invite.");
    }

    // Ensure viewer role (handle_new_user already inserts this for fresh users)
    await (supabaseAdmin as any)
      .from("user_roles")
      .upsert(
        { user_id: userId, role: "client_viewer" },
        { onConflict: "user_id,role", ignoreDuplicates: true },
      );

    // Grant client access
    const { error } = await (supabaseAdmin as any)
      .from("client_access")
      .upsert(
        { client_id: data.clientId, user_id: userId, tier: data.tier },
        { onConflict: "client_id,user_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true, invited: !existing };
  });

function validateViewerPassword(pw: string) {
  if (typeof pw !== "string" || pw.length < 8)
    throw new Error("Password must be at least 8 characters.");
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw))
    throw new Error("Password must include at least one letter and one number.");
}

export const createClientViewerWithPassword = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator(
    (i: { clientId: string; email: string; password: string; tier: DashboardTier }) => i,
  )
  .handler(async ({ data, context }) => {
    const email = data.email.trim().toLowerCase();
    if (!email.includes("@") || email.length > 254)
      throw new Error("Please enter a valid email address.");
    validateViewerPassword(data.password);

    const { data: advisorRoles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "advisor");
    if (!advisorRoles || advisorRoles.length === 0) {
      throw new Error("Only advisors can create client viewers.");
    }

    const { assertTierInPlanForClient } = await import("@/lib/plan-tiers.server");
    await assertTierInPlanForClient(context.userId, data.clientId, data.tier);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const existing = await findVerifiedAuthUserByEmail(supabaseAdmin as any, email);
    if (existing) throw new Error("An account with this email already exists.");

    const { data: created, error: cErr } = await (supabaseAdmin as any).auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
    });
    if (cErr) throw new Error(cErr.message);
    const userId = created?.user?.id;
    if (!userId) throw new Error("Could not create account.");

    await (supabaseAdmin as any)
      .from("user_roles")
      .upsert(
        { user_id: userId, role: "client_viewer" },
        { onConflict: "user_id,role", ignoreDuplicates: true },
      );

    const { error: aErr } = await (supabaseAdmin as any)
      .from("client_access")
      .upsert(
        { client_id: data.clientId, user_id: userId, tier: data.tier },
        { onConflict: "client_id,user_id" },
      );
    if (aErr) throw new Error(aErr.message);

    return { ok: true, email };
  });
