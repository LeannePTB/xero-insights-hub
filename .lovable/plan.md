# Navigation restructure — Step 3: Organisation workspace

**Classification: SECURITY-RELEVANT.** This step changes routing and which pages show which existing cards. One write rule (card defaults) is listed separately below for your decision. Every page keeps its current server checks. Support access stays read-only, and client viewers never get the organisation menu.

## 1. Pages and menu

```text
Organisation menu
  Overview            /overview                         (unchanged)
  Clients             /firms/:firmId                    client list + Add from Xero, New client, limit usage
  Xero files          /firms/:firmId/xero-files         FirmXeroFilesCard (new page)
  Consolidations      /firms/:firmId/consolidations
    Groups            /firms/:firmId/consolidations
    Loan matrix       /firms/:firmId/loans
    Loan accounts     /firms/:firmId/loans/accounts
  People & access     /firms/:firmId/people             PeopleSection (real page, no longer a redirect)
  Settings            /firms/:firmId/settings           -> redirects to General
    General           /firms/:firmId/settings/general   organisation name (read-only, see below) + report logo
    Card defaults     /firms/:firmId/settings/cards     OrgCardDefaultsCard
    Subscription      /firms/:firmId/settings/subscription  OrgPurchaseCard, view mode
    Ownership         /firms/:firmId/settings/ownership TransferOwnershipCard
    Support access    /firms/:firmId/settings/support   SupportAccessCard (organisation side)
```

### What "Groups" means
Today there are two group screens: `/consolidations`, which holds company consolidation groups, and `/loans/groups`, which holds loan consolidation groups.
- Under Consolidations, "Groups" points to `/consolidations`.
- The loans tab bar is removed. `/loans/groups` gets its own menu item, "Loan groups", so no screen is lost.

### General settings
- **Report logo:** reuses `LogoUploadCard` with the existing upload and remove organisation logo functions. These already check the person is an organisation writer and work on every plan, so nothing changes here.
- **Organisation name:** shown read-only. Today only a super admin can rename an organisation (`adminRenameFirm`). Letting owners rename it would be a new write path, so it is **not** in this step (see the decisions section).

### Subscription
- `OrgPurchaseCard` already lets only super admins edit (`canEdit = isSuperAdmin`). For everyone else it shows what the organisation has bought, with no editor.
- There is no self-service upgrade or checkout yet, because onboarding is still request-only. So "Upgrade" is a **Contact us to change your plan** link. It does not open a checkout.

## 2. System organisation page slimmed down
`/system/organisations/:firmId` keeps:
- the business name, which super admins can still rename;
- `OrgPurchaseCard` (the editor);
- `BillingLifecycleCard`;
- the members section with support tools (reset password, set password, change email, invite);
- View As;
- support-access status and join;
- the audit log;
- `FirmXeroFilesCard` in its plain style, showing Xero file details only.

It loses `FirmClientsSection` and `OrgCardDefaultsCard`. Clients and card defaults move to the organisation's own pages.

## 3. Card defaults — the write rule (for your approval)

**Current rule, checked against the live database today:**
- `set_org_card_defaults` and `apply_org_card_defaults` run `assert_aal2()` and then `app_private.assert_firm_member_write(_firm_id)`. That allows the **owner, or any active member (owner or staff)**.
- The cards are filtered to `known_cards()`, meaning *any* card in the catalogue, **not** only cards the organisation has bought.
- Reading uses `org_card_defaults()` with `has_firm_access`, which means active members.
- The table has no direct write grants. Its only policies are the read policy and the restrictive aal2 guard.

**So owners and staff can already write card defaults.** Nothing needs loosening.

**Proposed change (optional, and it tightens the rule).** I would like your approval for one migration:
- Change `set_org_card_defaults` so it also drops any card the organisation isn't entitled to. That means cards it has bought or is trialling, using the existing `firm_allowed_widgets` predicate.
- The card list on screen would use the same entitlement, so nothing unavailable is offered.
- No other part of either function changes: same guards, same audit row, same grants.
- **Effect on existing data:** if any organisation's saved defaults already include a card it hasn't bought, those stay until the next save. I won't rewrite saved data in the migration.

**"Super admins can still edit through support access": this conflicts with security rule 5 (support grants are read-only).**
- Under the current rules a super admin can change card defaults only as an active member of that organisation (path A). A support grant can't make the change.
- I will not add a support write path. Do you want to amend the rules?

