## What's wrong today

The "redacted view" badge on the Super-admin pages is just a label — there's no enforcement that financial data stays out of reach for people who aren't part of that company's subscription. Two specific holes:

1. **Global advisor bypass.** Every Xero report server function (P&L, Tax, Payables, Break-even, etc.) gates access through `assertWidgetAccess` → `getEffectiveTier` in `src/lib/xero/access.server.ts`. That function says: *if the user has the `advisor` role anywhere in the system, grant access to any tenant*. So any advisor (including super-admins, who are typically also advisors) can pull any firm's financial data by knowing its `tenantId`.

2. **Super-admin can grant themselves into any firm.** `app_private.user_can_manage_client` returns true for super-admins, so a super-admin can insert a `client_access` row pointing at themselves and then read that client's books. Even if they don't, the policy means the boundary isn't real — it's procedural.

The user's rule: **only people invited into a company's subscription (firm membership) or explicitly granted client access may see that company's financials.** Super-admin status alone is not enough.

## Proposed enforcement model

One rule, applied everywhere a financial read happens:

> A user may view tenant `T`'s data **only if** they are a member of the firm that owns the client linked to `T`, OR they hold a `client_access` row for that client. The global `advisor` role and the `super_admin` role grant **no** financial-data access on their own.

Super-admins keep what they have today on the admin pages: firm name, tier, subscription status, member emails, billing events, audit log, error counts — no Xero org names, balances, transactions, P&L, BAS, or break-even numbers.

## Changes

### 1. Rewrite the access check (single source of truth)

`src/lib/xero/access.server.ts` — replace the "isAdvisor → allow" branch in `getEffectiveTier` with a strict check:

- Resolve `clientId` and `firmId` for the tenant via `client_xero_orgs → clients`.
- Allow if `firm_members` has a row for `(userId, firmId)` — any role (owner/member).
- Otherwise allow if `client_access` has a row for `(userId, clientId)` — use its `tier` for widget gating.
- Otherwise deny. No advisor bypass, no super_admin bypass.

`assertWidgetAccess` keeps its widget-list gate for `client_access` viewers; firm members get the full widget set for their tier.

### 2. Close the super-admin RLS hole

Migration to update `app_private.user_can_manage_client` so it no longer short-circuits on `is_super_admin`. Only firm owners can manage `client_access` for their firm's clients. (Super-admin keeps managing firms, members, subscriptions via the existing `supabaseAdmin`-backed server functions, which already log to `audit_log`.)

### 3. Make the admin pages match the promise

Audit `listFirmsAdmin`, `getFirmDetailAdmin`, `getFirmAuditAdmin` in `src/lib/admin.functions.ts` and confirm none of them select Xero org names, tenant IDs, balances, report cache rows, unreconciled lines, or client display names. Anything that leaks gets dropped from the SELECT. The "redacted view" badge stays and the existing helper text on `/admin` ("Organisation name, tier, usage, billing and error counts only…") becomes a guarantee, not a claim.

### 4. Tighten the badge copy

Replace `redacted view` with `no client data` on `/admin` and `/admin/firms/$firmId` so the meaning is explicit.

## Out of scope

- No UI changes to dashboards, settings, or invite flows.
- No change to how firm owners invite members or grant client access — those flows already encode the new rule.
- Email/notifications unchanged.

## Technical notes

Files touched:
- `src/lib/xero/access.server.ts` — rewrite `getEffectiveTier`.
- `src/lib/admin.functions.ts` — audit selects; remove any client/Xero columns if present.
- `src/routes/_authenticated/admin.index.tsx`, `admin.firms.$firmId.tsx` — badge text only.
- One migration: redefine `app_private.user_can_manage_client` without the super-admin branch.

Risk: any existing advisor account that today relies on the global bypass will lose access until a firm owner adds them to `firm_members` or grants `client_access`. The two known advisors (`admin@positivetraction.com.au`, `allyce@positivetraction.com.au`) should be added to the relevant firms as part of rollout — I'll list what they currently see and what membership rows need to exist before flipping the switch, so nothing breaks for you.