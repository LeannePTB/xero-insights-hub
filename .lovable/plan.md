# Lock organisations apart, and restrict "view as"

I re-checked the access rules in the app and in the database. There is a real cross-over today: several checks treat "advisor" (and "firm owner") as a **platform-wide** badge instead of a badge inside one organisation. Because of that, a person carrying one of those badges in Positive Traction can reach DRTABT Projects data, even though they are not a member of it. There are 3 people with the advisor badge and 2 with the firm-owner badge today.

## What is wrong right now (verified)

1. **Advisor badge unlocks every organisation.** The database rule that decides "can this person manage this client" says yes for anyone with the advisor badge, no matter which organisation the client belongs to. It is used for client access grants, Xero file links, per-client card settings and loan accounts.
2. **Same shortcut in app code.** The client, Xero-linking, consolidation-group and loan-consolidation code paths each accept advisor / firm-owner as a global pass before ever checking membership.
3. **Loan consolidation snapshots have no organisation check at all** — the saved reconciliation snapshots are readable and writable by any signed-in user.
4. **Consolidation groups and loan accounts** carry the same "any advisor" escape hatch in their database rules.
5. **"View as" is open to anyone.** The preview links only appear for admins, but the underlying pages accept the preview setting from anyone who types it into the address bar. It is presentation-only (no data is unlocked by it), but it should still be refused for ordinary members.

## The fix

**One rule, applied everywhere:** you can reach an organisation only if you are a member of it. The single exception is the platform super admin. Advisor and firm-owner become *what you can do inside your own organisation*, never *which organisations you can see*.

- Rewrite the shared "can manage this client" database rule to require membership of that client's organisation (or being its owner), with super admin as the only override. Advisor status is then applied within the organisation, not across it.
- Remove the "any advisor" clause from the consolidation-group, group-member and loan-account rules, so they require membership of the group's organisation.
- Add proper organisation rules to loan-consolidation snapshots so only members of that group's organisation (or a super admin) can read or save them.
- Update the matching app-side checks (clients, Xero connections, consolidation groups, loan consolidation) so they resolve the organisation first and check membership against **that** organisation, instead of accepting a global role.
- Invited members: joining an organisation only creates membership in that one organisation, so once the above lands they can see nothing outside it. I'll also make the organisation list and the client list use *all* of a person's memberships rather than just their first one, so multi-organisation advisors behave predictably and single-organisation members stay boxed in.

**"View as":** allowed only for a super admin, or an advisor who is a member of that organisation. Anyone else asking for a preview simply gets the normal page. The banner stays as-is.

## After the change

- A member invited into an organisation sees that organisation, its clients, its Xero files, its groups and nothing else — in the app and directly against the database.
- Advisors keep everything they do today inside their own organisation(s).
- Super admins keep platform-wide management, with the existing "no client financial data" position unchanged.

## Technical notes

- Migration: redefine `app_private.user_can_manage_client` to drop the blanket `app_private.is_advisor` clause; drop and recreate the advisor-wide policies on `consolidation_groups`, `consolidation_group_members`, `loan_consolidation_accounts`; replace the two `loan_consolidation_snapshots` policies (currently `EXISTS (select 1 from consolidation_groups g where g.id = group_id)`, i.e. no check) with membership + super-admin rules. Grants stay as they are.
- App: `userCanManageClient` in `src/lib/xero/client-orgs.server.ts`; `MANAGE_ROLES` / `hasManageRole` / `canManageClient` / `resolveLoanGroup` in `src/lib/loan-consolidation.functions.ts`; `assertFirmAccess` in `src/lib/consolidation-groups.functions.ts`; the role short-circuits in `src/lib/clients.functions.ts` and `src/lib/xero/connections.functions.ts`.
- Membership breadth: `getMyContext` (`src/lib/roles.functions.ts`), `computeFirmAccess` (`src/lib/access.functions.ts`) and `listClients` currently take `limit(1)` on `firm_members`; switch to the full set.
- View-as gating: check context in `src/routes/_authenticated/firms.$firmId.index.tsx` and `clients.$clientId.index.tsx` before honouring the `viewAs` search param.
- Verification: re-run the security scan and linter, plus direct database queries impersonating a non-member to confirm zero rows cross organisations.
