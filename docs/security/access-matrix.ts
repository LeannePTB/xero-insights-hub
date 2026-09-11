/**
 * THE ACCESS MATRIX — single source of truth for who may do what.
 *
 * Readable copy: docs/security/access-matrix.md (GENERATED from this file by
 * `bun run scripts/render-access-matrix.ts`; a test fails if it is stale, so the
 * document and the tests can never disagree).
 *
 * Every row cites the rule it comes from: `PK n` = Project Knowledge rule n,
 * `Spec §n` = docs/security/access-control-spec.md section n.
 *
 * A row carrying `knownFailure` describes behaviour that is WRONG today. The
 * suites assert the current wrong behaviour, report it as a KNOWN FAILURE with
 * its backlog number, and never count it as a pass. When the fixing phase lands,
 * the marker is removed and the row must pass as written.
 */

export type Role =
  | "anonymous"
  | "aal1_member"
  | "org_owner"
  | "org_staff"
  | "other_org_member"
  | "org_a_owner_reading_org_b"
  | "client_viewer"
  | "support_grant_active"
  | "support_grant_expired"
  | "support_grant_revoked"
  | "super_admin_no_membership"
  | "super_admin_self_approving_support"
  | "suspended_member"
  | "removed_member";

export type Operation = "read" | "insert" | "update" | "delete" | "execute";
export type Expect = "allow" | "deny";
/** Which suite can prove this row. */
export type Layer = "pglite" | "live";

export type KnownFailure = {
  /** docs/security-backlog.md item number. */
  backlog: number;
  note: string;
};

export type MatrixRow = {
  role: Role;
  /** Table, view, database function, or server function. */
  resource: string;
  operation: Operation;
  expect: Expect;
  rule: string;
  layers: Layer[];
  knownFailure?: KnownFailure;
  note?: string;
};

export const ROLE_LABELS: Record<Role, string> = {
  anonymous: "Anonymous (no session)",
  aal1_member: "Active member, aal1 session only",
  org_owner: "Organisation owner (own organisation)",
  org_staff: "Organisation staff (own organisation)",
  other_org_member: "Active member of a DIFFERENT organisation",
  org_a_owner_reading_org_b: "Organisation A's owner, reading organisation B",
  client_viewer: "Client viewer (client_access on one client)",
  support_grant_active: "Support-grant holder, active, non-member organisation",
  support_grant_expired: "Support-grant holder, grant expired",
  support_grant_revoked: "Support-grant holder, grant revoked",
  super_admin_no_membership: "Super admin with NO membership",
  super_admin_self_approving_support: "Super admin approving their own support grant",
  suspended_member: "Member with status = suspended",
  removed_member: "Member with status = removed",
};

/** Client-scoped data tables: same expectation set applies to each. */
export const CLIENT_DATA_TABLES = [
  "clients",
  "client_xero_orgs",
  "client_notes",
  "client_access",
  "client_cost_classifications",
  "client_true_breakeven_inputs",
  "client_statutory_accounts",
  "client_subscriptions",
  "client_reports",
  "reconciliation_snapshots",
  "unreconciled_uploads",
  "unreconciled_lines",
  "loan_consolidation_accounts",
  "loan_consolidation_snapshots",
  "consolidation_groups",
  "consolidation_group_members",
  "tier_widget_config",
  "xero_snapshots",
  "xero_snapshot_runs",
  "report_cache",
  "scenario_exclusions",
] as const;

/** Path C platform metadata: super admin may read, never client financial data. */
export const PATH_C_METADATA = [
  "admin_firm_overview",
  "plan_levels",
  "tier_settings",
  "signup_requests",
  "access_invites",
  "user_roles",
  "audit_log",
  "xero_api_errors",
  "billing_events",
] as const;

/** Tables that must never be written from a browser session at all. */
export const APPEND_ONLY_TABLES = ["audit_log", "login_events", "xero_api_errors"] as const;

const WRITES: Operation[] = ["insert", "update", "delete"];

function rows(
  roles: Role[],
  resources: readonly string[],
  operations: Operation[],
  expect: Expect,
  rule: string,
  layers: Layer[] = ["pglite"],
  extra: Partial<MatrixRow> = {},
): MatrixRow[] {
  const out: MatrixRow[] = [];
  for (const role of roles)
    for (const resource of resources)
      for (const operation of operations)
        out.push({ role, resource, operation, expect, rule, layers, ...extra });
  return out;
}

