# Fix reconnect isolation and orphaned Xero connections

## Scope

TypeScript and UI only. No tables, columns, migrations, RLS policies, grants, triggers, or database functions will be created or changed.

## 1. Make reconnect strictly single-tenant

- Keep recording the requested reconnect tenant in the existing `xero_oauth_states.pending_tenant_ids` field.
- Update the callback state query/type to read that field.
- Move reconnect handling ahead of the generic connection upsert, so reconnect never creates rows for every tenant Xero returns.
- Require exactly one requested tenant from the state, find only that tenant in Xero’s returned list, confirm it is already linked to the intended organisation through `public.xero_tenant_already_linked`, and refresh every matching connection row used by that organisation.
- Ignore every other returned tenant completely: no upsert, no plan check, no picker state, and no client link.
- If the requested tenant is absent or no longer linked to the intended organisation, delete the OAuth state and return a clear retry error.
- On success, invalidate the missing-scope cache, delete the state, and redirect directly to settings with `xero=reconnected`; update the confirmation copy to “Xero reconnected — permissions updated.”

## 2. Stamp new connect/onboard rows to the intended organisation

- For normal `connect` and `onboard` flows, resolve the intended internal `firm_id` from the OAuth state or initiating client.
- Use `known_tenant_ids` to distinguish rows newly introduced by this authorisation from existing connection rows.
- Stamp newly created connection rows with the intended organisation at upsert time, while preserving the organisation stamp on existing rows and never moving a row already belonging elsewhere.
- Keep the existing picker/creation flow and database-enforced plan limits for genuinely new files.

## 3. Remove the zero-capacity picker state

- Change the client Xero options response to include the organisation plan tier plus `xero_org_limit` and `xero_files_used` from `public.firm_plan_limits(_firm_id)`.
- Use that one response for both the “used of allowed” plan text and picker capacity.
- When usage is at or above the limit, do not render checkboxes or “select up to 0”. Show the current plan, “N of N Xero files linked”, and an upgrade message instead.
- Keep server-side linking protected by the existing database limit trigger; do not weaken limits or trust the UI count.
- Apply the same zero-capacity presentation to the organisation onboarding picker so it cannot expose an unusable selection list.

## 4. Add super-admin orphan management

- Add a dedicated super-admin section on the existing Admin page for Xero connections where `firm_id IS NULL` and no `client_xero_orgs` row exists.
- Return metadata only (connection id, Xero organisation name, status, authorising user label/date) and the organisation list; never return encrypted tokens to the browser.
- Provide two explicit actions:
  - **Assign to organisation**: stamp `firm_id` only after rechecking that the row is still unstamped and unlinked. This does not create a client link.
  - **Disconnect**: confirm first, revoke Xero access best-effort, then remove only that orphan row.
- Restrict both functions to a server-verified `super_admin` role and write security audit events for assignment/disconnection.
- Do not auto-assign or auto-delete the existing Hay Officesmart Newsagency row.

## Technical files

- `src/routes/api/public/xero/callback.ts`
- `src/lib/xero/connections.functions.ts`
- `src/routes/_authenticated/clients.$clientId.settings.tsx`
- `src/components/admin/XeroOnboardPickerDialog.tsx`
- New thin server-function/server-helper modules for orphan connection administration
- New focused admin component, mounted from `src/routes/_authenticated/admin.index.tsx`

## Verification

- Reconnect a linked 1-of-1 Xero file while the Xero login has several authorised organisations: return directly to client settings, show the updated-permissions confirmation, create/link nothing else, and show no picker.
- Simulate the requested tenant missing from Xero’s response: show the required authorisation error and do not update any connection.
- Confirm a full plan shows plan name and “1 of 1 linked” without rendering a picker.
- Confirm a genuinely new-file flow still uses the normal database-enforced limit.
- Confirm the orphan row appears only to super admins and can be assigned or disconnected only after explicit action.
- Run focused TypeScript/tests and browser checks on desktop and mobile.

## Access-control invariants

This touches section 0 items 1, 3, 4, 5, 7, and 8. They remain intact because organisation/client access is not granted by caller IDs or super-admin status; reconnect target and plan decisions are confirmed by existing database RPCs; tokens stay server-side; unrelated tenants are ignored; and all failure paths close without linking data.
