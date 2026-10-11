import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { randomBytes, createHash } from "crypto";
import { requireAal2 } from "@/lib/auth/require-aal2";
import { assertSuperAdminDb } from "@/lib/auth/super-admin.server";
import { xeroCallbackUrl, assertAppOrigin } from "@/lib/site-origin";

// System Admin → "Add organisation" → "Start from a Xero file" (Stage 1).
// Every step re-checks the caller in the database: the state row trigger, the
// pending-record trigger and both definer functions refuse anyone who is not
// an aal2 super admin, whatever the UI shows.

const XERO_AUTHORIZE_URL = "https://login.xero.com/identity/connect/authorize";
const base64url = (buf: Buffer) => buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const GENERIC = "This Xero selection has expired or isn't yours. Start again.";

function friendly(message: string | undefined): string {
  const m = message ?? "";
  if (/CLIENT_LIMIT_EXCEEDED/.test(m)) return "You've picked more Xero files than the clients in this package.";
  if (/TENANT_ALREADY_LINKED/.test(m)) return "One of those Xero files is already linked in the app, so it can't be used here.";
  if (/INVALID_ORGANISATION_NAME/.test(m)) return "Please enter an organisation name (2 to 120 characters).";
  if (/FIRST_TENANT_REQUIRED/.test(m)) return "Pick the first Xero file.";
  if (/PLAN_LIMIT/.test(m)) return "The package doesn't have room for that many clients or Xero files.";
  if (/INVALID_BILLING_MODE|INVALID_CLIENT_LIMIT|REQUIRES_ADVISORY/.test(m)) return "Check the package details and try again.";
  if (/MFA_REQUIRED|SESSION_IDLE/.test(m)) return "Please confirm your sign-in again.";
  return GENERIC;
}

export const startAdminOnboardConnect = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((input: unknown) => z.object({ origin: z.string().url().max(300) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdminDb(context.supabase);
    const clientId = process.env["XERO_CLIENT_ID"];
    if (!clientId) throw new Error("Xero is not configured yet.");
    const { enforceRateLimit } = await import("@/lib/rate-limit.server");
    await enforceRateLimit(`xero:admin_onboard:${context.userId}`, 10, 3600);

    const state = randomBytes(24).toString("hex");
    const codeVerifier = base64url(randomBytes(48));
    const codeChallenge = base64url(createHash("sha256").update(codeVerifier).digest());
    const returnOrigin = assertAppOrigin(data.origin);
    // Inserted as the caller: RLS (own row) + the trigger's super-admin check.
    const { error } = await (context.supabase as any).from("xero_oauth_states").insert({
      state,
      user_id: context.userId,
      code_verifier: codeVerifier,
      return_origin: returnOrigin,
      client_id: null,
      firm_id: null,
      flow: "admin_onboard",
      known_tenant_ids: [],
      pending_tenant_ids: [],
    });
    if (error) throw new Error("Could not start the Xero sign-in.");

    const { xeroRequiredScopeString } = await import("@/lib/xero/scopes.server");
    const url = new URL(XERO_AUTHORIZE_URL);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", xeroCallbackUrl());
    url.searchParams.set("scope", await xeroRequiredScopeString());
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    return { authorizeUrl: url.toString() };
  });

export const listAdminOnboardCandidates = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((input: unknown) => z.object({ pendingId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await (context.supabase as any).rpc("admin_onboard_candidates", { _pending_id: data.pendingId });
    if (error) throw new Error(friendly(error.message));
    return {
      candidates: ((rows ?? []) as any[]).map((r) => ({ tenantId: String(r.tenant_id), name: String(r.tenant_name), alreadyLinked: !!r.already_linked })),
    };
  });

const createInput = z.object({
  pendingId: z.string().uuid(),
  firstTenantId: z.string().min(1).max(255),
  extraTenantIds: z.array(z.string().min(1).max(255)).max(500),
  orgName: z.string().trim().min(2).max(120),
  clientLimit: z.number().int().min(1).max(9999),
  billingMode: z.enum(["bookkeeping", "external"]),
  advisory: z.boolean(),
  consolidation: z.boolean(),
  branding: z.boolean(),
  whiteLabel: z.boolean(),
  addTractionTeam: z.boolean().default(true),
  cards: z.array(z.string().min(1).max(100)).max(100).nullable(),
  ownerEmail: z.string().trim().max(254).email().nullable(),
});

export const createOrganisationFromXero = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((input: unknown) => createInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdminDb(context.supabase);
    // All-or-nothing in the database, as the caller.
    const { data: rows, error } = await (context.supabase as any).rpc("admin_onboard_organisation_from_xero", {
      _pending_id: data.pendingId,
      _first_tenant: data.firstTenantId,
      _extra_tenants: data.extraTenantIds,
      _org_name: data.orgName,
      _client_limit: data.clientLimit,
      _billing_mode: data.billingMode,
      _advisory: data.advisory,
      _consolidation: data.advisory && data.consolidation,
      _branding: data.advisory && data.branding,
      _white_label: data.whiteLabel,
      _cards: data.cards,
      _add_practice_team: data.addTractionTeam,
    });
    if (error) throw new Error(friendly(error.message));
    const row = Array.isArray(rows) ? rows[0] : rows;
    const firmId: string | undefined = row?.firm_id;
    if (!firmId) throw new Error(GENERIC);
    const tenantIds: string[] = row?.tenant_ids ?? [];

    // First sync for each new client — fire-and-forget, never blocks.
    try {
      const { scheduleFirstLinkRefresh } = await import("@/lib/xero/first-link-refresh.server");
      for (const t of tenantIds) scheduleFirstLinkRefresh(t);
    } catch {
      /* the organisation exists; the overnight refresh will catch up */
    }

    // Optional owner invite, the normal one. The Xero login is never used to
    // create or link an owner account.
    let invite: { emailStatus: string; inviteUrl: string } | null = null;
    if (data.ownerEmail) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { issueOwnerInvite } = await import("@/lib/owner-invite.server");
        const { siteUrl } = await import("@/lib/site-origin");
        const { token, emailStatus } = await issueOwnerInvite({
          admin: supabaseAdmin,
          firm: { id: firmId, name: data.orgName },
          email: data.ownerEmail.toLowerCase(),
          invitedBy: context.userId,
        });
        invite = { emailStatus, inviteUrl: siteUrl(`/signup/${token}`) };
      } catch {
        invite = { emailStatus: "failed", inviteUrl: "" };
      }
    }
    return { firmId, clientCount: (row?.client_ids ?? []).length as number, invite };
  });
