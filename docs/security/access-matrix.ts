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

/** Roles that must reach NOTHING with organisation, client, Xero or personal data. */
const NO_DATA_ROLES: Role[] = [
  "anonymous",
  "aal1_member",
  "other_org_member",
  "org_a_owner_reading_org_b",
  "suspended_member",
  "removed_member",
  "super_admin_no_membership",
  "support_grant_expired",
  "support_grant_revoked",
];

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

  // ------------------------------------------------------------ membership (A)
  ...rows(
    ["org_owner", "org_staff"],
    ["firms", "firm_members", ...CLIENT_DATA_TABLES],
    ["read"],
    "allow",
    "PK 2 path A; Spec §3",
    ["pglite", "live"],
  ),
  ...rows(
    ["org_owner", "org_staff"],
    CLIENT_DATA_TABLES,
    WRITES,
    "allow",
    "PK 2 path A; Spec §6",
    ["pglite", "live"],
  ),

  // ------------------------------------------------------- support grant (B)
  ...rows(
    ["support_grant_active"],
    ["firms", "firm_members", ...CLIENT_DATA_TABLES],
    ["read"],
    "allow",
    "PK 2 path B; Spec §3, §7",
    ["pglite", "live"],
  ),
  ...rows(
    ["support_grant_active"],
    [
      "client_access",
      "client_cost_classifications",
      "client_notes",
      "client_true_breakeven_inputs",
      "client_xero_orgs",
      "loan_consolidation_accounts",
      "tier_widget_config",
      "unreconciled_lines",
      "unreconciled_uploads",
    ],
    WRITES,
    "deny",
    "PK 5 (support grants are READ-ONLY)",
    ["pglite", "live"],
    {
      knownFailure: {
        backlog: 18,
        note:
          "app_private.user_can_manage_client still admits is_super_admin AND platform_staff_can_access_firm; nine FOR ALL policies and app_private.move_xero_file_to_client depend on it, so an active support grant can still write.",
      },
    },
  ),
  ...rows(
    ["support_grant_active"],
    CLIENT_DATA_TABLES.filter(
      (t) =>
        ![
          "client_access",
          "client_cost_classifications",
          "client_notes",
          "client_true_breakeven_inputs",
          "client_xero_orgs",
          "loan_consolidation_accounts",
          "tier_widget_config",
          "unreconciled_lines",
          "unreconciled_uploads",
        ].includes(t),
    ),
    WRITES,
    "deny",
    "PK 5 (support grants are READ-ONLY)",
    ["pglite", "live"],
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
    ["other_org_member", "super_admin_no_membership", "anonymous", "aal1_member"],
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
  ...rows(["org_owner"], ["audit_log"], ["read"], "allow", "Spec §3 own organisation's audit rows", [
    "pglite",
    "live",
  ]),

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
    layers: ["pglite", "live"],
    note: "Denied in effect: the write succeeds but the forged value never persists.",
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
