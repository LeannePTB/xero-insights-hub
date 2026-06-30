import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const PRIMARY_ADVISOR_USER_ID = "57d544ad-db50-4330-9b12-bcffdf4c6065";


async function assertAdvisor(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "advisor");
  if (!data || data.length === 0) throw new Error("Only advisors can manage advisors.");
}

export const listAdvisors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdvisor(context.supabase, context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("user_roles")
      .select("id, user_id, created_at")
      .eq("role", "advisor")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    if (!rows?.length) return { advisors: [] };

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, email, display_name")
      .in("id", rows.map((r) => r.user_id));
    const map = new Map((profiles ?? []).map((p) => [p.id, p]));
    return {
      advisors: rows.map((r) => ({
        id: r.id,
        user_id: r.user_id,
        created_at: r.created_at,
        email: map.get(r.user_id)?.email ?? null,
        display_name: map.get(r.user_id)?.display_name ?? null,
        is_self: r.user_id === context.userId,
      })),
    };
  });

export const inviteAdvisor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { email: string }) => i)
  .handler(async ({ data, context }) => {
    await assertAdvisor(context.supabase, context.userId);
    const email = data.email.trim().toLowerCase();
    if (!email.includes("@")) throw new Error("Please enter a valid email address.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    let userId = existing?.id as string | undefined;
    let invited = false;

    if (!userId) {
      const redirectTo = getInviteRedirect();
      const { data: invitedRes, error: e } = await (supabaseAdmin as any).auth.admin.inviteUserByEmail(
        email,
        { redirectTo },
      );
      if (e) throw new Error(e.message);
      userId = invitedRes?.user?.id;
      if (!userId) throw new Error("Could not create invite.");
      invited = true;
    }

    // Grant advisor role (and remove any client_viewer role to avoid mixed state)
    const { error } = await (supabaseAdmin as any)
      .from("user_roles")
      .upsert({ user_id: userId, role: "advisor" }, { onConflict: "user_id,role", ignoreDuplicates: true });
    if (error) throw new Error(error.message);

    await (supabaseAdmin as any)
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("role", "client_viewer");

    return { ok: true, invited };
  });

function validatePassword(pw: string) {
  if (typeof pw !== "string" || pw.length < 8) throw new Error("Password must be at least 8 characters.");
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) throw new Error("Password must include at least one letter and one number.");
}

export const createAdvisorWithPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { email: string; password: string }) => i)
  .handler(async ({ data, context }) => {
    await assertAdvisor(context.supabase, context.userId);
    const email = data.email.trim().toLowerCase();
    if (!email.includes("@") || email.length > 254) throw new Error("Please enter a valid email address.");
    validatePassword(data.password);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (existing?.id) throw new Error("An account with this email already exists.");

    const { data: created, error: cErr } = await (supabaseAdmin as any).auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
    });
    if (cErr) throw new Error(cErr.message);
    const userId = created?.user?.id;
    if (!userId) throw new Error("Could not create account.");

    const { error: rErr } = await (supabaseAdmin as any)
      .from("user_roles")
      .upsert({ user_id: userId, role: "advisor" }, { onConflict: "user_id,role", ignoreDuplicates: true });
    if (rErr) throw new Error(rErr.message);

    await (supabaseAdmin as any)
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("role", "client_viewer");

    return { ok: true, email };
  });

export const changeMyPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { currentPassword: string; newPassword: string }) => i)
  .handler(async ({ data, context }) => {
    validatePassword(data.newPassword);
    if (data.currentPassword === data.newPassword) {
      throw new Error("New password must be different from the current password.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u, error: uErr } = await (supabaseAdmin as any).auth.admin.getUserById(context.userId);
    if (uErr || !u?.user?.email) throw new Error("Could not load your account.");
    const email = u.user.email as string;

    // Re-authenticate with current password using a throwaway client
    const { createClient } = await import("@supabase/supabase-js");
    const verifier = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { error: signInErr } = await verifier.auth.signInWithPassword({
      email,
      password: data.currentPassword,
    });
    if (signInErr) throw new Error("Current password is incorrect.");

    const { error: updErr } = await (supabaseAdmin as any).auth.admin.updateUserById(context.userId, {
      password: data.newPassword,
    });
    if (updErr) throw new Error(updErr.message);

    return { ok: true };
  });

export const sendAdvisorPasswordReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { userId: string }) => i)
  .handler(async ({ data, context }) => {
    await assertAdvisor(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u, error } = await (supabaseAdmin as any).auth.admin.getUserById(data.userId);
    if (error || !u?.user?.email) throw new Error("User not found");
    const email = u.user.email as string;
    const { error: rErr } = await (supabaseAdmin as any).auth.resetPasswordForEmail(email, {
      redirectTo: "https://tractionadvisory.com.au/set-password",
    });
    if (rErr) throw new Error(rErr.message);
    return { ok: true, email };
  });

