import { createServerFn } from "@tanstack/react-start";
import { createHash, randomBytes } from "crypto";
import { requireAal2 } from "@/lib/auth/require-aal2";
import { findVerifiedAuthUserByEmail } from "@/lib/auth-users.server";
import { siteUrl } from "@/lib/site-origin";
import { ALL_TIERS } from "@/lib/tiers";
import type { DashboardTier } from "@/lib/tiers";

/**
 * Client viewers at organisation level (People and access, Batch 3).
 *
 * Every authorisation decision here is a database call:
 * `public.me_can_manage_firm_viewers` / `me_can_manage_client_viewers` wrap
 * `app_private.can_manage_client_viewers` (organisation owner, or a practice
 * team member with an active membership of THAT organisation). This file never
 * reads `firm_members`, `user_roles`, `client_access` or `firm_viewer_access`
 * to decide who may do what.
 *
 * A standing grant is read-only by construction: it lives in
 * `firm_viewer_access`, which is referenced only by read predicates
 * (`app_private.has_standing_client_access` → `has_client_read_access`).
 */

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function normaliseEmail(raw: string) {
  const e = (raw ?? "").trim().toLowerCase();
  if (!e || e.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
    throw new Error("Please enter a valid email address.");
  }
  return e;
}

function assertTier(t: string): DashboardTier {
  if (!(ALL_TIERS as readonly string[]).includes(t)) throw new Error("Invalid dashboard level.");
  return t as DashboardTier;
}

export type StandingViewer = {
  id: string;
  userId: string;
  tier: DashboardTier;
  email: string | null;
  displayName: string | null;
  createdAt: string;
};

/** Standing ("every client") viewer grants for one organisation. */
export const listStandingViewers = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: { firmId: string }) => i)
  .handler(async ({ data, context }): Promise<{
    viewers: StandingViewer[];
    canManage: boolean;
    firmName: string | null;
  }> => {
    const [{ data: rows, error }, { data: canManage }, { data: firm }] = await Promise.all([
      (context.supabase as any).rpc("firm_viewers", { _firm_id: data.firmId }),
      (context.supabase as any).rpc("me_can_manage_firm_viewers", { _firm_id: data.firmId }),
      (context.supabase as any).from("firms").select("name").eq("id", data.firmId).maybeSingle(),
    ]);
    if (error) {
      if (/cannot view/i.test(error.message)) {
        return { viewers: [], canManage: false, firmName: (firm as any)?.name ?? null };
      }
      throw new Error(error.message);
    }
    return {
      firmName: (firm as any)?.name ?? null,
      viewers: ((rows ?? []) as any[]).map((r) => ({
        id: r.id,
        userId: r.user_id,
        tier: r.tier,
        email: r.email ?? null,
        displayName: r.display_name ?? null,
        createdAt: r.created_at,
      })),
      canManage: canManage === true,
    };
  });

/** Change the level on a standing grant. Audited in the database. */
export const setStandingViewerTier = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: { id: string; tier: string }) => i)
  .handler(async ({ data, context }) => {
    const tier = assertTier(data.tier);
    const { error } = await (context.supabase as any).rpc("set_firm_viewer_tier", {
      _id: data.id,
      _tier: tier,
    });
    if (error) throw new Error(explain(error.message));
    return { ok: true };
  });

/** Remove a standing grant entirely. Specific per-client grants are untouched. */
export const revokeStandingViewer = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).rpc("revoke_firm_viewer_access", {
      _id: data.id,
    });
    if (error) throw new Error(explain(error.message));
    return { ok: true };
  });

/**
 * Replace a person's standing grant with specific per-client grants — the only
 * remedy when an owner wants to stop someone seeing one client while keeping
 * the rest. There is deliberately no "exclusion" row type.
 */
export const switchStandingToSelected = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: { firmId: string; userId: string; clientIds: string[]; tier: string }) => i)
  .handler(async ({ data, context }) => {
    const tier = assertTier(data.tier);
    const clientIds = Array.from(new Set(data.clientIds ?? []));
    if (clientIds.length === 0) throw new Error("Tick at least one client.");

    const { data: canManage } = await (context.supabase as any).rpc("me_can_manage_firm_viewers", {
      _firm_id: data.firmId,
    });
    if (canManage !== true) throw new Error("You cannot manage viewers for this organisation.");

    // The ids are re-checked against this organisation, never trusted.
    const { data: clients, error: cErr } = await (context.supabase as any)
      .from("clients")
      .select("id")
      .eq("firm_id", data.firmId)
      .in("id", clientIds);
    if (cErr) throw new Error(cErr.message);
    const valid = ((clients ?? []) as any[]).map((c) => c.id as string);
    if (valid.length === 0) throw new Error("Those clients are no longer available.");

    for (const clientId of valid) {
      const { error } = await (context.supabase as any).rpc("grant_client_access", {
        _client_id: clientId,
        _user_id: data.userId,
        _tier: tier,
      });
      if (error) throw new Error(explain(error.message));
    }

    // Standing grant last: if anything above failed, the person keeps the wider
    // access rather than silently losing all of it.
    const { data: standing } = await (context.supabase as any).rpc("firm_viewers", {
      _firm_id: data.firmId,
    });
    const row = ((standing ?? []) as any[]).find((r) => r.user_id === data.userId);
    if (row) {
      const { error } = await (context.supabase as any).rpc("revoke_firm_viewer_access", {
        _id: row.id,
      });
      if (error) throw new Error(explain(error.message));
    }
    return { ok: true, clients: valid.length };
  });

export type ViewerInvite = {
  id: string;
  email: string;
  scope: "selected" | "all_clients";
  tier: DashboardTier;
  clientIds: string[];
  expiresAt: string;
  createdAt: string;
};

