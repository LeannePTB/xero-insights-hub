/**
 * TEMPORARY probe (deleted after the run). Resolves the contradiction over
 * remote sign-out on this project. Staged so auth.sessions counts can be read
 * between stages with the read-only query tool (the app database role cannot
 * read the auth schema, and this probe does not grant itself access).
 *
 * Only the contained security-test staff account is used; it is re-banned in
 * the final stage. No secret values are printed.
 *
 * Stages: open | logout | ban | globalsignout | contain
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";

const URL_ = process.env["SUPABASE_URL"]!;
const SERVICE = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
const ANON = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"]!;
const BAN_FOREVER = "876000h";
const STATE = "/tmp/probe-remote-signout.json";

const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });

type Tok = { accessToken: string; refreshToken: string };
type State = { userId: string; email: string; sessions: Record<string, Tok> };

const load = (): State => JSON.parse(readFileSync(STATE, "utf8"));
const save = (s: State) => writeFileSync(STATE, JSON.stringify(s));

async function staffAccount() {
  const { decryptToken } = await import("@/lib/crypto.server");
  const { data: row, error } = await admin
    .from("security_test_accounts" as any)
    .select("user_id, email, password_enc, totp_secret_enc")
    .eq("label", "staff")
    .maybeSingle();
  if (error || !row) throw new Error(`no staff test account: ${error?.message}`);
  return {
    userId: (row as any).user_id as string,
    email: (row as any).email as string,
    password: decryptToken((row as any).password_enc) as string,
    totpSecret: (row as any).totp_secret_enc
      ? (decryptToken((row as any).totp_secret_enc) as string)
      : null,
  };
}

async function openSession(acct: Awaited<ReturnType<typeof staffAccount>>): Promise<Tok> {
  const { totpCode } = await import("@/lib/totp.server");
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const s = await c.auth.signInWithPassword({ email: acct.email, password: acct.password });
  if (s.error || !s.data.session) throw new Error(`sign-in failed: ${s.error?.message}`);
  if (acct.totpSecret) {
    const f = await c.auth.mfa.listFactors();
    const fid = f.data?.totp?.[0]?.id;
    if (fid) {
      const ch = await c.auth.mfa.challenge({ factorId: fid });
      if (!ch.error)
        await c.auth.mfa.verify({
          factorId: fid,
          challengeId: ch.data.id,
          code: totpCode(acct.totpSecret),
        });
    }
  }
  const sess = (await c.auth.getSession()).data.session!;
  return { accessToken: sess.access_token, refreshToken: sess.refresh_token };
}

const userStatus = async (t: Tok) =>
  (await fetch(`${URL_}/auth/v1/user`, {
    headers: { apikey: ANON, Authorization: `Bearer ${t.accessToken}` },
  })).status;

const refreshStatus = async (t: Tok) =>
  (await fetch(`${URL_}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: t.refreshToken }),
  })).status;

async function main() {
  const stage = process.argv[2];

  if (stage === "open") {
    const acct = await staffAccount();
    await admin.auth.admin.updateUserById(acct.userId, { ban_duration: "none" } as any);
    const a = await openSession(acct);
    const b = await openSession(acct);
    const c = await openSession(acct);
    save({ userId: acct.userId, email: acct.email, sessions: { a, b, c } });
    console.log("staff user id:", acct.userId);
    console.log("opened 3 real sessions (a, b, c); a/b/c access tokens valid:", [
      await userStatus(a),
      await userStatus(b),
      await userStatus(c),
    ]);
    return;
  }

  const st = load();

  if (stage === "logout") {
    for (const [method, path] of [
      ["POST", `/auth/v1/admin/users/${st.userId}/logout`],
      ["DELETE", `/auth/v1/admin/users/${st.userId}/sessions`],
      ["POST", `/auth/v1/admin/users/${st.userId}/sessions/logout`],
    ] as const) {
      const res = await fetch(`${URL_}${path}`, {
        method,
        headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
      });
      console.log(`${method} ${path.replace(st.userId, "<real-user-id>")} -> ${res.status}`);
      console.log("   body:", (await res.text()).slice(0, 300));
    }
    // control: the same route with a fake id
    const fake = "00000000-0000-4000-8000-000000000000";
    const ctl = await fetch(`${URL_}/auth/v1/admin/users/${fake}/logout`, {
      method: "POST",
      headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
    });
    console.log(`control POST .../<fake-id>/logout -> ${ctl.status}`, (await ctl.text()).slice(0, 200));
    console.log("session a access:", await userStatus(st.sessions.a!), "refresh:", await refreshStatus(st.sessions.a!));
    return;
  }

  if (stage === "banlong") {
    const r = await admin.auth.admin.updateUserById(st.userId, { ban_duration: "300s" } as any);
    console.log("ban 300s error:", r.error?.message ?? "none");
    console.log("WHILE BANNED session b access:", await userStatus(st.sessions.b!), "refresh:", await refreshStatus(st.sessions.b!));
    return;
  }

  if (stage === "unban") {
    const r = await admin.auth.admin.updateUserById(st.userId, { ban_duration: "none" } as any);
    console.log("unban error:", r.error?.message ?? "none");
    console.log("AFTER UNBAN session b access:", await userStatus(st.sessions.b!), "refresh:", await refreshStatus(st.sessions.b!));
    return;
  }

  if (stage === "ban") {
    const r = await admin.auth.admin.updateUserById(st.userId, { ban_duration: "1s" } as any);
    console.log("ban 1s error:", r.error?.message ?? "none");
    await new Promise((x) => setTimeout(x, 1200));
    console.log("session b access:", await userStatus(st.sessions.b!), "refresh:", await refreshStatus(st.sessions.b!));
    return;
  }

  if (stage === "globalsignout") {
    const so = await (admin.auth.admin as any).signOut(st.sessions.c!.accessToken, "global");
    console.log("admin.signOut(jwt,'global') error:", so?.error?.message ?? "none");
    console.log("session c access:", await userStatus(st.sessions.c!), "refresh:", await refreshStatus(st.sessions.c!));
    return;
  }

  if (stage === "contain") {
    await admin.auth.admin.updateUserById(st.userId, { ban_duration: BAN_FOREVER } as any);
    for (const [k, t] of Object.entries(st.sessions)) {
      try {
        await (admin.auth.admin as any).signOut(t.accessToken, "global");
      } catch {
        /* best effort */
      }
      console.log(`session ${k} refresh after containment:`, await refreshStatus(t));
    }
    console.log("staff test account re-banned.");
    return;
  }

  throw new Error("unknown stage");
}

main().catch((e) => {
  console.error("PROBE FAILED:", e);
  process.exit(1);
});