/**
 * Roles that must reach NOTHING with organisation, client, Xero or personal
 * data, and that hold no platform role either.
 */
const NO_DATA_ROLES: Role[] = [
  "anonymous",
  "aal1_member",
  "other_org_member",
  "org_a_owner_reading_org_b",
  "suspended_member",
  "removed_member",
];

/**
 * Roles that hold `super_admin` but no membership of the organisation under
 * test — including a support grantee whose grant has expired or been revoked,
 * because every support grantee is a super admin (platform_staff_can_access_firm
 * requires it). They reach Path C platform metadata and NOTHING else.
 */
const PLATFORM_ONLY_ROLES: Role[] = [
  "super_admin_no_membership",
  "support_grant_expired",
  "support_grant_revoked",
];

/**
 * Client-scoped tables that no browser session writes, whatever its membership:
 * the rows are produced by SECURITY DEFINER functions or by service_role
 * (snapshot refresh, report generation, reconciliation). Verified: the tables
 * carry SELECT policies only.
 */
const SERVER_WRITTEN_TABLES = [
  "client_reports",
  "reconciliation_snapshots",
  "xero_snapshots",
  "xero_snapshot_runs",
] as const;

/** Client-scoped tables written only by the client viewer who owns the row. */
const VIEWER_SCOPED_TABLES = ["scenario_exclusions"] as const;

/** Tables a member manages directly through RLS (per-command firm policies). */
const MEMBER_MANAGED_TABLES = CLIENT_DATA_TABLES.filter(
  (t) =>
    !(SERVER_WRITTEN_TABLES as readonly string[]).includes(t) &&
    !(VIEWER_SCOPED_TABLES as readonly string[]).includes(t) &&
    !["clients", "client_subscriptions", "report_cache"].includes(t),
);

