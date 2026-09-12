/**
 * Phase 2 guardrails — the access matrix, executed.
 *
 * Every PGlite-testable row of docs/security/access-matrix.ts is driven against
 * an in-process PGlite database loaded from tests/fixtures/rls-schema.sql — a
 * faithful mirror of the live access-control layer (auth.uid/jwt, auth.users,
 * auth.mfa_factors, the anon/authenticated/service_role roles with the real
 * table AND column grants, every policy for every command, and the
 * app_private/public authorisation functions owned by a role that bypasses RLS).
 *
 * SYNTHETIC data only. This suite never opens a connection to the real database.
 *
 * Each case runs inside its own transaction with `set local role` plus the
 * role's JWT claims, and is rolled back, so no case can affect another.
 *
 * Rows that only a live session can prove (server functions, views, resources
 * with no PGlite model) are reported as "live-only — part 3" and are NEVER
 * counted as passes. Rows carrying `knownFailure` are asserted INVERTED: the
 * suite proves the wrong behaviour still exists, prints it with its backlog
 * number, and fails the moment it silently changes.
 */
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MATRIX, ROLE_LABELS, type MatrixRow, type Role } from "../docs/security/access-matrix";

// ---------------------------------------------------------------- synthetic ids
const ORG_A = "11111111-1111-4111-8111-111111111111";
const ORG_B = "22222222-2222-4222-8222-222222222222";
const CLIENT_A = "aaaaaaaa-1111-4111-8111-111111111111";
const CLIENT_B = "bbbbbbbb-2222-4222-8222-222222222222";
/** Added to Organisation A AFTER the standing grant exists. */
const CLIENT_NEW = "cccccccc-1111-4111-8111-111111111111";
const CONN_A = "aaaaaaaa-cccc-4111-8111-111111111111";
const GROUP_A = "aaaaaaaa-9999-4111-8111-111111111111";
const UPLOAD_A = "aaaaaaaa-8888-4111-8111-111111111111";
const TENANT_A = "tenant-a";

const U = {
  ownerA: "99990001-1111-4111-8111-111111111111",
  staffA: "99990002-1111-4111-8111-111111111111",
  ownerB: "99990003-2222-4222-8222-222222222222",
  viewer: "99990004-1111-4111-8111-111111111111",
  standingViewer: "99990011-1111-4111-8111-111111111111",
  supportActive: "99990005-1111-4111-8111-111111111111",
  supportExpired: "99990006-1111-4111-8111-111111111111",
  supportRevoked: "99990007-1111-4111-8111-111111111111",
  superAdmin: "99990008-1111-4111-8111-111111111111",
  suspended: "99990009-1111-4111-8111-111111111111",
  removed: "99990010-1111-4111-8111-111111111111",
};

type Ctx = { uid: string | null; dbRole: "anon" | "authenticated"; aal: "aal1" | "aal2" | null };

const CONTEXT: Record<Role, Ctx> = {
  anonymous: { uid: null, dbRole: "anon", aal: null },
  aal1_member: { uid: U.staffA, dbRole: "authenticated", aal: "aal1" },
  org_owner: { uid: U.ownerA, dbRole: "authenticated", aal: "aal2" },
  org_staff: { uid: U.staffA, dbRole: "authenticated", aal: "aal2" },
  other_org_member: { uid: U.ownerB, dbRole: "authenticated", aal: "aal2" },
  org_a_owner_reading_org_b: { uid: U.ownerB, dbRole: "authenticated", aal: "aal2" },
  client_viewer: { uid: U.viewer, dbRole: "authenticated", aal: "aal2" },
  standing_viewer: { uid: U.standingViewer, dbRole: "authenticated", aal: "aal2" },
  support_grant_active: { uid: U.supportActive, dbRole: "authenticated", aal: "aal2" },
  support_grant_expired: { uid: U.supportExpired, dbRole: "authenticated", aal: "aal2" },
  support_grant_revoked: { uid: U.supportRevoked, dbRole: "authenticated", aal: "aal2" },
  super_admin_no_membership: { uid: U.superAdmin, dbRole: "authenticated", aal: "aal2" },
  super_admin_self_approving_support: { uid: U.superAdmin, dbRole: "authenticated", aal: "aal2" },
  suspended_member: { uid: U.suspended, dbRole: "authenticated", aal: "aal2" },
  removed_member: { uid: U.removed, dbRole: "authenticated", aal: "aal2" },
};

/**
 * The Organisation A row seeded in each table under test, as literal SQL. Only
 * the columns that attribute the row to Organisation A (plus whatever a policy
 * reads) are set — the fixture drops defaults and NOT NULL so this is enough.
 */
