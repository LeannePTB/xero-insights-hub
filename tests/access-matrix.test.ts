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
  /** Holds BOTH a standing grant and a specific grant, to prove precedence. */
  mixedViewer: "99990012-1111-4111-8111-111111111111",
  /** Subject of the standing-grant row probes only; holds no other access. */
  grantTarget: "99990013-1111-4111-8111-111111111111",
  businessOwnerOne: "99990014-1111-4111-8111-111111111111",
  businessOwnerTwo: "99990015-1111-4111-8111-111111111111",
  handoverOwner: "99990016-1111-4111-8111-111111111111",
  supportActive: "99990005-1111-4111-8111-111111111111",
  supportExpired: "99990006-1111-4111-8111-111111111111",
  supportRevoked: "99990007-1111-4111-8111-111111111111",
  superAdmin: "99990008-1111-4111-8111-111111111111",
  suspended: "99990009-1111-4111-8111-111111111111",
  removed: "99990010-1111-4111-8111-111111111111",
};

type Ctx = {
  uid: string | null;
  dbRole: "anon" | "authenticated";
  aal: "aal1" | "aal2" | null;
  /** Overrides the session_id claim; used for the stale-session context. */
  sessionId?: string;
};

/** A session signed in today whose last recorded activity is 40 minutes ago. */
const IDLE_SESSION = "77777777-2222-4222-8222-222222222222";
/** A session seconds old with NO activity row: the just-completed-MFA case. */
const FRESH_SESSION = "77777777-3333-4333-8333-333333333333";
/** Signed in 90 minutes ago and STILL BEING USED: activity 2 minutes ago. */
const ACTIVE_SESSION = "77777777-4444-4444-8444-444444444444";

const CONTEXT: Record<Role, Ctx> = {
  anonymous: { uid: null, dbRole: "anon", aal: null },
  aal1_member: { uid: U.staffA, dbRole: "authenticated", aal: "aal1" },
  idle_session_member: {
    uid: U.staffA,
    dbRole: "authenticated",
    aal: "aal2",
    sessionId: IDLE_SESSION,
  },
  fresh_mfa_session_member: {
    uid: U.staffA,
    dbRole: "authenticated",
    aal: "aal2",
    sessionId: FRESH_SESSION,
  },
  active_session_member: {
    uid: U.staffA,
    dbRole: "authenticated",
    aal: "aal2",
    sessionId: ACTIVE_SESSION,
  },
  org_owner: { uid: U.ownerA, dbRole: "authenticated", aal: "aal2" },
  org_staff: { uid: U.staffA, dbRole: "authenticated", aal: "aal2" },
  other_org_member: { uid: U.ownerB, dbRole: "authenticated", aal: "aal2" },
  org_a_owner_reading_org_b: { uid: U.ownerB, dbRole: "authenticated", aal: "aal2" },
  client_viewer: { uid: U.viewer, dbRole: "authenticated", aal: "aal2" },
  // Live-only rows today: no PGlite probe uses this context yet.
  business_owner: { uid: U.businessOwnerOne, dbRole: "authenticated", aal: "aal2" },
  standing_viewer: { uid: U.standingViewer, dbRole: "authenticated", aal: "aal2" },
  support_grant_active: { uid: U.supportActive, dbRole: "authenticated", aal: "aal2" },
  support_grant_expired: { uid: U.supportExpired, dbRole: "authenticated", aal: "aal2" },
  support_grant_revoked: { uid: U.supportRevoked, dbRole: "authenticated", aal: "aal2" },
  super_admin_no_membership: { uid: U.superAdmin, dbRole: "authenticated", aal: "aal2" },
  super_admin_self_approving_support: { uid: U.superAdmin, dbRole: "authenticated", aal: "aal2" },
  suspended_member: { uid: U.suspended, dbRole: "authenticated", aal: "aal2" },
  removed_member: { uid: U.removed, dbRole: "authenticated", aal: "aal2" },
  // Live-suite accounts only: every one of their rows is layers: ["live"], so
  // no PGlite probe ever uses this context. Present because CONTEXT is
  // exhaustive over Role.
  security_test_account: { uid: null, dbRole: "authenticated", aal: "aal2" },
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
  client_notes: {
    id: q("c0000002-1111-4111-8111-111111111111"),
    client_id: q(CLIENT_A),
    body: q("note"),
  },
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
  unreconciled_uploads: {
    id: q(UPLOAD_A),
    client_id: q(CLIENT_A),
    filename: q("a.csv"),
    line_count: "1",
  },
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
  xero_rate_limits: {
    tenant_id: q("11111111-2222-4222-8222-222222222222"),
    day: "current_date",
    firm_id: q(ORG_A),
    tenant_name: q("Seed File"),
    calls_observed: "1",
    rate_limited_count: "0",
    hour_calls: "1",
    peak_hour_calls: "1",
    first_seen: "now()",
    last_seen: "now()",
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
    user_id: q(U.grantTarget),
    tier: q("basic"),
  },
  user_roles: {
    id: q("d0000009-1111-4111-8111-111111111111"),
    user_id: q(U.superAdmin),
    role: q("super_admin"),
  },
  security_attestations: {
    check_key: q("leaked_password"),
    confirmed_by: q(U.superAdmin),
  },
};