export const listViewerInvites = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: { firmId: string }) => i)
  .handler(async ({ data, context }): Promise<{ invites: ViewerInvite[] }> => {
    const { data: rows, error } = await (context.supabase as any).rpc("firm_viewer_invites", {
      _firm_id: data.firmId,
    });
    if (error) {
      if (/NOT_PERMITTED/i.test(error.message)) return { invites: [] };
      throw new Error(error.message);
    }
    return {
      invites: ((rows ?? []) as any[]).map((r) => ({
        id: r.id,
        email: r.email,
        scope: r.scope,
        tier: r.tier,
        clientIds: r.client_ids ?? [],
        expiresAt: r.expires_at,
        createdAt: r.created_at,
      })),
    };
  });

export const cancelViewerInvite = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).rpc("revoke_viewer_invite", { _id: data.id });
    if (error) throw new Error(explain(error.message));
    return { ok: true };
  });

/**
 * One invitation carrying the scope and the level. If the person already has a
 * verified account the grants are applied immediately; otherwise a hashed,
 * email-bound, single-use, expiring invite link is created and emailed.
 */
export const inviteViewer = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator(
    (i: {
      firmId: string;
      email: string;
      scope: "selected" | "all_clients";
      tier: string;
      clientIds?: string[] | null;
    }) => i,
  )
  .handler(async ({ data, context }) => {
    const email = normaliseEmail(data.email);
    const tier = assertTier(data.tier);
    if (data.scope !== "selected" && data.scope !== "all_clients") {
      throw new Error("Choose which clients this person should see.");
    }
    const requested = Array.from(new Set(data.clientIds ?? []));
    if (data.scope === "selected" && requested.length === 0) {
      throw new Error("Tick at least one client.");
    }

    // Authorisation BEFORE any privileged step (rule 7).
    const { data: canManage, error: cmErr } = await (context.supabase as any).rpc(
      "me_can_manage_firm_viewers",
      { _firm_id: data.firmId },
    );
    if (cmErr) throw new Error(cmErr.message);
    if (canManage !== true) {
      throw new Error("You cannot manage viewers for this organisation.");
    }

    // Client ids are only ever a filter: keep the ones that belong to this
    // organisation and are visible to the caller.
    let validIds: string[] = [];
    if (data.scope === "selected") {
      const { data: clients, error: cErr } = await (context.supabase as any)
        .from("clients")
        .select("id")
        .eq("firm_id", data.firmId)
        .in("id", requested);
      if (cErr) throw new Error(cErr.message);
      validIds = ((clients ?? []) as any[]).map((c) => c.id as string);
      if (validIds.length === 0) throw new Error("Those clients are no longer available.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const existing = await findVerifiedAuthUserByEmail(supabaseAdmin as any, email);

    if (existing) {
      // Grants applied straight away, each one authorised and audited in the
      // database.
      if (data.scope === "all_clients") {
        const { error } = await (context.supabase as any).rpc("grant_firm_viewer_access", {
          _firm_id: data.firmId,
          _user_id: existing.id,
          _tier: tier,
        });
        if (error) throw new Error(explain(error.message));
      } else {
        for (const clientId of validIds) {
          const { error } = await (context.supabase as any).rpc("grant_client_access", {
            _client_id: clientId,
            _user_id: existing.id,
            _tier: tier,
          });
          if (error) throw new Error(explain(error.message));
        }
      }
      return { ok: true, invited: false, email, token: null as string | null, emailStatus: null };
    }

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const { error: iErr } = await (supabaseAdmin as any).from("access_invites").insert({
      firm_id: data.firmId,
      email,
      // `role` is inert on a viewer invite: every member path filters kind = 'member'.
      role: "staff",
      kind: "viewer",
      scope: data.scope,
      tier,
      client_ids: data.scope === "selected" ? validIds : [],
      token_hash: hashToken(token),
      expires_at: expiresAt,
      invited_by: context.userId,
    });
    if (iErr) throw new Error(iErr.message);

    await (supabaseAdmin as any).from("audit_log").insert({
      actor_user_id: context.userId,
      firm_id: data.firmId,
      action: "viewer_invite_created",
      target_type: "firm",
      target_id: data.firmId,
      meta: {
        email,
        scope: data.scope,
        tier,
        client_count: data.scope === "selected" ? validIds.length : null,
      },
    });

    const { data: firm } = await (supabaseAdmin as any)
      .from("firms")
      .select("name")
      .eq("id", data.firmId)
      .maybeSingle();

    const inviteUrl = siteUrl(`/signup/${token}`);
    let emailStatus = "skipped";
    try {
      const { enqueueAppEmail } = await import("@/lib/email/send.server");
      const res = await enqueueAppEmail({
        templateName: "firm-invite",
        recipientEmail: email,
        idempotencyKey: `viewer-invite-${data.firmId}-${token.slice(0, 8)}`,
        templateData: {
          inviteUrl,
          role: "client viewer",
          firmName: firm?.name ?? null,
          inviterName: null,
        },
      });
      emailStatus = res.status;
    } catch (e) {
      console.error("Failed to enqueue viewer invite email", e);
      emailStatus = "failed";
    }

    return { ok: true, invited: true, email, token, emailStatus };
  });

function explain(message: string): string {
  if (/NOT_PERMITTED/i.test(message)) return "You cannot manage viewers for this organisation.";
  if (/INVITE_NOT_FOUND/i.test(message)) return "That invitation no longer exists.";
  if (/ALREADY_ACCEPTED/i.test(message)) return "That invitation has already been used.";
  if (/MFA_REQUIRED/i.test(message)) return "Please verify your second factor and try again.";
  return message;
}
