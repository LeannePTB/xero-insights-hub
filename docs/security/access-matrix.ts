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
  | "idle_session_member"
  | "fresh_mfa_session_member"
  | "active_session_member"
  | "org_owner"
  | "org_staff"
  | "other_org_member"
  | "org_a_owner_reading_org_b"
  | "client_viewer"
  | "business_owner"
  | "standing_viewer"
  | "support_grant_active"
  | "support_grant_expired"
  | "support_grant_revoked"
  | "super_admin_no_membership"
  | "super_admin_self_approving_support"
  | "suspended_member"
  | "removed_member"
  | "security_test_account";

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
  idle_session_member:
    "Active member on aal2, signed in today, with no recorded activity for more than 30 minutes",
  fresh_mfa_session_member:
    "Active member who has just completed MFA: an aal2 session seconds old with no activity row written yet",
  active_session_member:
    "Active member being ACTIVELY USED: an aal2 session that began 90 minutes ago whose last recorded activity is 2 minutes ago",
  org_owner: "Organisation owner (own organisation)",
  org_staff: "Organisation staff (own organisation)",
  other_org_member: "Active member of a DIFFERENT organisation",
  org_a_owner_reading_org_b: "Organisation A's owner, reading organisation B",
  client_viewer:
    "External adviser — selected clients (client_access on one client; user-facing name only, the key is unchanged)",
  business_owner:
    "Business owner — one specific client (client_access with relationship = 'business_owner', self-service)",
  standing_viewer:
    "External adviser — All clients (firm_viewer_access on one organisation, read-only; user-facing name only, the key is unchanged)",
  support_grant_active: "Support-grant holder, active, non-member organisation",
  support_grant_expired: "Support-grant holder, grant expired",
  support_grant_revoked: "Support-grant holder, grant revoked",
  super_admin_no_membership: "Super admin with NO membership",
  super_admin_self_approving_support: "Super admin approving their own support grant",
  suspended_member: "Member with status = suspended",
  removed_member: "Member with status = removed",
  security_test_account:
    "Live smoke-suite test account (confined to ZZ Security Test Org, banned outside a run)",
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
  "xero_rate_limits",
  "billing_events",
] as const;

/** Tables that must never be written from a browser session at all. */
export const APPEND_ONLY_TABLES = [
  "audit_log",
  "login_events",
  "xero_api_errors",
  "xero_rate_limits",
] as const;

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

/**
 * Tables a member manages directly through RLS (per-command firm policies).
 * scenario_exclusions belongs here as of 13 Sep 2026: Batch 3 dropped its three
 * accidental adviser write policies and left nothing behind, so members and
 * client owners lost the scenario planner's exclude/restore entirely. The
 * regression fix re-created per-command INSERT/UPDATE/DELETE plus a member
 * SELECT policy on app_private.user_can_write_client, and these positive rows
 * are what would have caught it.
 */