export const setAdvisorPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { userId: string; newPassword: string }) => i)
  .handler(async ({ data, context }) => {
    await assertAdvisor(context.supabase, context.userId);
    validatePassword(data.newPassword);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u, error: gErr } = await (supabaseAdmin as any).auth.admin.getUserById(data.userId);
    if (gErr || !u?.user?.email) throw new Error("User not found");
    const { error } = await (supabaseAdmin as any).auth.admin.updateUserById(data.userId, {
      password: data.newPassword,
    });
    if (error) throw new Error(error.message);
    return { ok: true, email: u.user.email as string };
  });


export const revokeAdvisor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { userId: string }) => i)
  .handler(async ({ data, context }) => {
    await assertAdvisor(context.supabase, context.userId);
    if (data.userId === PRIMARY_ADVISOR_USER_ID) {
      throw new Error("The primary advisor account can't be removed.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Safety: make sure at least one other advisor remains
    const { data: others } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "advisor")
      .neq("user_id", data.userId);
    if (!others || others.length === 0) {
      throw new Error("At least one advisor must remain.");
    }

    // Remove all role rows for this user
    const { error: roleErr } = await (supabaseAdmin as any)
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId);
    if (roleErr) throw new Error(roleErr.message);

    // Remove client_access grants
    await (supabaseAdmin as any).from("client_access").delete().eq("user_id", data.userId);

    // Remove profile row
    await (supabaseAdmin as any).from("profiles").delete().eq("id", data.userId);

    // Finally, delete the auth user so they can't sign in or reuse the email
    const { error: delErr } = await (supabaseAdmin as any).auth.admin.deleteUser(data.userId);
    if (delErr) throw new Error(delErr.message);

    return { ok: true };

  });

function getInviteRedirect() {
  return "https://tractionadvisory.com.au/set-password";
}

async function resendInviteForUser(supabaseAdmin: any, userId: string) {
  const { data: u, error: getErr } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (getErr || !u?.user?.email) {
    return { ok: false as const, reason: "User not found" };
  }
  const user = u.user;
  if (user.last_sign_in_at) {
    return { ok: false as const, reason: "Already active" };
  }
  const redirectTo = getInviteRedirect();
  // Re-issue the invite. inviteUserByEmail on an existing unconfirmed user
  // re-sends the invite via the auth webhook.
  const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(
    user.email,
    redirectTo ? { redirectTo } : undefined,
  );
  if (error) {
    // Fallback: generate an invite link, which also fires the auth webhook.
    const { error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "invite",
      email: user.email,
      options: redirectTo ? { redirectTo } : undefined,
    });
    if (linkErr) return { ok: false as const, reason: linkErr.message };
  }
  return { ok: true as const, email: user.email as string };
}

export const generateAdvisorInviteLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { userId: string }) => i)
  .handler(async ({ data, context }) => {
    await assertAdvisor(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u, error: getErr } = await (supabaseAdmin as any).auth.admin.getUserById(data.userId);
    if (getErr || !u?.user?.email) throw new Error("User not found");
    const email = u.user.email as string;
    const redirectTo = getInviteRedirect();
    const { data: link, error } = await (supabaseAdmin as any).auth.admin.generateLink({
      type: "invite",
      email,
      options: { redirectTo },
    });
    if (error) throw new Error(error.message);
    const actionLink = link?.properties?.action_link ?? link?.action_link;
    if (!actionLink) throw new Error("Could not generate invite link");
    return { email, link: actionLink as string };
  });

export const resendAdvisorInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { userId: string }) => i)
  .handler(async ({ data, context }) => {
    await assertAdvisor(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const res = await resendInviteForUser(supabaseAdmin, data.userId);
    if (!res.ok) throw new Error(res.reason);
    return { ok: true, email: res.email };
  });

export const resendAllPendingAdvisorInvites = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdvisor(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "advisor");
    const userIds = (rows ?? []).map((r: any) => r.user_id).filter((id: string) => id !== context.userId);

    const resent: string[] = [];
    const skipped: { email?: string; reason: string }[] = [];
    for (const uid of userIds) {
      const res = await resendInviteForUser(supabaseAdmin, uid);
      if (res.ok) resent.push(res.email);
      else skipped.push({ reason: res.reason });
    }
    return { resent, skipped };
  });

export const listPendingAdvisors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdvisor(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "advisor");
    const pending: string[] = [];
    for (const r of rows ?? []) {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(r.user_id);
      if (u?.user && !u.user.last_sign_in_at) {
        pending.push(r.user_id);
      }
    }
    return { pendingUserIds: pending };
  });

