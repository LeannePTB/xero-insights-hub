import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { randomBytes, createHash } from "crypto";
import { xeroScopeString, xeroIdentityScopeString } from "@/lib/xero/scopes";

function base64url(buf: Buffer) {
  return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

const XERO_AUTHORIZE_URL = "https://login.xero.com/identity/connect/authorize";
const CANONICAL_XERO_APP_ORIGIN = "https://tractionadvisory.com.au";
const XERO_CALLBACK_URL = `${CANONICAL_XERO_APP_ORIGIN}/api/public/xero/callback`;
const SCOPES = xeroScopeString();
const IDENTITY_SCOPES = xeroIdentityScopeString();

/**
 * Sign In with Xero (Xero certification checkpoint 1).
 *
 * Unauthenticated server fn — anyone visiting /auth can call it. We mint a
 * PKCE state row with flow='signin' and no user_id, then redirect to Xero's
 * identity flow. On callback, we match the returned id_token's email against
 * an existing invited user; unknown emails are rejected (invite-only).
 */
export const startXeroSignIn = createServerFn({ method: "POST" })
  .inputValidator((input: { origin: string }) => input)
  .handler(async ({ data }) => {
    const clientId = process.env.XERO_CLIENT_ID;
    if (!clientId) {
      throw new Error("Sign In with Xero is not configured yet.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const state = randomBytes(24).toString("hex");
    const codeVerifier = base64url(randomBytes(48));
    const codeChallenge = base64url(createHash("sha256").update(codeVerifier).digest());
    const returnOrigin = normalizeOrigin(data.origin);

    const { error } = await supabaseAdmin.from("xero_oauth_states").insert({
      state,
      user_id: null,
      code_verifier: codeVerifier,
      return_origin: returnOrigin,
      client_id: null,
      flow: "signin",
    });
    if (error) throw new Error(error.message);

    const url = new URL(XERO_AUTHORIZE_URL);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", XERO_CALLBACK_URL);
    url.searchParams.set("scope", IDENTITY_SCOPES);
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    return { authorizeUrl: url.toString() };
  });

export const listXeroConnections = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("xero_connections")
      .select(
        "id, tenant_id, tenant_name, tenant_type, created_at, status, disconnected_at, base_currency",
      )
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { connections: data ?? [] };
  });

/**
 * Lookup the base currency for a single tenant (e.g., AUD, NZD, USD).
 * Widgets call this so amounts are formatted in the org's actual currency
 * rather than hard-coded AUD — required for Xero certification data integrity.
 */
export const getTenantCurrency = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("xero_connections")
      .select("base_currency")
      .eq("tenant_id", data.tenantId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    let currency: string = (row?.base_currency as string | null) ?? "";

    // Lazy backfill — if we have a connection but never captured the
    // currency (older rows), pull it from /Organisation now and cache.
    if (!currency) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { getConnectionByTenant, xeroGet } = await import("@/lib/xero/api.server");
        const conn = await getConnectionByTenant(data.tenantId);
        const org = await xeroGet<{ Organisations?: Array<{ BaseCurrency?: string }> }>(
          conn,
          "Organisation",
        );
        const cc = org.Organisations?.[0]?.BaseCurrency;
        if (cc && typeof cc === "string") {
          currency = cc;
          await supabaseAdmin
            .from("xero_connections")
            .update({ base_currency: cc })
            .eq("tenant_id", data.tenantId);
        }
      } catch (e) {
        console.warn("[xero] currency backfill failed", e instanceof Error ? e.message : e);
      }
    }
    return { currency: currency || "AUD" };
  });

export const checkXeroConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string }) => input)
  .handler(async ({ data }) => {
    const { getConnectionByTenant } = await import("@/lib/xero/api.server");
    try {
      await getConnectionByTenant(data.tenantId);
      return { ok: true as const, needsReconnect: false as const };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const lower = msg.toLowerCase();
      const needsReconnect =
        lower.includes("reconnect required") ||
        lower.includes("invalid_grant") ||
        lower.includes("missing tokens") ||
        lower.includes("connection not found");
      return { ok: false as const, needsReconnect, message: msg };
    }
  });

