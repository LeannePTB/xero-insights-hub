# Admin client register (`supabaseAdmin`)

Project Knowledge rule 7: `supabaseAdmin` bypasses RLS and is for **system contexts only** —
OAuth callbacks, webhooks, cron, the email queue, audit/telemetry writes and token storage.
Any other use must call a **database** authorisation function for the caller first and be listed
here with a reason. An unlisted use is a defect and fails `tests/static-guards.test.ts`.

Built 11 Sep 2026 by reading each call path — not by labelling it. Where a handler's gate is a
hand-rolled TypeScript check against `user_roles` / `firm_members` / `client_access` /
`client_xero_orgs` instead of a database authorisation function, that is a **rule 7 KNOWN FAILURE**
and is recorded as such. It is reported on every run and never counted as a pass. Phase 4 fixes them;
Phase 2 only makes them visible.

**Verdicts**

| Verdict | Meaning |
| --- | --- |
| `system context` | OAuth callback, webhook, cron/scheduled, email queue, audit/telemetry write, token storage, rate limiting, or a pre-session token flow. No caller identity to authorise. |
| `exception — calls DB authorisation first` | User-initiated, but a database authorisation function (`user_can_access_firm`, `user_can_access_client`, `assert_client_write_access`, `client_entitlement`, or a helper that calls one) runs for the caller before the admin call. |
| `KNOWN FAILURE (backlog 21)` | User-initiated, gated only by a TypeScript re-implementation of the rule, or not gated at all. Rule 7 violation. |
| `KNOWN FAILURE (backlog 21, unverified)` | Uses `supabaseAdmin` on a path this audit could not trace end to end. Recorded fail-closed until individually verified. |

Two claims from the first pass were **checked and rejected**: `getAuditAnomalies` /
`exportAuditLogCsv` / `getRetentionStatus` do call `assertSuperAdmin` first, and `listLoginEvents`
does check the advisor role through `context.supabase`. They are still rule 7 known failures because
the check is TypeScript, but they are not open endpoints.

## Register

