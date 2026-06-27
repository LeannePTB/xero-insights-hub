import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SecurityContact = {
  company_legal_name: string | null;
  trading_name: string | null;
  abn: string | null;
  registered_address: string | null;
  website: string | null;
  app_name: string | null;
  xero_client_id: string | null;
  primary_contact_name: string | null;
  primary_contact_role: string | null;
  primary_contact_email: string | null;
  primary_contact_phone: string | null;
  xero_api_usage: string | null;
  assessment_date: string | null;
};

const EMPTY_CONTACT: SecurityContact = {
  company_legal_name: null,
  trading_name: null,
  abn: null,
  registered_address: null,
  website: null,
  app_name: null,
  xero_client_id: null,
  primary_contact_name: null,
  primary_contact_role: null,
  primary_contact_email: null,
  primary_contact_phone: null,
  xero_api_usage: null,
  assessment_date: null,
};

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

    // MFA enrolment via SECURITY DEFINER RPC — reads auth.mfa_factors directly,
    // since auth.admin.listUsers() does not return the factors array.
    let mfaEnrolled = 0;
    let totalUsers = 0;
    let adminMfaEnrolled = 0;
    let totalAdmins = 0;
    try {
      const { data: rows, error } = await supabaseAdmin.rpc("get_mfa_posture_counts" as any);
      if (error) throw error;
      const row = (rows as any[])?.[0] ?? {};
      totalUsers = Number(row.total_staff ?? 0);
      mfaEnrolled = Number(row.enrolled_staff ?? 0);
      totalAdmins = Number(row.total_admins ?? 0);
      adminMfaEnrolled = Number(row.enrolled_admins ?? 0);
    } catch {
      // ignore — surface zeros, card will show "action"
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

export const getSecurityContact = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SecurityContact> => {
    await assertSuperAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("security_contact_details")
      .select("*")
      .eq("singleton", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return EMPTY_CONTACT;
    return {
      company_legal_name: data.company_legal_name,
      trading_name: data.trading_name,
      abn: data.abn,
      registered_address: data.registered_address,
      website: data.website,
      app_name: data.app_name,
      xero_client_id: data.xero_client_id,
      primary_contact_name: data.primary_contact_name,
      primary_contact_role: data.primary_contact_role,
      primary_contact_email: data.primary_contact_email,
      primary_contact_phone: data.primary_contact_phone,
      xero_api_usage: data.xero_api_usage,
      assessment_date: data.assessment_date,
    };
  });

export const saveSecurityContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: Partial<SecurityContact>) => i)
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload: Record<string, unknown> = { singleton: true };
    for (const k of Object.keys(EMPTY_CONTACT) as (keyof SecurityContact)[]) {
      const v = (data as any)[k];
      payload[k] = typeof v === "string" && v.trim() === "" ? null : v ?? null;
    }
    const { error } = await supabaseAdmin
      .from("security_contact_details")
      .upsert(payload, { onConflict: "singleton" });
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("audit_log").insert({
      actor_user_id: context.userId,
      action: "security_contact_updated",
      target_type: "security_contact_details",
      target_id: "singleton",
      meta: {},
    });
    return { ok: true };
  });