export const startXeroConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { origin: string; clientId?: string }) => input)
  .handler(async ({ data, context }) => {
    const clientId = process.env.XERO_CLIENT_ID;
    if (!clientId) {
      throw new Error(
        "Xero is not configured yet. The app owner needs to add XERO_CLIENT_ID and XERO_CLIENT_SECRET.",
      );
    }

    // Rate limit: 10 Xero connect starts per user per hour.
    const { enforceRateLimit } = await import("@/lib/rate-limit.server");
    await enforceRateLimit(`xero:connect:${context.userId}`, 10, 3600);

    let knownTenantIds: string[] = [];
    if (data.clientId) {
      const { userCanManageClient, getClientOrgAllowance, getClientFirmConnectionAccess } =
        await import("@/lib/xero/client-orgs.server");
      if (!(await userCanManageClient(context.userId, data.clientId)))
        throw new Error("You cannot manage this client subscription.");
      const access = await getClientFirmConnectionAccess(data.clientId);
      if (access.state === "locked")
        throw new Error(`${access.firmName}'s subscription is not active.`);
      if (access.connectionCount >= access.connectionLimit) {
        throw new Error(
          `${access.firmName} has reached its plan limit of ${access.connectionLimit} Xero file${access.connectionLimit === 1 ? "" : "s"}.`,
        );
      }
      const allowance = await getClientOrgAllowance(data.clientId);
      if (allowance.remaining < 1)
        throw new Error(
          `This subscription has reached its Xero file allowance of ${allowance.allowance}.`,
        );
      const { data: known, error: knownError } = await context.supabase
        .from("xero_connections")
        .select("tenant_id");
      if (knownError) throw new Error(knownError.message);
      knownTenantIds = [...new Set((known ?? []).map((connection) => connection.tenant_id))];
    }

    const state = randomBytes(24).toString("hex");
    // OAuth 2.0 PKCE (S256) — required by Xero security standard.
    const codeVerifier = base64url(randomBytes(48));
    const codeChallenge = base64url(createHash("sha256").update(codeVerifier).digest());
    const returnOrigin = normalizeOrigin(data.origin);
    const { error } = await context.supabase.from("xero_oauth_states").insert({
      state,
      user_id: context.userId,
      code_verifier: codeVerifier,
      return_origin: returnOrigin,
      client_id: data.clientId ?? null,
      known_tenant_ids: knownTenantIds,
      pending_tenant_ids: [],
    });
    if (error) throw new Error(error.message);

    const url = new URL(XERO_AUTHORIZE_URL);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", XERO_CALLBACK_URL);
    url.searchParams.set("scope", SCOPES);
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    console.info("Starting Xero OAuth", {
      redirectUri: XERO_CALLBACK_URL,
      scopes: SCOPES,
      returnOrigin,
    });
    return { authorizeUrl: url.toString() };
  });

/**
 * Onboard flow: authorise a Xero file first, then create the client
 * subscription automatically from the Xero organisation name on callback.
 */
