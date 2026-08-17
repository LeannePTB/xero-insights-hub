# Support access: no client data from Plan & members

Today a platform super admin (and any advisor) can open a client's dashboard from anywhere, including the admin **Plan & members** page — even though that page is labelled "no client data". This locks that down.

## The rule

Platform staff (super admins and advisors) can see an organisation's client financial data **only** when one of these is true:

1. They are an actual member of that organisation (a row in the organisation's Members list), or
2. The organisation's **owner** has switched on **Support access** for that organisation.

Access granted this way stays on **until the owner revokes it**.

When neither applies, all client financial data is blocked: dashboards, Business Health, cash flow, scenarios, audit, receivables/payables, unreconciled lines, loan consolidation figures and Xero reports. Names, plans, tiers, member lists and Xero file names stay visible so admin support still works.

## Plan & members page

- Client rows stop linking anywhere: no clickable client name, no chevron, no "Open", no "Settings".
- The only way through to a client is the **View as** menu, and each entry is disabled with a tooltip ("This organisation hasn't granted support access") until access is allowed.
- A small line in the header shows whether support access is currently on, who granted it and when.
- The organisation's own page (`/firms/$firmId`) is unchanged for real members of that organisation.

## Granting access (new)

A **Support access** card on the organisation page, visible to the organisation owner only:

- Toggle: "Allow Positive Traction support to view our client data".
- Shows current state, who turned it on and when, and a Revoke button.
- Every grant and revoke is written to the audit log and shows in the organisation's audit card.
- Super admins see the state read-only; they cannot grant it to themselves.

While a super admin is viewing a client under a grant (not as a member), the amber preview banner says so, so it is obvious the session is using support access.

## Technical notes

**Database**

- New table `public.firm_support_access`: `firm_id` (PK, references `firms`), `granted` boolean, `granted_by`, `granted_at`, `revoked_at`, `note`, timestamps. GRANTs for `authenticated` (select/insert/update) and `service_role`; RLS so only the firm's owner can read and write their row, and super admins can read.
- New helper `app_private.firm_support_access_active(_firm_id uuid)` and `app_private.platform_staff_can_access_firm(_user_id uuid, _firm_id uuid)` = firm membership OR active grant.
- `app_private.user_can_manage_client` changes: the unconditional `is_super_admin` bypass is replaced with `is_super_admin(_user_id) AND platform_staff_can_access_firm(...)`. Same treatment for the advisor path. Owner and firm-member paths are untouched.
- RLS on `xero_connections`, `client_xero_orgs`, `audit_runs`/`audit_findings`, `loan_consolidation_*` and `consolidation_groups` is re-checked against the new helper so the restriction can't be side-stepped through a related table.

**Server functions**

- `src/lib/xero/access.server.ts` `getEffectiveTier`: the early `super_admin → investigate` return becomes conditional on `platform_staff_can_access_firm`. This one change gates every widget/report server function that already calls the shared check.
- `src/lib/clients.functions.ts`, `loan-consolidation.functions.ts`, `consolidation-groups.functions.ts`, `health.functions.ts`, `unreconciled.functions.ts` and `audit`-related functions get the same check where they resolve access through `supabaseAdmin`.
- New `src/lib/support-access.functions.ts`: `getSupportAccess(firmId)`, `setSupportAccess({ firmId, granted, note })` (owner only, audit-logged) and `mySupportAccessFor(firmId)` for the UI to disable View As.

**UI**

- `src/components/admin/FirmClientsSection.tsx`: new `allowClientData` prop — when false, render client names as plain text, drop the chevron/Open/Settings items, and disable View As entries.
- `src/routes/_authenticated/admin.firms.$firmId.tsx`: passes `allowClientData={false}` and shows the support-access state.
- New `src/components/admin/SupportAccessCard.tsx` mounted on `src/routes/_authenticated/firms.$firmId.index.tsx` for the owner.
- `ViewAsBanner` gains a "using support access" note.

**Verification**

- As a super admin who is not a member and with no grant: Plan & members shows no clickable client data; opening a client URL directly returns "You don't have access to this organisation's data".
- Owner grants access → the same super admin can View As; revoking it blocks them again immediately.
- A firm member's own access is unchanged throughout.