const q = (v: string) => `'${v}'`;
const TARGET: Record<string, Record<string, string>> = {
  firms: { id: q(ORG_A), name: q("Org A"), owner_user_id: q(U.ownerA) },
  firm_members: {
    id: q("f0000001-1111-4111-8111-111111111111"),
    firm_id: q(ORG_A),
    user_id: q(U.ownerA),
    role: q("owner"),
    status: q("active"),
  },
  clients: { id: q(CLIENT_A), name: q("Client A"), owner_user_id: q(U.ownerA), firm_id: q(ORG_A) },
  client_xero_orgs: {
    id: q("c0000001-1111-4111-8111-111111111111"),
    client_id: q(CLIENT_A),
    xero_connection_id: q(CONN_A),
  },
  client_notes: { id: q("c0000002-1111-4111-8111-111111111111"), client_id: q(CLIENT_A), body: q("note") },
  client_access: {
    id: q("c0000003-1111-4111-8111-111111111111"),
    client_id: q(CLIENT_A),
    user_id: q(U.viewer),
    tier: q("basic"),
  },
  client_cost_classifications: {
    id: q("c0000004-1111-4111-8111-111111111111"),
    client_id: q(CLIENT_A),
    tenant_id: q(TENANT_A),
    account_name: q("Wages"),
    classification: q("fixed"),
  },
  client_true_breakeven_inputs: {
    id: q("c0000005-1111-4111-8111-111111111111"),
    client_id: q(CLIENT_A),
    tenant_id: q(TENANT_A),
    loan_principal: "0",
    credit_card_interest: "0",
    owner_drawings: "0",
    ato_payment_plan: "0",
    equipment_finance: "0",
    other: "0",
  },
  client_statutory_accounts: {
    id: q("c0000006-1111-4111-8111-111111111111"),
    client_id: q(CLIENT_A),
    tenant_id: q(TENANT_A),
    account_name: q("GST"),
    category: q("gst"),
  },
  client_subscriptions: {
    id: q("c0000007-1111-4111-8111-111111111111"),
    client_id: q(CLIENT_A),
    subscription_type: q("free_forever"),
    status: q("free_forever"),
    dashboard_tier: q("basic"),
  },
  client_reports: {
    id: q("c0000008-1111-4111-8111-111111111111"),
    client_id: q(CLIENT_A),
    firm_id: q(ORG_A),
    report_key: q("monthly"),
    period_end: "current_date",
    payload: q("{}"),
    payload_version: "1",
    status: q("final"),
    version: "1",
    complete: "true",
  },
  reconciliation_snapshots: {
    id: q("c0000009-1111-4111-8111-111111111111"),
    client_id: q(CLIENT_A),
    tenant_id: q(TENANT_A),
    report_key: q("recon"),
    as_at: "current_date",
    payload: q("{}"),
    complete: "true",
  },
  unreconciled_uploads: { id: q(UPLOAD_A), client_id: q(CLIENT_A), filename: q("a.csv"), line_count: "1" },
  unreconciled_lines: {
    id: q("c0000011-1111-4111-8111-111111111111"),
    upload_id: q(UPLOAD_A),
    client_id: q(CLIENT_A),
    account_name: q("acc"),
    row_index: "1",
    client_comment: q(""),
  },
  loan_consolidation_accounts: {
    id: q("c0000012-1111-4111-8111-111111111111"),
    client_id: q(CLIENT_A),
    tenant_id: q(TENANT_A),
    direction: q("asset"),
    sort_order: "1",
  },
  loan_consolidation_snapshots: {
    id: q("c0000013-1111-4111-8111-111111111111"),
    group_id: q(GROUP_A),
    as_at: "current_date",
    payload: q("{}"),
  },
  consolidation_groups: { id: q(GROUP_A), firm_id: q(ORG_A), name: q("Group A") },
  consolidation_group_members: {
    id: q("c0000014-1111-4111-8111-111111111111"),
    group_id: q(GROUP_A),
    client_id: q(CLIENT_A),
  },
  tier_widget_config: {
    id: q("c0000015-1111-4111-8111-111111111111"),
    client_id: q(CLIENT_A),
    firm_id: q(ORG_A),
    tier: q("basic"),
    widgets: "'{}'::text[]",
    excluded_widgets: "'{}'::text[]",
  },
  xero_snapshots: {
    id: q("c0000016-1111-4111-8111-111111111111"),
    client_id: q(CLIENT_A),
    firm_id: q(ORG_A),
    tenant_id: q(TENANT_A),
    report_key: q("pnl"),
    params_hash: q("h"),
    params: q("{}"),
    source_endpoint: q("e"),
    payload: q("{}"),
    payload_version: "1",
    as_at: "now()",
    fetched_at: "now()",
    complete: "true",
  },
  xero_snapshot_runs: {
    id: q("c0000017-1111-4111-8111-111111111111"),
    client_id: q(CLIENT_A),
    firm_id: q(ORG_A),
    tenant_id: q(TENANT_A),
    trigger: q("manual"),
    status: q("ok"),
    reports_requested: "1",
    reports_succeeded: "1",
    reports_failed: "0",
    started_at: "now()",
  },
  report_cache: {
    id: q("c0000018-1111-4111-8111-111111111111"),
    user_id: q(U.ownerA),
    tenant_id: q(TENANT_A),
    report_key: q("pnl"),
    params_hash: q("h"),
    payload: q("{}"),
    fetched_at: "now()",
  },
  scenario_exclusions: {
    id: q("c0000019-1111-4111-8111-111111111111"),
    client_id: q(CLIENT_A),
    xero_invoice_id: q("inv-1"),
  },
  audit_log: {
    id: q("d0000001-1111-4111-8111-111111111111"),
    firm_id: q(ORG_A),
    actor_user_id: q(U.ownerA),
    action: q("test_event"),
    at: "now()",
  },
  login_events: {
    id: q("d0000002-1111-4111-8111-111111111111"),
    user_id: q(U.ownerA),
    email: q("a@example.invalid"),
    occurred_at: "now()",
  },
  xero_api_errors: {
    id: q("d0000003-1111-4111-8111-111111111111"),
    firm_id: q(ORG_A),
    path: q("/Reports"),
    occurrences: "1",
    first_seen: "now()",
    last_seen: "now()",
    day: "current_date",
  },
  subscriptions: {
    id: q("d0000004-1111-4111-8111-111111111111"),
    firm_id: q(ORG_A),
    tier: q("ptb"),
    status: q("active"),
    cancel_at_period_end: "false",
    consolidation_enabled: "false",
    wip_enabled: "false",
  },
  billing_events: {
    id: q("d0000005-1111-4111-8111-111111111111"),
    firm_id: q(ORG_A),
    stripe_event_id: q("evt_1"),
    type: q("invoice.paid"),
    payload: q("{}"),
    occurred_at: "now()",
  },
  plan_levels: {
    id: q("d0000006-1111-4111-8111-111111111111"),
    scope: q("firm"),
    key: q("ptb"),
    label: q("PTB"),
    description: q("d"),
    client_limit: "1",
    xero_org_limit: "1",
    allows_multi_org: "false",
    widgets: "'{}'::text[]",
    sort_order: "1",
    enabled: "true",
    allowed_tiers: "'{basic}'::text[]",
    is_free: "true",
  },
  tier_settings: { tier: q("basic"), enabled: "true" },
  signup_requests: {
    id: q("d0000007-1111-4111-8111-111111111111"),
    firm_name: q("Org A"),
    contact_name: q("A"),
    email: q("a@example.invalid"),
    status: q("new"),
  },
  access_invites: {
    id: q("d0000008-1111-4111-8111-111111111111"),
    firm_id: q(ORG_A),
    email: q("a@example.invalid"),
    role: q("staff"),
    token_hash: q("h"),
    expires_at: "now() + interval '1 day'",
  },
  firm_viewer_access: {
    id: q("e0000001-1111-4111-8111-111111111111"),
    firm_id: q(ORG_A),
    user_id: q(U.viewer),
    tier: q("basic"),
  },
  user_roles: {
    id: q("d0000009-1111-4111-8111-111111111111"),
    user_id: q(U.superAdmin),
    role: q("super_admin"),
  },
};

