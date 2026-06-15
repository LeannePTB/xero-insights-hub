## Problem

When a new business owner accepts an invite they:
1. See **Positive Traction's clients** on their dashboard (firm A's data leaking to firm B).
2. See top-right buttons for **Advisors, Tier widgets, Activity** which are firm-wide / super-admin tools.

Root cause: the previous fix granted the global `advisor` app role on invite acceptance. The `clients.advisors manage clients` RLS policy lets anyone with that role read/write **every** client across **every** firm. Granting it to a new firm owner gave them full cross-firm access.

## Fix

### 1. Tighten RLS so firm data stays in its firm

Drop the global "advisors manage clients" policy and replace with super-admin + firm-scoped policies. Same pattern on related tables that currently lean on `is_advisor(...)`:

- `public.clients`
- `public.client_xero_orgs`
- `public.client_access`
- `public.client_notes`
- `public.tier_widget_config`
- `public.unreconciled_uploads`, `public.unreconciled_lines`

For each: keep super-admin full access + firm-member read + firm-owner manage. No more "any advisor sees everything".

### 2. Stop auto-granting global `advisor` role on invite

In `src/lib/invites.functions.ts` remove the `user_roles` insert added in the prior turn. Access for firm owners/staff flows through `firm_members` + the new RLS policies — they don't need the global role.

Backfill: delete the `advisor` rows the prior migration inserted for users who are **not** super_admin (currently only `leanne@astrovisual.com.au`). Leave the existing PT super-admin/advisor rows alone.

### 3. Treat firm membership as the "advisor UX" flag

In `src/lib/roles.functions.ts` (`getMyContext`), set `isAdvisor = hasAdvisorRole || isFirmMember`, and also return the user's `firmId` (from `firm_members`). This keeps the dashboard rendering the clients view for new firm owners without granting cross-firm RLS.

### 4. Scope `listClients` to the caller's firm

In `src/lib/clients.functions.ts`, when no `firmId` is passed and the caller is not super-admin, auto-filter to the user's own `firm_id` (looked up via `firm_members`). Defense in depth on top of RLS.

### 5. Trim dashboard chrome for non-super-admins

In `src/routes/_authenticated/dashboard.tsx`, the "advisor" toolbar currently shows: Advisors, Tier widgets, Activity, My account, New client. For users who are firm owners but **not** super-admin, show only **My account** and **New client**. Super-admins (the Positive Traction team) keep the full set.

## Verification

- New business owner (leanne) refreshes `/dashboard` → sees only their own (empty) clients list, with just **My account** and **New client** buttons; no Positive Traction client visible.
- Positive Traction super-admin still sees the Businesses grid and full toolbar; opening PT's firm still lists PT clients.
- Invite a brand new business → owner accepts → lands on their own clients view, can add a client, cannot see other firms' data.
- Supabase linter passes for the touched tables.