export const MATRIX: MatrixRow[] = [
  // ---------------------------------------------------------------- deny-all
  ...rows(
    NO_DATA_ROLES,
    ["firms", "firm_members", ...CLIENT_DATA_TABLES],
    ["read", ...WRITES],
    "deny",
    "PK 1, PK 2, PK 3, PK 4; Spec §0.3",
    ["pglite", "live"],
  ),

  // ------------------------------------------- platform role, no membership (C)
  // Path C is metadata only. The organisation list and the membership list are
  // named in Spec §3; client billing is named in Spec §8 (comps are super-admin
  // only). Everything else with client or Xero data stays denied.
  ...rows(
    PLATFORM_ONLY_ROLES,
    CLIENT_DATA_TABLES.filter((t) => t !== "client_subscriptions"),
    ["read", ...WRITES],
    "deny",
    "PK 3 (super_admin alone is not access to client data)",
    ["pglite", "live"],
  ),
  ...rows(PLATFORM_ONLY_ROLES, ["firms"], ["read"], "allow", "PK 2 path C; Spec §3 (organisation list)", [
    "pglite",
    "live",
  ]),
  ...rows(PLATFORM_ONLY_ROLES, ["firm_members"], ["read"], "allow", "PK 2 path C; Spec §3", ["pglite", "live"], {
    note:
      "Owner-approved Path C item (11 Sep 2026): the membership list is platform metadata, no financial data.",
  }),
  // Backlog 27 closed 11 Sep 2026 (Phase 2 part B): 'super_admin updates firms'
  // dropped, and INSERT/UPDATE/DELETE/TRUNCATE revoked from authenticated on
  // public.firms. The flag now moves only through public.set_firm_always_free
  // (aal2 + super admin + reason + audit row, TRUE only on the practice
  // organisation) and ownership only through transfer_organisation_ownership.
  ...rows(
    PLATFORM_ONLY_ROLES,
    ["firms"],
    ["update"],
    "deny",
    "PK 3; Spec §4 (ownership only via transfer_organisation_ownership; is_always_free only on the practice organisation, with a reason and an audit row)",
    ["pglite", "live"],
  ),
  ...rows(
    ["org_owner", "org_staff", "client_viewer"],
    ["firms"],
    ["update"],
    "deny",
    "Spec §4; no UPDATE grant for authenticated — organisation name, logo and default cards are changed by server code, never by a direct REST write",
    ["pglite", "live"],
  ),


  ...rows(
    PLATFORM_ONLY_ROLES,
    ["firms", "firm_members"],
    ["insert", "delete"],
    "deny",
    "Spec §4 (creation and membership go through their own functions)",
    ["pglite", "live"],
  ),
  ...rows(
    PLATFORM_ONLY_ROLES,
    ["client_subscriptions"],
    ["read"],
    "allow",
    "PK 2 path C; Spec §8 (billing metadata, not Xero financial data)",
    ["pglite", "live"],
  ),
  ...rows(
    PLATFORM_ONLY_ROLES,
    ["client_subscriptions"],
    WRITES,
    "deny",
    "Spec §8 (a comp needs a reason and an audit row; a direct REST write carries neither)",
    ["pglite", "live"],
    {
      knownFailure: {
        backlog: 28,
        note:
          "Policy 'super admins manage client subscriptions' is FOR ALL on is_super_admin alone; the only trigger is client_subscriptions_set_updated_at. Fixed in Phase 3.",
      },
    },
  ),


  // ------------------------------------------------------------ membership (A)
  ...rows(
    ["org_owner", "org_staff"],
    ["firms", "firm_members", ...CLIENT_DATA_TABLES.filter((t) => !["report_cache", "scenario_exclusions"].includes(t))],
    ["read"],
    "allow",
    "PK 2 path A; Spec §3",
    ["pglite", "live"],
  ),
  // report_cache is per-user, not per-organisation: a member sees only their own rows.
  { role: "org_owner", resource: "report_cache", operation: "read", expect: "allow", rule: "own cache rows", layers: ["pglite", "live"] },
  { role: "org_staff", resource: "report_cache", operation: "read", expect: "deny", rule: "another member's cache rows", layers: ["pglite", "live"] },
  ...rows(["org_owner"], ["report_cache"], WRITES, "allow", "own cache rows", ["pglite", "live"]),
  ...rows(["org_staff"], ["report_cache"], WRITES, "deny", "another member's cache rows", ["pglite", "live"]),

  // scenario_exclusions is written by the client viewer who owns the client.
  ...rows(
    ["org_owner", "org_staff"],
    VIEWER_SCOPED_TABLES,
    ["read", ...WRITES],
    "deny",
    "Spec §6 (client_access-scoped table)",
    ["pglite", "live"],
  ),

  ...rows(["org_owner", "org_staff"], MEMBER_MANAGED_TABLES, WRITES, "allow", "PK 2 path A; Spec §6", [
    "pglite",
    "live",
  ]),
  // Only an organisation OWNER manages the client list itself.
  ...rows(["org_owner"], ["clients"], WRITES, "allow", "Spec §6 (is_firm_owner)", ["pglite", "live"]),
  ...rows(["org_staff"], ["clients"], WRITES, "deny", "Spec §6 (is_firm_owner only)", ["pglite", "live"]),
  // Snapshots, reports and reconciliations are written by the server, never by a session.
  ...rows(
    ["org_owner", "org_staff"],
    SERVER_WRITTEN_TABLES,
    WRITES,
    "deny",
    "Spec §6 (written by definer functions / service_role only)",
    ["pglite", "live"],
  ),
  ...rows(
    ["org_owner", "org_staff"],
    ["client_subscriptions"],
    WRITES,
    "deny",
    "Spec §8 (billing is platform-owned)",
    ["pglite", "live"],
  ),

  // ------------------------------------------------------- support grant (B)
  // Read-only, and only where the read policy names the support path. Verified:
  // `clients`, `client_statutory_accounts`, `report_cache` and
  // `scenario_exclusions` do not, so a grant holder cannot read them. That
  // fails closed (Spec §0.8) and is recorded as backlog 25, not fixed here.
  ...rows(
    ["support_grant_active"],
    [
      "firms",
      "firm_members",
      ...CLIENT_DATA_TABLES.filter(
        (t) => !["clients", "client_statutory_accounts", "report_cache", "scenario_exclusions"].includes(t),
      ),
    ],
    ["read"],
    "allow",
    "PK 2 path B; Spec §3, §7",
    ["pglite", "live"],
  ),
  ...rows(
    ["support_grant_active"],
    ["clients", "client_statutory_accounts", "report_cache", "scenario_exclusions"],
    ["read"],
    "deny",
    "Backlog 25 — the read policy does not name the support path; fails closed",
    ["pglite", "live"],
  ),
  ...rows(
    ["support_grant_active"],
    CLIENT_DATA_TABLES.filter((t) => t !== "client_subscriptions"),
    WRITES,
    "deny",
    "PK 5 (support grants are READ-ONLY)",
    ["pglite", "live"],
    {
      note:
        "Proved at the RLS layer: the nine former FOR ALL policies are now per-command with membership-only EXISTS checks. The remaining half of backlog 18 is app_private.user_can_manage_client itself, still reachable through app_private.move_xero_file_to_client and the server-function path below.",
    },
  ),
  ...rows(
    ["support_grant_active"],
    ["client_subscriptions"],
    WRITES,
    "deny",
    "PK 5 (support grants are READ-ONLY); Spec §8 (a comp needs a reason and an audit row)",
    ["pglite", "live"],
    {
      knownFailure: {
        backlog: 28,
        note:
          "Admitted by 'super admins manage client subscriptions' (every grantee is a super admin) and by 'staff manage client subscriptions' (platform_staff_can_access_firm). No audit row is written. Fixed in Phase 3.",
      },
    },
  ),


  // --------------------------------------------------------- client viewer
  ...rows(["client_viewer"], ["clients", "client_notes"], ["read"], "allow", "Spec §3 client viewer", [
    "pglite",
    "live",
  ]),
  ...rows(
    ["client_viewer"],
    ["firms", "firm_members", "audit_log", "subscriptions"],
    ["read"],
    "deny",
    "Spec §3 client viewer sees only that client",
    ["pglite", "live"],
  ),
  ...rows(["client_viewer"], ["clients", "client_access"], WRITES, "deny", "Spec §3", ["pglite", "live"]),

  // ------------------------------------------------------------ Xero tokens
  ...rows(
    [
      "org_owner",
      "org_staff",
      "support_grant_active",
      "super_admin_no_membership",
      "client_viewer",
      "anonymous",
    ],
    ["xero_connections.access_token_enc", "xero_connections.refresh_token_enc"],
    ["read"],
    "deny",
    "PK 8; Spec §10 (no column grant; privilege check precedes RLS)",
    ["pglite", "live"],
  ),
  ...rows(
    ["org_owner", "org_staff"],
    ["xero_connections (non-token columns)"],
    ["read"],
    "allow",
    "Spec §10",
    ["pglite", "live"],
  ),
  ...rows(
    ["other_org_member", "anonymous", "aal1_member"],
    ["xero_connections (non-token columns)"],
    ["read"],
    "deny",
    "PK 3, PK 4",
    ["pglite", "live"],
  ),

  // ---------------------------------------------------------- append-only
  ...rows(
    ["org_owner", "org_staff", "client_viewer", "support_grant_active", "super_admin_no_membership"],
    APPEND_ONLY_TABLES,
    WRITES,
    "deny",
    "PK 10; Spec §9 (append-only)",
    ["pglite", "live"],
  ),
  {
    role: "org_owner",
    resource: "audit_log",
    operation: "read",
    expect: "deny",
    rule: "Backlog 26 — Spec §3 promises the organisation its own audit rows; only super_admin can read today",
    layers: ["pglite", "live"],
    note: "Fails closed, so it is a gap rather than an incident. Recorded, not fixed in Phase 2.",
  },

  // -------------------------------------------------- Path C platform metadata
  ...rows(
    ["super_admin_no_membership"],
    PATH_C_METADATA,
    ["read"],
    "allow",
    "PK 2 path C (metadata only, never Xero financial data)",
    ["pglite", "live"],
  ),
  ...rows(
    ["super_admin_no_membership"],
    ["xero_snapshots", "client_reports", "report_cache", "reconciliation_snapshots"],
    ["read"],
    "deny",
    "PK 3 (super_admin grants ZERO client data on its own)",
    ["pglite", "live"],
  ),
  ...rows(
    ["org_staff", "client_viewer", "other_org_member"],
    ["plan_levels", "tier_settings"],
    WRITES,
    "deny",
    "Spec §5 (plan catalogue is platform-owned)",
    ["pglite"],
  ),

  // Path C writes: legitimate super-admin powers, but Spec §8 and §9 require a
  // reason and an audit row, and a direct REST write leaves neither. Verified
  // live 11 Sep 2026: the only trigger on plan_levels, signup_requests and
  // xero_assessment_contact is tg_set_updated_at; user_roles has
  // audit_user_roles_change, but only AFTER INSERT OR DELETE — not UPDATE.
  // Phase 3 fixes the whole class in one change (audit triggers or audited
  // definer functions), not table by table.
  ...rows(
    ["super_admin_no_membership"],
    ["user_roles"],
    ["insert", "delete"],
    "allow",
    "PK 2 path C; Spec §9 (audited by audit_user_roles_change)",
    ["pglite", "live"],
  ),
  ...rows(
    ["super_admin_no_membership"],
    ["user_roles"],
    ["update"],
    "deny",
    "Spec §9 (role changes must be audited; the trigger covers insert and delete only)",
    ["pglite", "live"],
    {
      knownFailure: {
        backlog: 29,
        note: "'super admins manage roles' is FOR ALL on me_is_super_admin(); an UPDATE leaves no audit row.",
      },
    },
  ),
  ...rows(
    ["super_admin_no_membership"],
    ["plan_levels", "xero_assessment_contact"],
    WRITES,
    "deny",
    "Spec §9 (platform configuration changes must leave an audit row)",
    ["pglite", "live"],
    {
      knownFailure: {
        backlog: 29,
        note: "FOR ALL policy on me_is_super_admin() with no audit trigger; direct REST writes are unrecorded.",
      },
    },
  ),
  ...rows(
    ["super_admin_no_membership"],
    ["signup_requests"],
    ["update"],
    "deny",
    "Spec §9 (platform metadata changes must leave an audit row)",
    ["pglite", "live"],
    {
      knownFailure: {
        backlog: 29,
        note:
          "'super_admin updates signup_requests' is on is_super_admin alone, targets role public rather than authenticated, and writes no audit row.",
      },
    },
  ),



  // ---------------------------------------------------------------- profiles
  {
    role: "org_staff",
    resource: "profiles (own row, display_name)",
    operation: "update",
    expect: "allow",
    rule: "Phase 1b follow-up; column grant UPDATE(display_name) only",
    layers: ["pglite", "live"],
  },
  {
    role: "org_staff",
    resource: "profiles (own row, email)",
    operation: "update",
    expect: "deny",
    rule: "Phase 1b follow-up; verified email comes from auth.users",
    layers: ["pglite", "live"],
  },
  {
    role: "org_staff",
    resource: "profiles (another user's row)",
    operation: "update",
    expect: "deny",
    rule: "PK 1 deny by default",
    layers: ["pglite", "live"],
  },
  {
    role: "org_staff",
    resource: "profiles (any row)",
    operation: "insert",
    expect: "deny",
    rule: "handle_new_user() is the only writer",
    layers: ["pglite", "live"],
  },
  {
    role: "anonymous",
    resource: "profiles",
    operation: "read",
    expect: "deny",
    rule: "PK 1",
    layers: ["pglite", "live"],
  },

  // ------------------------------------------------------------ user_presence
  {
    role: "anonymous",
    resource: "user_presence",
    operation: "read",
    expect: "deny",
    rule: "Phase 1b follow-up (anon holds no privilege)",
    layers: ["pglite", "live"],
  },
  {
    role: "org_staff",
    resource: "user_presence (own row)",
    operation: "insert",
    expect: "allow",
    rule: "Phase 1b (heartbeat); server sets last_seen_at",
    layers: ["pglite", "live"],
  },
  {
    role: "org_staff",
    resource: "user_presence (another user's row)",
    operation: "update",
    expect: "deny",
    rule: "PK 1",
    layers: ["pglite", "live"],
  },
  {
    role: "org_staff",
    resource: "user_presence (own row, forged last_seen_at)",
    operation: "update",
    expect: "deny",
    rule: "Phase 1b correction: set_presence_seen_at() trigger overwrites",
    layers: ["live"],
    note:
      "Denied in effect: the write succeeds but the forged value never persists. Live-only — the PGlite fixture mirrors policies and grants, not triggers.",
  },
  {
    role: "org_staff",
    resource: "public.online_users()",
    operation: "execute",
    expect: "deny",
    rule: "PK 2 path C; super admin + aal2 only",
    layers: ["pglite", "live"],
  },
  {
    role: "super_admin_no_membership",
    resource: "public.online_users()",
    operation: "execute",
    expect: "allow",
    rule: "PK 2 path C metadata",
    layers: ["pglite", "live"],
  },

  // ----------------------------------------------------- support grant lifecycle
  {
    role: "org_staff",
    resource: "server fn: requestSupportAccess (own pending request)",
    operation: "insert",
    expect: "allow",
    rule: "Spec §7",
    layers: ["live"],
  },
  {
    role: "org_staff",
    resource: "server fn: approveSupportAccess",
    operation: "update",
    expect: "deny",
    rule: "Spec §7 (only is_org_owner may approve)",
    layers: ["live"],
  },
  {
    role: "super_admin_self_approving_support",
    resource: "server fn: approveSupportAccess (own request)",
    operation: "update",
    expect: "deny",
    rule: "PK 2 path B; Spec §7 (a super admin never approves their own access)",
    layers: ["pglite", "live"],
  },
  {
    role: "support_grant_expired",
    resource: "firm_support_access (expired grant used for a read)",
    operation: "read",
    expect: "deny",
    rule: "Spec §7 (max 72h, expires_at enforced)",
    layers: ["pglite", "live"],
  },
  {
    role: "support_grant_revoked",
    resource: "firm_support_access (revoked grant used for a read)",
    operation: "read",
    expect: "deny",
    rule: "Spec §7 (revoked_at)",
    layers: ["pglite", "live"],
  },

  // ------------------------------------------------------ SECURITY DEFINER fns
  ...rows(
    ["aal1_member"],
    [
      "public.user_can_access_firm()",
      "public.user_can_access_client()",
      "public.client_entitlement()",
      "public.assert_client_write_access()",
      "public.set_client_widget_enabled()",
      "public.delete_client_report()",
      "public.transfer_organisation_ownership()",
      "public.set_all_client_tiers()",
      "public.security_posture()",
      "public.online_users()",
      "public.set_profile_display_name_admin()",
    ],
    ["execute"],
    "deny",
    "PK 2 (assert_aal2 guard is the first statement)",
    ["pglite", "live"],
  ),
  {
    role: "org_staff",
    resource: "public.transfer_organisation_ownership()",
    operation: "execute",
    expect: "deny",
    rule: "Spec §4 (current owner only)",
    layers: ["pglite", "live"],
  },
  {
    role: "org_staff",
    resource: "public.set_profile_display_name_admin()",
    operation: "execute",
    expect: "deny",
    rule: "PK 2 path C; super admin only",
    layers: ["pglite", "live"],
  },
  {
    role: "org_staff",
    resource: "public.security_posture()",
    operation: "execute",
    expect: "deny",
    rule: "PK 2 path C; super admin only",
    layers: ["pglite", "live"],
  },
  {
    role: "super_admin_no_membership",
    resource: "public.set_all_client_tiers()",
    operation: "execute",
    expect: "deny",
    rule: "PK 3 — needs the organisation's data, super admin alone is not access",
    layers: ["live"],
    note: "Backlog 19 records that this now gates on is_super_admin; revisit when the shared gate rule is decided.",
  },

  // --------------------------------------------------------- server functions
  ...rows(
    ["other_org_member", "super_admin_no_membership", "suspended_member", "removed_member"],
    [
      "server fn: list clients for an organisation",
      "server fn: read Xero data for a client",
      "server fn: write client data",
      "server fn: invite a member",
      "server fn: transfer ownership",
    ],
    ["execute"],
    "deny",
    "PK 4 (caller-supplied id is a filter, never a grant); PK 3",
    ["live"],
  ),
  ...rows(
    ["aal1_member"],
    [
      "server fn: list clients for an organisation",
      "server fn: read Xero data for a client",
      "server fn: write client data",
      "server fn: invite a member",
      "server fn: transfer ownership",
    ],
    ["execute"],
    "deny",
    "PK 2 (requireAal2)",
    ["live"],
  ),
  ...rows(
    ["org_owner"],
    [
      "server fn: list clients for an organisation",
      "server fn: write client data",
      "server fn: invite a member",
    ],
    ["execute"],
    "allow",
    "PK 2 path A",
    ["live"],
  ),
  {
    role: "support_grant_active",
    resource: "server fn: write client data",
    operation: "execute",
    expect: "deny",
    rule: "PK 5 (support grants are READ-ONLY)",
    layers: ["live"],
    knownFailure: {
      backlog: 18,
      note: "Shared gate app_private.user_can_manage_client still admits the support path.",
    },
  },
];

export const KNOWN_FAILURES = MATRIX.filter((r) => r.knownFailure);