| File | Function | Verdict | Evidence / reason |
| --- | --- | --- | --- |
| `src/integrations/supabase/client.server.ts` | `supabaseAdmin` | `system context` | The client definition itself; generated, never edited. |
| `src/routes/api/public/xero/callback.ts` | route handler | `system context` | Xero OAuth redirect. The `xero_oauth_states` row is the credential; this is the trust boundary and stores rotated tokens. |
| `src/lib/audit.server.ts` | `writeAudit`, `logXeroRead` | `system context` | Append-only audit writes; `audit_log` takes no writes from a browser session. |
| `src/lib/rate-limit.server.ts` | rate-limit bucket writes | `system context` | Abuse control; must work before and without a session. |
| `src/lib/email/send.server.ts` | queue send/log | `system context` | Email queue processing and `email_send_log`. |
| `src/lib/xero/api.server.ts` | token read/refresh | `system context` | Xero token storage and rotation; refresh must survive an unauthenticated background path. |
| `src/lib/xero/first-link-refresh.server.ts` | first-link refresh | `system context` | Runs in the post-OAuth pipeline, not from a user request. |
| `src/lib/xero/scopes.server.ts` | `xeroRequiredScopes` | `system context` | Reads a fixed scope configuration; no organisation or client data. |
| `src/lib/audit.functions.ts` | `logAuthEvent`, `logFailedSignIn` | `system context` | Self-scoped auth logging before MFA; actor from the verified token, rate limited. See the aal1 allow-list. |
| `src/lib/login-log.functions.ts` | `logLogin` | `system context` | Self-scoped sign-in receipt; user/email from the token, ip/agent from headers. |
| `src/lib/invites.functions.ts` | `getInvitePublic`, `acceptInvite` | `system context` | Pre-session invite flow; the hashed single-use token is the credential. |
| `src/lib/reports/monthly-report.server.ts` | report build | `system context` | Batch/scheduled report generation; user-facing reads go through `getReportPdfUrl`. |
| `src/lib/reports/monthly-report-context.server.ts` | report context | `system context` | Same pipeline as above. |
| `src/lib/reports/report-delivery.server.ts` | link issue/open | `system context` | Recipient-bound token flow for people with no account. |
| `src/lib/reports/report-verdict.server.ts` | `loadMonthComment` | `system context` | Called only from the report builder above. |
| `src/lib/xero/snapshot-refresh.server.ts` | `refreshAllTenants` (scheduled) | `system context` | Cron snapshot refresh. The manual path is a known failure — next table. |
| `src/lib/unreconciled.functions.ts` | upload and line handlers | `exception — calls DB authorisation first` | `rpc("assert_client_write_access")` / `rpc("user_can_access_client")` before every admin call. |
| `src/lib/reports/report-pdf.server.ts` | `getReportPdfUrl` | `exception — calls DB authorisation first` | `assertClientDataAccessForClient` → `rpc("user_can_access_client")`; staff branch via `platformStaffCanAccessFirm` → `rpc("user_can_access_firm")`. |
| `src/lib/branding.server.ts` | logo get/set | `exception — calls DB authorisation first` | `platformStaffCanAccessFirm` / `assertClientDataAccessForClient`, both RPC-backed. |
| `src/lib/support-access.server.ts` | `platformStaffCanAccessFirm`, `canAccessClient` | `exception — calls DB authorisation first` | These *are* the RPC-backed helpers (`user_can_access_firm`, `user_can_access_client`). |
| `src/lib/security-posture.functions.ts` | posture and presence reads | `exception — calls DB authorisation first` | Reads through `context.supabase` RPCs (`security_posture`, `online_users`), both guarded by `assert_aal2` + `me_is_super_admin`. |
| `src/lib/audit.functions.ts` | `getAuditAnomalies`, `exportAuditLogCsv`, `getRetentionStatus` | `KNOWN FAILURE (backlog 21)` | Verified: `assertSuperAdmin(context.supabase, userId)` runs first, but it is a raw `user_roles` select in TypeScript, not a database authorisation function. |
| `src/lib/login-log.functions.ts` | `listLoginEvents` | `KNOWN FAILURE (backlog 21)` | Verified: advisor role checked via `context.supabase`, then `supabaseAdmin` joins `profiles`. TypeScript gate. |
| `src/lib/access.functions.ts` | `computeFirmAccess`, `getMyFirmAccess` | `KNOWN FAILURE (backlog 21)` | Self-scoped raw `firm_members` read; not the sanctioned RPC. |
| `src/lib/admin.functions.ts` | all admin console handlers | `KNOWN FAILURE (backlog 21)` | Local `assertSuperAdmin` copy (raw `user_roles`). |
| `src/lib/advisors.functions.ts` | advisor management handlers | `KNOWN FAILURE (backlog 21)` | Same local role-check pattern. `changeMyPassword` is self-scoped. |
| `src/lib/firms.functions.ts` | organisation admin handlers | `KNOWN FAILURE (backlog 21)` | Local `assertSuperAdmin` copy. |
| `src/lib/invites.functions.ts` | `adminCreateOrganisation`, `adminCreateFirmAndInvite`, `adminInviteFirmMember` | `KNOWN FAILURE (backlog 21)` | Local `assertSuperAdmin` copy. |
| `src/lib/security.functions.ts` | `getSecurityPosture`, `purgeOldAuditLog`, `resetUserMfa`, `getSecurityContact`, `saveSecurityContact` | `KNOWN FAILURE (backlog 21)` | Local `assertSuperAdmin` copy gating MFA reset and audit purge. |
| `src/lib/billing.functions.ts` | comp/trial/tier handlers | `KNOWN FAILURE (backlog 21)` | Local `assertSuperAdmin` copy. |
| `src/lib/clients.functions.ts` | `listClients`, `createClient`, `deleteClient` (pre-RPC reads), `setClientXeroAllowance`, `detachXeroOrg`, `listClientAccess`, `updateClientAccessTier`, `inviteClientViewer`, `createClientViewerWithPassword` | `KNOWN FAILURE (backlog 21)` | Raw `firm_members`/`user_roles` gates before admin writes. `getClient` is the exception in this file (RPC-backed). `setClientXeroAllowance` also carries the owner-approved invariant-3 exception recorded in the backlog. |
| `src/lib/consolidation-groups.functions.ts` | group list/save/delete/get | `KNOWN FAILURE (backlog 21)` | Ordinary-member branch is a raw `firm_members` read; the super-admin branch is RPC-backed. |
| `src/lib/loan-consolidation.functions.ts` | all loan handlers | `KNOWN FAILURE (backlog 21)` | Gated by `canManageClient`/`canReadClient`, raw reads of `client_access`/`firm_members`/`user_roles`. |
| `src/lib/loan-autosetup.server.ts` | auto-setup | `KNOWN FAILURE (backlog 21)` | Inherits the gate above. |
| `src/lib/loan-recon.server.ts` | `runLoanReconciliation` | `KNOWN FAILURE (backlog 21)` | Inherits the gate above. |
| `src/lib/loan-mismatch.server.ts` | `runLoanMismatchDetail` | `KNOWN FAILURE (backlog 21)` | Inherits the gate above. |
| `src/lib/widget-access.server.ts` | `clientCanUseWidget`, `firmCanUseWidget` | `KNOWN FAILURE (backlog 21)` | Entitlement read re-implemented over raw tables instead of `client_entitlement`. |
| `src/lib/xero/access.server.ts` | `assertWidgetAccess`, `getEffectiveTier` | `KNOWN FAILURE (backlog 21)` | The main dashboard gate, entirely TypeScript over `user_roles`/`firm_members`/`client_access`/`client_xero_orgs`. Every caller inherits this. |
| `src/lib/xero/client-orgs.server.ts` | `userCanManageClient`, `getClientFirmId`, `isSuperAdmin` | `KNOWN FAILURE (backlog 21)` | Raw membership/role reads used as the authorisation gate. |
| `src/lib/xero/onboard.server.ts` | `assertFirmCanAddClient`, `createClientsFromTenants` | `KNOWN FAILURE (backlog 21)` | Raw `firm_members` gate before client creation. Plan limits themselves are database triggers and are not re-implemented. |
| `src/lib/xero/connections.functions.ts` | list/start/link/disconnect/create handlers and the pre-RPC reads in `moveXeroFileToClient` | `KNOWN FAILURE (backlog 21)` | Session/oauth-state ownership only. The mutation itself goes through `rpc("move_xero_file_to_client")`. |
| `src/lib/xero/consolidated.functions.ts` | `getConsolidatedReceivables`, `getConsolidatedPayables` | `KNOWN FAILURE (backlog 21)` | Raw `firm_members` gate. |
| `src/lib/xero/scenario.functions.ts` | `getScenarioData`, `setInvoiceExcluded`, `setInvoicesExcludedBulk`, `resetScenario` | `KNOWN FAILURE (backlog 21)` | `assertWidgetAccess` / raw `client_access` gate. |
| `src/lib/xero/search.functions.ts` | `canSearchOrganisationTransactions`, `searchClientTransactions` | `KNOWN FAILURE (backlog 21)` | Raw `xero_connections`/`client_access` reads. |
| `src/lib/xero/orphan-connections.functions.ts` | orphan list/assign/disconnect | `KNOWN FAILURE (backlog 21)` | Local `assertSuperAdmin` copy. |
| `src/lib/xero/recon-snapshot.server.ts` | `runReconciliation` | `KNOWN FAILURE (backlog 21)` | Raw `firm_members` gate. |
| `src/lib/xero/snapshot-refresh.server.ts` | `refreshTenant` (manual) | `KNOWN FAILURE (backlog 21)` | Manual path gated by `assertWidgetAccess`. |
| `src/lib/xero/snapshot-read.server.ts` | snapshot reads | `KNOWN FAILURE (backlog 21)` | Documented as relying on the caller's `assertWidgetAccess`. |
| `src/lib/tenant-ownership.server.ts` | `assertTenantBelongsToClient` | `KNOWN FAILURE (backlog 21)` | A consistency check, not a caller-authorisation check; callers rely on it as though it were one. |
| `src/lib/plan-tiers.server.ts` | `assertTierInPlanForClient` | `KNOWN FAILURE (backlog 21)` | Also carries the open owner decision recorded in the backlog (super admin setting a tier outside the plan). |
| `src/lib/plan-levels.functions.ts` | plan catalogue admin handlers | `KNOWN FAILURE (backlog 21, unverified)` | Uses `supabaseAdmin`; gate not traced end to end in this pass. |
| `src/lib/tier-config.functions.ts` | tier/widget configuration handlers | `KNOWN FAILURE (backlog 21, unverified)` | Same. |
| `src/lib/ownership.functions.ts` | member list, ownership transfer | `KNOWN FAILURE (backlog 21, unverified)` | The transfer itself goes through `transfer_organisation_ownership`; the surrounding admin reads were not traced. |
| `src/lib/firm-subscription.functions.ts` | subscription handlers | `KNOWN FAILURE (backlog 21, unverified)` | `resolveAccess` claims to delegate to the database; not confirmed line by line. |
| `src/lib/subscription-state.server.ts` | subscription state reads | `KNOWN FAILURE (backlog 21, unverified)` | Not traced. |
| `src/lib/support-access.functions.ts` | grant read helper | `KNOWN FAILURE (backlog 21, unverified)` | Mutations use `context.supabase`; the grant-state read at the file helper was not traced. |
| `src/lib/health.functions.ts` | health/verdict handlers | `KNOWN FAILURE (backlog 21, unverified)` | Multiple branches; not traced. |
| `src/lib/xero/audit.functions.ts` | Xero audit reads | `KNOWN FAILURE (backlog 21, unverified)` | Not traced. |
| `src/lib/xero/authorised-tenants.server.ts` | `reconcileAuthorisedTenants` | `KNOWN FAILURE (backlog 21, unverified)` | Called from both onboarding and reconciliation; caller not traced. |
| `src/lib/xero/authorisation-freshness.server.ts` | freshness check | `KNOWN FAILURE (backlog 21, unverified)` | Not traced. |
| `src/lib/xero/scope-status.functions.ts` | scope status | `KNOWN FAILURE (backlog 21, unverified)` | States it uses the caller's session; the `supabaseAdmin` reference in the file was not traced. |

## The test-runner's own path

`bun run security:check` signs in the dedicated `security-runner` test account (super admin, no
membership, TOTP secret held only in project secrets), reaches aal2, and calls
`public.record_access_test_run(...)` through that session. It never uses `supabaseAdmin`, and it
writes only `security_test_runs`. The `/admin/security` button runs the same recording call as the
signed-in super admin who pressed it.
