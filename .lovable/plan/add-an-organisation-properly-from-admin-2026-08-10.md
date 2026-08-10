# Add an organisation properly from Admin

Today the only way to add an organisation is "Invite organisation", which just emails a link and always creates a 7-day trial you then have to go and edit. And the "New client" card on the Admin hub is confusing — it creates a client subscription (a dashboard + Xero file) but doesn't ask which organisation it belongs to.

## What changes

### 1. "Add organisation" dialog (replaces "Invite organisation")

One dialog, filled in from top to bottom:

**Organisation**
- Organisation name (now required)

**Plan**
- Tier: Starter / Growth / Scale / Firm / Free / Legacy
- Status: Trialing / Active
- Trial end or next bill date (date picker, defaults sensibly from the status)
- "Always free" toggle

**Owner access** — a choice, per organisation:
- *Create their login now*: enter email + password (or generate one). The account works immediately; the credentials are shown once so you can pass them on.
- *Send an invite*: enter email only. Emails the invite and shows a backup link to copy, as it does today.

On save the organisation, its subscription and the owner are created in one go, and the new row appears in the Organisations table straight away.

### 2. Remove "New client" from Admin

Clients are always created inside an organisation, so the card is removed from the Admin hub. Adding a client stays where it makes sense: the organisation's client list ("Open clients" -> "New client"), where the organisation is already known. The `/clients/new` page itself stays and keeps working.

### 3. Small clarity fixes

- The Organisations table gets an "Add organisation" empty-state button so it's obvious where new orgs come from.
- Wording on the client pages says "client subscription" instead of bare "client" where it's ambiguous.

## Technical notes

- Extend `adminCreateFirmAndInvite` in `src/lib/invites.functions.ts` into `adminCreateOrganisation`, accepting `{ name, tier, status, periodEnd | trialEndsAt, isAlwaysFree, owner: { email, mode: 'password' | 'invite', password? } }`. Super-admin only; keeps writing the audit log entry.
  - `mode: 'password'` uses `supabaseAdmin.auth.admin.createUser` (email confirmed) and inserts the `firm_members` owner row + `user_roles` entry directly — same pattern as `createClientViewerWithPassword` in `src/lib/clients.functions.ts`.
  - `mode: 'invite'` keeps the current `access_invites` token + email path.
  - Subscription row is written with the chosen tier/status/dates instead of the hardcoded 7-day trial.
- Rewrite `InviteFirmOwnerDialog` in `src/routes/_authenticated/admin.index.tsx` as `AddOrganisationDialog` with the sections above; drop the `New client` entry from `AdminQuickLinks`.
- No schema changes needed — `firms`, `subscriptions`, `firm_members`, `user_roles` and `access_invites` already cover this.