const MEMBER_MANAGED_TABLES = CLIENT_DATA_TABLES.filter(
  (t) =>
    !(SERVER_WRITTEN_TABLES as readonly string[]).includes(t) &&
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
  ...rows(
    PLATFORM_ONLY_ROLES,
    ["firms"],
    ["read"],
    "allow",
    "PK 2 path C; Spec §3 (organisation list)",
    ["pglite", "live"],
  ),
  ...rows(
    PLATFORM_ONLY_ROLES,
    ["firm_members"],
    ["read"],
    "allow",
    "PK 2 path C; Spec §3",
    ["pglite", "live"],
    {
      note: "Owner-approved Path C item (11 Sep 2026): the membership list is platform metadata, no financial data.",
    },
  ),
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
      note: "Phase 3b closed backlog 28: the FOR ALL super-admin policy is dropped, authenticated holds SELECT only, and comps/trials/tier changes go through the audited aal2 functions set_client_comp, set_client_trial and set_client_dashboard_tier. Trigger audit_change records every row change.",
    },
  ),

  // ------------------------------------------------------------ membership (A)
  ...rows(
    ["org_owner", "org_staff"],
    ["firms", "firm_members", ...CLIENT_DATA_TABLES.filter((t) => t !== "report_cache")],
    ["read"],
    "allow",
    "PK 2 path A; Spec §3 — including scenario_exclusions, which the member SELECT policy added by the Batch 3 regression fix admits",
    ["pglite", "live"],
  ),
  // report_cache is per-user, not per-organisation: a member sees only their own rows.
  {
    role: "org_owner",
    resource: "report_cache",
    operation: "read",
    expect: "allow",
    rule: "own cache rows",
    layers: ["pglite", "live"],
  },
  {
    role: "org_staff",
    resource: "report_cache",
    operation: "read",
    expect: "deny",
    rule: "another member's cache rows",
    layers: ["pglite", "live"],
  },
  ...rows(["org_owner"], ["report_cache"], WRITES, "allow", "own cache rows", ["pglite", "live"]),
  ...rows(["org_staff"], ["report_cache"], WRITES, "deny", "another member's cache rows", [
    "pglite",
    "live",
  ]),

  ...rows(
    ["org_owner", "org_staff"],
    MEMBER_MANAGED_TABLES,
    WRITES,
    "allow",
    "PK 2 path A; Spec §6",
    ["pglite", "live"],
  ),
  // Direct browser writes are closed unconditionally. Owners and active
  // practice-team members manage rows only through the audited functions.
  ...rows(
    ["org_owner", "org_staff"],
    ["client_access"],
    WRITES,
    "deny",
    "PK rule 11; Spec §14.3 — client_access writes use audited functions only",
    ["pglite", "live"],
  ),

  // Only an organisation OWNER manages the client list itself.
  ...rows(["org_owner"], ["clients"], WRITES, "allow", "Spec §6 (is_firm_owner)", [
    "pglite",
    "live",
  ]),
  ...rows(["org_staff"], ["clients"], WRITES, "deny", "Spec §6 (is_firm_owner only)", [
    "pglite",
    "live",
  ]),
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
      ...CLIENT_DATA_TABLES.filter((t) => !["report_cache", "scenario_exclusions"].includes(t)),
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
      note: "Proved at the RLS layer: the nine former FOR ALL policies are per-command with membership-only EXISTS checks. Phase 3a closed the rest of backlog 18: app_private.user_can_write_client (membership or client ownership, never a support grant) is now the write helper, app_private.move_xero_file_to_client uses it, and every server-function write path calls public.user_can_write_firm / user_can_write_client.",
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
      note: "Phase 3b closed backlog 28: no write policy or write grant remains for authenticated on client_subscriptions, so a support grantee (super admin or not) cannot write.",
    },
  ),

  // --------------------------------------------------------- client viewer
  ...rows(
    ["client_viewer"],
    ["clients", "client_notes"],
    ["read"],
    "allow",
    "Spec §3 client viewer",
    ["pglite", "live"],
  ),
  ...rows(
    ["client_viewer"],
    ["firms", "firm_members", "audit_log", "subscriptions"],
    ["read"],
    "deny",
    "Spec §3 client viewer sees only that client",
    ["pglite", "live"],
  ),
  ...rows(["client_viewer"], ["clients", "client_access"], WRITES, "deny", "Spec §3", [
    "pglite",
    "live",
  ]),

  // ---------------- Batch 2 relationship foundation (13 Sep 2026) --------
  {
    role: "org_owner",
    resource: "set_client_access_relationship() for own organisation",
    operation: "execute",
    expect: "allow",
    rule: "PK paths D/E — owner classifies selected-client access through an audited function",
    layers: ["pglite", "live"],
  },
  ...rows(
    [
      "org_staff",
      "other_org_member",
      "support_grant_active",
      "super_admin_no_membership",
      "client_viewer",
      "standing_viewer",
      "aal1_member",
      "anonymous",
    ],
    ["set_client_access_relationship() for own organisation"],
    ["execute"],
    "deny",
    "PK 1, 3, 4, 5 and paths D/E — no self-classification or status-only bypass",
    ["pglite", "live"],
  ),
  {
    role: "org_owner",
    resource: "two Business owners on one client remain independently client-scoped",
    operation: "execute",
    expect: "allow",
    rule: "PK path E — several Business owners are valid; each exact client_access row stands alone",
    layers: ["pglite", "live"],
  },
  {
    role: "org_staff",
    resource: "membership governs a simultaneous Business owner relationship",
    operation: "execute",
    expect: "allow",
    rule: "PK paths A/E — active membership is broader and does not conflict with the relationship row",
    layers: ["pglite", "live"],
  },
  {
    role: "org_owner",
    resource: "removing membership preserves the Business owner relationship row",
    operation: "execute",
    expect: "allow",
    rule: "PK path E — membership removal does not silently delete independently granted client access",
    layers: ["pglite", "live"],
  },
  {
    role: "org_owner",
    resource: "inviter labels do not affect identity or authorisation",
    operation: "execute",
    expect: "allow",
    rule: "PK rule 11; Spec §14.3 — labels are display-only",
    layers: ["pglite", "live"],
  },

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
    [
      "org_owner",
      "org_staff",
      "client_viewer",
      "support_grant_active",
      "super_admin_no_membership",
    ],
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
      note: "Phase 3b closed backlog 29 for this table: the generic AFTER trigger audit_change on user_roles records insert, update and delete with the actor and the changed columns, replacing audit_user_roles_change.",
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
      note: "Phase 3b closed backlog 29: the generic AFTER trigger audit_change records every row change on these tables with the actor and the changed columns.",
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
      note: "Phase 3b closed backlog 29: trigger audit_change on signup_requests records the actor and the changed columns.",
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
    note: "Denied in effect: the write succeeds but the forged value never persists. Live-only — the PGlite fixture mirrors policies and grants, not triggers.",
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

  // ---------------------------------------------------- View as (impersonation)
  // View As is a PRESENTATION filter: the preview renders through the caller's
  // own session and RLS, so it can never show a row the caller could not
  // already read. It resolves against PK 3 by refusing to record — and so
  // refusing to open — for an organisation the caller only reaches by being a
  // super admin. Every accepted preview writes an audit_log row naming who
  // previewed whom, which organisation and when.
  {
    role: "super_admin_no_membership",
    resource: "record_view_as(an organisation they are not a member of)",
    operation: "execute",
    expect: "deny",
    rule: "PK 3 — super_admin alone grants no organisation access, so it cannot preview one either",
    layers: ["pglite"],
    note: "Added 16 Sep 2026 with the audited View as action on the Organisations table. Before this, view-as was a URL parameter with no audit row and no database check.",
  },
  {
    role: "org_owner",
    resource: "record_view_as(their own organisation)",
    operation: "execute",
    expect: "deny",
    rule: "Platform operations only (assert_super_admin) — an organisation owner has no impersonation action",
    layers: ["pglite"],
  },
  {
    role: "aal1_member",
    resource: "record_view_as(their own organisation)",
    operation: "execute",
    expect: "deny",
    rule: "PK 2 (aal2 required before anything else)",
    layers: ["pglite"],
  },
  {
    role: "client_viewer",
    resource: "record_view_as(their own organisation)",
    operation: "execute",
    expect: "deny",
    rule: "PK 2 path D — a viewer grant is read-only and never platform operations",
    layers: ["pglite"],
  },
  {
    role: "super_admin_no_membership",
    resource: "xero_error_breakdown()",
    operation: "execute",
    expect: "allow",
    rule: "PK 2 path C — Xero telemetry is platform metadata: status codes and endpoints, never client data",
    layers: ["pglite"],
  },
  {
    role: "org_owner",
    resource: "xero_error_breakdown()",
    operation: "execute",
    expect: "deny",
    rule: "PK 2 path C is platform operations only; an organisation reads its own Xero errors elsewhere",
    layers: ["pglite"],
  },

  // ------------------------------------------------- organisation trials (v2)
  // A trial grants Advisory (and Consolidation) on the ORGANISATION until a
  // date, stored separately from what has been purchased. Starting, extending or
  // ending one is a commercial change, so it is aal2 + super admin through
  // public.set_org_trial and audited. It never grants access to anything: it
  // only changes which cards exist for clients the caller can already reach.
  {
    role: "super_admin_no_membership",
    resource: "set_org_trial(any organisation)",
    operation: "execute",
    expect: "allow",
    rule: "PK 2 path C — plan and billing metadata is platform operations; no client data is read or returned",
    layers: ["pglite"],
    note: "Added 16 Sep 2026 when trials moved from the client to the organisation.",
  },
  {
    role: "super_admin_no_membership",
    resource: "starting a trial over purchased Advisory converts the purchase and keeps ticks",
    operation: "execute",
    expect: "allow",
    rule: "The audited trial change is atomic: selected purchased options become trialled while client card selections remain untouched",
    layers: ["pglite"],
    note: "Added 16 Sep 2026 after a purchase-plus-trial overlap could create a cosmetic trial that granted nothing.",
  },
  {
    role: "org_owner",
    resource: "set_org_trial(their own organisation)",
    operation: "execute",
    expect: "deny",
    rule: "Commercial change — assert_super_admin, same treatment as a comp; an organisation cannot grant itself a trial",
    layers: ["pglite"],
  },
  {
    role: "aal1_member",
    resource: "set_org_trial(their own organisation)",
    operation: "execute",
    expect: "deny",
    rule: "PK 2 (aal2 required before anything else)",
    layers: ["pglite"],
  },
  {
    role: "support_grant_active",
    resource: "set_org_trial(the organisation they support)",
    operation: "execute",
    expect: "allow",
    rule: "PK 2 path C — this person is a platform super admin, so the change is plan metadata; the support grant contributes nothing to it",
    layers: ["pglite"],
    note: "Support grants are only ever held by a Positive Traction super admin, so this row cannot separate the two paths. What it does prove is that the trial function reads and returns no client data, so invariant 5 (support grants are read-only over CLIENT data) is untouched: org_owner and client_viewer above are refused outright.",
  },
  {
    role: "client_viewer",
    resource: "set_org_trial(the organisation of the client they can see)",
    operation: "execute",
    expect: "deny",
    rule: "PK 2 path D — an adviser grant is read-only and never organisation or platform data",
    layers: ["pglite"],
  },
  {
    role: "super_admin_no_membership",
    resource: "toggling Consolidation off and on preserves all consolidation working data",
    operation: "execute",
    expect: "allow",
    rule: "Availability is an entitlement filter, never a data operation — switching an option off hides cards and deletes nothing",
    layers: ["pglite"],
    note: "Added 16 Sep 2026 at the owner's direction — her single biggest concern about this model. Proves, on every check, that set_org_purchase with Consolidation false leaves consolidation_groups, consolidation_group_members, loan_consolidation_accounts and loan_consolidation_snapshots row-for-row unchanged, that the loan_consolidation card stops being available while it is off, and that switching it back on restores the card with the working data and the per-client ticks intact. No foreign key or trigger on those four tables references the option: their only cascades are from deleting a firm, client or group.",
  },
  {
    role: "org_owner",
    resource: "purchased Advisory keeps its cards with no trial or an expired trial",
    operation: "read",
    expect: "allow",
    rule: "Effective options = purchased OR unexpired trial — an absent or expired trial can never take away a purchase",
    layers: ["pglite"],
    note: "Added 16 Sep 2026 at the owner's direction: this is the case that protects an organisation whose Advisory is granted rather than trialled.",
  },
  {
    role: "org_owner",
    resource: "trial-only organisation options are available and identified as trialled",
    operation: "read",
    expect: "allow",
    rule: "Every organisation-option display uses effective state (purchased OR unexpired trial), while preserving the trial marker and end date",
    layers: ["pglite"],
    note: "Added 17 Sep 2026 after the Organisations row incorrectly described a genuine Advisory and Consolidation trial as both options being off.",
  },
  {
    role: "org_owner",
    resource:
      "an expired trial with nothing purchased shows no Advisory cards, and the ticks survive",
    operation: "read",
    expect: "deny",
    rule: "A trial ends at read time with no scheduled job; per-client ticked lists are never rewritten",
    layers: ["pglite"],
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
    note: "Phase 3a: every server-function write path (branding, report finalise/send/revoke/delete, draft save, Xero audit runs and finding snoozes, organisation reconnect-all, loan-consolidation account setup, note report-flagging, Xero file link/unlink/move) authorises through public.user_can_write_firm / public.user_can_write_client, which never admit a support grant.",
  },
  // Personal video on a monthly report (client_reports.video_* columns). Both
  // gates are required and neither substitutes for the other.
  ...rows(
    ["org_owner", "org_staff", "support_grant_active", "aal1_member", "client_viewer"],
    ["server fn: set a report's personal video"],
    ["execute"],
    "deny",
    "PK 2 (requireAal2) + platform super admin only (assert_super_admin)",
    ["live"],
  ),
  {
    role: "super_admin_no_membership",
    resource: "server fn: set a report's personal video",
    operation: "execute",
    expect: "deny",
    rule: "PK 3 (super admin alone grants ZERO client data) + PK 5",
    layers: ["live"],
    note: "setReportVideo runs assert_super_admin AND canWriteFirm (public.user_can_write_firm) on the report's own firm_id, read server-side from the stored row. A super admin who is not an active member of that organisation is refused. Finalised or sent reports are refused outright; the video never enters the payload, so it cannot reach the rendered PDF.",
  },

  {
    role: "support_grant_active",
    resource: "server fn: change organisation or client branding",
    operation: "execute",
    expect: "deny",
    rule: "PK 5 (support grants are READ-ONLY)",
    layers: ["live"],
    note: "branding.server.ts write gates call public.user_can_write_firm / user_can_write_client; reads still allow a grant. The Branding entitlement gate added on top narrows further and never widens: assertClientWriter still runs first.",
  },
  {
    role: "org_staff",
    resource: "server fn: set a client logo when the organisation has not bought Branding",
    operation: "execute",
    expect: "deny",
    rule: "Spec §5 — Branding is a purchasable option; an entitlement is never a grant",
    layers: ["live"],
    note: "setClientLogo calls public.client_branding_enabled (aal2 + user_can_read_client + effective branding + NOT lapsed) after the write gate. A direct upload call is refused, and getClientLogo returns no path or signed URL, so an existing report link cannot render the logo either.",
  },
  {
    role: "org_staff",
    resource: "server fn: set a client logo when the organisation has bought Branding",
    operation: "execute",
    expect: "allow",
    rule: "Path A — membership writes within its own organisation",
    layers: ["live"],
    note: "With effective branding on (purchased OR unexpired trial that explicitly includes Branding) and the organisation not lapsed, an active member may upload, replace and clear the client logo. Switching Branding off hides the logo; storage and clients.logo_path are untouched, so it returns when Branding comes back.",
  },
  // ------------------------------------------- invitations and ownership (People)
  {
    role: "super_admin_no_membership",
    resource: "server fn: invite an owner to an existing organisation",
    operation: "execute",
    expect: "deny",
    rule: "Spec §4 — ownership only moves through transfer_organisation_ownership",
    layers: ["live"],
    note: "adminInviteFirmMember accepts role 'staff' only; an owner invitation to an existing organisation is refused with a pointer to ownership transfer.",
  },
  {
    role: "anonymous",
    resource: "server fn: accept an owner invite while the organisation already has an owner",
    operation: "execute",
    expect: "deny",
    rule: "Spec §4 — accepting an invite never replaces a sitting owner",
    layers: ["live"],
    note: "acceptInvite sets firms.owner_user_id only while it is null (the organisation-creation flow) and writes an audit row when it does; otherwise the person joins as a member and ownership is untouched.",
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
    note: "Opening a client dashboard writes one xero_data_read row per actor + client + Xero file + read key + source per five minutes, recording no figures, account names or contact names.",
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
    [
      "firms",
      "firm_members",
      "audit_log",
      "subscriptions",
      "billing_events",
      "client_subscriptions",
      "access_invites",
    ],
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
  ...rows(
    ["org_owner"],
    ["firm_viewer_access"],
    ["read", ...WRITES],
    "allow",
    "PK section 2 path D — the organisation's owner grants and revokes",
    ["pglite", "live"],
  ),
  ...rows(
    [
      "org_staff",
      "other_org_member",
      "super_admin_no_membership",
      "support_grant_active",
      "client_viewer",
      "aal1_member",
      "anonymous",
    ],
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
    [
      "org_staff",
      "other_org_member",
      "support_grant_active",
      "super_admin_no_membership",
      "client_viewer",
      "standing_viewer",
      "aal1_member",
      "anonymous",
    ],
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
  // The practice team list itself is platform metadata (Path C): super admin
  // only. The support-grant subject in the fixture also holds the super_admin
  // role, so it reads the list as a platform admin — the list names our own
  // staff and holds no organisation or client data, so this is Path C, not the
  // support grant widening (PK 5 still admits no write anywhere).
  {
    role: "super_admin_no_membership",
    resource: "practice_team",
    operation: "read",
    expect: "allow",
    rule: "PK 2 path C — platform metadata, no client data",
    layers: ["pglite", "live"],
  },
  {
    role: "support_grant_active",
    resource: "practice_team",
    operation: "read",
    expect: "allow",
    rule: "PK 2 path C — reads as a platform admin; no organisation or client data on this table",
    layers: ["pglite", "live"],
  },
  ...rows(
    ["super_admin_no_membership", "support_grant_active"],
    ["practice_team"],
    WRITES,
    "deny",
    "Batch 5 — writes only through the audited admin_add/remove_practice_member definer functions",
    ["pglite", "live"],
  ),
  ...rows(
    [
      "org_owner",
      "org_staff",
      "other_org_member",
      "client_viewer",
      "standing_viewer",
      "aal1_member",
      "anonymous",
    ],
    ["practice_team"],
    ["read", ...WRITES],
    "deny",
    "Batch 5 — practice team readable by super admins only",
    ["pglite", "live"],
  ),
  // The advisors-page control (12 Sep 2026). It is the SAME audited definer
  // function as the old standalone screen — aal2 + super admin, asserted in the
  // database — so moving the control changes nobody's rights. Both fixture
  // super admins reach it as platform admins (Path C, metadata only); everyone
  // else, including an organisation owner and any aal1 session, is refused.
  ...rows(
    ["super_admin_no_membership", "support_grant_active"],
    ["manage the practice team (admin_add/remove_practice_member)"],
    ["execute"],
    "allow",
    "PK 2 path C — platform metadata; aal2 + super admin asserted in the definer function",
    ["pglite", "live"],
  ),
  ...rows(
    [
      "org_owner",
      "org_staff",
      "other_org_member",
      "client_viewer",
      "standing_viewer",
      "aal1_member",
      "anonymous",
    ],
    ["manage the practice team (admin_add/remove_practice_member)"],
    ["execute"],
    "deny",
    "Batch 5 — super-admin-only, unchanged by the advisors-page control",
    ["pglite", "live"],
  ),

  // ---------------------------------------------- Member removal (12 Sep 2026)
  // public.remove_firm_member() is the ONLY removal path. It is a WRITE, so no
  // support grant may reach it (PK 5), and the super_admin role alone gives
  // nothing (PK 3). Removal sets firm_members.status = 'removed'; every
  // membership test is already active-only, so a removed row reaches nothing.
  {
    role: "org_owner",
    resource: "remove a staff member of the caller's own organisation",
    operation: "execute",
    expect: "allow",
    rule: "Spec §15 — the handover case: an owner removes staff of their own organisation",
    layers: ["pglite", "live"],
  },
  {
    role: "org_owner",
    resource: "remove a Traction Advisory (practice-team) staff member",
    operation: "execute",
    expect: "allow",
    rule: "Design decision 8 — our people are removable by the owner after handover",
    layers: ["pglite", "live"],
  },
  {
    role: "org_owner",
    resource: "an owner removes themselves",
    operation: "execute",
    expect: "deny",
    rule: "Spec §15 — ownership must be transferred first; an organisation is never left without an owner",
    layers: ["pglite", "live"],
  },
  {
    role: "org_staff",
    resource: "removing the organisation's last remaining member",
    operation: "execute",
    expect: "deny",
    rule: "Spec §15 — an organisation is never stranded with no members",
    layers: ["pglite", "live"],
  },
  {
    role: "org_staff",
    resource: "leave the organisation (remove yourself)",
    operation: "execute",
    expect: "allow",
    rule: "Spec §15 — anyone who is not the owner may leave",
    layers: ["pglite", "live"],
  },
  ...rows(
    [
      "org_staff",
      "other_org_member",
      "support_grant_active",
      "super_admin_no_membership",
      "client_viewer",
      "standing_viewer",
      "suspended_member",
      "removed_member",
      "aal1_member",
      "anonymous",
    ],
    ["remove a staff member of the caller's own organisation"],
    ["execute"],
    "deny",
    "Spec §15 — owner only; PK 5 admits no write from a support grant and PK 3 none from the role alone",
    ["pglite", "live"],
  ),
  {
    role: "org_owner",
    resource: "removal leaves client viewer and standing grants untouched",
    operation: "execute",
    expect: "allow",
    rule: "Spec §15 — removal is a membership status change and nothing else",
    layers: ["pglite", "live"],
  },
  {
    role: "removed_member",
    resource: "the organisation's clients after removal",
    operation: "read",
    expect: "deny",
    rule: "PK 2 path A — membership must be ACTIVE",
    layers: ["pglite", "live"],
  },

  // -------------------------------- Slim live smoke suite (12 Sep 2026)
  // These rows exist because only a REAL session can prove them: the same
  // person on aal2 and on aal1, and the real server functions over HTTP. The
  // live runner reads its expectations from here — it never keeps its own list.
  {
    role: "org_owner",
    resource: "server fn: read a client dashboard",
    operation: "execute",
    expect: "allow",
    rule: "PK 2 path A",
    layers: ["live"],
  },
  {
    role: "standing_viewer",
    resource: "server fn: read a client dashboard",
    operation: "execute",
    expect: "allow",
    rule: "PK section 2 path D — read-only over every client in that organisation",
    layers: ["live"],
  },
  ...rows(
    ["aal1_member", "anonymous"],
    ["server fn: read a client dashboard"],
    ["execute"],
    "deny",
    "PK 2 (requireAal2); no session reaches a server function",
    ["live"],
  ),
  ...rows(
    ["anonymous"],
    ["server fn: list clients for an organisation", "server fn: write client data"],
    ["execute"],
    "deny",
    "PK 1 deny by default — no session, no server function",
    ["live"],
  ),
  {
    role: "standing_viewer",
    resource: "server fn: write client data",
    operation: "execute",
    expect: "deny",
    rule: "PK section 2 path D — a standing grant is READ-ONLY and never enters a write path",
    layers: ["live"],
  },
  {
    role: "org_owner",
    resource: "server fn: list pending member invitations",
    operation: "execute",
    expect: "deny",
    rule: "PK 2 path C — member invitations are platform metadata, super admin only",
    layers: ["live"],
  },
  // The suite's own accounts are confined by DATABASE TRIGGERS, not convention:
  // proved by attempting each insert as the SERVICE ROLE and being refused.
  ...rows(
    ["security_test_account"],
    [
      "membership of a real organisation",
      "a platform role (user_roles)",
      "practice_team membership",
    ],
    ["insert"],
    "deny",
    "Live suite containment — app_private.confine_security_test_accounts() refuses even service_role",
    ["live"],
  ),

  // ------------------------------ Attestations (12 Sep 2026) — Spec §17
  // A control no system can read is evidenced by a recorded human confirmation.
  // The record is platform metadata (Path C): super admin only, written ONLY by
  // public.record_security_attestation, which stamps auth.uid() and now() itself.
  {
    role: "super_admin_no_membership",
    resource: "record a security attestation",
    operation: "execute",
    expect: "allow",
    rule: "Spec §17 — attestations are platform metadata, super admin only",
    layers: ["pglite", "live"],
  },
  {
    role: "support_grant_active",
    resource: "record a security attestation",
    operation: "execute",
    expect: "allow",
    rule: "Spec §17 — acts as a platform admin (this fixture identity also holds super_admin); PK 5 is untouched, no organisation or client data is reachable here",
    layers: ["pglite", "live"],
    note: "The support-grant subject in the fixture also holds the super_admin role, so this row proves the Path C rule, not a support-grant widening.",
  },
  ...rows(
    [
      "org_owner",
      "org_staff",
      "other_org_member",
      "client_viewer",
      "standing_viewer",
      "aal1_member",
      "anonymous",
    ],
    ["record a security attestation"],
    ["execute"],
    "deny",
    "Spec §17 — super admin only; PK 2 requires aal2 and PK 1 admits nothing without it",
    ["pglite", "live"],
  ),
  {
    role: "super_admin_no_membership",
    resource: "a security attestation's confirmed_by and confirmed_at are set by the server",
    operation: "execute",
    expect: "allow",
    rule: "Spec §17 — the function stamps auth.uid() and now(); no caller-supplied identity or time",
    layers: ["pglite", "live"],
  },
  {
    role: "super_admin_no_membership",
    resource: "security_attestations",
    operation: "read",
    expect: "allow",
    rule: "PK 2 path C — platform metadata, no client data",
    layers: ["pglite", "live"],
  },
  {
    role: "support_grant_active",
    resource: "security_attestations",
    operation: "read",
    expect: "allow",
    rule: "PK 2 path C — reads as a platform admin; no organisation or client data on this table",
    layers: ["pglite", "live"],
  },
  ...rows(
    ["super_admin_no_membership", "support_grant_active"],
    ["security_attestations"],
    WRITES,
    "deny",
    "Spec §17 — writes only through public.record_security_attestation; no write policy exists at all",
    ["pglite", "live"],
  ),
  ...rows(
    [
      "org_owner",
      "org_staff",
      "other_org_member",
      "client_viewer",
      "standing_viewer",
      "aal1_member",
      "anonymous",
    ],
    ["security_attestations"],
    ["read", ...WRITES],
    "deny",
    "Spec §17 — readable by super admins only",
    ["pglite", "live"],
  ),

  // ---------------- Batch 3: the accidental adviser writes are gone --------
  // PK rule 11: app_private.has_client_access (a READ predicate) no longer
  // appears in any permissive write policy or write helper. Before this batch a
  // specific client_access holder could insert/update/delete scenario
  // exclusions and update reconciliation comments directly.
  ...rows(
    ["client_viewer", "standing_viewer"],
    ["scenario_exclusions", "unreconciled_lines"],
    WRITES,
    "deny",
    "PK rule 11; PK section 2 path D — an External adviser grant is read-only, including scenario exclusions and reconciliation comments",
    ["pglite", "live"],
  ),
  {
    role: "client_viewer",
    resource: "user_can_write_client_scenario() for the client they can read",
    operation: "execute",
    expect: "deny",
    rule: "PK rule 11 — the read predicate is gone from the scenario write check",
    layers: ["pglite"],
  },
  {
    role: "org_owner",
    resource: "user_can_write_client_scenario() for a client in their organisation",
    operation: "execute",
    expect: "allow",
    rule: "PK section 2 path A — membership or client ownership still writes scenario exclusions, unchanged by Batch 3",
    layers: ["pglite"],
  },
  {
    role: "org_staff",
    resource: "user_can_write_client_scenario() for a client in their organisation",
    operation: "execute",
    expect: "allow",
    rule: "PK section 2 path A — an active member's scenario writes are unchanged by Batch 3",
    layers: ["pglite"],
  },
  {
    role: "other_org_member",
    resource: "user_can_write_client_scenario() for a client outside their organisation",
    operation: "execute",
    expect: "deny",
    rule: "PK 1 / PK 4 — membership in another organisation writes nothing here",
    layers: ["pglite"],
  },
  // The daily 3am Australia/Sydney sign-in cut-off and its rows were REMOVED on
  // 15 Sep 2026 (owner decision): the inactivity timeout below addresses the
  // stolen-device threat directly, while a daily forced sign-in added friction
  // without covering it. app_private.is_session_fresh() was dropped and nothing
  // refuses a session for having begun yesterday.

  // ------------- 30 minute inactivity timeout — SERVER ENFORCEMENT SUSPENDED
  // OUTAGE, 15 Sep 2026. Nothing in the published app was recording activity, so
  // public.session_activity held no row for any live session and
  // app_private.is_session_active() fell back to the sign-in time — refusing
  // every person whose session was over 30 minutes old, however actively they
  // were working. The check was therefore removed from app_private.is_aal2()
  // and app_private.assert_aal2(), and switched off at the request layer. The
  // table and its functions remain in place and unchanged; the browser-side
  // timeout still ends a session at 30 minutes and can only ever end it
  // EARLIER than the server would.
  //
  // Enforcement RESTORED 15 Sep 2026, 04:50 UTC, in the same change as the
  // positive proof (see `active_session_member` below): an aal2 session with no
  // activity for longer than the window is refused in the database, and the
  // refusal is SESSION_IDLE, never MFA_REQUIRED.
  {
    role: "idle_session_member",
    resource: "client_notes",
    operation: "read",
    expect: "deny",
    rule: "PK 2 — the aal2 gate requires activity inside the 30 minute window",
    layers: ["pglite"],
  },
  {
    role: "idle_session_member",
    resource: "assert_aal2() with an idle session",
    operation: "execute",
    expect: "deny",
    rule: "PK 2 — raises SESSION_IDLE before any MFA answer",
    layers: ["pglite"],
  },
  {
    role: "idle_session_member",
    resource: "touch_session_activity()",
    operation: "execute",
    expect: "deny",
    rule: "PK 2 — an idle session cannot revive itself: the aal2 assertion fails first",
    layers: ["pglite"],
  },
  {
    role: "idle_session_member",
    resource: "assert_aal2() with no session_id claim",
    operation: "execute",
    expect: "deny",
    rule: "PK 2 — an unverifiable session id fails closed",
    layers: ["pglite"],
  },

  // Regression, 15 Sep 2026: a person who has just completed MFA has a session
  // seconds old and NO activity row yet, because the browser writes the first
  // one after sign-in. is_session_active() therefore falls back to the
  // session's own start time in auth.sessions. If it did not, everyone would be
  // refused the moment they finished their second factor.
  {
    role: "fresh_mfa_session_member",
    resource: "client_notes",
    operation: "read",
    expect: "allow",
    rule: "PK 2 — a brand-new session with no activity row is active from its start time",
    layers: ["pglite"],
  },
  {
    role: "fresh_mfa_session_member",
    resource: "assert_aal2() immediately after MFA (no activity row yet)",
    operation: "execute",
    expect: "allow",
    rule: "PK 2 — completing MFA is never refused as idle",
    layers: ["pglite"],
  },
  {
    role: "fresh_mfa_session_member",
    resource: "touch_session_activity()",
    operation: "execute",
    expect: "allow",
    rule: "PK 2 — the first activity write of a new session succeeds",
    layers: ["pglite"],
  },
  // POSITIVE PROOF, added 15 Sep 2026. The outage happened because every row
  // here proved the inactivity check REFUSES and none proved it ALLOWS. These
  // three rows are that missing half: a session whose sign-in is well past the
  // 30 minute window but whose recorded activity is recent must be accepted —
  // for a client-scoped read, for the aal2 assertion, and for its own activity
  // write. They must hold both while database enforcement is suspended and
  // after it is restored, so a future suspension or restoration cannot silently
  // lock out people who are working.
  {
    role: "active_session_member",
    resource: "client_notes",
    operation: "read",
    expect: "allow",
    rule: "PK 2 — recent recorded activity keeps a long-lived session active, whatever its age",
    layers: ["pglite"],
  },
  {
    role: "active_session_member",
    resource: "assert_aal2() after 90 minutes of continuous use",
    operation: "execute",
    expect: "allow",
    rule: "PK 2 — an actively used session is never refused as idle",
    layers: ["pglite"],
  },
  {
    role: "active_session_member",
    resource: "touch_session_activity()",
    operation: "execute",
    expect: "allow",
    rule: "PK 2 — an actively used session keeps recording its own activity, caller-scoped",
    layers: ["pglite"],
  },
  {
    role: "org_staff",
    resource: "touch_session_activity()",
    operation: "execute",
    expect: "allow",
    rule: "PK 2 — a live aal2 session records its own activity, caller-scoped",
    layers: ["pglite"],
  },
  {
    role: "idle_session_member",
    resource: "session_activity",
    operation: "update",
    expect: "deny",
    rule: "PK 1 — activity timestamps are server-written only; no client write path",
    layers: ["pglite"],
  },
  {
    role: "org_staff",
    resource: "session_activity",
    operation: "update",
    expect: "deny",
    rule: "PK 1 — read-only to signed-in users; only the definer function writes",
    layers: ["pglite"],
  },

  // Signing ANOTHER person out of every device (stolen device). The
  // authentication service has no admin logout endpoint on this platform and a
  // temporary ban leaves the session intact, so the control works by an admin
  // credential change, which was measured deleting every auth.sessions row.
  // Authorisation is in the database and nowhere else.
  {
    role: "super_admin_no_membership",
    resource: "admin_assert_can_sign_out_user(another person)",
    operation: "execute",
    expect: "allow",
    rule: "Path C — platform operations; aal2 + super admin, audited, no client data",
    layers: ["pglite"],
  },
  {
    role: "super_admin_no_membership",
    resource: "admin_assert_can_sign_out_user(their own account)",
    operation: "execute",
    expect: "deny",
    rule: "PK 1 — the caller uses Sign out my other devices for themselves",
    layers: ["pglite"],
  },
  {
    role: "org_staff",
    resource: "admin_assert_can_sign_out_user(another person)",
    operation: "execute",
    expect: "deny",
    rule: "Invariant 3/6 — only a super admin may sign another person out",
    layers: ["pglite"],
  },

  // ---- Client setup checklist (display + acknowledgements) ----
  {
    role: "support_grant_active",
    resource: "server fn: acknowledgeSetupItem (record a setup decision)",
    operation: "execute",
    expect: "deny",
    rule: "PK 5 (support grants are READ-ONLY)",
    layers: ["live"],
    note: "The acknowledgement is an UPDATE on public.clients through context.supabase, so the clients write policies (app_private.user_can_manage_client) decide. A support grant is read-only, so the update matches no row and the function raises 'You cannot change this client.' Reading the checklist stays allowed, like other client reads under a grant.",
  },
  {
    role: "org_staff",
    resource: "server fn: getClientSetupChecklist for a client in another organisation",
    operation: "execute",
    expect: "deny",
    rule: "PK 4 (a caller-supplied client_id is a FILTER, never a GRANT)",
    layers: ["live"],
    note: "assertClientDataAccessForClient runs first, and every read inside setup-checklist.server.ts goes through context.supabase, so RLS scopes the clients, client_statutory_accounts, client_cost_classifications and xero_snapshots reads. public.client_setup_account_counts is SECURITY INVOKER, so it counts only rows the caller may already read.",
  },
  // ------------------------------------------- organisation trial visibility
  {
    role: "business_owner",
    resource: "server fn: getClientOrgTrial for their own client",
    operation: "execute",
    expect: "allow",
    rule: "Path E — the business owner may see their client's plan and billing",
    layers: ["live"],
    note: "public.client_org_trial asserts aal2, then returns the organisation's live trial (end date, days remaining, ending-soon flag) only when the caller is an active member of the client's organisation or holds a client_access row with relationship = 'business_owner' for that exact client. Only trial metadata is returned — never purchase detail, never another organisation.",
  },
  {
    role: "org_staff",
    resource: "server fn: getClientOrgTrial for a client in their organisation",
    operation: "execute",
    expect: "allow",
    rule: "Path A — members see their own organisation's billing state",
    layers: ["live"],
    note: "app_private.has_firm_access (active membership) admits the caller; the same row a super admin sees on the purchase card is what the banner renders.",
  },
  {
    role: "business_owner",
    resource: "server fn: getClientOrgTrial for a client that is not theirs",
    operation: "execute",
    expect: "deny",
    rule: "PK 4 (a caller-supplied client_id is a FILTER, never a GRANT)",
    layers: ["live"],
    note: "Neither predicate holds — no membership of that organisation and no business_owner row for that client — so the function returns no rows and the banner never renders.",
  },
  {
    role: "client_viewer",
    resource: "server fn: getClientOrgTrial",
    operation: "execute",
    expect: "deny",
    rule: "Path D — an external adviser never sees billing, plan or organisation-level data",
    layers: ["live"],
    note: "A client_access row with relationship = 'external_adviser' (or NULL) does not match the business_owner predicate and the caller is not a member, so no rows are returned.",
  },
  {
    role: "standing_viewer",
    resource: "server fn: getClientOrgTrial",
    operation: "execute",
    expect: "deny",
    rule: "Path D — an external adviser never sees billing, plan or organisation-level data",
    layers: ["live"],
    note: "firm_viewer_access is not consulted by the function; without membership or a business_owner row the result is empty.",
  },
  {
    role: "support_grant_active",
    resource: "server fn: getClientOrgTrial",
    operation: "execute",
    expect: "deny",
    rule: "PK 5 / Path B — a support grant is read-only client data, never billing state",
    layers: ["live"],
    note: "app_private.has_firm_access counts active firm_members rows only, so a support grant does not satisfy it; without a business_owner row the function returns nothing.",
  },
  {
    role: "aal1_member",
    resource: "server fn: getClientOrgTrial",
    operation: "execute",
    expect: "deny",
    rule: "PK 2 — MFA is enforced on the server",
    layers: ["live"],
    note: "app_private.assert_aal2() runs before anything is read, so an aal1 session is refused with MFA_REQUIRED even when the person would otherwise qualify.",
  },
];

export const KNOWN_FAILURES = MATRIX.filter((r) => r.knownFailure);
