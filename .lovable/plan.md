## Goal

Super-admins land on `/dashboard` and see one card per firm. Only their **own firm** (Positive Traction) is clickable and opens its client list. Other firm cards show **tier + connected client count only** — no client names, no drill-in.

Regular firm owners and viewers see no change.

## Behaviour

- `/dashboard` for a super-admin:
  - Grid of firm cards.
  - **Own firm card** (the firm the super-admin belongs to via `firm_members`): business name, tier, client count, clickable → `/firms/$firmId`.
  - **Other firm cards**: business name, tier, connected-client count. Not clickable. No links, no client names, no Xero org names.
- `/firms/$firmId` (new): only resolves for the super-admin's own firm. Shows that firm's clients in the same layout as today's `/dashboard`. "Add client" attributes to that firm.
- Non-super-admin advisors → unchanged.
- Viewers → unchanged.

## Technical changes

1. **`src/lib/firms.functions.ts`** (new) — `listFirmsForSuperAdmin`:
   - Asserts super-admin (`me_is_super_admin` RPC).
   - Returns `{ firms: { id, name, tier, clientCount, isOwn }[] }` using `supabaseAdmin` (loaded inside the handler) so it returns aggregate counts without exposing per-client rows.
   - Resolves "own firm" via `firm_members` for `context.userId`.
   - Joins `subscriptions.tier` per firm; counts `clients` per firm.

2. **`src/lib/clients.functions.ts`**:
   - `listClients` accepts optional `{ firmId?: string }`. When provided, validates the caller is a member of that firm (or owner of clients in it) — i.e. RLS already gates this, no extra check needed beyond passing `firm_id` to `.eq`.
   - `createClient` (in `clients.new.tsx` flow) accepts optional `firmId`; default = caller's own firm via `firm_members`. Rejects if caller is not a member of `firmId`.

3. **`src/routes/_authenticated/dashboard.tsx`**:
   - When `isSuperAdmin`, fetch firms via `listFirmsForSuperAdmin` and render firm cards instead of clients.
   - Own firm card: Building2 icon, name, tier badge, "N clients" → `<Link to="/firms/$firmId">`.
   - Other firm cards: same shape but rendered as a static `<div>` (no link), with a muted "read-only" badge so it's visually clear they don't open.
   - Non-super-admin branches unchanged.

4. **`src/routes/_authenticated/firms.$firmId.tsx`** (new): client grid scoped to `firmId`. Header shows firm name + "← All businesses" back link. Calls `listClients({ firmId })`. "Add client" link carries `?firmId=…`. If the user is not a member of the firm, the loader returns empty and the page redirects back to `/dashboard` (defence in depth — RLS is the real gate).

5. **`src/routes/_authenticated/clients.new.tsx`**: read optional `?firmId` from search params; pass to `createClient`.

## Out of scope

- No DB migration (firm_id already exists on clients; super-admin RLS already allows reads, which is exactly why we use a server fn that returns ONLY aggregate fields for other firms).
- No changes to `/admin` page (it already shows tier/status/usage and is fine as-is).
- No changes to viewer or single-firm-owner experience.

## Verification

- Sign in as super-admin → `/dashboard` shows firm cards. Only Positive Traction is clickable.
- Other firm cards display tier + client count only — no client names anywhere in DOM or network response.
- Click Positive Traction → `/firms/<id>` shows its clients. "Add client" creates under Positive Traction.
- Manually navigating to `/firms/<other-firm-id>` returns to `/dashboard` (server fn refuses).
- Regular firm owner → `/dashboard` unchanged.
- Viewer → unchanged.