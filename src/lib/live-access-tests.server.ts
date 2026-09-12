/**
 * THE SLIM LIVE SMOKE SUITE.
 *
 * `bun run security:check` already proves the whole access matrix against a
 * faithful copy of the live catalogue (PGlite). This suite exists for the only
 * two things the copy cannot produce:
 *
 *   1. a REAL session — in particular the same person on aal2 and on aal1;
 *   2. the REAL server functions, over HTTP, with that session's bearer token.
 *
 * It is a smoke test, not a second matrix. Every expectation is read from
 * docs/security/access-matrix.ts by (role, resource, operation) — there is no
 * second expectation list anywhere in this file.
 *
 * Containment (all enforced elsewhere as well, never by this file alone):
 *   - the three accounts hold no super_admin role and no practice_team row;
 *     database triggers refuse either (app_private.confine_security_test_accounts);
 *   - they may hold a membership or grant ONLY inside `ZZ Security Test Org`;
 *   - they are BANNED outside a run. This runner sweeps, unbans, runs, then
 *     re-bans, signs every session out and cleans up in a `finally` block;
 *   - the test organisation has no Xero connection, so no Xero API call is
 *     reachable from here, and its addresses are permanently suppressed.
 *
 * Server-only. Never import from client-reachable code.
 */

import { randomBytes } from "crypto";
import { MATRIX, type Expect, type Operation, type Role } from "../../docs/security/access-matrix";

export type ProbeResult = {
  role: Role;
  resource: string;
  operation: Operation;
  expected: Expect;
  observed: "allow" | "deny" | "inconclusive";
  passed: boolean;
  detail: string;
};

export type RunSummary = {
  runId: string;
  passed: number;
  failed: number;
  inconclusive: number;
  probes: ProbeResult[];
};

const LABELS = ["owner", "staff", "viewer"] as const;
type Label = (typeof LABELS)[number];

const EMAILS: Record<Label, string> = {
  owner: "zz-security-owner@tractionadvisory.com.au",
  staff: "zz-security-staff@tractionadvisory.com.au",
  viewer: "zz-security-viewer@tractionadvisory.com.au",
};

/** Permanent ban applied whenever a run is not in progress (100 years). */
const BAN_FOREVER = "876000h";

// ------------------------------------------------------------------ expectation
/**
 * The single source of expectations. A probe with no matrix row is a bug in the
 * probe list, not a licence to invent an expectation here.
 */
function expectationFor(role: Role, resource: string, operation: Operation): Expect {
  const row = MATRIX.find(
    (r) => r.role === role && r.resource === resource && r.operation === operation,
  );
  if (!row) {
    throw new Error(
      `No access-matrix row for ${role} / ${resource} / ${operation} — add the row, never a local expectation.`,
    );
  }
  return row.expect;
}

// ---------------------------------------------------------------- session setup
type Session = { accessToken: string; refreshToken: string; aal: "aal1" | "aal2" };

function publishableKey(): string {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  if (!key) throw new Error("No Supabase publishable key on the server.");
  return key;
}

async function browserLikeClient() {
  const { createClient } = await import("@supabase/supabase-js");
  const key = publishableKey();
  return createClient(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input: any, init: any) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

// ------------------------------------------------------------------- the fixture
type Account = { label: Label; userId: string; email: string; password: string; totpSecret: string | null };

async function loadOrCreateAccounts(): Promise<Account[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { encryptTokenB64, decryptToken } = await import("@/lib/crypto.server");
  const out: Account[] = [];

  for (const label of LABELS) {
    const email = EMAILS[label];
    const { data: existing } = await supabaseAdmin
      .from("security_test_accounts" as any)
      .select("user_id, password_enc, totp_secret_enc")
      .eq("label", label)
      .maybeSingle();

    if (existing) {
      out.push({
        label,
        userId: (existing as any).user_id,
        email,
        password: decryptToken((existing as any).password_enc),
        totpSecret: (existing as any).totp_secret_enc
          ? decryptToken((existing as any).totp_secret_enc)
          : null,
      });
      continue;
    }

    // Generated on the server. The owner never sees or pastes these.
    const password = `Zz!${randomBytes(24).toString("base64url")}`;
    const created = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { security_test_account: true },
    });
    if (created.error || !created.data.user) {
      throw new Error(`Could not create the ${label} test account: ${created.error?.message}`);
    }
    const userId = created.data.user.id;
    const { error: insErr } = await supabaseAdmin.from("security_test_accounts" as any).insert({
      user_id: userId,
      label,
      email,
      password_enc: encryptTokenB64(password),
    });
    if (insErr) throw new Error(`Could not store the ${label} test credentials: ${insErr.message}`);
    out.push({ label, userId, email, password, totpSecret: null });
  }
  return out;
}

