import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { randomBytes, createHash } from "crypto";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function assertSuperAdmin(supabase: any, _userId: string) {
  const { data, error } = await supabase.rpc("me_is_super_admin");
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

async function logAudit(action: string, targetType: string, targetId: string, actorUserId: string | null, meta: Record<string, any>) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await (supabaseAdmin as any).from("audit_log").insert({
    actor_user_id: actorUserId,
    action,
    target_type: targetType,
    target_id: targetId,
    meta,
  });
}

function validatePassword(pw: string) {
  if (typeof pw !== "string" || pw.length < 8) throw new Error("Password must be at least 8 characters.");
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) throw new Error("Password must include at least one letter and one number.");
}

function validateEmail(email: string) {
  const e = email.trim().toLowerCase();
  if (!e || e.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
    throw new Error("Invalid email address.");
  }
  return e;
}

/**
 * Super-admin: create a brand-new firm + owner invite in one step.
 * Firm gets a placeholder name; owner sets the real business name on signup.
 */
export const adminCreateFirmAndInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { email: string; businessName?: string | null }) => i)
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const email = validateEmail(data.email);
    const placeholderName = (data.businessName?.trim() || email).slice(0, 120);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Create firm shell (owner_user_id null until invite accepted).
    const { data: firm, error: fErr } = await (supabaseAdmin as any)
      .from("firms")
      .insert({ name: placeholderName, is_always_free: false })
      .select("id, name")
      .single();
    if (fErr) throw new Error(fErr.message);

    // Default subscription row: 7-day trial, starter tier.
    const trialEnds = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await (supabaseAdmin as any).from("subscriptions").insert({
      firm_id: firm.id,
      tier: "starter",
      status: "trialing",
      trial_ends_at: trialEnds,
    });

    // Invite.
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const { error: iErr } = await (supabaseAdmin as any).from("access_invites").insert({
      firm_id: firm.id,
      email,
      role: "owner",
      token_hash: hashToken(token),
      expires_at: expiresAt,
      invited_by: context.userId,
    });
    if (iErr) throw new Error(iErr.message);

    await logAudit("firm_invite_created", "firm", firm.id, context.userId, {
      firm_id: firm.id, email, role: "owner", new_firm: true,
    });

    // Build the canonical signup URL and fire-and-forget the email.
    const inviteUrl = `https://tractionadvisory.app/signup/${token}`;
    let emailStatus: string = "skipped";
    try {
      const { enqueueAppEmail } = await import("@/lib/email/send.server");
      const res = await enqueueAppEmail({
        templateName: "firm-invite",
        recipientEmail: email,
        idempotencyKey: `firm-invite-${firm.id}-${token.slice(0, 8)}`,
        templateData: {
          inviteUrl, role: "owner", firmName: firm.name, inviterName: null,
        },
      });
      emailStatus = res.status;
    } catch (e) {
      console.error("Failed to enqueue invite email", e);
      emailStatus = "failed";
    }

    return { ok: true, firmId: firm.id, token, email, emailStatus };
  });

/**
 * Super-admin: invite an additional member to an existing firm.
 */
export const adminInviteFirmMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { firmId: string; email: string; role: "owner" | "staff" }) => i)
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const email = validateEmail(data.email);
    if (data.role !== "owner" && data.role !== "staff") throw new Error("Invalid role.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await (supabaseAdmin as any).from("access_invites").insert({
      firm_id: data.firmId,
      email,
      role: data.role,
      token_hash: hashToken(token),
      expires_at: expiresAt,
      invited_by: context.userId,
    });
    if (error) throw new Error(error.message);

    await logAudit("firm_invite_created", "firm", data.firmId, context.userId, {
      firm_id: data.firmId, email, role: data.role, new_firm: false,
    });

    const { data: firm } = await (supabaseAdmin as any)
      .from("firms").select("name").eq("id", data.firmId).maybeSingle();
    const inviteUrl = `https://tractionadvisory.app/signup/${token}`;
    let emailStatus: string = "skipped";
    try {
      const { enqueueAppEmail } = await import("@/lib/email/send.server");
      const res = await enqueueAppEmail({
        templateName: "firm-invite",
        recipientEmail: email,
        idempotencyKey: `firm-invite-${data.firmId}-${token.slice(0, 8)}`,
        templateData: {
          inviteUrl, role: data.role, firmName: firm?.name ?? null, inviterName: null,
        },
      });
      emailStatus = res.status;
    } catch (e) {
      console.error("Failed to enqueue invite email", e);
      emailStatus = "failed";
    }

    return { ok: true, token, email, emailStatus };
  });

/**
 * Public: look up an invite by token to render the signup screen.
 * Returns minimal, non-sensitive info.
 */
