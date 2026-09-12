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
  | "standing_viewer"
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
  standing_viewer: "Standing viewer grant (every client in one organisation, read-only)",
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
    !["clients", "client_subscriptions", "report_cache", "client_access"].includes(t),
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
      note:
        "Phase 3b closed backlog 28: the FOR ALL super-admin policy is dropped, authenticated holds SELECT only, and comps/trials/tier changes go through the audited aal2 functions set_client_comp, set_client_trial and set_client_dashboard_tier. Trigger audit_change records every row change.",
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
  // Viewer access rows are managed by the organisation OWNER (or an active
  // practice-team member of that organisation) only: staff may read the viewer
  // list but never change it — app_private.can_manage_viewers_for_client.
  ...rows(["org_owner"], ["client_access"], WRITES, "allow", "PK 2 client viewer; owner manages viewers", ["pglite", "live"]),
  ...rows(["org_staff"], ["client_access"], WRITES, "deny", "PK 2 client viewer; staff may read the list only", ["pglite", "live"]),

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
  // Read-only, and only where the read policy names the support path. Phase 3a
  // added the support path to `clients` and `client_statutory_accounts` (owner
  // approved, backlog 25). `report_cache` and `scenario_exclusions` still do
  // not name it, which fails closed (Spec §0.8) and is left as it is.
  ...rows(
    ["support_grant_active"],
    [
      "firms",
      "firm_members",
      ...CLIENT_DATA_TABLES.filter(
        (t) => !["report_cache", "scenario_exclusions"].includes(t),
      ),
    ],
    ["read"],
    "allow",
    "PK 2 path B; Spec §3, §7",
    ["pglite", "live"],
  ),
  ...rows(
    ["support_grant_active"],
    ["report_cache", "scenario_exclusions"],
    ["read"],
    "deny",
    "Backlog 25 (remainder) — the read policy does not name the support path; fails closed",
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
        "Proved at the RLS layer: the nine former FOR ALL policies are per-command with membership-only EXISTS checks. Phase 3a closed the rest of backlog 18: app_private.user_can_write_client (membership or client ownership, never a support grant) is now the write helper, app_private.move_xero_file_to_client uses it, and every server-function write path calls public.user_can_write_firm / user_can_write_client.",
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
      note:
        "Phase 3b closed backlog 28: no write policy or write grant remains for authenticated on client_subscriptions, so a support grantee (super admin or not) cannot write.",
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
    "allow",
    "PK 2 path C; Spec §9 (role changes are audited)",
    ["pglite", "live"],
    {
      note:
        "Phase 3b closed backlog 29 for this table: the generic AFTER trigger audit_change on user_roles records insert, update and delete with the actor and the changed columns, replacing audit_user_roles_change.",
    },
  ),
  ...rows(
    ["super_admin_no_membership"],
    ["plan_levels", "xero_assessment_contact"],
    WRITES,
    "allow",
    "PK 2 path C; Spec §9 (platform configuration changes leave an audit row)",
    ["pglite", "live"],
    {
      note:
        "Phase 3b closed backlog 29: the generic AFTER trigger audit_change records every row change on these tables with the actor and the changed columns.",
    },
  ),
  ...rows(
    ["super_admin_no_membership"],
    ["signup_requests"],
    ["update"],
    "allow",
    "PK 2 path C; Spec §9 (platform metadata changes leave an audit row)",
    ["pglite", "live"],
    {
      note:
        "Phase 3b closed backlog 29: trigger audit_change on signup_requests records the actor and the changed columns.",
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

  // ------------------------------------------------- Xero disconnect (Phase 5)
  ...rows(
    [
      "aal1_member",
      "support_grant_active",
      "client_viewer",
      "other_org_member",
      "org_a_owner_reading_org_b",
      "super_admin_no_membership",
      "suspended_member",
      "removed_member",
    ],
    ["public.user_can_disconnect_xero_connection()"],
    ["execute"],
    "deny",
    "PK 2 (aal2), PK 5 (support grants are read-only), PK 3, PK 4",
    ["live"],
    {
      note: "Phase 5: disconnecting a Xero file is a write. Membership or client-write only; the connection's firm and client are resolved server-side from the connection id.",
    },
  ),
  {
    role: "org_owner",
    resource: "public.user_can_disconnect_xero_connection()",
    operation: "execute",
    expect: "allow",
    rule: "Path A — membership, own organisation",
    layers: ["live"],
  },
  {
    role: "org_owner",
    resource: "public.client_xero_files_used()",
    operation: "execute",
    expect: "allow",
    rule: "Path A — membership; disconnected files do not consume the allowance",
    layers: ["live"],
    note: "Phase 5: shared with the client allowance triggers, so a disconnected Xero file keeps its client link without counting toward the plan limit.",
  },
  {
    role: "org_owner",
    resource: "public.xero_connections (disconnecting leaves no token ciphertext)",
    operation: "update",
    expect: "allow",
    rule: "Backlog 38 — a revoked grant leaves no token at rest",
    layers: ["live"],
    note: "Phase 7: every path that marks a connection disconnected because the grant is dead (advisor disconnect, grant_revoked on refresh, unassigned cleanup) nulls access_token_enc and refresh_token_enc in the same update. The authorisation reconcile (not_authorised) deliberately keeps the ciphertext, because that token is still valid for the other tenants on the same consent and the row can be restored without re-authorising.",
  },
  ...rows(
    ["aal1_member", "other_org_member", "super_admin_no_membership"],
    ["public.client_xero_files_used()"],
    ["execute"],
    "deny",
    "PK 2 (aal2), PK 3, PK 4",
    ["live"],
  ),

  // Phase 5 step 5 — a Xero connection always belongs to an organisation.
  {
    role: "org_owner",
    resource: "public.xero_connections (firm_id null)",
    operation: "insert",
    expect: "deny",
    rule: "PK 4 — a Xero connection cannot exist without an organisation (firm_id NOT NULL)",
    layers: ["live"],
    note: "Phase 5 step 5: the connect callback refuses a tenant it cannot place instead of storing it unassigned; the database refuses it as well.",
  },
  {
    role: "org_owner",
    resource: "public.client_xero_orgs (client in another organisation)",
    operation: "insert",
    expect: "deny",
    rule: "PK 4 — a Xero file must belong to the same organisation as the client it is linked to",
    layers: ["live"],
    note: "Phase 5 step 5: deferred constraint triggers on client_xero_orgs and xero_connections.firm_id.",
  },
  {
    role: "org_owner",
    resource: "public.xero_connections (tenant over the plan's Xero file limit)",
    operation: "insert",
    expect: "deny",
    rule: "Plan limit trigger PLAN_LIMIT_XERO_ORGS — refused and reported, never stored unassigned",
    layers: ["live"],
    note: "Phase 5 step 5: the callback presents the database's own plan-limit wording and names the refused Xero file.",
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
    note:
      "Phase 3a: every server-function write path (branding, report finalise/send/revoke/delete, draft save, Xero audit runs and finding snoozes, organisation reconnect-all, loan-consolidation account setup, note report-flagging, Xero file link/unlink/move) authorises through public.user_can_write_firm / public.user_can_write_client, which never admit a support grant.",
  },
  {
    role: "support_grant_active",
    resource: "server fn: change organisation or client branding",
    operation: "execute",
    expect: "deny",
    rule: "PK 5 (support grants are READ-ONLY)",
    layers: ["live"],
    note: "branding.server.ts write gates call public.user_can_write_firm / user_can_write_client; reads still allow a grant.",
  },
  // ------------------------------------------- invitations and ownership (People)
  {
    role: "super_admin_no_membership",
    resource: "server fn: invite an owner to an existing organisation",
    operation: "execute",
    expect: "deny",
    rule: "Spec §4 — ownership only moves through transfer_organisation_ownership",
    layers: ["live"],
    note:
      "adminInviteFirmMember accepts role 'staff' only; an owner invitation to an existing organisation is refused with a pointer to ownership transfer.",
  },
  {
    role: "anonymous",
    resource: "server fn: accept an owner invite while the organisation already has an owner",
    operation: "execute",
    expect: "deny",
    rule: "Spec §4 — accepting an invite never replaces a sitting owner",
    layers: ["live"],
    note:
      "acceptInvite sets firms.owner_user_id only while it is null (the organisation-creation flow) and writes an audit row when it does; otherwise the person joins as a member and ownership is untouched.",
  },
  {
    role: "org_owner",
    resource: "server fn: list pending member invitations",
    operation: "execute",
    expect: "deny",
    rule: "PK section 2 path C — invitations stay platform metadata; inviting is super admin only",
    layers: ["live"],
    note: "public.firm_member_invites requires aal2 + super admin; the People section hides the forms for everyone else.",
  },
  // ---- Phase 6: reads of client financial data are recorded ----
  {
    role: "org_staff",
    resource: "audit trail row for reading a client's figures",
    operation: "insert",
    expect: "allow",
    rule: "PK 8 / Spec §1 — reading client financial data must be auditable",
    layers: ["live"],
    note:
      "Opening a client dashboard writes one xero_data_read row per actor + client + Xero file + read key + source per five minutes, recording no figures, account names or contact names.",
  },
  {
    role: "client_viewer",
    resource: "audit trail row for reading a client's figures",
    operation: "insert",
    expect: "allow",
    rule: "PK 8 / Spec §1 — every reader is recorded, not only staff",
    layers: ["live"],
    note: "A client viewer's dashboard read writes the same row with their own user id as the actor.",
  },
  {
    role: "support_grant_active",
    resource: "audit trail row for reading a client's figures",
    operation: "insert",
    expect: "allow",
    rule: "PK section 2 path B — support reads are read-only AND recorded",
    layers: ["live"],
    note: "meta.access_path comes from public.firm_access_path, so a support read is distinguishable from a member read.",
  },
  {
    role: "anonymous",
    resource: "audit trail row for a public report link view",
    operation: "insert",
    expect: "allow",
    rule: "PK 8 — a link view is a read and is recorded; PK 8 — never the token, IP or user agent",
    layers: ["live"],
    note: "client_report_read with anonymous = true, the report and client, and the period; the token itself is never stored, only its SHA-256 hash on the recipient row.",
  },
  {
    role: "other_org_member",
    resource: "audit trail row for reading another organisation's client figures",
    operation: "insert",
    expect: "deny",
    rule: "PK 1 / PK 4 — the read is impossible, so nothing is recorded",
    layers: ["live"],
    note: "Access is refused before any read path runs; no audit row is written because no read happened.",
  },

  // ---- Path D: standing viewer grant (people-and-access Batch 2) ----
  // Read-only, organisation-wide, never membership. PK section 2 path D.
  ...rows(
    ["standing_viewer"],
    [
      "clients",
      "client_notes",
      "client_cost_classifications",
      "client_statutory_accounts",
      "client_true_breakeven_inputs",
      "client_xero_orgs",
      "unreconciled_lines",
      "unreconciled_uploads",
    ],
    ["read"],
    "allow",
    "PK section 2 path D — read every client in the organisation",
    ["pglite", "live"],
  ),
  {
    role: "standing_viewer",
    resource: "clients (client added after the grant)",
    operation: "read",
    expect: "allow",
    rule: "PK section 2 path D — standing, not a snapshot",
    layers: ["pglite", "live"],
  },
  {
    role: "client_viewer",
    resource: "clients (client added after the grant)",
    operation: "read",
    expect: "deny",
    rule: "PK section 2 client viewer — a specific grant covers that client only",
    layers: ["pglite", "live"],
  },
  {
    role: "standing_viewer",
    resource: "clients (another organisation's client)",
    operation: "read",
    expect: "deny",
    rule: "PK section 2 path D — never crosses organisations",
    layers: ["pglite", "live"],
  },
  ...rows(
    ["standing_viewer"],
    [
      "clients",
      "client_access",
      "client_notes",
      "client_cost_classifications",
      "client_statutory_accounts",
      "client_true_breakeven_inputs",
      "client_xero_orgs",
      "unreconciled_lines",
      "unreconciled_uploads",
      "scenario_exclusions",
      "firm_viewer_access",
    ],
    WRITES,
    "deny",
    "PK section 2 path D — a standing grant confers no write, anywhere; the standing predicate appears only in read paths",
    ["pglite", "live"],
  ),
  // Not membership: no organisation-level or platform data.
  ...rows(
    ["standing_viewer"],
    ["firms", "firm_members", "audit_log", "subscriptions", "billing_events", "client_subscriptions", "access_invites"],
    ["read", ...WRITES],
    "deny",
    "PK section 2 path D — a viewer grant is not membership and carries no platform or organisation data",
    ["pglite", "live"],
  ),
  {
    role: "standing_viewer",
    resource: "member list (standing grant holder is not a member)",
    operation: "read",
    expect: "deny",
    rule: "PK section 2 path D — the holder never appears in the member list",
    layers: ["pglite", "live"],
  },
  {
    role: "org_owner",
    resource: "PLAN_LIMIT_CLIENTS counts clients, not standing grants",
    operation: "execute",
    expect: "allow",
    rule: "PK section 2 path D — a standing grant never counts toward plan limits",
    layers: ["pglite", "live"],
  },
  // Precedence and cap.
  {
    role: "standing_viewer",
    resource: "app_private.viewer_tier() — specific grant overrides standing",
    operation: "execute",
    expect: "allow",
    rule: "PK section 2 path D precedence",
    layers: ["pglite", "live"],
  },
  {
    role: "standing_viewer",
    resource: "app_private.viewer_tier() — the client's entitlement caps the level",
    operation: "execute",
    expect: "allow",
    rule: "PK section 2 path D — a grant can never widen access beyond the client's tier",
    layers: ["pglite", "live"],
  },
  {
    role: "standing_viewer",
    resource: "revoking a specific grant leaves the standing grant in place",
    operation: "execute",
    expect: "allow",
    rule: "PK section 2 path D — revoking standing removes all of it and leaves specific grants; the reverse also holds",
    layers: ["pglite", "live"],
  },
  // Who may manage standing grants (policies land in Batch 2; the owner-facing
  // permission and its server functions land in Batch 5).
  ...rows(["org_owner"], ["firm_viewer_access"], ["read", ...WRITES], "allow", "PK section 2 path D — the organisation's owner grants and revokes", ["pglite", "live"]),
  ...rows(
    ["org_staff", "other_org_member", "super_admin_no_membership", "support_grant_active", "client_viewer", "aal1_member", "anonymous"],
    ["firm_viewer_access"],
    ["read", ...WRITES],
    "deny",
    "PK section 2 path D — owner or an active practice-team member of THAT organisation only",
    ["pglite", "live"],
  ),

  // ---------------------------------------------- Batch 5 (12 Sep 2026)
  // The one deliberate widening in the programme: viewer management is no longer
  // advisor-only. It is decided by app_private.can_manage_viewers_for_client —
  // the client's organisation OWNER, or a practice-team person holding an ACTIVE
  // membership of that same organisation. Nothing else moved.
  {
    role: "org_owner",
    resource: "viewer management for a client in the caller's own organisation",
    operation: "execute",
    expect: "allow",
    rule: "PK 2 client viewer + path D; Batch 5 owner permission",
    layers: ["pglite", "live"],
  },
  {
    role: "org_owner",
    resource: "viewer management for another organisation's client",
    operation: "execute",
    expect: "deny",
    rule: "PK 4 — the owner's own organisation only",
    layers: ["pglite", "live"],
  },
  ...rows(
    ["org_staff", "other_org_member", "support_grant_active", "super_admin_no_membership", "client_viewer", "standing_viewer", "aal1_member", "anonymous"],
    ["viewer management for a client in the caller's own organisation"],
    ["execute"],
    "deny",
    "Batch 5 — staff read the viewer list only; PK 3, PK 5 admit nothing here",
    ["pglite", "live"],
  ),
  {
    role: "org_owner",
    resource: "practice-team membership of organisation A inside organisation B",
    operation: "execute",
    expect: "deny",
    rule: "PK 4; Batch 5 — practice team is metadata, an ACTIVE membership of THAT organisation is still required",
    layers: ["pglite", "live"],
  },
  // The practice team list itself is platform metadata (Path C): super admin only.
  {
    role: "super_admin_no_membership",
    resource: "practice_team",
    operation: "read",
    expect: "allow",
    rule: "PK 2 path C — platform metadata, no client data",
    layers: ["pglite", "live"],
  },
  ...rows(
    ["super_admin_no_membership"],
    ["practice_team"],
    WRITES,
    "deny",
    "Batch 5 — writes only through the audited admin_add/remove_practice_member definer functions",
    ["pglite", "live"],
  ),
  ...rows(
    ["org_owner", "org_staff", "other_org_member", "support_grant_active", "client_viewer", "standing_viewer", "aal1_member", "anonymous"],
    ["practice_team"],
    ["read", ...WRITES],
    "deny",
    "Batch 5 — practice team readable by super admins only",
    ["pglite", "live"],
  ),
];

export const KNOWN_FAILURES = MATRIX.filter((r) => r.knownFailure);