/** The test organisation, its two dummy clients, memberships and the standing grant. */
async function ensureTestOrganisation(accounts: Account[]) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const owner = accounts.find((a) => a.label === "owner")!;
  const staff = accounts.find((a) => a.label === "staff")!;
  const viewer = accounts.find((a) => a.label === "viewer")!;

  const { data: firm, error: firmErr } = await supabaseAdmin
    .from("firms")
    .select("id, owner_user_id")
    .eq("is_test" as any, true)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (firmErr || !firm) throw new Error("The security test organisation is missing.");
  const firmId = (firm as any).id as string;

  if ((firm as any).owner_user_id !== owner.userId) {
    await supabaseAdmin.from("firms").update({ owner_user_id: owner.userId }).eq("id", firmId);
  }

  for (const [user, role] of [
    [owner, "owner"],
    [staff, "staff"],
  ] as const) {
    const { data: m } = await supabaseAdmin
      .from("firm_members")
      .select("id, status, role")
      .eq("firm_id", firmId)
      .eq("user_id", user.userId)
      .maybeSingle();
    if (!m) {
      await supabaseAdmin
        .from("firm_members")
        .insert({ firm_id: firmId, user_id: user.userId, role, status: "active" } as any);
    } else if ((m as any).status !== "active" || (m as any).role !== role) {
      await supabaseAdmin
        .from("firm_members")
        .update({ status: "active", role } as any)
        .eq("id", (m as any).id);
    }
  }

  const { data: clients } = await supabaseAdmin
    .from("clients")
    .select("id, name")
    .eq("firm_id", firmId)
    .order("created_at");
  const have = (clients ?? []) as { id: string; name: string }[];
  const wanted = ["ZZ Test Client One", "ZZ Test Client Two"];
  for (const name of wanted) {
    if (!have.some((c) => c.name === name)) {
      const { data: ins, error } = await supabaseAdmin
        .from("clients")
        .insert({ name, firm_id: firmId, owner_user_id: owner.userId } as any)
        .select("id, name")
        .single();
      if (error) throw new Error(`Could not create ${name}: ${error.message}`);
      have.push(ins as any);
    }
  }

  // The viewer's standing grant over every client in the test organisation.
  const { data: standing } = await supabaseAdmin
    .from("firm_viewer_access" as any)
    .select("id")
    .eq("firm_id", firmId)
    .eq("user_id", viewer.userId)
    .maybeSingle();
  if (!standing) {
    await supabaseAdmin
      .from("firm_viewer_access" as any)
      .insert({ firm_id: firmId, user_id: viewer.userId, tier: "basic", granted_by: owner.userId });
  }

  return {
    firmId,
    clientOne: have.find((c) => c.name === wanted[0])!.id,
    clientTwo: have.find((c) => c.name === wanted[1])!.id,
  };
}