/** Primary key column used for the row-scoped read/update/delete probe. */
const PK: Record<string, string> = { tier_settings: "tier" };
const pkOf = (t: string) => PK[t] ?? "id";

/** Database functions callable in the fixture, with a synthetic argument set. */
const EXEC: Record<string, string> = {
  "public.user_can_access_firm()": `select public.user_can_access_firm(auth.uid(), '${ORG_A}')`,
  "public.user_can_access_client()": `select public.user_can_access_client(auth.uid(), '${CLIENT_A}')`,
  "public.client_entitlement()": `select * from public.client_entitlement('${CLIENT_A}')`,
  "public.assert_client_write_access()": `select public.assert_client_write_access('${CLIENT_A}')`,
  "public.set_client_widget_enabled()": `select * from public.set_client_widget_enabled('${CLIENT_A}', 'basic', 'cash', true)`,
  "public.delete_client_report()": `select * from public.delete_client_report('c0000008-1111-4111-8111-111111111111', 'test')`,
  "public.transfer_organisation_ownership()": `select public.transfer_organisation_ownership('${ORG_A}', '${U.staffA}', true)`,
  "public.set_all_client_tiers()": `select * from public.set_all_client_tiers('${ORG_A}', 'basic', false, 'test')`,
  "public.online_users()": `select * from public.online_users(5)`,
  "public.set_profile_display_name_admin()": `select public.set_profile_display_name_admin('${U.staffA}', 'A Name')`,
};

