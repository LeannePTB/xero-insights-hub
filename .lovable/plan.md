# People section: member and viewer invites in one place

**Security classification: SECURITY-RELEVANT.** Touches invites, `access_invites`, `client_access`,
ownership (`firms.owner_user_id`) and SECURITY DEFINER functions.

## Step 1 — where people are added today (verified 11 Sep 2026)

| What | Route | Component | Server function |
| --- | --- | --- | --- |
| Organisation member invite (`access_invites`) | `/admin/firms/$firmId` | `InviteMemberDialog` in `admin.firms.$firmId.tsx` | `adminInviteFirmMember` (super admin only) |
| New organisation + owner (creates `firms`, `subscriptions`, owner member/invite) | `/admin` | `AddOrganisationDialog` | `adminCreateOrganisation`, `adminCreateFirmAndInvite` |
| Invite acceptance (creates the login, member row, may set owner) | `/signup/$token` | `signup.$token.tsx` | `getInvitePublic`, `acceptInvite` (pre-session, system context) |
| Client viewer (`client_access`) | `/clients/$clientId/settings` | inline section | `listClientAccess`, `inviteClientViewer`, `createClientViewerWithPassword`, `updateClientAccessTier`, `revokeClientAccess` |
| Advisor / super-admin grants (`user_roles`) | `/settings/advisors` | `settings.advisors.tsx` | `listAdvisors`, `inviteAdvisor`, `createAdvisorWithPassword`, `setAdvisorSuperAdmin`, `revokeAdvisor` |
| Ownership handover between existing members | `/firms/$firmId/settings` | `TransferOwnershipCard` | `listOrganisationMembers`, `transferOrganisationOwnership` |

Corrections to the assumptions: there is **no** existing screen listing pending member invites, and no
way to revoke one — that is new. Advisor/super-admin grants are platform-wide, not per organisation,
so they stay on `/settings/advisors` and are only linked from the new section.

## Step 2 — one People section

New route `/firms/$firmId/people` (not the settings page: settings already carries plan, billing,
support access, ownership, Xero files and default cards). Linked from the organisation page and
settings.

- **Team member** — someone from the advisory team; sees every client in this organisation and their
  Xero data. Role owner or staff. Shows active members (role + status) and pending invites with a
  revoke action.
- **Client viewer** — the business owner or their staff; sees one client's dashboard only, at the
  tier chosen. Requires a client and a tier. Grouped by client with a remove action.
- Emails always come from the database functions that read `auth.users`
  (`organisation_members`, `client_viewers`, new `firm_member_invites`).
- Inviting stays **super admin only** — the forms are hidden otherwise and the server/database
  checks are unchanged. The client-screen viewer control stays and calls the same server functions.

## Step 3 — security fix

`acceptInvite` set `firms.owner_user_id` for any `owner` invite, bypassing
`transfer_organisation_ownership` (Spec §4).

- `adminInviteFirmMember` refuses `owner` for an existing organisation, pointing to ownership transfer.
- `acceptInvite` sets `owner_user_id` only while it is null; otherwise it joins as staff-equivalent
  and refuses to change ownership.
- Ownership set on first acceptance writes an audit row.

## Database (one migration)

- `public.firm_member_invites(_firm_id)` — aal2 + super admin, pending invites with verified email.
- `public.revoke_firm_member_invite(_id)` — aal2 + super admin, deletes the pending invite and writes
  an audit row.
Both `SECURITY DEFINER`, `SET search_path`, EXECUTE revoked from `PUBLIC`/`anon`.

## Verification

`bun run security:check` before/after with fingerprint, `bunx tsgo --noEmit`, linter class unchanged,
new matrix rows for the two ownership rules, then the Security report.

No permission is widened; if the section required that, stop instead.
