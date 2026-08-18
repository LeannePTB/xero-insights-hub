import { createFileRoute } from "@tanstack/react-router";

const XERO_TOKEN_URL = "https://identity.xero.com/connect/token";
const XERO_CONNECTIONS_URL = "https://api.xero.com/connections";
const XERO_CALLBACK_URL = "https://tractionadvisory.com.au/api/public/xero/callback";

type StateRow = {
  user_id: string | null;
  code_verifier: string | null;
  return_origin: string | null;
  created_at: string | null;
  client_id: string | null;
  firm_id: string | null;
  flow: string | null;
  known_tenant_ids: string[];
  /** For a reconnect: the single tenant the reconnect was started for. */
  pending_tenant_ids: string[];
};



export const Route = createFileRoute("/api/public/xero/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const error = url.searchParams.get("error");
        const rawErrorDescription = url.searchParams.get("error_description");
        const origin = `${url.protocol}//${url.host}`;
        let returnOrigin = origin;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        let stateRow: StateRow | null = null;

        if (state) {
          const { data, error: stateLookupErr } = await supabaseAdmin
            .from("xero_oauth_states")
            .select(
              "user_id, code_verifier, return_origin, created_at, client_id, firm_id, flow, known_tenant_ids, pending_tenant_ids",
            )

            .eq("state", state)
            .maybeSingle();
          if (!stateLookupErr && data) {
            stateRow = data as StateRow;
            returnOrigin = getSafeReturnOrigin(data.return_origin, data.code_verifier, origin);
          }
        }

        const flow: "connect" | "signin" | "onboard" | "reconnect" =
          stateRow?.flow === "signin"
            ? "signin"
            : stateRow?.flow === "onboard"
              ? "onboard"
              : stateRow?.flow === "reconnect"
                ? "reconnect"
                : "connect";
        const onboardReturnPath = stateRow?.firm_id ? `/firms/${stateRow.firm_id}` : "/dashboard";

        if (error) {
          const errorDescription = rawErrorDescription ?? "";
          console.error("Xero authorization failed", {
            error,
            errorDescription,
            callbackOrigin: origin,
            returnOrigin,
            flow,
          });
          if (state) await supabaseAdmin.from("xero_oauth_states").delete().eq("state", state);
          const message =
            error === "invalid_scope"
              ? `Xero rejected the requested read-only permissions${errorDescription ? ` (${errorDescription})` : ""}. The app now requests Xero's current granular Accounting API read scopes; please check those scopes are assigned to the Xero app, then try Reconnect again.`
              : error;
          const errorPath =
            flow === "signin"
              ? `/auth?xero_error=${encodeURIComponent(message)}`
              : flow === "onboard"
                ? `${onboardReturnPath}?xero_error=${encodeURIComponent(message)}`
                : `${stateRow?.client_id ? `/clients/${stateRow.client_id}/settings` : "/dashboard"}?xero_error=${encodeURIComponent(message)}`;
          return redirectTo(`${returnOrigin}${errorPath}`);
        }
        if (!code || !state)
          return redirectTo(`${returnOrigin}/dashboard?xero_error=missing_params`);

        const clientSecret = process.env.XERO_CLIENT_SECRET;
        const clientId = process.env.XERO_CLIENT_ID;
        if (!clientId || !clientSecret) {
          return redirectTo(
            `${returnOrigin}${flow === "signin" ? "/auth" : "/dashboard"}?xero_error=not_configured`,
          );
        }

        if (!stateRow) {
          return redirectTo(
            `${returnOrigin}${flow === "signin" ? "/auth" : "/dashboard"}?xero_error=invalid_state`,
          );
        }
        if (
          stateRow.created_at &&
          Date.now() - new Date(stateRow.created_at).getTime() > 15 * 60 * 1000
        ) {
          await supabaseAdmin.from("xero_oauth_states").delete().eq("state", state);
          return redirectTo(
            `${returnOrigin}${flow === "signin" ? "/auth" : "/dashboard"}?xero_error=state_expired`,
          );
        }
        const codeVerifier: string | null = stateRow.code_verifier ?? null;

        const tokenBody: Record<string, string> = {
          grant_type: "authorization_code",
          code,
          redirect_uri: XERO_CALLBACK_URL,
        };
        if (
          codeVerifier &&
          !codeVerifier.startsWith("https://") &&
          codeVerifier.length >= 43 &&
          codeVerifier.length <= 128
        ) {
          tokenBody.code_verifier = codeVerifier;
        }

        const tokenRes = await fetch(XERO_TOKEN_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
          },
          body: new URLSearchParams(tokenBody),
        });
        if (!tokenRes.ok) {
          const t = await tokenRes.text();
          console.error("Xero token exchange failed", {
            status: tokenRes.status,
            body: t,
            redirectUri: XERO_CALLBACK_URL,
            flow,
          });
          return redirectTo(
            `${returnOrigin}${flow === "signin" ? "/auth" : "/dashboard"}?xero_error=token_exchange`,
          );
        }
        const tokens = (await tokenRes.json()) as {
          access_token: string;
          refresh_token?: string;
          expires_in: number;
          scope: string;
          id_token?: string;
        };

        // ─────────────────────────────────────────────────────────────────────
        // Sign In with Xero — invite-only email match, then mint a Supabase
        // session via an admin-generated magic link.
        // ─────────────────────────────────────────────────────────────────────
        if (flow === "signin") {
          if (!tokens.id_token) {
            await supabaseAdmin.from("xero_oauth_states").delete().eq("state", state);
            console.error("Xero sign-in missing id_token", { scope: tokens.scope });
            return redirectTo(
              `${returnOrigin}/auth?xero_error=${encodeURIComponent("Xero did not return an identity token. Confirm openid/profile/email scopes are enabled on the Xero app.")}`,
            );
          }
          const claims = decodeJwtPayload(tokens.id_token);
          const xeroEmail =
            typeof claims?.email === "string" ? claims.email.toLowerCase().trim() : null;
          if (!xeroEmail) {
            await supabaseAdmin.from("xero_oauth_states").delete().eq("state", state);
            return redirectTo(
              `${returnOrigin}/auth?xero_error=${encodeURIComponent("Your Xero account did not return an email. Verify your Xero email is confirmed and try again.")}`,
            );
          }

          // Match against existing invited users only. We never auto-provision
          // — access is invite-only per app policy.
          let matchedUser: { id: string; email?: string | null } | null = null;
          let page = 1;
          // listUsers paginates; loop a few pages defensively.
          while (page <= 10) {
            const { data, error } = await supabaseAdmin.auth.admin.listUsers({
              page,
              perPage: 200,
            });
            if (error) {
              console.error("Xero sign-in: listUsers failed", error);
              return redirectTo(
                `${returnOrigin}/auth?xero_error=${encodeURIComponent("Could not verify your account. Please try again or sign in with email/password.")}`,
              );
            }
            const found = data.users.find(
              (u) => (u.email ?? "").toLowerCase().trim() === xeroEmail,
            );
            if (found) {
              matchedUser = { id: found.id, email: found.email };
              break;
            }
            if (data.users.length < 200) break;
            page += 1;
          }

          if (!matchedUser) {
            await supabaseAdmin.from("audit_log").insert({
              actor_user_id: null,
              action: "xero_signin_rejected_unknown_email",
              target_type: "auth_user",
              target_id: xeroEmail,
              meta: { reason: "not_invited" },
            });
            await supabaseAdmin.from("xero_oauth_states").delete().eq("state", state);
            return redirectTo(
              `${returnOrigin}/auth?xero_error=${encodeURIComponent(`No invited account found for ${xeroEmail}. Access is invite-only — contact Traction Advisory to be added.`)}`,
            );
          }

          // Mint a magic link the browser can follow to establish a session.
          const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
            type: "magiclink",
            email: matchedUser.email ?? xeroEmail,
            options: { redirectTo: `${returnOrigin}/auth?xero=signedin` },
          });
          if (linkErr || !linkData?.properties?.action_link) {
            console.error("Xero sign-in: generateLink failed", linkErr);
            return redirectTo(
              `${returnOrigin}/auth?xero_error=${encodeURIComponent("Could not start your session. Please try email/password sign-in.")}`,
            );
          }

          await supabaseAdmin.from("audit_log").insert({
            actor_user_id: matchedUser.id,
            action: "xero_signin_succeeded",
            target_type: "auth_user",
            target_id: matchedUser.id,
            meta: { email: xeroEmail },
          });

          await supabaseAdmin.from("xero_oauth_states").delete().eq("state", state);

          return redirectTo(linkData.properties.action_link);
        }

        // ─────────────────────────────────────────────────────────────────────
        // Data-connect flow (original behaviour)
        // ─────────────────────────────────────────────────────────────────────
        const userId = stateRow.user_id;
        if (!userId) {
          return redirectTo(`${returnOrigin}/dashboard?xero_error=invalid_state`);
        }
        if (!tokens.refresh_token) {
          return redirectTo(`${returnOrigin}/dashboard?xero_error=missing_refresh_token`);
        }

        const { encryptTokenB64 } = await import("@/lib/crypto.server");

        // Fetch tenants
        const tenantsRes = await fetch(XERO_CONNECTIONS_URL, {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        if (!tenantsRes.ok) {
          return redirectTo(`${returnOrigin}/dashboard?xero_error=tenants_lookup`);
        }
        const tenants = (await tenantsRes.json()) as Array<{
          tenantId: string;
          tenantName: string;
          tenantType: string;
        }>;

        const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
        let accessEnc: string;
        let refreshEnc: string;
        try {
          accessEnc = encryptTokenB64(tokens.access_token);
          refreshEnc = encryptTokenB64(tokens.refresh_token);
        } catch (storageErr) {
          console.error("Xero token encryption failed", storageErr);
          return redirectTo(`${returnOrigin}/dashboard?xero_error=token_storage`);
        }
        // ─────────────────────────────────────────────────────────────────────
        // Reconnect flow — handled BEFORE any connection row is written.
        //
        // Xero's consent screen returns every organisation the login can reach.
        // A reconnect means "refresh these Xero files": we touch only tenants
        // listed in pending_tenant_ids that are already linked to this
        // organisation, and ignore every other returned tenant entirely — no
        // row is created for them, no plan gate runs, no picker is offered,
        // nothing is linked. firm_id is never rewritten here; a reconnect
        // refreshes tokens and scopes only. One tenant or twelve, same code.
        // ─────────────────────────────────────────────────────────────────────
        if (flow === "reconnect") {
          const { isTenantAlreadyLinkedToFirm, getClientFirmId } = await import(
            "@/lib/xero/client-orgs.server"
          );
          const firmId =
            stateRow.firm_id ??
            (stateRow.client_id ? await getClientFirmId(stateRow.client_id) : null);
          const requestedTenantIds = [...new Set(stateRow.pending_tenant_ids ?? [])];
          // Single-file reconnects return exactly where they always did; the
          // bulk path returns to the organisation's settings page, where the
          // "Reconnect all Xero files" action lives.
          const backPath = stateRow.client_id
            ? `/clients/${stateRow.client_id}/settings`
            : firmId
              ? requestedTenantIds.length > 1
                ? `/firms/${firmId}/settings`
                : `/firms/${firmId}`
              : "/dashboard";
          const fail = async (message: string) => {
            await supabaseAdmin.from("xero_oauth_states").delete().eq("state", state);
            return redirectTo(`${returnOrigin}${backPath}?xero_error=${encodeURIComponent(message)}`);
          };

          if (requestedTenantIds.length < 1 || !firmId) {
            return await fail(
              "We couldn't tell which Xero organisation was being reconnected. Please start the reconnect again from that organisation's row.",
            );
          }


          const refreshedNames: string[] = [];
          const missedNames: string[] = [];
          const refreshedConnectionIds: string[] = [];

          for (const tenantId of requestedTenantIds) {
            const tenant = tenants.find((t) => t.tenantId === tenantId);
            if (!tenant) {
              missedNames.push(tenantId);
              continue;
            }
            if (!(await isTenantAlreadyLinkedToFirm(firmId, tenantId))) {
              // No longer linked here — never relink or recreate it.
              missedNames.push(tenant.tenantName ?? tenantId);
              unlinkedNames.push(tenant.tenantName ?? tenantId);
              continue;
            }

            // A tenant can have a row per staff member; the client link may
            // point at someone else's row. Refresh every row for this
            // organisation's tenant so the linked row is never left stale.
            const { data: refreshed, error: refreshErr } = await supabaseAdmin
              .from("xero_connections")
              .update({
                access_token_enc: accessEnc,
                refresh_token_enc: refreshEnc,
                expires_at: expiresAt,
                scopes: tokens.scope,
                status: "connected",
                disconnected_at: null,
              })
              .eq("tenant_id", tenantId)
              .or(`firm_id.eq.${firmId},firm_id.is.null`)
              .select("id");
            if (refreshErr) {
              console.error("xero reconnect token refresh failed", refreshErr);
              missedNames.push(tenant.tenantName ?? tenantId);
              continue;
            }
            refreshedNames.push(tenant.tenantName ?? tenantId);
            refreshedConnectionIds.push(...(refreshed ?? []).map((r: any) => r.id as string));
            // One audit row per Xero file — the trail is per file, not per batch.
            await supabaseAdmin.from("audit_log").insert({
              actor_user_id: userId,
              action: "xero_reconnected",
              target_type: "xero_connection",
              target_id: tenantId,
              meta: { firm_id: firmId, scopes: tokens.scope, bulk: requestedTenantIds.length > 1 },
            });
          }

          // Missing-scope results are cached for 60s — drop the affected
          // entries so widgets stop saying "Reconnect to enable this".
          try {
            const { invalidateMissingScopes } = await import("@/lib/xero/api.server");
            invalidateMissingScopes(refreshedConnectionIds);
          } catch {
            // cache invalidation is best-effort
          }

          await supabaseAdmin.from("xero_oauth_states").delete().eq("state", state);

          if (refreshedNames.length === 0) {
            return await fail(
              requestedTenantIds.length === 1
                ? "That Xero organisation wasn't authorised. Please try again and tick that organisation on Xero's consent screen."
                : "None of this organisation's Xero files were authorised. Run it again and tick every organisation you want reconnected.",
            );
          }

          const params = new URLSearchParams({
            xero: "reconnected",
            refreshed: String(refreshedNames.length),
            requested: String(requestedTenantIds.length),
          });
          if (missedNames.length > 0) {
            params.set("missed", missedNames.slice(0, 25).join("|"));
          }
          return redirectTo(`${returnOrigin}${backPath}?${params.toString()}`);
        }


        // ─────────────────────────────────────────────────────────────────────
        // Connect / onboard: store the authorised tenants. Rows introduced by
        // this authorisation are stamped with the organisation the flow was
        // started for, so unstamped connections stop appearing. Tenants already
        // known keep whatever organisation they belong to.
        // ─────────────────────────────────────────────────────────────────────
        const { getClientFirmId: resolveClientFirmId } = await import(
          "@/lib/xero/client-orgs.server"
        );
        const intendedFirmId =
          stateRow.firm_id ??
          (stateRow.client_id ? await resolveClientFirmId(stateRow.client_id) : null);
        const knownTenantIds = new Set(stateRow.known_tenant_ids ?? []);

        const baseRow = (t: (typeof tenants)[number]) => ({
          user_id: userId,
          tenant_id: t.tenantId,
          tenant_name: t.tenantName,
          tenant_type: t.tenantType,
          access_token_enc: accessEnc,
          refresh_token_enc: refreshEnc,
          expires_at: expiresAt,
          scopes: tokens.scope,
          status: "connected",
          disconnected_at: null,
        });
        const isNewTenant = (tenantId: string) =>
          Boolean(intendedFirmId) && !knownTenantIds.has(tenantId);

        // Stamped rows go in one at a time: the database enforces the Xero file
        // limit on insert, and one refused tenant must not lose the others. A
        // refused tenant is still stored (unstamped) so the authorisation isn't
        // silently dropped — it then shows up for a super admin to place.
        for (const t of tenants) {
          const row = baseRow(t);
          const stamped = isNewTenant(t.tenantId)
            ? { ...row, firm_id: intendedFirmId }
            : row;
          const { error: upsertErr } = await supabaseAdmin
            .from("xero_connections")
            .upsert(stamped, { onConflict: "user_id,tenant_id" });
          if (upsertErr) {
            const { isPlanLimitError } = await import("@/lib/plan-errors");
            if (stamped !== row && isPlanLimitError(upsertErr)) {
              const { error: retryErr } = await supabaseAdmin
                .from("xero_connections")
                .upsert(row, { onConflict: "user_id,tenant_id" });
              if (!retryErr) continue;
              console.error("xero_connections upsert failed", retryErr);
            } else {
              console.error("xero_connections upsert failed", upsertErr);
            }
            return redirectTo(`${returnOrigin}/dashboard?xero_error=db`);
          }
        }


        if (tenants.length > 0) {
          await supabaseAdmin.from("audit_log").insert(
            tenants.map((t) => ({
              actor_user_id: userId,
              action: "xero_connected",
              target_type: "xero_connection",
              target_id: t.tenantId,
              meta: { tenant_name: t.tenantName, scopes: tokens.scope, firm_id: intendedFirmId },
            })),
          );
        }



        // ─────────────────────────────────────────────────────────────────────
        // Onboard flow: create a client subscription per authorised Xero file
        // ─────────────────────────────────────────────────────────────────────

        if (flow === "onboard" && stateRow.firm_id) {
          const firmPath = `/firms/${stateRow.firm_id}`;
          if (tenants.length === 0) {
            await supabaseAdmin.from("xero_oauth_states").delete().eq("state", state);
            return redirectTo(
              `${returnOrigin}${firmPath}?xero_error=${encodeURIComponent("Xero didn't return any organisations for that login. Try again and tick the organisation you want on Xero's consent screen.")}`,
            );
          }
          try {
            // Xero returns every organisation this login has ever authorised —
            // only the ones that weren't known before this flow are "new".
            const known = new Set(stateRow.known_tenant_ids ?? []);
            const newTenantIds = tenants
              .map((t) => t.tenantId)
              .filter((id) => !known.has(id));

            if (newTenantIds.length === 1) {
              const { createClientsFromTenants } = await import("@/lib/xero/onboard.server");
              const outcome = await createClientsFromTenants({
                firmId: stateRow.firm_id,
                userId,
                tenantIds: newTenantIds,
              });
              await supabaseAdmin.from("xero_oauth_states").delete().eq("state", state);
              if (outcome.created.length === 1) {
                return redirectTo(
                  `${returnOrigin}/clients/${outcome.created[0].clientId}?xero=connected`,
                );
              }
              const reason = outcome.skippedAssigned.length
                ? `That Xero organisation is already linked to a client (${outcome.skippedAssigned.join(", ")}).`
                : outcome.skippedLimit.length
                  ? "Your plan's client limit has been reached, so no new client was created."
                  : "No new client could be created from that Xero login.";
              return redirectTo(
                `${returnOrigin}${firmPath}?xero_error=${encodeURIComponent(reason)}`,
              );
            }

            // Otherwise let the user confirm which organisations to turn into clients.
            await supabaseAdmin
              .from("xero_oauth_states")
              .update({
                pending_tenant_ids: tenants.map((t) => t.tenantId),
                completed_at: new Date().toISOString(),
              })
              .eq("state", state);
            return redirectTo(
              `${returnOrigin}${firmPath}?xero_pick=${encodeURIComponent(state)}`,
            );
          } catch (onboardErr: any) {
            console.error("Xero onboard client creation failed", onboardErr);
            await supabaseAdmin.from("xero_oauth_states").delete().eq("state", state);
            return redirectTo(
              `${returnOrigin}${firmPath}?xero_error=${encodeURIComponent(onboardErr?.message ?? "Could not create the client.")}`,
            );
          }
        }


        const initiatingClientId = stateRow.client_id ?? null;

        if (initiatingClientId) {
          const settingsPath = `/clients/${initiatingClientId}/settings`;
          const { getClientOrgAllowance, getSelectableConnectionsForClient, getClientFirmId } =
            await import("@/lib/xero/client-orgs.server");

          if (tenants.length === 0) {
            await supabaseAdmin.from("xero_oauth_states").delete().eq("state", state);
            return redirectTo(
              `${returnOrigin}${settingsPath}?xero_error=${encodeURIComponent("Xero didn't return any organisations for that login. Run Connect a Xero file again and tick the organisation you want on Xero's consent screen.")}`,
            );
          }

          const firmId = await getClientFirmId(initiatingClientId);
          const allTenantIds = tenants.map((t) => t.tenantId);

          const allowance = await getClientOrgAllowance(initiatingClientId);
          // Include organisations Xero already treats as "connected" — the user
          // still needs to be able to pick them for this subscription.
          const candidates = await getSelectableConnectionsForClient(
            initiatingClientId,
            allTenantIds,
            userId,
          );
          const selectable = candidates.filter((c) => c.available);

          if (
            candidates.length > 0 &&
            candidates.every((candidate) => candidate.linkedToThisClient)
          ) {
            await supabaseAdmin.from("xero_oauth_states").delete().eq("state", state);
            return redirectTo(`${returnOrigin}${settingsPath}?xero=connected`);
          }

          if (selectable.length === 1 && candidates.length === 1 && allowance.remaining > 0) {
            const { error: linkErr } = await supabaseAdmin.from("client_xero_orgs").insert({
              client_id: initiatingClientId,
              xero_connection_id: selectable[0].id,
            });
            if (linkErr)
              return redirectTo(
                `${returnOrigin}${settingsPath}?xero_error=${encodeURIComponent(linkErr.message)}`,
              );
            if (firmId)
              await supabaseAdmin
                .from("xero_connections")
                .update({ firm_id: firmId })
                .eq("id", selectable[0].id);
            await supabaseAdmin.from("audit_log").insert({
              actor_user_id: userId,
              action: "xero_file_linked",
              target_type: "xero_connection",
              target_id: selectable[0].id,
              meta: { client_id: initiatingClientId, firm_id: firmId },
            });
            await supabaseAdmin.from("xero_oauth_states").delete().eq("state", state);
            return redirectTo(`${returnOrigin}${settingsPath}?xero=connected`);
          }
          if (candidates.length > 0) {
            await supabaseAdmin
              .from("xero_oauth_states")
              .update({
                pending_tenant_ids: candidates.map((connection) => connection.tenant_id),
                completed_at: new Date().toISOString(),
              })
              .eq("state", state);
            return redirectTo(
              `${returnOrigin}${settingsPath}?xero=choose&state=${encodeURIComponent(state)}`,
            );
          }
          await supabaseAdmin.from("xero_oauth_states").delete().eq("state", state);
          return redirectTo(
            `${returnOrigin}${settingsPath}?xero_error=${encodeURIComponent("Those Xero organisations belong to another organisation in this app, so they can't be linked here.")}`,
          );
        }

        await supabaseAdmin.from("xero_oauth_states").delete().eq("state", state);
        return redirectTo(`${returnOrigin}/dashboard?xero=connected`);
      },
    },
  },
});

function redirectTo(url: string) {
  return new Response(null, { status: 302, headers: { Location: url } });
}

function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
  try {
    const parts = jwt.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    return JSON.parse(Buffer.from(padded, "base64").toString("utf-8"));
  } catch {
    return null;
  }
}

const ALLOWED_RETURN_HOSTS = new Set([
  "tractionadvisory.com.au",
  "www.tractionadvisory.com.au",
  "xero-shine-dashboards.lovable.app",
]);

function getSafeReturnOrigin(
  returnOrigin: string | null,
  legacyCodeVerifier: string | null,
  fallback: string,
) {
  const candidates = [returnOrigin, legacyCodeVerifier];
  for (const candidate of candidates) {
    if (typeof candidate !== "string" || !candidate.startsWith("https://")) continue;
    try {
      const parsed = new URL(candidate);
      if (ALLOWED_RETURN_HOSTS.has(parsed.hostname) || parsed.hostname.endsWith(".lovable.app")) {
        return parsed.origin;
      }
    } catch {
      // ignore
    }
  }
  return fallback;
}
