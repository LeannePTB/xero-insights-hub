/**
 * Phase 4 — files converted to the one rulebook.
 *
 * A converted file must not decide access itself. Enforced by
 * `tests/static-guards.test.ts` (guard 6), per batch, not only at the end:
 *
 *  1. it may not read `user_roles`, `firm_members`, `client_access` or
 *     `firm_support_access` directly;
 *  2. if it references `supabaseAdmin` at all, the file must also contain a
 *     call to one of the registered database authorisation functions below,
 *     and the privileged step must come after it.
 *
 * Add a file here in the same change that converts it. Never remove one.
 */

/** Database authorisation functions server code is allowed to rely on. */
export const REGISTERED_DB_AUTH_CALLS = [
  "assert_widget_access",
  "effective_tier_for_tenant",
  "client_for_tenant",
  "user_can_access_tenant",
  "assert_tenant_belongs_to_client",
  "user_can_access_client",
  "user_can_access_firm",
  "user_can_read_client",
  "user_can_write_client",
  "user_can_write_firm",
  "user_can_write_client_scenario",
  "assert_client_write_access",
  "client_entitlement",
  "client_allowed_widgets",
  "client_can_use_widget",
  "firm_allowed_widgets",
  "firm_can_use_widget",
  "me_is_super_admin",
  // Phase 4 batch 2 — caller-scoped, aal2-guarded, EXECUTE revoked from
  // PUBLIC/anon. Each one decides the caller's access inside the database.
  "my_firm_ids",
  "me_has_role",
  "client_viewers",
  "client_for_access",
  "client_access_tiers",
  "grant_client_access",
  "set_client_access_tier",
  "revoke_client_access",
  // Phase 4 batch 3 — super admin / Path C. Same rules: caller-scoped
  // (auth.uid()), aal2-guarded, EXECUTE revoked from PUBLIC/anon.
  "assert_super_admin",
  "assert_advisor",
  "admin_list_advisors",
  "admin_advisor_user_ids",
  "admin_set_super_admin",
  "admin_grant_advisor",
  "admin_remove_advisor",
  "organisation_members",
  "admin_firm_members",
  "plan_level_usage_count",
  // Phase 4 batch 5 — the caller's own roles, memberships and viewer grants,
  // and support-access state. Caller-scoped (auth.uid()), aal2-guarded,
  // EXECUTE revoked from PUBLIC/anon.
  "my_roles",
  "my_firm_memberships",
  "my_client_access",
  "firm_support_grants",
  "firm_support_viewer_state",
] as const;



/**
 * Thin TypeScript wrappers that do nothing but call one of the functions
 * above. Counted as a database authorisation call by the guard.
 */
export const REGISTERED_DB_AUTH_WRAPPERS = [
  "assertWidgetAccess",
  "getEffectiveTier",
  "assertTenantBelongsToClient",
  "assertClientDataAccessForClient",
  "assertClientDataAccessForFirm",
  "assertClientWriteAccess",
  "assertFirmWriteAccess",
  "assertClientWidget",
  "assertFirmWidget",
  "canWriteClient",
  "canWriteFirm",
  "canAccessClient",
  "platformStaffCanAccessFirm",
  "userCanManageClient",
  // Batch 3 — the single super-admin and advisor checks.
  "assertSuperAdminDb",
  "meIsSuperAdmin",
  "assertAdvisor",
] as const;



/** Batch 1 — the Xero read gate and everything that authorised through it. */
export const CONVERTED_FILES: string[] = [
  "src/lib/xero/access.server.ts",
  "src/lib/tenant-ownership.server.ts",
  "src/lib/widget-access.server.ts",
  "src/lib/xero/scenario.functions.ts",
  "src/lib/xero/consolidated.functions.ts",
  "src/lib/xero/recon-snapshot.server.ts",
  "src/lib/xero/audit.functions.ts",
  "src/lib/xero/receivables.functions.ts",
  "src/lib/xero/payables.functions.ts",
  "src/lib/xero/reports.functions.ts",
  "src/lib/xero/cashflow.functions.ts",
  "src/lib/xero/org-basis.functions.ts",
  "src/lib/xero/file-capability.functions.ts",
  "src/lib/xero/snapshot-compare.functions.ts",
  "src/lib/xero/snapshot-refresh.functions.ts",
  "src/lib/xero/accounts.functions.ts",
  "src/lib/cost-classification.functions.ts",
  "src/lib/statutory-accounts.functions.ts",

  // Batch 2 — client data reads and writes.
  //
  // `src/lib/xero/client-orgs.server.ts`, `src/lib/xero/onboard.server.ts` and
  // `src/lib/xero/connections.functions.ts` had their access decisions moved to
  // the database in this batch too, but they are not listed here: the first
  // service-role use in each is a module-level import or the unauthenticated
  // "Sign in with Xero" flow, which the file-ordering guard cannot express.
  // They stay in the admin-client register instead.
  "src/lib/clients.functions.ts",
  "src/lib/loan-consolidation.functions.ts",
  "src/lib/consolidation-groups.functions.ts",
  "src/lib/loan-autosetup.server.ts",
  "src/lib/loan-recon.server.ts",
  "src/lib/loan-mismatch.server.ts",

  // Batch 3 — super admin / Path C (platform metadata only).
  //
  // `src/lib/invites.functions.ts` is not listed: after the super-admin check
  // it provisions a new organisation with the service role, and the same file
  // also holds the pre-session invite acceptance, which is system context.
  // It stays in the admin-client register instead.
  "src/lib/admin.functions.ts",
  "src/lib/advisors.functions.ts",
  "src/lib/firms.functions.ts",
  "src/lib/security.functions.ts",
  "src/lib/plan-levels.functions.ts",
  "src/lib/tier-config.functions.ts",
  "src/lib/ownership.functions.ts",
  "src/lib/xero/orphan-connections.functions.ts",
  "src/lib/xero-assessment.functions.ts",
  "src/lib/audit.functions.ts",

  // Batch 4 — reports, email and branding.
  //
  // Not listed, and left in the admin-client register instead, because their
  // first service-role use is a system context the file-ordering guard cannot
  // express: `src/lib/reports/report-delivery.server.ts` (recipient token flow
  // for people with no account), `src/lib/email/send.server.ts` (queue),
  // `src/lib/reports/monthly-report.server.ts` and
  // `src/lib/reports/report-verdict.server.ts` (called only from the report
  // builder, after resolveReportContext has authorised the caller).
  "src/lib/branding.server.ts",
  "src/lib/reports/report-pdf.server.ts",
  "src/lib/reports/monthly-report-context.server.ts",
];