// -------------------------------------------------------------------- harness
type Outcome = "allow" | "deny" | "unsupported";
type Result = { row: MatrixRow; outcome: Outcome; detail: string };

let db: PGlite;
const results: Result[] = [];

function claims(ctx: Ctx) {
  const c: Record<string, string> = { role: ctx.dbRole };
  if (ctx.uid) c["sub"] = ctx.uid;
  if (ctx.aal) c["aal"] = ctx.aal;
  return JSON.stringify(c);
}

/** Runs `fn` as the role, in its own transaction, always rolled back. */
async function asRole<T>(role: Role, fn: () => Promise<T>): Promise<T> {
  const ctx = CONTEXT[role];
  await db.exec("begin");
  try {
    await db.query(`select set_config('request.jwt.claims', $1, true)`, [claims(ctx)]);
    await db.exec(`set local role ${ctx.dbRole}`);
    return await fn();
  } finally {
    await db.exec("rollback");
  }
}

async function probe(sql: string): Promise<{ ok: boolean; rows: number; error?: string }> {
  try {
    const res = await db.query(sql);
    // PGlite reports affectedRows = 0 for SELECT, so take whichever is meaningful.
    return { ok: true, rows: Math.max(res.rows.length, res.affectedRows ?? 0) };
  } catch (e) {
    return { ok: false, rows: 0, error: (e as Error).message };
  }
}

/** Table read/write probe scoped to the seeded Organisation A row. */
async function tableOutcome(table: string, op: MatrixRow["operation"]): Promise<Result["detail"] | Outcome> {
  const spec = TARGET[table];
  if (!spec) return "unsupported";
  const pk = pkOf(table);
  const id = spec[pk]!;

  if (op === "read") {
    const r = await probe(`select 1 from public.${table} where ${pk} = ${id}`);
    return r.ok && r.rows > 0 ? "allow" : "deny";
  }
  if (op === "insert") {
    const cols = Object.keys(spec);
    const vals = cols.map((c) => (c === pk ? newId(spec[c]!) : spec[c]!));
    const r = await probe(
      `insert into public.${table} (${cols.map((c) => `"${c}"`).join(", ")}) values (${vals.join(", ")})`,
    );
    return r.ok && r.rows > 0 ? "allow" : "deny";
  }
  if (op === "update") {
    const r = await probe(`update public.${table} set "${pk}" = "${pk}" where "${pk}" = ${id}`);
    return r.ok && r.rows > 0 ? "allow" : "deny";
  }
  const r = await probe(`delete from public.${table} where "${pk}" = ${id}`);
  return r.ok && r.rows > 0 ? "allow" : "deny";
}

/** A distinct primary key for the insert probe. */
function newId(literal: string): string {
  if (/^'[0-9a-f-]{36}'$/.test(literal)) return `'${"7"}${literal.slice(2)}`;
  return `${literal.slice(0, -1)}-new'`;
}