export const startXeroOnboardConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { origin: string; firmId: string }) => input)
  .handler(async ({ data, context }) => {
    const clientId = process.env.XERO_CLIENT_ID;
    if (!clientId) {
      throw new Error(
        "Xero is not configured yet. The app owner needs to add XERO_CLIENT_ID and XERO_CLIENT_SECRET.",
      );
    }

    const { enforceRateLimit } = await import("@/lib/rate-limit.server");
    await enforceRateLimit(`xero:connect:${context.userId}`, 10, 3600);

    const { assertFirmCanAddClient } = await import("@/lib/xero/onboard.server");
    await assertFirmCanAddClient(data.firmId, context.userId);

    const { data: known, error: knownError } = await context.supabase
      .from("xero_connections")
      .select("tenant_id");
    if (knownError) throw new Error(knownError.message);
    const knownTenantIds = [...new Set((known ?? []).map((c) => c.tenant_id))];

    const state = randomBytes(24).toString("hex");
    const codeVerifier = base64url(randomBytes(48));
    const codeChallenge = base64url(createHash("sha256").update(codeVerifier).digest());
    const returnOrigin = normalizeOrigin(data.origin);
    const { error } = await context.supabase.from("xero_oauth_states").insert({
      state,
      user_id: context.userId,
      code_verifier: codeVerifier,
      return_origin: returnOrigin,
      client_id: null,
      firm_id: data.firmId,
      flow: "onboard",
      known_tenant_ids: knownTenantIds,
      pending_tenant_ids: [],
    } as any);
    if (error) throw new Error(error.message);

    const url = new URL(XERO_AUTHORIZE_URL);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", XERO_CALLBACK_URL);
    url.searchParams.set("scope", SCOPES);
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    return { authorizeUrl: url.toString() };
  });



export const listClientXeroOptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { clientId: string; state?: string }) => input)
  .handler(async ({ data, context }) => {
    const { userCanManageClient, getClientOrgAllowance, getSelectableConnectionsForClient } =
      await import("@/lib/xero/client-orgs.server");
    if (!(await userCanManageClient(context.userId, data.clientId)))
      throw new Error("You cannot manage this client subscription.");
    const allowance = await getClientOrgAllowance(data.clientId);
    if (!data.state) return { connections: [], allowance };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: oauthState } = await supabaseAdmin
      .from("xero_oauth_states")
      .select("pending_tenant_ids, expires_at, completed_at")
      .eq("state", data.state)
      .eq("user_id", context.userId)
      .eq("client_id", data.clientId)
      .maybeSingle();
    if (!oauthState?.completed_at || new Date(oauthState.expires_at).getTime() < Date.now())
      return { connections: [], allowance };
    const connections = await getSelectableConnectionsForClient(
      data.clientId,
      oauthState.pending_tenant_ids ?? [],
      context.userId,
    );
    return { connections, allowance };
  });

export const linkClientXeroOptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { clientId: string; state: string; connectionIds: string[] }) => input)
  .handler(async ({ data, context }) => {
    const uniqueIds = [...new Set(data.connectionIds)];
    const {
      userCanManageClient,
      getClientOrgAllowance,
      getSelectableConnectionsForClient,
      getClientFirmId,
    } = await import("@/lib/xero/client-orgs.server");
    if (!(await userCanManageClient(context.userId, data.clientId)))
      throw new Error("You cannot manage this client subscription.");
    const allowance = await getClientOrgAllowance(data.clientId);
    if (uniqueIds.length < 1) throw new Error("Select at least one Xero organisation.");
    if (uniqueIds.length > allowance.remaining)
      throw new Error(
        `You can link ${allowance.remaining} more Xero file${allowance.remaining === 1 ? "" : "s"}.`,
      );
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: oauthState } = await supabaseAdmin
      .from("xero_oauth_states")
      .select("pending_tenant_ids, expires_at, completed_at")
      .eq("state", data.state)
      .eq("user_id", context.userId)
      .eq("client_id", data.clientId)
      .maybeSingle();
    if (!oauthState?.completed_at || new Date(oauthState.expires_at).getTime() < Date.now())
      throw new Error("This Xero selection has expired. Connect again.");
    const candidates = await getSelectableConnectionsForClient(
      data.clientId,
      oauthState.pending_tenant_ids ?? [],
      context.userId,
    );
    const selectable = candidates.filter((connection) => connection.available);
    if (uniqueIds.some((id) => !selectable.some((connection) => connection.id === id))) {
      throw new Error(
        "One of those Xero organisations is no longer available — it may already be linked to another subscription.",
      );
    }
    const { error } = await supabaseAdmin
      .from("client_xero_orgs")
      .insert(
        uniqueIds.map((xero_connection_id) => ({ client_id: data.clientId, xero_connection_id })),
      );
    if (error) throw new Error(error.message);
    // Stamp the organisation onto the connections so they stay scoped to it.
    const firmId = await getClientFirmId(data.clientId);
    if (firmId) {
      await supabaseAdmin.from("xero_connections").update({ firm_id: firmId }).in("id", uniqueIds);
    }
    await supabaseAdmin.from("audit_log").insert(
      uniqueIds.map((connectionId) => ({
        actor_user_id: context.userId,
        action: "xero_file_linked",
        target_type: "xero_connection",
        target_id: connectionId,
        meta: { client_id: data.clientId, firm_id: firmId },
      })),
    );
    await supabaseAdmin.from("xero_oauth_states").delete().eq("state", data.state);
    return { linked: uniqueIds.length };
  });