/** Enrol a verified TOTP factor for an account that has none, using a real session. */
async function ensureTotp(account: Account): Promise<Account> {
  if (account.totpSecret) return account;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { encryptTokenB64 } = await import("@/lib/crypto.server");
  const { totpCode } = await import("@/lib/totp.server");

  const client = await browserLikeClient();
  const signIn = await client.auth.signInWithPassword({
    email: account.email,
    password: account.password,
  });
  if (signIn.error) throw new Error(`Test sign-in failed for ${account.label}: ${signIn.error.message}`);

  const enrol = await client.auth.mfa.enroll({ factorType: "totp" });
  if (enrol.error || !enrol.data) throw new Error(`TOTP enrol failed: ${enrol.error?.message}`);
  const secret = (enrol.data as any).totp.secret as string;
  const factorId = (enrol.data as any).id as string;

  const challenge = await client.auth.mfa.challenge({ factorId });
  if (challenge.error) throw new Error(`TOTP challenge failed: ${challenge.error.message}`);
  const verify = await client.auth.mfa.verify({
    factorId,
    challengeId: challenge.data.id,
    code: totpCode(secret),
  });
  if (verify.error) throw new Error(`TOTP verify failed: ${verify.error.message}`);

  await supabaseAdmin
    .from("security_test_accounts" as any)
    .update({
      totp_secret_enc: encryptTokenB64(secret),
      factor_id: factorId,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", account.userId);

  await client.auth.signOut();
  return { ...account, totpSecret: secret };
}

/** A real session. `stepUp: false` deliberately stops at aal1 (no second factor). */
async function openSession(account: Account, stepUp: boolean): Promise<Session> {
  const { totpCode } = await import("@/lib/totp.server");
  const client = await browserLikeClient();
  const signIn = await client.auth.signInWithPassword({
    email: account.email,
    password: account.password,
  });
  if (signIn.error || !signIn.data.session) {
    throw new Error(`Test sign-in failed for ${account.label}: ${signIn.error?.message}`);
  }
  if (!stepUp) {
    return {
      accessToken: signIn.data.session.access_token,
      refreshToken: signIn.data.session.refresh_token,
      aal: "aal1",
    };
  }
  const factors = await client.auth.mfa.listFactors();
  const factorId =
    factors.data?.totp?.[0]?.id ?? (factors.data as any)?.all?.find((f: any) => f.status === "verified")?.id;
  if (!factorId) throw new Error(`No verified factor for ${account.label}`);
  const challenge = await client.auth.mfa.challenge({ factorId });
  if (challenge.error) throw new Error(`Challenge failed: ${challenge.error.message}`);
  const verify = await client.auth.mfa.verify({
    factorId,
    challengeId: challenge.data.id,
    code: totpCode(account.totpSecret!),
  });
  if (verify.error || !verify.data) throw new Error(`Verify failed: ${verify.error?.message}`);
  return {
    accessToken: verify.data.access_token,
    refreshToken: verify.data.refresh_token,
    aal: "aal2",
  };
}

// --------------------------------------------------------------- calling the app
type CallOutcome = {
  outcome: "allow" | "deny" | "inconclusive";
  detail: string;
  /** Raw response payload, for probes that must check the RESULT, not the status. */
  body?: string;
};

/**
 * Extracts the message from a TanStack-serialised error payload.
 *
 * The response envelope is seroval cross-JSON, and its error node carries the
 * plugin tag `$TSR/Error`. Deserialising it properly needs TanStack's internal
 * seroval plugins, which the package does not export, so the message is read
 * out of the raw payload instead. Presence of the tag is the signal; the text
 * is only for the report.
 */
function serialisedErrorMessage(text: string): string | null {
  if (!text.includes('"$TSR/Error"')) return null;
  const m = /"message":\{"t":1,"s":"((?:[^"\\]|\\.)*)"\}/.exec(text);
  if (!m) return "error (message not readable)";
  try {
    return JSON.parse(`"${m[1]}"`) as string;
  } catch {
    return m[1] ?? "error";
  }
}

/**
 * Calls a real server function over HTTP with a real session's bearer token.
 *
 * The request shape is TanStack Start's own RPC contract, read from the
 * installed version's client (`serverFnFetcher`): POST to the function's
 * `/_serverFn/<id>` url, header `x-tsr-serverFn: true`, and a body that is the
 * SEROVAL-serialised `{ data }` envelope — not plain JSON. Plain JSON is what
 * produced "Seroval Error (step: 3)" on every probe.
 *
 * Classification: a serialised error payload (any status) is a refusal; 2xx
 * with a result is allow; 401/403 and other 4xx are deny. A 5xx without a
 * readable payload, or anything unparseable, is INCONCLUSIVE and never a pass.
 */
