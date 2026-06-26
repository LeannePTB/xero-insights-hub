import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertSuperAdmin(supabase: any) {
  const { data, error } = await supabase.rpc("me_is_super_admin");
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

export const getSecurityPosture = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Token encryption coverage.
    const { count: encCount } = await supabaseAdmin
      .from("xero_connections")
      .select("*", { count: "exact", head: true })
      .not("access_token_enc", "is", null);
    const { count: plainCount } = await supabaseAdmin
      .from("xero_connections")
      .select("*", { count: "exact", head: true })
      .is("access_token_enc", null)
      .not("access_token", "is", null);
    const { count: totalConns } = await supabaseAdmin
      .from("xero_connections")
      .select("*", { count: "exact", head: true });

    // MFA enrolment count via Auth Admin API.
    let mfaEnrolled = 0;
    let totalUsers = 0;
    try {
      const { data } = await (supabaseAdmin as any).auth.admin.listUsers({ page: 1, perPage: 1000 });
      const users = data?.users ?? [];
      totalUsers = users.length;
      mfaEnrolled = users.filter((u: any) =>
        (u.factors ?? []).some((f: any) => f.status === "verified" && f.factor_type === "totp"),
      ).length;
    } catch {
      // ignore — older SDKs may not return factors
    }

    // Audit log retention.
    const cutoff = new Date(Date.now() - 1000 * 60 * 60 * 24 * 365 * 2).toISOString();
    const { count: oldAudit } = await supabaseAdmin
      .from("audit_log")
      .select("*", { count: "exact", head: true })
      .lt("at", cutoff);

    return {
      tokenEncryption: {
        encrypted: encCount ?? 0,
        plaintext: plainCount ?? 0,
        total: totalConns ?? 0,
      },
      mfa: { enrolled: mfaEnrolled, total: totalUsers },
      audit: { rowsOlderThanRetention: oldAudit ?? 0, retentionYears: 2 },
      tokenEncKeyConfigured: !!process.env.TOKEN_ENC_KEY,
      xeroConfigured: !!process.env.XERO_CLIENT_ID && !!process.env.XERO_CLIENT_SECRET,
    };
  });

export const purgeOldAuditLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cutoff = new Date(Date.now() - 1000 * 60 * 60 * 24 * 365 * 2).toISOString();
    const { error, count } = await supabaseAdmin
      .from("audit_log")
      .delete({ count: "exact" })
      .lt("at", cutoff);
    if (error) throw new Error(error.message);
    return { deleted: count ?? 0 };
  });

export const resetUserMfa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { userId: string }) => i)
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: factors } = await (supabaseAdmin as any).auth.admin.mfa.listFactors({
      userId: data.userId,
    });
    let removed = 0;
    for (const f of factors?.factors ?? []) {
      await (supabaseAdmin as any).auth.admin.mfa.deleteFactor({ userId: data.userId, id: f.id });
      removed += 1;
    }
    await supabaseAdmin.from("audit_log").insert({
      actor_user_id: context.userId,
      action: "mfa_reset_by_admin",
      target_type: "user",
      target_id: data.userId,
      meta: { factors_removed: removed },
    });
    return { ok: true, removed };
  });

const POLICY_DOCS = [
  "README",
  "access-control",
  "data-hosting",
  "data-retention",
  "incident-response",
  "monitoring",
  "sdlc",
  "vulnerability-management",
  "xero-assessment-mapping",
] as const;

export const listSecurityDocs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase);
    return { docs: POLICY_DOCS.map((slug) => ({ slug, url: `/api/public/docs/security/${slug}.md` })) };
  });