/**
 * Move a Xero file from the subscription that currently holds it onto this
 * client subscription. Requires manage rights on both sides (super admins have
 * them everywhere) and a free slot in the target's file allowance.
 */
export const moveXeroFileToClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { clientId: string; connectionId: string }) => input)
  .handler(async ({ data, context }) => {
    const { userCanManageClient, getClientOrgAllowance, getClientFirmId, isSuperAdmin } =
      await import("@/lib/xero/client-orgs.server");
    if (!(await userCanManageClient(context.userId, data.clientId))) {
      throw new Error("You cannot manage this client subscription.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing, error: lookupErr } = await supabaseAdmin
      .from("client_xero_orgs")
      .select("id, client_id, xero_connection_id, clients(name, firm_id)")
      .eq("xero_connection_id", data.connectionId)
      .maybeSingle();
    if (lookupErr) throw new Error(lookupErr.message);
    if (!existing)
      throw new Error(
        "That Xero file is no longer linked to another subscription — refresh and link it directly.",
      );
    if (existing.client_id === data.clientId)
      throw new Error("That Xero file is already on this subscription.");

    const superAdmin = await isSuperAdmin(context.userId);
    const targetFirmId = await getClientFirmId(data.clientId);
    const sourceFirmId = (existing.clients as any)?.firm_id ?? null;
    // Xero files never cross organisations — not even for platform admins.
    if (!targetFirmId || sourceFirmId !== targetFirmId) {
      throw new Error("That Xero file belongs to another organisation and cannot be moved here.");
    }
    if (!superAdmin && !(await userCanManageClient(context.userId, existing.client_id))) {
      throw new Error("You cannot manage the subscription that currently holds this Xero file.");
    }


    const allowance = await getClientOrgAllowance(data.clientId);
    if (allowance.remaining < 1) {
      throw new Error(
        `This subscription has reached its Xero file allowance of ${allowance.allowance}.`,
      );
    }

    const { error: moveError } = await (supabaseAdmin as any).rpc("move_xero_file_to_client", {
      _connection_id: data.connectionId,
      _target_client_id: data.clientId,
      _actor_user_id: context.userId,
    });
    if (moveError) throw new Error(moveError.message);
    await supabaseAdmin.from("audit_log").insert({
      actor_user_id: context.userId,
      action: "xero_file_moved",
      target_type: "xero_connection",
      target_id: data.connectionId,
      meta: {
        from_client_id: existing.client_id,
        to_client_id: data.clientId,
        from_client_name: (existing.clients as any)?.name ?? null,
      },
    });
    return { moved: true as const };
  });

const ALLOWED_CUSTOM_HOSTS = new Set(["tractionadvisory.com.au", "www.tractionadvisory.com.au"]);

function normalizeOrigin(origin: string) {
  const parsed = new URL(origin);
  if (parsed.hostname === "localhost") return parsed.origin;
  if (parsed.protocol !== "https:") {
    throw new Error("Invalid app origin for Xero connection.");
  }

  const projectId = process.env.LOVABLE_PROJECT_ID ?? process.env.__LOVABLE_PROJECT_ID;
  const allowedHosts = new Set<string>(ALLOWED_CUSTOM_HOSTS);
  if (projectId) {
    allowedHosts.add(`${projectId}.lovableproject.com`);
    allowedHosts.add(`id-preview--${projectId}.lovable.app`);
    allowedHosts.add(`project--${projectId}.lovable.app`);
    allowedHosts.add(`project--${projectId}-dev.lovable.app`);
  }

  // Allow any *.lovable.app host (covers published slug subdomains).
  if (parsed.hostname.endsWith(".lovable.app")) return CANONICAL_XERO_APP_ORIGIN;
  if (allowedHosts.has(parsed.hostname)) return CANONICAL_XERO_APP_ORIGIN;

  throw new Error("Invalid app origin for Xero connection.");
}

export const disconnectXero = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string }) => input)
  .handler(async ({ data, context }) => {
    // Look up the connection row (we need the Xero connection id + tokens to
    // revoke remotely before deleting locally).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error: lookupErr } = await supabaseAdmin
      .from("xero_connections")
      .select("id, tenant_id, tenant_name, user_id, client_xero_orgs(client_id)")
      .eq("tenant_id", data.tenantId)
      .maybeSingle();
    if (lookupErr) throw new Error(lookupErr.message);
    if (!row) throw new Error("Xero connection not found.");
    const linkedClientId = (row.client_xero_orgs as Array<{ client_id: string }> | null)?.[0]
      ?.client_id;
    if (linkedClientId) {
      const { userCanManageClient } = await import("@/lib/xero/client-orgs.server");
      if (!(await userCanManageClient(context.userId, linkedClientId)))
        throw new Error("You cannot disconnect this Xero file.");
    } else if (row.user_id !== context.userId)
      throw new Error("You cannot disconnect this Xero file.");

    // Best-effort remote revoke. Xero requires us to call DELETE /connections
    // and revoke the refresh token so the org no longer shows our app as
    // connected (Xero certification checkpoint 3). A failure here must not
    // block the local cleanup.
    if (row) {
      try {
        const { getConnectionByTenant } = await import("@/lib/xero/api.server");

        let conn: Awaited<ReturnType<typeof getConnectionByTenant>> | null = null;
        try {
          conn = await getConnectionByTenant(data.tenantId);
        } catch (e) {
          console.warn(
            "[xero] disconnect: could not materialize tokens for revoke",
            e instanceof Error ? e.message : e,
          );
        }

        const clientId = process.env.XERO_CLIENT_ID;
        const clientSecret = process.env.XERO_CLIENT_SECRET;

        if (conn) {
          // 1. DELETE /connections/{id} — tells Xero this organisation is no
          //    longer connected to our app.
          try {
            const delRes = await fetch(`https://api.xero.com/connections/${row.id}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${conn.access_token}` },
            });
            if (!delRes.ok && delRes.status !== 404 && delRes.status !== 401) {
              console.warn(
                `[xero] DELETE /connections returned ${delRes.status}: ${await delRes.text()}`,
              );
            }
          } catch (e) {
            console.warn("[xero] DELETE /connections failed", e instanceof Error ? e.message : e);
          }

          // 2. Revoke the refresh token at the identity server.
          if (clientId && clientSecret) {
            try {
              const revRes = await fetch("https://identity.xero.com/connect/revocation", {
                method: "POST",
                headers: {
                  "Content-Type": "application/x-www-form-urlencoded",
                  Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
                },
                body: new URLSearchParams({ token: conn.refresh_token }),
              });
              if (!revRes.ok) {
                console.warn(`[xero] revoke returned ${revRes.status}: ${await revRes.text()}`);
              }
            } catch (e) {
              console.warn("[xero] revoke failed", e instanceof Error ? e.message : e);
            }
          }
        }

        // 3. Audit-log the disconnect before removing the row.
        await supabaseAdmin.from("audit_log").insert({
          actor_user_id: context.userId,
          action: "xero_disconnected",
          target_type: "xero_connection",
          target_id: row.tenant_id,
          meta: { tenant_name: row.tenant_name },
        });
      } catch (e) {
        console.error("[xero] disconnect remote cleanup error", e);
      }
    }

    const { error } = await supabaseAdmin
      .from("xero_connections")
      .delete()
      .eq("tenant_id", data.tenantId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Onboard picker: list the Xero organisations returned by the last onboard
 * authorisation, flagging which can become new client subscriptions.
 */
export const listOnboardCandidates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { firmId: string; state: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getFirmClientCapacity } = await import("@/lib/xero/onboard.server");

    const { data: oauthState } = await supabaseAdmin
      .from("xero_oauth_states")
      .select("pending_tenant_ids, known_tenant_ids, expires_at, completed_at, firm_id")
      .eq("state", data.state)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (
      !oauthState?.completed_at ||
      (oauthState as any).firm_id !== data.firmId ||
      new Date(oauthState.expires_at).getTime() < Date.now()
    ) {
      return { candidates: [], remaining: 0 };
    }

    const tenantIds = oauthState.pending_tenant_ids ?? [];
    const known = new Set(oauthState.known_tenant_ids ?? []);
    const [{ data: connections }, { data: assigned }, capacity] = await Promise.all([
      supabaseAdmin
        .from("xero_connections")
        .select("id, tenant_id, tenant_name")
        .eq("user_id", context.userId)
        .in("tenant_id", tenantIds.length ? tenantIds : ["__none__"]),
      supabaseAdmin.from("client_xero_orgs").select("xero_connection_id, client_id"),
      getFirmClientCapacity(data.firmId),
    ]);
    const assignedIds = new Set((assigned ?? []).map((r) => r.xero_connection_id));

    const candidates = (connections ?? []).map((c) => {
      const linked = assignedIds.has(c.id);
      const isNew = !known.has(c.tenant_id);
      return {
        tenantId: c.tenant_id,
        name: c.tenant_name ?? "Untitled organisation",
        isNew,
        alreadyLinked: linked,
        available: !linked,
      };
    });
    candidates.sort((a, b) => Number(b.isNew) - Number(a.isNew) || a.name.localeCompare(b.name));
    return { candidates, remaining: capacity.remaining };
  });