/** Resources that are not plain tables get a bespoke probe. */
async function specialOutcome(row: MatrixRow): Promise<Outcome> {
  const r = row.resource;

  if (r.startsWith("server fn:")) return "unsupported";
  if (r === "admin_firm_overview") return "unsupported"; // a view; not dumped into the fixture

  if (r === "xero_connections.access_token_enc" || r === "xero_connections.refresh_token_enc") {
    const col = r.split(".")[1]!;
    const p = await probe(`select ${col} from public.xero_connections where id = '${CONN_A}'`);
    return p.ok && p.rows > 0 ? "allow" : "deny";
  }
  if (r === "xero_connections (non-token columns)") {
    const p = await probe(`select id, tenant_name, status from public.xero_connections where id = '${CONN_A}'`);
    return p.ok && p.rows > 0 ? "allow" : "deny";
  }
  if (r.startsWith("firm_support_access (")) {
    // The grant is exercised by reading the organisation it points at.
    const p = await probe(`select 1 from public.clients where id = '${CLIENT_A}'`);
    return p.ok && p.rows > 0 ? "allow" : "deny";
  }
  if (r === "clients (client added after the grant)") {
    const p = await probe(`select 1 from public.clients where id = '${CLIENT_NEW}'`);
    return p.ok && p.rows > 0 ? "allow" : "deny";
  }
  if (r === "clients (another organisation's client)") {
    const p = await probe(`select 1 from public.clients where id = '${CLIENT_B}'`);
    return p.ok && p.rows > 0 ? "allow" : "deny";
  }
  if (r === "member list (standing grant holder is not a member)") {
    const p = await probe(
      `select 1 from public.firm_members where firm_id = '${ORG_A}' and user_id = auth.uid()`,
    );
    return p.ok && p.rows > 0 ? "allow" : "deny";
  }
  if (r === "PLAN_LIMIT_CLIENTS counts clients, not standing grants") {
    // The limit trigger counts client rows. Standing grants must not inflate it.
    const p = await db.query<{ n: number }>(
      `select (select count(*) from public.clients where firm_id = '${ORG_A}')::int as n`,
    );
    return Number(p.rows[0]?.n) === 2 ? "allow" : "deny";
  }
  if (r === "app_private.viewer_tier() — specific grant overrides standing") {
    // The standing grant is multi_company; the specific grant on CLIENT_A is basic.
    const p = await db.query<{ t: string | null }>(
      `select app_private.viewer_tier('${U.viewer}', '${CLIENT_A}')::text as t`,
    );
    return p.rows[0]?.t === "basic" ? "allow" : "deny";
  }
  if (r === "app_private.viewer_tier() — the client's entitlement caps the level") {
    // No subscription on CLIENT_NEW, so the entitlement is Standard (basic) and
    // caps the standing grant's multi_company.
    const p = await db.query<{ t: string | null }>(
      `select app_private.viewer_tier('${U.standingViewer}', '${CLIENT_NEW}')::text as t`,
    );
    return p.rows[0]?.t === "basic" ? "allow" : "deny";
  }
  if (r === "revoking a specific grant leaves the standing grant in place") {
    await db.exec("savepoint revoke_probe");
    try {
      await db.exec(
        `delete from public.client_access where client_id = '${CLIENT_A}' and user_id = '${U.standingViewer}'`,
      );
      const still = await db.query<{ n: number }>(
        `select (select count(*) from public.firm_viewer_access
                  where firm_id = '${ORG_A}' and user_id = '${U.standingViewer}')::int as n`,
      );
      const reads = await db.query<{ ok: boolean }>(
        `select app_private.has_client_read_access('${U.standingViewer}', '${CLIENT_A}') as ok`,
      );
      return Number(still.rows[0]?.n) === 1 && reads.rows[0]?.ok === true ? "allow" : "deny";
    } finally {
      await db.exec("rollback to savepoint revoke_probe");
    }
  }
  if (r.startsWith("profiles")) {
    const uid = CONTEXT[row.role].uid;
    if (row.operation === "read") {
      const p = await probe(`select 1 from public.profiles where id = '${U.staffA}'`);
      return p.ok && p.rows > 0 ? "allow" : "deny";
    }
    if (row.operation === "insert") {
      const p = await probe(
        `insert into public.profiles (id, display_name) values ('99999999-4444-4444-8444-444444444444', 'X')`,
      );
      return p.ok && p.rows > 0 ? "allow" : "deny";
    }
    const target = r.includes("another user") ? U.ownerA : uid;
    const col = r.includes("email") ? "email" : "display_name";
    const p = await probe(
      `update public.profiles set ${col} = 'changed@example.invalid' where id = '${target}'`,
    );
    return p.ok && p.rows > 0 ? "allow" : "deny";
  }
  if (r.startsWith("user_presence")) {
    const uid = CONTEXT[row.role].uid;
    if (row.operation === "read") {
      const p = await probe(`select 1 from public.user_presence where user_id = '${U.staffA}'`);
      return p.ok && p.rows > 0 ? "allow" : "deny";
    }
    if (row.operation === "insert") {
      const p = await probe(
        `insert into public.user_presence (user_id, last_seen_at) values ('${uid}', now())`,
      );
      return p.ok && p.rows > 0 ? "allow" : "deny";
    }
    if (r.includes("forged")) {
      // A forged value is "denied in effect": the write may succeed, but the
      // set_presence_seen_at() trigger must overwrite it.
      const forged = "2099-01-01T00:00:00Z";
      const p = await probe(
        `update public.user_presence set last_seen_at = '${forged}' where user_id = '${uid}'`,
      );
      if (!p.ok || p.rows === 0) return "deny";
      const check = await db.query<{ future: boolean }>(
        `select last_seen_at > now() + interval '1 day' as future from public.user_presence where user_id = '${uid}'`,
      );
      return check.rows[0]?.future ? "allow" : "deny";
    }
    const p = await probe(`update public.user_presence set last_seen_at = now() where user_id = '${U.ownerA}'`);
    return p.ok && p.rows > 0 ? "allow" : "deny";
  }
  if (EXEC[r]) {
    const p = await probe(EXEC[r]!);
    if (!p.ok) return "deny";
    // A boolean-returning authorisation helper answering `false` is a denial.
    return "allow";
  }
  if (r.endsWith("()")) return "unsupported"; // definer function not modelled in the fixture
  return "unsupported";
}