## 4. Payables / Receivables in the client menu
- Each client's Xero files come from the existing `getClient` server function (`client_xero_orgs` → Xero file id and name). This adds no new data path.
- **Proposal:** a "Payables" item and a "Receivables" item in the client menu.
  - **One Xero file:** the item links straight to that file's page.
  - **Several Xero files:** each item becomes a parent with one sub-item per file, named after the file.
  - **No Xero files:** the items are hidden.
- The pages themselves (`/clients/:clientId/payables/:tenantId` and `.../receivables/:tenantId`) are unchanged and keep their own checks.

## 5. Duplicates removed and redirects
- **Organisation page:** remove the "All organisations" back link and the "Company Consolidations" and "Organisation Settings" buttons.
- **Old Settings page:** the long scroll is split up. This removes the "Back to organisations" link, the "View audit log (Super Admin)" link, and the duplicate copies of `OrgPurchaseCard`, `FirmXeroFilesCard`, `PeopleSection` and the add-client actions.
- **Loans pages:** the loans layout loses its tab bar and "Back to organisation" button, and becomes a plain outlet.
- **Consolidations pages:** `/consolidations` and `/consolidated/:groupId` drop their "Back to organisation" buttons. On `/consolidated/:groupId` the button becomes a small "All groups" link, because the menu has no entry for a single group.
- **Redirects:**
  - `/firms/:firmId/settings` goes to `/settings/general`.
  - Old `#people` links go to `/firms/:firmId/people`.
  - No other URLs are removed.

## Files
- **Create:**
  - `src/routes/_authenticated/firms.$firmId.xero-files.tsx`
  - `firms.$firmId.settings.index.tsx` (the redirect)
  - `firms.$firmId.settings.general.tsx`
  - `firms.$firmId.settings.cards.tsx`
  - `firms.$firmId.settings.subscription.tsx`
  - `firms.$firmId.settings.ownership.tsx`
  - `firms.$firmId.settings.support.tsx`
  - `src/components/firm/FirmPageHeader.tsx`, a shared title block
- **Change:**
  - `firms.$firmId.settings.tsx` becomes the `<Outlet />` layout.
  - `firms.$firmId.people.tsx` becomes a real page.
  - `firms.$firmId.index.tsx` gets the add-client actions and loses the buttons and back link.
  - `firms.$firmId.loans.tsx` loses its tabs.
  - `firms.$firmId.consolidations.tsx` and `firms.$firmId.consolidated.$groupId.tsx` lose their back buttons.
  - `system.organisations.$firmId.tsx` loses the clients and card-defaults sections.
  - `OrgPurchaseCard.tsx` gets a "Contact us to change your plan" line for people who can't edit.
  - `src/lib/nav/sidebar-nav.ts` gets the new items, Settings sub-items, and Payables/Receivables built per file.
  - `AppSidebar.tsx` gets per-client file sub-items.
  - `sidebar-nav.test.ts` gets tests for the new items and the file sub-items.
- **Delete:** nothing. Every component is still used somewhere.

## Database or policy changes
- **None for steps 1, 2, 4 and 5.**
- **Only with your approval:** the card-defaults entitlement filter in section 3. It is one migration, a body-only change to `set_org_card_defaults`. Grants are unchanged.

## Conflicts and findings in the security docs
1. **Rule 5:** a super admin editing card defaults through a support grant would be a support write. Not planned unless you amend the rules.
2. **Organisation rename by owners:** this would be a new write path, so it needs your approval. It would be one aal2, caller-scoped, audited database function, using the same check as card defaults.
3. **Invariant 6 finding, to go in the backlog and not fixed here:** `branding.server.ts` checks organisation writers in TypeScript (`assertOrganisationStaff`/`assertOrganisationWriter`). I'll check whether these look up `firm_members` directly. If they do, that's a defect, and I'll log it in the backlog.
4. **Path C:** the system organisation page keeps the Xero file list, which is file metadata, but drops the client list. If you want super admins to keep a client-name count there, that is metadata only and allowed.

## Verification
- `bun run security:check` with the known-failure list unchanged, plus `tsgo`, the build log and the linter.
- Nav tests, and a check that each old URL redirects.
- A backlog update and a security report.
- You click through the organisation pages yourself, because the test account's second-factor step blocks me from signing in.

## Decisions needed
1. Approve the card-defaults entitlement filter? (yes / no)
2. Keep organisation rename super-admin-only for now, or add an owner rename function?
3. Super-admin edits through support access: drop that idea, or amend the rules?