/** Primary key column used for the row-scoped read/update/delete probe. */
const PK: Record<string, string> = {
  tier_settings: "tier",
  security_attestations: "check_key",
  // Keyed by (tenant_id, day); the probe scopes on the tenant, which is unique
  // within the seeded day.
  xero_rate_limits: "tenant_id",
};

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
  // The inactivity timeout resolves the session's activity from its session id,
  // so every signed-in context needs a session_id backed by an auth.sessions row.
  if (ctx.uid) c["session_id"] = ctx.sessionId ?? ctx.uid;
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
async function tableOutcome(
  table: string,
  op: MatrixRow["operation"],
): Promise<Result["detail"] | Outcome> {
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

/** Re-points the current transaction at another user, for a cross-user assertion. */
async function actAs(uid: string) {
  await db.query(`select set_config('request.jwt.claims', $1, true)`, [
    JSON.stringify({ role: "authenticated", sub: uid, aal: "aal2", session_id: uid }),
  ]);
}

/** Resources that are not plain tables get a bespoke probe. */
/**
 * Setup that must happen outside the caller's own privileges, then hand the
 * transaction back to the row's role. Safe because every case runs in a
 * transaction that is always rolled back.
 */
async function seedThenActAs(role: Role, sql: string) {
  await db.exec("set local role postgres");
  await db.exec(sql);
  const ctx = CONTEXT[role];
  await db.query(`select set_config('request.jwt.claims', $1, true)`, [claims(ctx)]);
  await db.exec(`set local role ${ctx.dbRole}`);
}

async function specialOutcome(row: MatrixRow): Promise<Outcome> {
  const r = row.resource;

  if (r.startsWith("server fn:")) return "unsupported";
  if (r === "admin_firm_overview") return "unsupported"; // a view; not dumped into the fixture

  if (r === "assert_aal2() with an idle session") {
    const p = await probe(`select app_private.assert_aal2()`);
    // The code must be SESSION_IDLE: an idle session is not an MFA problem, and
    // sending people to their authenticator app would be the wrong instruction.
    if (!p.ok) expect(String(p.error)).toContain("SESSION_IDLE");
    return p.ok ? "allow" : "deny";
  }
  if (r.startsWith("record_view_as(")) {
    // View As is a presentation filter, but recording it is the control: if the
    // record is refused the preview never opens. ORG_A for "their own", ORG_B
    // for the organisation a super admin only reaches by being a super admin.
    const org = r.includes("not a member of") ? ORG_B : ORG_A;
    const p = await probe(`select public.record_view_as('${org}'::uuid, null, 'owner')`);
    return p.ok ? "allow" : "deny";
  }
  if (r === "xero_error_breakdown()") {
    const p = await probe(`select * from public.xero_error_breakdown(7)`);
    return p.ok ? "allow" : "deny";
  }
  if (r === "starting a trial over purchased Advisory converts the purchase and keeps ticks") {
    await db.exec("set local role postgres");
    await db.exec(`
      delete from public.client_cards where client_id = '${CLIENT_A}'::uuid;
      insert into public.client_cards (client_id, cards)
      values ('${CLIENT_A}'::uuid, array['cashflow','debtors']);
      delete from public.org_subscription_options where firm_id = '${ORG_B}'::uuid;
      insert into public.org_subscription_options
        (firm_id, client_limit, advisory_enabled, consolidation_enabled, billing_mode)
      values ('${ORG_B}'::uuid, 10, true, false, 'bookkeeping');
    `);
    const changed = await probe(
      `select public.set_org_trial('${ORG_B}'::uuid, true, false, false, now() + interval '30 days', 'matrix overlap conversion')`,
    );
    await db.exec("set local role postgres");
    const state = await db.query<{
      purchased: boolean;
      trialled: boolean;
      ticked: string[];
    }>(`
      select o.advisory_enabled as purchased,
             o.trial_advisory_enabled as trialled,
             (select cards from public.client_cards where client_id = '${CLIENT_A}'::uuid) as ticked
        from public.org_subscription_options o
       where o.firm_id = '${ORG_B}'::uuid
    `);
    const row = state.rows[0];
    return changed.ok && !row?.purchased && row?.trialled && (row?.ticked ?? []).length === 2
      ? "allow"
      : "deny";
  }
  if (r.startsWith("set_org_trial(")) {
    // ORG_B for a super admin with no membership — a trial is plan metadata, not
    // an access path, so this one is allowed to succeed. Everyone else acts on
    // the organisation they are attached to and must be refused.
    const org = r.includes("any organisation") ? ORG_B : ORG_A;
    const p = await probe(
      `select public.set_org_trial('${org}'::uuid, true, false, false, now() + interval '30 days', 'matrix probe')`,
    );
    return p.ok ? "allow" : "deny";
  }
  if (r === "toggling Consolidation off and on preserves all consolidation working data") {
    // The owner's biggest concern: does switching Consolidation off destroy the
    // consolidation work? Counts the four working-data tables before, during and
    // after, and proves the card leaves and returns while they never move.
    const counts = async () => {
      const res = await db.query<{
        groups: number;
        members: number;
        accounts: number;
        snapshots: number;
        card: boolean;
        ticks: string[];
      }>(`
        select (select count(*) from public.consolidation_groups) as groups,
               (select count(*) from public.consolidation_group_members) as members,
               (select count(*) from public.loan_consolidation_accounts) as accounts,
               (select count(*) from public.loan_consolidation_snapshots) as snapshots,
               app_private.client_available_cards('${CLIENT_A}'::uuid)
                 @> array['loan_consolidation'] as card,
               (select cards from public.client_cards where client_id = '${CLIENT_A}'::uuid) as ticks
      `);
      const row = res.rows[0]!;
      return {
        ...row,
        groups: Number(row.groups),
        members: Number(row.members),
        accounts: Number(row.accounts),
        snapshots: Number(row.snapshots),
      };
    };
    await db.exec("set local role postgres");
    await db.exec(`
      delete from public.client_cards where client_id = '${CLIENT_A}'::uuid;
      insert into public.client_cards (client_id, cards)
      values ('${CLIENT_A}'::uuid, array['cashflow','loan_consolidation']);
      delete from public.org_subscription_options where firm_id = '${ORG_A}'::uuid;
      insert into public.org_subscription_options
        (firm_id, client_limit, advisory_enabled, consolidation_enabled, billing_mode)
      values ('${ORG_A}'::uuid, 10, true, true, 'bookkeeping');
    `);
    const before = await counts();
    // The purchase control itself, run as this row's role (a super admin).
    const ctx = CONTEXT[row.role];
    await db.query(`select set_config('request.jwt.claims', $1, true)`, [claims(ctx)]);
    await db.exec(`set local role ${ctx.dbRole}`);
    // A savepoint keeps a refusal from poisoning the rest of the case.
    const guarded = async (sql: string) => {
      await db.exec("savepoint toggle_sp");
      const p = await probe(sql);
      await db.exec(p.ok ? "release savepoint toggle_sp" : "rollback to savepoint toggle_sp");
      if (!p.ok) console.log(`  consolidation toggle — refused: ${p.error}`);
      return p;
    };
    const off = await guarded(
      `select public.set_org_purchase('${ORG_A}'::uuid, 10, true, false, false, 'bookkeeping')`,
    );
    await db.exec("set local role postgres");
    const during = await counts();
    await db.query(`select set_config('request.jwt.claims', $1, true)`, [claims(ctx)]);
    await db.exec(`set local role ${ctx.dbRole}`);
    const on = await guarded(
      `select public.set_org_purchase('${ORG_A}'::uuid, 10, true, true, false, 'bookkeeping')`,
    );
    await db.exec("set local role postgres");
    const after = await counts();

    const dataUnchanged = (a: typeof before, b: typeof before) =>
      a.groups === b.groups &&
      a.members === b.members &&
      a.accounts === b.accounts &&
      a.snapshots === b.snapshots;
    const shape = (c: typeof before) =>
      `groups ${c.groups} / members ${c.members} / loan accounts ${c.accounts} / snapshots ${c.snapshots} — card ${c.card ? "available" : "hidden"}, ticks [${(c.ticks ?? []).join(",")}]`;
    console.log(`  consolidation toggle — before:  ${shape(before)}`);
    console.log(`  consolidation toggle — during:  ${shape(during)}`);
    console.log(`  consolidation toggle — after:   ${shape(after)}`);

    const preserved =
      off.ok &&
      on.ok &&
      dataUnchanged(before, during) &&
      dataUnchanged(before, after) &&
      before.card === true &&
      during.card === false &&
      after.card === true &&
      (during.ticks ?? []).includes("loan_consolidation") &&
      (after.ticks ?? []).includes("loan_consolidation");
    if (!preserved) {
      throw new Error(
        `Switching Consolidation off must never touch consolidation working data. before: ${shape(before)}; during: ${shape(during)}; after: ${shape(after)}`,
      );
    }
    return "allow";
  }
  if (r === "purchased Advisory keeps its cards with no trial or an expired trial") {
    // The case that protects an organisation whose Advisory is granted rather
    // than trialled: purchased true, trial absent, then an expired trial.
    await db.exec("set local role postgres");
    await db.exec(`
      delete from public.org_subscription_options where firm_id = '${ORG_A}'::uuid;
      insert into public.org_subscription_options
        (firm_id, client_limit, advisory_enabled, consolidation_enabled, billing_mode,
         trial_advisory_enabled, trial_consolidation_enabled, trial_ends_at)
      values ('${ORG_A}'::uuid, 10, true, false, 'bookkeeping', false, false, null);
    `);
    const withNoTrial = await db.query<{ ok: boolean }>(
      `select app_private.client_available_cards('${CLIENT_A}'::uuid) @> array['cashflow'] as ok`,
    );
    await db.exec(`
      update public.org_subscription_options
         set trial_advisory_enabled = true, trial_ends_at = now() - interval '1 day'
       where firm_id = '${ORG_A}'::uuid;
    `);
    const withExpiredTrial = await db.query<{ ok: boolean }>(
      `select app_private.client_available_cards('${CLIENT_A}'::uuid) @> array['cashflow'] as ok`,
    );
    return withNoTrial.rows[0]?.ok && withExpiredTrial.rows[0]?.ok ? "allow" : "deny";
  }
  if (
    r === "an expired trial with nothing purchased shows no Advisory cards, and the ticks survive"
  ) {
    await db.exec("set local role postgres");
    await db.exec(`
      delete from public.client_cards where client_id = '${CLIENT_A}'::uuid;
      insert into public.client_cards (client_id, cards)
      values ('${CLIENT_A}'::uuid, array['cashflow','debtors']);
      delete from public.org_subscription_options where firm_id = '${ORG_A}'::uuid;
      insert into public.org_subscription_options
        (firm_id, client_limit, advisory_enabled, consolidation_enabled, billing_mode,
         trial_advisory_enabled, trial_consolidation_enabled, trial_ends_at)
      values ('${ORG_A}'::uuid, 10, false, false, 'bookkeeping', true, false, now() - interval '1 day');
    `);
    const res = await db.query<{ has_advisory: boolean; ticks: string[] }>(
      `select app_private.client_available_cards('${CLIENT_A}'::uuid) @> array['cashflow'] as has_advisory,
              (select cards from public.client_cards where client_id = '${CLIENT_A}'::uuid) as ticks`,
    );
    const row = res.rows[0];
    const ticksKept = (row?.ticks ?? []).includes("cashflow");
    // "deny" is the expectation: no Advisory card, with the ticks still recorded.
    return !row?.has_advisory && ticksKept ? "deny" : "allow";
  }
  if (r === "touch_session_activity()") {
    const p = await probe(`select public.touch_session_activity()`);
    return p.ok ? "allow" : "deny";
  }
  if (r === "admin_assert_can_sign_out_user(another person)") {
    const p = await probe(`select public.admin_assert_can_sign_out_user('${U.staffA}'::uuid)`);
    return p.ok ? "allow" : "deny";
  }
  if (r === "admin_assert_can_sign_out_user(their own account)") {
    const p = await probe(`select public.admin_assert_can_sign_out_user('${U.superAdmin}'::uuid)`);
    return p.ok ? "allow" : "deny";
  }
  if (r === "assert_aal2() immediately after MFA (no activity row yet)") {
    // Regression: no session_activity row exists yet for this session, so
    // is_session_active() must fall back to its start time in auth.sessions.
    const p = await probe(`select app_private.assert_aal2()`);
    return p.ok ? "allow" : "deny";
  }
  if (r === "assert_aal2() after 90 minutes of continuous use") {
    // POSITIVE proof. The session began 90 minutes ago, so its age alone is well
    // past the window; only the recorded activity from 2 minutes ago can keep it
    // active. This must NEVER refuse — refusing it is the outage of 15 Sep 2026.
    const p = await probe(`select app_private.assert_aal2()`);
    if (!p.ok) {
      throw new Error(
        `An actively used session was refused — this is the lockout condition: ${p.error}`,
      );
    }
    return "allow";
  }
  if (r === "assert_aal2() with no session_id claim") {
    // Same person, same aal2 claim, no session_id: fail closed.
    await db.query(`select set_config('request.jwt.claims', $1, true)`, [
      JSON.stringify({ role: "authenticated", sub: U.staffA, aal: "aal2" }),
    ]);
    const p = await probe(`select app_private.assert_aal2()`);
    return p.ok ? "allow" : "deny";
  }
  if (r === "xero_connections.access_token_enc" || r === "xero_connections.refresh_token_enc") {
    const col = r.split(".")[1]!;
    const p = await probe(`select ${col} from public.xero_connections where id = '${CONN_A}'`);
    return p.ok && p.rows > 0 ? "allow" : "deny";
  }
  if (r === "xero_connections (non-token columns)") {
    const p = await probe(
      `select id, tenant_name, status from public.xero_connections where id = '${CONN_A}'`,
    );
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
    await actAs(U.ownerA);
    const p = await db.query<{ n: number }>(
      `select (select count(*) from public.clients where firm_id = '${ORG_A}')::int as n`,
    );
    return Number(p.rows[0]?.n) === 2 ? "allow" : "deny";
  }
  if (r === "app_private.viewer_tier() — specific grant overrides standing") {
    // The standing grant is multi_company and the client is entitled to it; the
    // specific grant on that client is advisory, and must win.
    await actAs(U.mixedViewer);
    const p = await db.query<{ t: string | null }>(
      `select app_private.viewer_tier('${U.mixedViewer}', '${CLIENT_NEW}')::text as t`,
    );
    return p.rows[0]?.t === "advisory" ? "allow" : "deny";
  }
  if (r === "app_private.viewer_tier() — the client's entitlement caps the level") {
    // CLIENT_A is free_forever at Standard (basic), which caps the standing
    // grant's multi_company.
    await actAs(U.standingViewer);
    const p = await db.query<{ t: string | null }>(
      `select app_private.viewer_tier('${U.standingViewer}', '${CLIENT_A}')::text as t`,
    );
    return p.rows[0]?.t === "basic" ? "allow" : "deny";
  }
  if (r === "revoking a specific grant leaves the standing grant in place") {
    await db.exec("savepoint revoke_probe");
    try {
      await db.exec("set local role postgres");
      await actAs(U.mixedViewer);
      await db.exec(
        `delete from public.client_access where client_id = '${CLIENT_NEW}' and user_id = '${U.mixedViewer}'`,
      );
      const still = await db.query<{ n: number }>(
        `select (select count(*) from public.firm_viewer_access
                  where firm_id = '${ORG_A}' and user_id = '${U.mixedViewer}')::int as n`,
      );
      const reads = await db.query<{ ok: boolean }>(
        `select app_private.has_client_read_access('${U.mixedViewer}', '${CLIENT_NEW}') as ok`,
      );
      return Number(still.rows[0]?.n) === 1 && reads.rows[0]?.ok === true ? "allow" : "deny";
    } finally {
      await db.exec("rollback to savepoint revoke_probe");
    }
  }
  if (r === "viewer management for a client in the caller's own organisation") {
    const p = await probe(
      `select 1 / (case when app_private.can_manage_viewers_for_client(auth.uid(), '${CLIENT_A}') then 1 else 0 end)`,
    );
    return p.ok ? "allow" : "deny";
  }
  if (r === "viewer management for another organisation's client") {
    const p = await probe(
      `select 1 / (case when app_private.can_manage_viewers_for_client(auth.uid(), '${CLIENT_B}') then 1 else 0 end)`,
    );
    return p.ok ? "allow" : "deny";
  }
  if (r === "practice-team membership of organisation A inside organisation B") {
    // ownerA is on the practice team and an active member of A only. Path D
    // management must not follow the practice-team row into organisation B.
    const p = await probe(
      `select 1 / (case when app_private.can_manage_client_viewers(auth.uid(), '${ORG_B}') then 1 else 0 end)`,
    );
    return p.ok ? "allow" : "deny";
  }
  if (r.startsWith("user_can_write_client_scenario()")) {
    const p = await probe(
      `select 1 / (case when public.user_can_write_client_scenario('${CLIENT_A}') then 1 else 0 end)`,
    );
    return p.ok ? "allow" : "deny";
  }
  if (r === "set_client_access_relationship() for own organisation") {
    const p = await probe(
      `select public.set_client_access_relationship('c0000003-1111-4111-8111-111111111111', 'external_adviser')`,
    );
    return p.ok ? "allow" : "deny";
  }
  if (r === "two Business owners on one client remain independently client-scoped") {
    await db.exec("set local role postgres");
    const p = await db.query<{ same_client: number; cross_client: number }>(`
      select
        (select count(*) from public.client_access
          where client_id = '${CLIENT_A}'
            and user_id in ('${U.businessOwnerOne}', '${U.businessOwnerTwo}')
            and relationship = 'business_owner')::int as same_client,
        (select count(*) from public.client_access
          where (user_id = '${U.businessOwnerOne}' and client_id = '${CLIENT_B}')
             or (user_id = '${U.businessOwnerTwo}' and client_id = '${CLIENT_NEW}'))::int as cross_client
    `);
    return p.rows[0]?.same_client === 2 && p.rows[0]?.cross_client === 0 ? "allow" : "deny";
  }
  if (r === "membership governs a simultaneous Business owner relationship") {
    await db.exec("set local role postgres");
    const p = await db.query<{ memberships: number; relationships: number }>(`
      select
        (select count(*) from public.firm_members
          where firm_id = '${ORG_A}' and user_id = '${U.handoverOwner}'
            and status = 'active')::int as memberships,
        (select count(*) from public.client_access
          where client_id = '${CLIENT_A}' and user_id = '${U.handoverOwner}'
            and relationship = 'business_owner')::int as relationships
    `);
    return p.rows[0]?.memberships === 1 && p.rows[0]?.relationships === 1 ? "allow" : "deny";
  }
  if (r === "removing membership preserves the Business owner relationship row") {
    await db.exec("set local role postgres");
    await db.exec(
      `update public.firm_members set status = 'removed'
        where firm_id = '${ORG_A}' and user_id = '${U.handoverOwner}'`,
    );
    const p = await db.query<{ member: boolean; rows: number }>(`
      select app_private.has_firm_access('${U.handoverOwner}', '${ORG_A}') as member,
             (select count(*) from public.client_access
               where client_id = '${CLIENT_A}' and user_id = '${U.handoverOwner}'
                 and relationship = 'business_owner')::int as rows
    `);
    return p.rows[0]?.member === false && p.rows[0]?.rows === 1 ? "allow" : "deny";
  }
  if (r === "inviter labels do not affect identity or authorisation") {
    await db.exec("set local role postgres");
    const before = await db.query<{ rows: number }>(
      `select count(*)::int as rows from public.client_access
        where client_id = '${CLIENT_A}' and user_id = '${U.businessOwnerOne}'`,
    );
    await db.exec(
      `update public.client_access set inviter_label = 'A completely different display label'
        where client_id = '${CLIENT_A}' and user_id = '${U.businessOwnerOne}'`,
    );
    const after = await db.query<{ rows: number }>(
      `select count(*)::int as rows from public.client_access
        where client_id = '${CLIENT_A}' and user_id = '${U.businessOwnerOne}'`,
    );
    return before.rows[0]?.rows === 1 && after.rows[0]?.rows === 1 ? "allow" : "deny";
  }
  // ---- member removal -------------------------------------------------
  if (r === "remove a staff member of the caller's own organisation") {
    // A THIRD person, so this row never overlaps the self-leave row.
    await seedThenActAs(
      row.role,
      `insert into public.firm_members (id, firm_id, user_id, role, status)
       values ('99990099-1111-4111-8111-111111111111', '${ORG_A}', '${U.grantTarget}', 'staff', 'active')`,
    );
    const p = await probe(`select public.remove_firm_member('${ORG_A}', '${U.grantTarget}')`);
    if (!p.ok) return "deny";
    await db.exec("set local role postgres");
    const left = await db.query<{ n: number }>(
      `select (select count(*) from public.firm_members
                where firm_id = '${ORG_A}' and user_id = '${U.grantTarget}' and status = 'active')::int as n`,
    );
    return Number(left.rows[0]?.n) === 0 ? "allow" : "deny";
  }
  if (r === "remove a Traction Advisory (practice-team) staff member") {
    await seedThenActAs(
      row.role,
      `insert into public.practice_team (user_id) values ('${U.staffA}')`,
    );
    const p = await probe(`select public.remove_firm_member('${ORG_A}', '${U.staffA}')`);
    return p.ok ? "allow" : "deny";
  }
  if (r === "an owner removes themselves") {
    const p = await probe(`select public.remove_firm_member('${ORG_A}', '${U.ownerA}')`);
    return p.ok ? "allow" : "deny";
  }
  if (r === "removing the organisation's last remaining member") {
    // Leave staffA as the only active member, then have them try to leave.
    await seedThenActAs(
      row.role,
      `update public.firm_members set status = 'removed'
         where firm_id = '${ORG_A}' and user_id <> '${U.staffA}'`,
    );
    const p = await probe(`select public.remove_firm_member('${ORG_A}', '${U.staffA}')`);
    return p.ok ? "allow" : "deny";
  }
  if (r === "leave the organisation (remove yourself)") {
    const p = await probe(`select public.remove_firm_member('${ORG_A}', auth.uid())`);
    return p.ok ? "allow" : "deny";
  }
  if (r === "removal leaves client viewer and standing grants untouched") {
    await db.exec("set local role postgres");
    const before = await db.query<{ ca: number; fva: number; conns: number }>(
      `select (select count(*) from public.client_access)::int as ca,
              (select count(*) from public.firm_viewer_access)::int as fva,
              (select count(*) from public.xero_connections)::int as conns`,
    );
    await seedThenActAs(row.role, "select 1");
    const p = await probe(`select public.remove_firm_member('${ORG_A}', '${U.staffA}')`);
    if (!p.ok) return "deny";
    await db.exec("set local role postgres");
    const after = await db.query<{ ca: number; fva: number; conns: number }>(
      `select (select count(*) from public.client_access)::int as ca,
              (select count(*) from public.firm_viewer_access)::int as fva,
              (select count(*) from public.xero_connections)::int as conns`,
    );
    const b = before.rows[0]!;
    const a = after.rows[0]!;
    return a.ca === b.ca && a.fva === b.fva && a.conns === b.conns ? "allow" : "deny";
  }
  if (r === "the organisation's clients after removal") {
    const p = await probe(`select 1 from public.clients where id = '${CLIENT_A}'`);
    return p.ok && p.rows > 0 ? "allow" : "deny";
  }
  if (r === "practice_team") {
    if (row.operation === "read") {
      const p = await probe(`select 1 from public.practice_team where user_id = '${U.ownerA}'`);
      return p.ok && p.rows > 0 ? "allow" : "deny";
    }
    if (row.operation === "insert") {
      const p = await probe(
        `insert into public.practice_team (user_id) values ('${U.grantTarget}')`,
      );
      return p.ok && p.rows > 0 ? "allow" : "deny";
    }
    if (row.operation === "update") {
      const p = await probe(
        `update public.practice_team set added_by = auth.uid() where user_id = '${U.ownerA}'`,
      );
      return p.ok && p.rows > 0 ? "allow" : "deny";
    }
    const p = await probe(`delete from public.practice_team where user_id = '${U.ownerA}'`);
    return p.ok && p.rows > 0 ? "allow" : "deny";
  }
  if (r === "manage the practice team (admin_add/remove_practice_member)") {
    // The advisors-page control calls exactly these two functions, nothing else.
    const add = await probe(`select public.admin_add_practice_member('${U.grantTarget}')`);
    if (!add.ok) return "deny";
    const rm = await probe(`select public.admin_remove_practice_member('${U.grantTarget}')`);
    return rm.ok ? "allow" : "deny";
  }
  // ---- attestations (Spec §17) ----------------------------------------
  if (r === "record a security attestation") {
    const p = await probe(`select public.record_security_attestation('leaked_password', 'probe')`);
    return p.ok ? "allow" : "deny";
  }
  if (r === "a security attestation's confirmed_by and confirmed_at are set by the server") {
    // The function takes no identity or timestamp. Proved by asserting the row
    // it writes carries the CALLER's id and a fresh timestamp, whatever was
    // there before (the fixture row names the same super admin, so it is first
    // re-pointed at a different person by a privileged write).
    await seedThenActAs(
      row.role,
      `update public.security_attestations
          set confirmed_by = '${U.ownerA}', confirmed_at = now() - interval '400 days'
        where check_key = 'leaked_password'`,
    );
    const p = await probe(`select public.record_security_attestation('leaked_password', null)`);
    if (!p.ok) return "deny";
    await db.exec("set local role postgres");
    const after = await db.query<{ n: number }>(
      `select (select count(*) from public.security_attestations
                where check_key = 'leaked_password'
                  and confirmed_by = '${CONTEXT[row.role].uid}'
                  and confirmed_at > now() - interval '1 minute')::int as n`,
    );
    return Number(after.rows[0]?.n) === 1 ? "allow" : "deny";
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
    const p = await probe(
      `update public.user_presence set last_seen_at = now() where user_id = '${U.ownerA}'`,
    );
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
  const fixture = fs.readFileSync(
    path.join(process.cwd(), "tests/fixtures/rls-schema.sql"),
    "utf8",
  );
  await db.exec(fixture);

  // The fixture dump carries columns and policies, not constraints. Live
  // `practice_team` has a primary key on user_id (verified 12 Sep 2026) and
  // `admin_add_practice_member` relies on it via `on conflict (user_id)`, so the
  // copy needs it to be faithful for that path. Test-copy fidelity only — no
  // application object changes.
  await db.exec(`alter table public.practice_team add primary key (user_id);`);

  // Same fidelity fix: live `session_activity` has a primary key on session_id
  // (verified 15 Sep 2026) and `touch_session_activity` upserts on it.
  await db.exec(`alter table public.session_activity add primary key (session_id);`);

  const users = Object.values(U);
  await db.exec(`
    insert into auth.users(id, email) values
      ${users.map((u, i) => `('${u}', 'u${i}@example.invalid')`).join(", ")};
    insert into auth.sessions(id, user_id, created_at) values
      ${users.map((u) => `('${u}', '${u}', now())`).join(", ")},
      
      ('${IDLE_SESSION}', '${U.staffA}', now()),
      -- Just completed MFA: seconds old, and deliberately NO activity row.
      ('${FRESH_SESSION}', '${U.staffA}', now() - interval '5 seconds'),
      -- Signed in 90 minutes ago and still in use: well past the window on age
      -- alone, so only the recorded activity below can keep it active.
      ('${ACTIVE_SESSION}', '${U.staffA}', now() - interval '90 minutes');
    -- Signed in today, but the SERVER-held activity timestamp is 40 minutes old.
    insert into public.session_activity(session_id, user_id, last_activity_at, created_at) values
      ('${IDLE_SESSION}', '${U.staffA}', now() - interval '40 minutes', now() - interval '40 minutes'),
      -- Actively used: last interaction 2 minutes ago on a 90 minute old session.
      ('${ACTIVE_SESSION}', '${U.staffA}', now() - interval '2 minutes', now() - interval '90 minutes');
    insert into auth.mfa_factors(user_id, status) values
      ${users.map((u) => `('${u}', 'verified')`).join(", ")};
    insert into public.profiles(id, email, display_name) values
      ${users.map((u, i) => `('${u}', 'u${i}@example.invalid', 'User ${i}')`).join(", ")};
    -- staffA deliberately has NO presence row, so the own-row insert probe is real.
    insert into public.user_presence(user_id, last_seen_at) values
      ${users
        .filter((u) => u !== U.staffA)
        .map((u) => `('${u}', now())`)
        .join(", ")};

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
      ('e0000002-1111-4111-8111-111111111111', '${ORG_A}', '${U.standingViewer}', 'multi_company', '${U.ownerA}'),
      ('e0000003-1111-4111-8111-111111111111', '${ORG_A}', '${U.mixedViewer}', 'multi_company', '${U.ownerA}');
    -- Batch 5: ownerA is on the practice team. It confers nothing by itself —
    -- Path D management still needs an ACTIVE membership of the organisation in
    -- question, which ownerA has for A and not for B.
    insert into public.practice_team(user_id, added_by) values ('${U.ownerA}', '${U.superAdmin}');
    insert into public.clients(id, name, owner_user_id, firm_id, notes, report_basis,
                               cost_classification_enabled, basis_overrides, max_xero_orgs,
                               consolidation_mode, consolidation_org_ids) values
      ('${CLIENT_NEW}', 'Client added later', '${U.ownerA}', '${ORG_A}', '', 'accrual', false, '{}', 1, 'none', '{}');
    -- The later client is entitled to the top level, so a capped result cannot be
    -- mistaken for precedence working.
    insert into public.client_subscriptions(id, client_id, subscription_type, status, dashboard_tier) values
      ('e0000004-1111-4111-8111-111111111111', '${CLIENT_NEW}', 'free_forever', 'free_forever', 'multi_company');
    -- ... and the mixed holder also has a SPECIFIC grant on it, at a lower level.
    -- Multiple Business owners on one client are intentional. The handover
    -- subject holds both active membership and a specific relationship row.
    insert into public.client_access(id, client_id, user_id, tier, relationship, inviter_label) values
      ('e0000005-1111-4111-8111-111111111111', '${CLIENT_NEW}', '${U.mixedViewer}', 'advisory', 'external_adviser', null),
      ('e0000006-1111-4111-8111-111111111111', '${CLIENT_A}', '${U.businessOwnerOne}', 'multi_company', 'business_owner', 'Partner one'),
      ('e0000007-1111-4111-8111-111111111111', '${CLIENT_A}', '${U.businessOwnerTwo}', 'multi_company', 'business_owner', 'Partner two'),
      ('e0000008-1111-4111-8111-111111111111', '${CLIENT_A}', '${U.handoverOwner}', 'multi_company', 'business_owner', 'Handed-over owner');
    insert into public.firm_members(id, firm_id, user_id, role, status) values
      ('e0000009-1111-4111-8111-111111111111', '${ORG_A}', '${U.handoverOwner}', 'staff', 'active');
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
  for (const r of liveOnly)
    byResource.set(r.row.resource, (byResource.get(r.row.resource) ?? 0) + 1);

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
        ? [
            ...new Set(
              known.map(
                (r) => `  backlog ${r.row.knownFailure!.backlog}: ${r.row.knownFailure!.note}`,
              ),
            ),
          ]
        : ["  none"]),
      `  affected rows proved here: ${known.length}`,
      ...(knownPending.length
        ? [
            "  known failures that only the live suite can prove (part 3):",
            ...[
              ...new Set(
                knownPending.map(
                  (r) => `    backlog ${r.row.knownFailure!.backlog}: ${r.row.resource}`,
                ),
              ),
            ],
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
      .filter(
        (r) => r.outcome !== "unsupported" && !r.row.knownFailure && r.outcome !== r.row.expect,
      )
      .map((r) => `${label(r.row)} — expected ${r.row.expect}, got ${r.outcome}  [${r.row.rule}]`);
    expect(
      failures,
      `Access matrix violations:\n${failures.map((f) => `  - ${f}`).join("\n")}`,
    ).toEqual([]);
  });

  it("still shows every known failure, and no more", () => {
    const healed = results
      .filter(
        (r) => r.row.knownFailure && r.outcome !== "unsupported" && r.outcome === r.row.expect,
      )
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
  it("sources organisation limits from org_subscription_options, not legacy plans", async () => {
    const migration = fs.readFileSync(
      path.join(
        process.cwd(),
        "supabase/migrations/20260916021651_2ff5c91e-569e-4c6e-b683-f68b40f87c09.sql",
      ),
      "utf8",
    );
    expect(migration).toContain("from public.org_subscription_options");
    expect(migration).not.toContain("public.plan_levels");
    expect(migration).not.toContain("public.subscriptions");
  });

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
      await db.exec(
        `create policy tmp_leak on public.clients as permissive for select to authenticated using (true)`,
      );
      await db.query(`select set_config('request.jwt.claims', $1, true)`, [
        claims(CONTEXT.other_org_member),
      ]);
      await db.exec("set local role authenticated");
      const p = await probe(`select 1 from public.clients where id = '${CLIENT_A}'`);
      leaked = p.rows;
    } finally {
      await db.exec("rollback");
    }
    expect(
      leaked,
      "with the scoping policy removed the suite must observe the leak",
    ).toBeGreaterThan(0);

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