async function evaluate(row: MatrixRow): Promise<Outcome> {
  if (!row.layers.includes("pglite")) return "unsupported";
  return asRole(row.role, async () => {
    if (TARGET[row.resource]) {
      const out = await tableOutcome(row.resource, row.operation);
      return out as Outcome;
    }
    return specialOutcome(row);
  });
}

// ------------------------------------------------------------------- fixture
beforeAll(async () => {
  db = new PGlite();
  const fixture = fs.readFileSync(path.join(process.cwd(), "tests/fixtures/rls-schema.sql"), "utf8");
  await db.exec(fixture);

  const users = Object.values(U);
  await db.exec(`
    insert into auth.users(id, email) values
      ${users.map((u, i) => `('${u}', 'u${i}@example.invalid')`).join(", ")};
    insert into auth.mfa_factors(user_id, status) values
      ${users.map((u) => `('${u}', 'verified')`).join(", ")};
    insert into public.profiles(id, email, display_name) values
      ${users.map((u, i) => `('${u}', 'u${i}@example.invalid', 'User ${i}')`).join(", ")};
    -- staffA deliberately has NO presence row, so the own-row insert probe is real.
    insert into public.user_presence(user_id, last_seen_at) values
      ${users.filter((u) => u !== U.staffA).map((u) => `('${u}', now())`).join(", ")};

    -- Only the four platform accounts hold super_admin; none of them is a member.
    insert into public.user_roles(id, user_id, role) values
      (gen_random_uuid(), '${U.superAdmin}', 'super_admin'),
      (gen_random_uuid(), '${U.supportActive}', 'super_admin'),
      (gen_random_uuid(), '${U.supportExpired}', 'super_admin'),
      (gen_random_uuid(), '${U.supportRevoked}', 'super_admin');

    insert into public.firms(id, name, owner_user_id, is_always_free) values
      ('${ORG_A}', 'Org A', '${U.ownerA}', false),
      ('${ORG_B}', 'Org B', '${U.ownerB}', false);
    insert into public.firm_members(id, firm_id, user_id, role, status) values
      (gen_random_uuid(), '${ORG_A}', '${U.ownerA}', 'owner', 'active'),
      (gen_random_uuid(), '${ORG_A}', '${U.staffA}', 'staff', 'active'),
      (gen_random_uuid(), '${ORG_A}', '${U.suspended}', 'staff', 'suspended'),
      (gen_random_uuid(), '${ORG_A}', '${U.removed}', 'staff', 'removed'),
      (gen_random_uuid(), '${ORG_B}', '${U.ownerB}', 'owner', 'active');

    insert into public.firm_support_access
      (id, firm_id, grantee_user_id, granted, expires_at, revoked_at) values
      (gen_random_uuid(), '${ORG_A}', '${U.supportActive}', true, now() + interval '2 hours', null),
      (gen_random_uuid(), '${ORG_A}', '${U.supportExpired}', true, now() - interval '2 hours', null),
      (gen_random_uuid(), '${ORG_A}', '${U.supportRevoked}', true, now() + interval '2 hours', now());

    insert into public.clients(id, name, owner_user_id, firm_id, notes, report_basis,
                               cost_classification_enabled, basis_overrides, max_xero_orgs,
                               consolidation_mode, consolidation_org_ids) values
      ('${CLIENT_B}', 'Client B', '${U.ownerB}', '${ORG_B}', '', 'accrual', false, '{}', 1, 'none', '{}');
    -- The standing grant (path D) and a client added to Organisation A after it.
    insert into public.firm_viewer_access(id, firm_id, user_id, tier, granted_by) values
      ('e0000002-1111-4111-8111-111111111111', '${ORG_A}', '${U.standingViewer}', 'multi_company', '${U.ownerA}');
    insert into public.clients(id, name, owner_user_id, firm_id, notes, report_basis,
                               cost_classification_enabled, basis_overrides, max_xero_orgs,
                               consolidation_mode, consolidation_org_ids) values
      ('${CLIENT_NEW}', 'Client added later', '${U.ownerA}', '${ORG_A}', '', 'accrual', false, '{}', 1, 'none', '{}');
    insert into public.xero_connections(id, user_id, tenant_id, tenant_name, firm_id, status,
                                        expires_at, access_token_enc, refresh_token_enc, enc_version) values
      ('${CONN_A}', '${U.ownerA}', '${TENANT_A}', 'File A', '${ORG_A}', 'connected',
       now() + interval '1 day', 'ctA', 'rtA', 1);
  `);

  // Every table under test gets its Organisation A row.
  for (const [table, spec] of Object.entries(TARGET)) {
    if (table === "firms" || table === "xero_connections") continue;
    const cols = Object.keys(spec);
    await db.exec(
      `insert into public.${table} (${cols.map((c) => `"${c}"`).join(", ")}) values (${cols
        .map((c) => spec[c]!)
        .join(", ")}) on conflict do nothing;`,
    );
  }

  for (const row of MATRIX) {
    results.push({ row, outcome: await evaluate(row), detail: "" });
  }
}, 120_000);