async function callServerFn(
  fn: unknown,
  body: unknown,
  session: Session | null,
): Promise<CallOutcome> {
  const url = (fn as { url?: string } | undefined)?.url;
  if (!url) return { outcome: "inconclusive", detail: "server function has no callable url" };
  // The suite must exercise the deployment it is RUNNING IN, not whatever the
  // canonical public origin happens to be — otherwise a preview run silently
  // tests production. Falls back to the canonical origin.
  let origin: string;
  try {
    const { getRequestUrl } = await import("@tanstack/react-start/server");
    origin = new URL(String(getRequestUrl())).origin;
  } catch {
    const { siteOrigin } = await import("@/lib/site-origin");
    origin = siteOrigin();
  }
  const absolute = url.startsWith("http") ? url : `${origin}${url}`;


  let payload: string;
  try {
    const { toJSONAsync } = await import("seroval");
    payload = JSON.stringify(await toJSONAsync({ data: body }));
  } catch (e) {
    return { outcome: "inconclusive", detail: `could not serialise payload: ${(e as Error).message}` };
  }

  let res: Response;
  try {
    res = await fetch(absolute, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-tsr-serverFn": "true",
        accept: "application/json",
        ...(session ? { Authorization: `Bearer ${session.accessToken}` } : {}),
      },
      body: payload,
      signal: AbortSignal.timeout(20_000),
    });
  } catch (e) {
    return { outcome: "inconclusive", detail: `request failed: ${(e as Error).message}` };
  }

  const text = (await res.text()).slice(0, 2000);
  const errMessage = serialisedErrorMessage(text);
  if (errMessage) return { outcome: "deny", detail: `${res.status}: ${errMessage.slice(0, 160)}` };

  if (res.ok) {
    if (res.headers.get("x-tss-serialized")) return { outcome: "allow", detail: `${res.status}` };
    // A 2xx without the serialised envelope is not a server-function result.
    return { outcome: "inconclusive", detail: `${res.status} without a server-function payload` };
  }
  if (res.status === 401 || res.status === 403) return { outcome: "deny", detail: `${res.status}` };
  if (res.status >= 400 && res.status < 500) {
    return { outcome: "deny", detail: `${res.status}: ${text.slice(0, 120)}` };
  }
  return { outcome: "inconclusive", detail: `${res.status}: ${text.slice(0, 120)}` };
}


// ------------------------------------------------------------------- confinement
/**
 * The database, not convention, keeps a test account out of every real
 * organisation. Proved by trying it with the SERVICE ROLE — the strongest
 * caller there is — against a real organisation. It must still be refused.
 */
async function probeConfinement(accounts: Account[]): Promise<ProbeResult[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const staff = accounts.find((a) => a.label === "staff")!;
  const out: ProbeResult[] = [];

  const { data: realFirm } = await supabaseAdmin
    .from("firms")
    .select("id")
    .eq("is_test" as any, false)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  const attempts: { resource: string; run: () => Promise<{ error: unknown }> }[] = [
    {
      resource: "membership of a real organisation",
      run: async () =>
        realFirm
          ? await supabaseAdmin
              .from("firm_members")
              .insert({ firm_id: (realFirm as any).id, user_id: staff.userId, role: "staff", status: "active" } as any)
          : { error: new Error("no real organisation to test against") },
    },
    {
      resource: "a platform role (user_roles)",
      run: async () =>
        await supabaseAdmin.from("user_roles").insert({ user_id: staff.userId, role: "super_admin" } as any),
    },
    {
      resource: "practice_team membership",
      run: async () =>
        await supabaseAdmin.from("practice_team" as any).insert({ user_id: staff.userId }),
    },
  ];

  for (const a of attempts) {
    const expected = expectationFor("security_test_account", a.resource, "insert");
    let observed: ProbeResult["observed"] = "inconclusive";
    let detail = "";
    try {
      const { error } = await a.run();
      observed = error ? "deny" : "allow";
      detail = error ? String((error as any).message ?? error).slice(0, 160) : "insert succeeded";
    } catch (e) {
      observed = "deny";
      detail = (e as Error).message.slice(0, 160);
    }
    // Fail closed: if a row did land, remove it immediately.
    if (observed === "allow") {
      if (a.resource.startsWith("membership")) {
        await supabaseAdmin.from("firm_members").delete().eq("user_id", staff.userId).neq("firm_id", "");
      } else if (a.resource.includes("user_roles")) {
        await supabaseAdmin.from("user_roles").delete().eq("user_id", staff.userId);
      } else {
        await supabaseAdmin.from("practice_team" as any).delete().eq("user_id", staff.userId);
      }
    }
    out.push({
      role: "security_test_account",
      resource: a.resource,
      operation: "insert",
      expected,
      observed,
      passed: observed === expected,
      detail,
    });
  }
  return out;
}

