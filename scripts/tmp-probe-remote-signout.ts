/**
 * TEMPORARY probe (deleted after the run). Resolves the contradiction over
 * remote sign-out: does GoTrue's admin logout endpoint work against a REAL
 * user id on this project, and does a brief ban terminate live sessions?
 *
 * Uses only the contained security-test staff account. Re-bans it at the end.
 * Prints statuses/bodies and before/after auth.sessions counts. No secrets.
 */
import { $ } from "bun";
import { createClient } from "@supabase/supabase-js";

const URL_ = process.env["SUPABASE_URL"]!;
const SERVICE = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
const ANON = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"]!;
const BAN_FOREVER = "876000h";

const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });

async function sessionCount(userId: string): Promise<string> {
  const out =
    await $`psql ${process.env["SUPABASE_DB_URL"]} -At -c ${`select count(*) from auth.sessions where user_id = '${userId}'`}`.text();
  return out.trim();
}

async function main() {
  const { decryptToken } = await import("@/lib/crypto.server");
  const { totpCode } = await import("@/lib/totp.server");

  const { data: row, error } = await admin
    .from("security_test_accounts" as any)
    .select("user_id, email, password_enc, totp_secret_enc")
    .eq("label", "staff")
    .maybeSingle();
  if (error || !row) throw new Error(`no staff test account: ${error?.message}`);
  const userId = (row as any).user_id as string;
  const email = (row as any).email as string;
  const password = decryptToken((row as any).password_enc);
  const totpSecret = (row as any).totp_secret_enc ? decryptToken((row as any).totp_secret_enc) : null;

  console.log("staff test user id:", userId);

  // unban so we can sign in
  await admin.auth.admin.updateUserById(userId, { ban_duration: "none" } as any);

  const openSession = async (label: string) => {
    const c = createClient(URL_, ANON, { auth: { persistSession: false } });
    const s = await c.auth.signInWithPassword({ email, password });
    if (s.error || !s.data.session) throw new Error(`${label} sign-in failed: ${s.error?.message}`);
    if (totpSecret) {
      const f = await c.auth.mfa.listFactors();
      const fid = f.data?.totp?.[0]?.id;
      if (fid) {
        const ch = await c.auth.mfa.challenge({ factorId: fid });
        if (!ch.error)
          await c.auth.mfa.verify({
            factorId: fid,
            challengeId: ch.data.id,
            code: totpCode(totpSecret),
          });
      }
    }
    const sess = (await c.auth.getSession()).data.session!;
    return { client: c, accessToken: sess.access_token, refreshToken: sess.refresh_token };
  };

  const tokenWorks = async (accessToken: string) => {
    const r = await fetch(`${URL_}/auth/v1/user`, {
      headers: { apikey: ANON, Authorization: `Bearer ${accessToken}` },
    });
    return r.status;
  };
  const refreshWorks = async (refreshToken: string) => {
    const r = await fetch(`${URL_}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { apikey: ANON, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    return r.status;
  };

  // ---------------------------------------------------------------- TEST 1
  console.log("\n=== TEST 1: POST /auth/v1/admin/users/{REAL id}/logout ===");
  const a = await openSession("t1-a");
  const b = await openSession("t1-b");
  console.log("sessions before:", await sessionCount(userId));
  for (const path of [
    `/auth/v1/admin/users/${userId}/logout`,
    `/auth/v1/admin/users/${userId}/sessions`,
  ]) {
    const method = path.endsWith("/logout") ? "POST" : "DELETE";
    const res = await fetch(`${URL_}${path}`, {
      method,
      headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
    });
    console.log(`${method} ${path.replace(userId, "<real-user-id>")} -> ${res.status}`);
    console.log("   body:", (await res.text()).slice(0, 300));
  }
  console.log("sessions after:", await sessionCount(userId));
  console.log("token a /user status:", await tokenWorks(a.accessToken));
  console.log("refresh a status:", await refreshWorks(a.refreshToken));

  // ---------------------------------------------------------------- TEST 2
  console.log("\n=== TEST 2: brief ban terminates live sessions? ===");
  console.log("sessions before ban:", await sessionCount(userId));
  const banRes = await admin.auth.admin.updateUserById(userId, { ban_duration: "1s" } as any);
  console.log("ban applied error:", banRes.error?.message ?? "none");
  await new Promise((r) => setTimeout(r, 1500));
  console.log("sessions after ban:", await sessionCount(userId));
  console.log("token b /user status after ban:", await tokenWorks(b.accessToken));
  console.log("refresh b status after ban:", await refreshWorks(b.refreshToken));

  // ---------------------------------------------------------------- TEST 3
  console.log("\n=== TEST 3: admin signOut(jwt, 'global') helper ===");
  const c = await openSession("t3");
  console.log("sessions before:", await sessionCount(userId));
  const so = await (admin.auth.admin as any).signOut(c.accessToken, "global");
  console.log("signOut error:", so?.error?.message ?? "none");
  console.log("sessions after:", await sessionCount(userId));
  console.log("token c /user status:", await tokenWorks(c.accessToken));
  console.log("refresh c status:", await refreshWorks(c.refreshToken));

  // containment
  await admin.auth.admin.updateUserById(userId, { ban_duration: BAN_FOREVER } as any);
  console.log("\nstaff test account re-banned. final sessions:", await sessionCount(userId));
}

main().catch((e) => {
  console.error("PROBE FAILED:", e);
  process.exit(1);
});