// -------------------------------------------------------------------- reports
const label = (r: MatrixRow) => `${ROLE_LABELS[r.role]} · ${r.resource} · ${r.operation}`;

afterAll(() => {
  const liveOnly = results.filter((r) => r.outcome === "unsupported");
  const known = results.filter((r) => r.row.knownFailure && r.outcome !== "unsupported");
  const knownPending = results.filter((r) => r.row.knownFailure && r.outcome === "unsupported");
  const tested = results.filter((r) => r.outcome !== "unsupported" && !r.row.knownFailure);
  const failed = tested.filter((r) => r.outcome !== r.row.expect);

  const byResource = new Map<string, number>();
  for (const r of liveOnly) byResource.set(r.row.resource, (byResource.get(r.row.resource) ?? 0) + 1);

  console.log(
    [
      "",
      "──────── ACCESS MATRIX (PGlite layer) ────────",
      `matrix rows        : ${MATRIX.length}`,
      `proved here        : ${tested.length}  (passed ${tested.length - failed.length}, failed ${failed.length})`,
      `known failures     : ${known.length}`,
      `live-only, part 3  : ${liveOnly.length}`,
      "",
      "KNOWN FAILURES (asserted inverted — wrong behaviour proved to still exist):",
      ...(known.length
        ? [...new Set(known.map((r) => `  backlog ${r.row.knownFailure!.backlog}: ${r.row.knownFailure!.note}`))]
        : ["  none"]),
      `  affected rows proved here: ${known.length}`,
      ...(knownPending.length
        ? [
            "  known failures that only the live suite can prove (part 3):",
            ...[...new Set(knownPending.map((r) => `    backlog ${r.row.knownFailure!.backlog}: ${r.row.resource}`))],
          ]
        : []),
      "",
      "LIVE-ONLY ROWS (part 3 — NOT counted as passes):",
      ...[...byResource.entries()].map(([res, n]) => `  ${res} × ${n}`),
      "──────────────────────────────────────────────",
      "",
    ].join("\n"),
  );

  fs.writeFileSync(
    "/tmp/access-matrix-summary.json",
    JSON.stringify(
      {
        rows: MATRIX.length,
        proved: tested.length,
        passed: tested.length - failed.length,
        failed: failed.length,
        knownFailures: known.length,
        liveOnly: liveOnly.length,
        failures: failed.map((f) => label(f.row)),
      },
      null,
      2,
    ),
  );
});

describe("access matrix — PGlite layer", () => {
  it("has a probe for every role in the matrix", () => {
    const missing = [...new Set(MATRIX.map((r) => r.role))].filter((r) => !CONTEXT[r]);
    expect(missing).toEqual([]);
  });

  it("proves every testable row, and reports the rest as live-only", () => {
    const failures = results
      .filter((r) => r.outcome !== "unsupported" && !r.row.knownFailure && r.outcome !== r.row.expect)
      .map((r) => `${label(r.row)} — expected ${r.row.expect}, got ${r.outcome}  [${r.row.rule}]`);
    expect(failures, `Access matrix violations:\n${failures.map((f) => `  - ${f}`).join("\n")}`).toEqual([]);
  });

  it("still shows every known failure, and no more", () => {
    const healed = results
      .filter((r) => r.row.knownFailure && r.outcome !== "unsupported" && r.outcome === r.row.expect)
      .map((r) => `${label(r.row)} (backlog ${r.row.knownFailure!.backlog})`);
    expect(
      healed,
      `These rows now behave correctly. If the fixing phase landed, remove their knownFailure marker:\n${healed
        .map((f) => `  - ${f}`)
        .join("\n")}`,
    ).toEqual([]);
  });

  it("names a backlog item for every known failure", () => {
    const unnumbered = MATRIX.filter((r) => r.knownFailure && !(r.knownFailure.backlog > 0));
    expect(unnumbered).toEqual([]);
  });
});