export const getInvitePublic = createServerFn({ method: "POST" })
  .inputValidator((i: { token: string }) => i)
  .handler(async ({ data }) => {
    if (!data.token || data.token.length < 32) throw new Error("Invalid invite link.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invite, error } = await (supabaseAdmin as any)
      .from("access_invites")
      .select("id, firm_id, email, role, expires_at, accepted_at")
      .eq("token_hash", hashToken(data.token))
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!invite) throw new Error("Invite not found or already used.");
    if (invite.accepted_at) throw new Error("This invite has already been used. Please sign in.");
    if (new Date(invite.expires_at).getTime() < Date.now()) throw new Error("This invite has expired.");

    // Look up firm name (placeholder) to show context.
    const { data: firm } = await (supabaseAdmin as any)
      .from("firms").select("name").eq("id", invite.firm_id).maybeSingle();

    return {
      email: invite.email,
      role: invite.role as "owner" | "staff",
      firmName: firm?.name ?? null,
      firmId: invite.firm_id,
    };
  });

/**
 * Public: accept an invite. Creates auth user if needed, sets password,
 * joins firm_members. If owner + businessName provided, renames the firm.
 */
export const acceptInvite = createServerFn({ method: "POST" })
  .inputValidator((i: {
    token: string;
    password: string;
    displayName: string;
    businessName?: string | null;
  }) => i)
  .handler(async ({ data }) => {
    if (!data.token || data.token.length < 32) throw new Error("Invalid invite link.");
    validatePassword(data.password);
    const displayName = (data.displayName ?? "").trim().slice(0, 120);
    if (displayName.length < 2) throw new Error("Please enter your name.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Rate limit invite-accept attempts: 20 per 10 minutes per token prefix.
    const { enforceRateLimit } = await import("@/lib/rate-limit.server");
    await enforceRateLimit(`invite:accept:${data.token.slice(0, 16)}`, 20, 600);
    const { data: invite, error } = await (supabaseAdmin as any)
      .from("access_invites")
      .select("id, firm_id, email, role, expires_at, accepted_at")
      .eq("token_hash", hashToken(data.token))
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!invite) throw new Error("Invite not found or already used.");
    if (invite.accepted_at) throw new Error("This invite has already been used. Please sign in.");
    if (new Date(invite.expires_at).getTime() < Date.now()) throw new Error("This invite has expired.");

    // Create or find auth user.
    let userId: string | null = null;
    const { data: created, error: cErr } = await (supabaseAdmin as any).auth.admin.createUser({
      email: invite.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    });
    if (cErr) {
      // Likely already exists — try lookup by email + update password.
      const { data: list } = await (supabaseAdmin as any).auth.admin.listUsers({
        page: 1, perPage: 200,
      });
      const existing = (list?.users ?? []).find((u: any) =>
        (u.email ?? "").toLowerCase() === invite.email.toLowerCase()
      );
      if (!existing) throw new Error(cErr.message);
      userId = existing.id;
      await (supabaseAdmin as any).auth.admin.updateUserById(userId, {
        password: data.password,
        email_confirm: true,
        user_metadata: { ...(existing.user_metadata ?? {}), display_name: displayName },
      });
    } else {
      userId = created?.user?.id ?? null;
    }
    if (!userId) throw new Error("Could not create account.");

    // Upsert profile.
    await (supabaseAdmin as any).from("profiles").upsert({
      id: userId, email: invite.email, display_name: displayName,
    });

    // Add to firm_members (unique on firm_id+user_id assumed; ignore conflict).
    const { error: mErr } = await (supabaseAdmin as any).from("firm_members").insert({
      firm_id: invite.firm_id, user_id: userId, role: invite.role,
    });
    if (mErr && !/duplicate/i.test(mErr.message)) throw new Error(mErr.message);

    // Grant 'advisor' app role so they reach the firm/clients UI (not the viewer empty state).
    const { error: rErr } = await (supabaseAdmin as any).from("user_roles").insert({
      user_id: userId, role: "advisor",
    });
    if (rErr && !/duplicate/i.test(rErr.message)) throw new Error(rErr.message);

    // If owner: ensure firms.owner_user_id is set; allow business name rename.
    if (invite.role === "owner") {
      const patch: Record<string, any> = { owner_user_id: userId };
      const businessName = (data.businessName ?? "").trim();
      if (businessName.length >= 2 && businessName.length <= 120) {
        patch.name = businessName;
      }
      await (supabaseAdmin as any).from("firms").update(patch).eq("id", invite.firm_id);
    }

    // Mark invite accepted.
    await (supabaseAdmin as any).from("access_invites")
      .update({ accepted_at: new Date().toISOString() }).eq("id", invite.id);

    await logAudit("firm_invite_accepted", "firm", invite.firm_id, userId, {
      firm_id: invite.firm_id, email: invite.email, role: invite.role,
    });

    return { ok: true, email: invite.email };
  });