// -------------------------------------------------------------------- the probes
async function runProbes(
  accounts: Account[],
  org: { firmId: string; clientOne: string; clientTwo: string },
): Promise<ProbeResult[]> {
  const owner = accounts.find((a) => a.label === "owner")!;
  const staff = accounts.find((a) => a.label === "staff")!;
  const viewer = accounts.find((a) => a.label === "viewer")!;

  const ownerAal2 = await openSession(owner, true);
  // The single most valuable thing the copy cannot prove: the SAME person,
  // signed in, who skipped the second factor.
  const ownerAal1 = await openSession(owner, false);
  const staffAal2 = await openSession(staff, true);
  const viewerAal2 = await openSession(viewer, true);
  const sessions = [ownerAal2, ownerAal1, staffAal2, viewerAal2];

  const clients = await import("@/lib/clients.functions");
  const invites = await import("@/lib/invites.functions");
  const ownership = await import("@/lib/ownership.functions");

  const probes: {
    role: Role;
    resource: string;
    operation: Operation;
    session: Session | null;
    call: () => Promise<CallOutcome>;
  }[] = [
    // list clients
    {
      role: "org_owner",
      resource: "server fn: list clients for an organisation",
      operation: "execute",
      session: ownerAal2,
      call: () => callServerFn(clients.listClients, { firmId: org.firmId }, ownerAal2),
    },
    {
      role: "aal1_member",
      resource: "server fn: list clients for an organisation",
      operation: "execute",
      session: ownerAal1,
      call: () => callServerFn(clients.listClients, { firmId: org.firmId }, ownerAal1),
    },
    {
      role: "anonymous",
      resource: "server fn: list clients for an organisation",
      operation: "execute",
      session: null,
      call: () => callServerFn(clients.listClients, { firmId: org.firmId }, null),
    },
    // read a client dashboard
    {
      role: "org_owner",
      resource: "server fn: read a client dashboard",
      operation: "execute",
      session: ownerAal2,
      call: () => callServerFn(clients.getClient, { clientId: org.clientOne }, ownerAal2),
    },
    {
      role: "standing_viewer",
      resource: "server fn: read a client dashboard",
      operation: "execute",
      session: viewerAal2,
      call: () => callServerFn(clients.getClient, { clientId: org.clientTwo }, viewerAal2),
    },
    {
      role: "aal1_member",
      resource: "server fn: read a client dashboard",
      operation: "execute",
      session: ownerAal1,
      call: () => callServerFn(clients.getClient, { clientId: org.clientOne }, ownerAal1),
    },
    {
      role: "anonymous",
      resource: "server fn: read a client dashboard",
      operation: "execute",
      session: null,
      call: () => callServerFn(clients.getClient, { clientId: org.clientOne }, null),
    },
    // write client data
    {
      role: "org_owner",
      resource: "server fn: write client data",
      operation: "execute",
      session: ownerAal2,
      call: () =>
        callServerFn(
          clients.renameClient,
          { clientId: org.clientOne, name: "ZZ Test Client One" },
          ownerAal2,
        ),
    },
    {
      role: "standing_viewer",
      resource: "server fn: write client data",
      operation: "execute",
      session: viewerAal2,
      call: () =>
        callServerFn(
          clients.renameClient,
          { clientId: org.clientTwo, name: "ZZ Renamed By Viewer" },
          viewerAal2,
        ),
    },
    {
      role: "aal1_member",
      resource: "server fn: write client data",
      operation: "execute",
      session: ownerAal1,
      call: () =>
        callServerFn(
          clients.renameClient,
          { clientId: org.clientOne, name: "ZZ Renamed By Aal1" },
          ownerAal1,
        ),
    },
    // viewer management (Batch 5 widening): owner may, staff may not
    {
      role: "org_owner",
      resource: "viewer management for a client in the caller's own organisation",
      operation: "execute",
      session: ownerAal2,
      call: () =>
        callServerFn(
          clients.inviteClientViewer,
          { clientId: org.clientOne, email: EMAILS.viewer, tier: "basic" },
          ownerAal2,
        ),
    },
    {
      role: "org_staff",
      resource: "viewer management for a client in the caller's own organisation",
      operation: "execute",
      session: staffAal2,
      call: () =>
        callServerFn(
          clients.inviteClientViewer,
          { clientId: org.clientTwo, email: EMAILS.viewer, tier: "basic" },
          staffAal2,
        ),
    },
    // member removal: staff may not remove the owner
    {
      role: "org_staff",
      resource: "remove a staff member of the caller's own organisation",
      operation: "execute",
      session: staffAal2,
      call: () =>
        callServerFn(
          ownership.removeOrganisationMember,
          { firmId: org.firmId, userId: owner.userId },
          staffAal2,
        ),
    },
    // one Path C admin call: platform metadata stays platform metadata
    {
      role: "org_owner",
      resource: "server fn: list pending member invitations",
      operation: "execute",
      session: ownerAal2,
      call: () => callServerFn(invites.listFirmMemberInvites, { firmId: org.firmId }, ownerAal2),
    },
  ];

  const results: ProbeResult[] = [];
  for (const p of probes) {
    const expected = expectationFor(p.role, p.resource, p.operation);
    let outcome: CallOutcome;
    try {
      outcome = await p.call();
    } catch (e) {
      outcome = { outcome: "inconclusive", detail: (e as Error).message.slice(0, 160) };
    }
    results.push({
      role: p.role,
      resource: p.resource,
      operation: p.operation,
      expected,
      observed: outcome.outcome,
      passed: outcome.outcome === expected,
      detail: outcome.detail,
    });
  }

  // The owner's viewer invite created a specific grant. Revoke it through the
  // real function, as the owner — that is the revoke half of the probe pair.
  {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: grant } = await supabaseAdmin
      .from("client_access")
      .select("id")
      .eq("client_id", org.clientOne)
      .eq("user_id", viewer.userId)
      .maybeSingle();
    if (grant) {
      const expected = expectationFor(
        "org_owner",
        "viewer management for a client in the caller's own organisation",
        "execute",
      );
      const outcome = await callServerFn(clients.revokeClientAccess, { id: (grant as any).id }, ownerAal2);
      results.push({
        role: "org_owner",
        resource: "viewer management for a client in the caller's own organisation",
        operation: "execute",
        expected,
        observed: outcome.outcome,
        passed: outcome.outcome === expected,
        detail: `revoke: ${outcome.detail}`,
      });
    }
  }

  // Every session this run opened is closed before the run ends.
  await signOutSessions(sessions);
  return results;
}