/** Create client subscriptions only for the Xero organisations the user picked. */
export const createClientsFromSelectedTenants = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { firmId: string; state: string; tenantIds: string[] }) => input)
  .handler(async ({ data, context }) => {
    const uniqueIds = [...new Set(data.tenantIds)];
    if (uniqueIds.length < 1) throw new Error("Select at least one Xero organisation.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { assertFirmCanAddClient, createClientsFromTenants } = await import(
      "@/lib/xero/onboard.server"
    );
    await assertFirmCanAddClient(data.firmId, context.userId);

    const { data: oauthState } = await supabaseAdmin
      .from("xero_oauth_states")
      .select("pending_tenant_ids, expires_at, completed_at, firm_id")
      .eq("state", data.state)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (
      !oauthState?.completed_at ||
      (oauthState as any).firm_id !== data.firmId ||
      new Date(oauthState.expires_at).getTime() < Date.now()
    ) {
      throw new Error("This Xero selection has expired. Start again.");
    }
    const pending = new Set(oauthState.pending_tenant_ids ?? []);
    if (uniqueIds.some((id) => !pending.has(id))) {
      throw new Error("One of those Xero organisations is no longer part of this authorisation.");
    }

    const outcome = await createClientsFromTenants({
      firmId: data.firmId,
      userId: context.userId,
      tenantIds: uniqueIds,
    });
    await supabaseAdmin.from("xero_oauth_states").delete().eq("state", data.state);
    return outcome;
  });