describe("meta: the suite can actually detect a regression", () => {
  it("(a) denies an aal1 claim on a data table that aal2 can read", async () => {
    const withAal2 = await asRole("org_owner", () =>
      probe(`select 1 from public.clients where id = '${CLIENT_A}'`),
    );
    expect(withAal2.rows, "an aal2 owner must see their own client").toBeGreaterThan(0);
    const withAal1 = await asRole("aal1_member", () =>
      probe(`select 1 from public.clients where id = '${CLIENT_A}'`),
    );
    expect(withAal1.rows, "an aal1 session must see nothing").toBe(0);
  });

  it("(b) catches a dropped organisation-scoping policy, then rolls it back", async () => {
    const before = await asRole("other_org_member", () =>
      probe(`select 1 from public.clients where id = '${CLIENT_A}'`),
    );
    expect(before.rows).toBe(0);

    await db.exec("begin");
    let leaked = 0;
    try {
      const names = await db.query<{ polname: string }>(
        `select polname from pg_policy where polrelid = 'public.clients'::regclass and polpermissive`,
      );
      for (const n of names.rows) await db.exec(`drop policy "${n.polname}" on public.clients`);
      await db.exec(`create policy tmp_leak on public.clients as permissive for select to authenticated using (true)`);
      await db.query(`select set_config('request.jwt.claims', $1, true)`, [claims(CONTEXT.other_org_member)]);
      await db.exec("set local role authenticated");
      const p = await probe(`select 1 from public.clients where id = '${CLIENT_A}'`);
      leaked = p.rows;
    } finally {
      await db.exec("rollback");
    }
    expect(leaked, "with the scoping policy removed the suite must observe the leak").toBeGreaterThan(0);

    const after = await asRole("other_org_member", () =>
      probe(`select 1 from public.clients where id = '${CLIENT_A}'`),
    );
    expect(after.rows, "the rollback must restore isolation").toBe(0);
  });

  it("(c) the static guard catches a createServerFn without requireAal2", async () => {
    const { AAL1_ALLOWLIST } = await import("../docs/security/server-fn-aal1-allowlist");
    const fake = `export const leakyThing = createServerFn({ method: "GET" })
      .middleware([requireSupabaseAuth])
      .handler(async () => ({}));`;
    const parts = fake.split(/export const /).slice(1);
    const offenders = parts
      .filter((p) => p.includes("createServerFn("))
      .filter((p) => !p.slice(0, p.indexOf(".handler(")).includes("requireAal2"))
      .map((p) => p.slice(0, p.indexOf(" ")));
    expect(offenders).toEqual(["leakyThing"]);
    expect(AAL1_ALLOWLIST.some((a) => a.fn === "leakyThing")).toBe(false);
  });
});

describe("audit trigger — every Path C table records its changes (backlog 29)", () => {
  const AUDITED = [
    "user_roles",
    "plan_levels",
    "signup_requests",
    "xero_assessment_contact",
    "client_subscriptions",
    "subscriptions",
    "firms",
  ];

  it("attaches audit_table_change to every covered table, for insert, update and delete", async () => {
    const missing: string[] = [];
    for (const t of AUDITED) {
      const r = await db.query<{ n: number; ins: boolean; upd: boolean; del: boolean }>(
        `select count(*)::int as n,
                bool_or((tgtype & 4) > 0) as ins,
                bool_or((tgtype & 16) > 0) as upd,
                bool_or((tgtype & 8) > 0) as del
           from pg_trigger t
           join pg_proc p on p.oid = t.tgfoid
          where t.tgrelid = 'public.${t}'::regclass
            and not t.tgisinternal
            and p.proname = 'audit_table_change'`,
      );
      const row = r.rows[0];
      if (!row || row.n === 0 || !row.ins || !row.upd || !row.del) missing.push(t);
    }
    expect(missing, `these tables are not fully audited: ${missing.join(", ")}`).toEqual([]);
  });

  it("writes an audit_log row naming the actor and the changed columns", async () => {
    await db.exec("begin");
    try {
      await db.exec("set local role postgres");
      await db.query(`select set_config('request.jwt.claims', $1, true)`, ["{}"]);
      await db.exec(`update public.firms set name = name || ' (audit probe)'`);
      const r = await db.query<{ n: number }>(
        `select count(*)::int as n from public.audit_log
          where action = 'record_update' and target_type = 'firms'
            and meta ? 'changed'`,
      );
      expect(r.rows[0]!.n).toBeGreaterThan(0);
    } finally {
      await db.exec("rollback");
    }
  });
});