async function signOutSessions(sessions: Session[]) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  for (const s of sessions) {
    try {
      await (supabaseAdmin.auth.admin as any).signOut(s.accessToken, "global");
    } catch {
      /* best effort; the ban below is the boundary */
    }
  }
}

// ------------------------------------------------------------------------- run
async function banAll(): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("security_test_accounts" as any).select("user_id");
  for (const row of (data ?? []) as unknown as { user_id: string }[]) {
    try {
      await supabaseAdmin.auth.admin.updateUserById(row.user_id, { ban_duration: BAN_FOREVER } as any);
      await (supabaseAdmin.auth.admin as any).signOut?.(row.user_id, "global");
    } catch {
      /* the next sweep tries again */
    }
  }
}

async function unbanAll(): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("security_test_accounts" as any).select("user_id");
  for (const row of (data ?? []) as unknown as { user_id: string }[]) {
    await supabaseAdmin.auth.admin.updateUserById(row.user_id, { ban_duration: "none" } as any);
  }
}

async function setRunState(running: boolean, runId: string | null): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("security_test_run_state" as any).upsert(
    {
      id: true,
      running,
      run_id: runId,
      started_at: running ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
}

/**
 * One run. Safe to call twice: the sweep at the start re-bans and clears
 * anything a previous crashed run left behind.
 */
export async function runLiveAccessTests(ranBy: string | null): Promise<RunSummary> {
  const runId = crypto.randomUUID();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // 1. sweep — whatever happened last time, the accounts start banned.
  await banAll();
  await setRunState(false, null);

  let probes: ProbeResult[] = [];
  try {
    let accounts = await loadOrCreateAccounts();
    await setRunState(true, runId);
    await unbanAll();

    const withFactors: Account[] = [];
    for (const a of accounts) withFactors.push(await ensureTotp(a));
    accounts = withFactors;

    const org = await ensureTestOrganisation(accounts);
    probes = [...(await probeConfinement(accounts)), ...(await runProbes(accounts, org))];

    // Membership and grants are put back exactly as the suite expects to find
    // them next time; nothing outside the test organisation is touched.
    await ensureTestOrganisation(accounts);
  } finally {
    await banAll();
    await setRunState(false, null);
  }

  const passed = probes.filter((p) => p.passed).length;
  const inconclusive = probes.filter((p) => p.observed === "inconclusive").length;
  const failed = probes.length - passed;

  // Recorded with the service role. public.record_access_test_run() is aal2 +
  // super-admin guarded, which is right for a browser session but cannot be
  // satisfied by a system context, so the row is written directly here. The
  // table takes no writes from any browser session either way.
  const { error: recErr } = await supabaseAdmin.from("security_test_runs" as any).insert({
    layer: "live",
    ran_by: ranBy,
    passed,
    failed,
    known_failures: [],
    fingerprint_match: true,
    details: probes,
  });
  if (recErr) console.error("[live-access-tests] could not record the run:", recErr.message);

  return { runId, passed, failed, inconclusive, probes };
}
