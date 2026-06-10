## What you'll get

1. **Login lands on a Clients grid** — one card per client you've set up. Click a card to open that client's dashboard.
2. **Each client can hold multiple Xero orgs**, all rendered together on that client's dashboard page.
3. **Client viewers** (read-only people you invite) log in and are taken straight to their own client's dashboard — they can't see other clients.
4. **Three dashboard tiers** control which widgets appear:
   - **Basic** — Revenue & Expenses KPIs, Tax Liabilities
   - **Advisory** — Basic + P&L, Breakeven
   - **Investigate the Numbers** — Advisory + Payables (everything)
5. **Per-user access screen** where you (the advisor) pick which client a viewer can see and which tier they get.

## Pages

```text
/dashboard                       Clients grid (advisor) — viewers redirected to their client
/clients/new                     Create a client (name + pick Xero orgs)
/clients/$clientId               Client dashboard — widgets filtered by tier
/clients/$clientId/settings      Advisor only: rename, attach/detach Xero orgs, manage viewers + tiers
```

## Roles & tiers

- `advisor` — sees and manages everything.
- `client_viewer` — sees exactly one client's dashboard, widgets gated by tier. Cannot reach `/clients/new` or settings.

The first user to sign up becomes `advisor` automatically. New viewers are created by sending them an email invite from the settings page (they set their own password on first login).

## Technical details

**New tables**
- `app_role` enum: `advisor`, `client_viewer`.
- `dashboard_tier` enum: `basic`, `advisory`, `investigate`.
- `user_roles(user_id, role)` — role storage (separate table, security-definer `has_role()` function, per project rules).
- `clients(id, name, owner_user_id, created_at)` — one row per client/company you track.
- `client_xero_orgs(client_id, xero_connection_id)` — many-to-many; one client can hold multiple Xero orgs.
- `client_access(id, client_id, user_id, tier)` — which viewer can see which client at which tier. Unique on (client_id, user_id).
- Invites use Supabase's `inviteUserByEmail` via an admin server fn; we insert the `client_access` row at invite time keyed on the new user id.

**RLS**
- Advisors: full access via `has_role(auth.uid(), 'advisor')`.
- Viewers: `SELECT` on their `clients` / `client_xero_orgs` / underlying `xero_connections` rows only when a matching `client_access` row exists.
- All existing Xero report server fns gain a tier check that throws if the requesting viewer's tier doesn't include the requested widget.

**Widget gating**
- A `TIER_WIDGETS` map in `src/lib/tiers.ts` lists which widget keys each tier exposes.
- The client dashboard renders widgets by mapping over the allowed keys for the viewer's effective tier (advisors always get all).

**Routing**
- `/dashboard` becomes the clients grid. Existing dashboard content moves into `/clients/$clientId`.
- A `loader` on `/dashboard` redirects viewers to their single client.
- "Connect Xero" stays in `/clients/new` and `/clients/$clientId/settings` only.

**Migration plan for existing data**
- One-time backfill: for the current advisor user, create one `clients` row per existing Xero connection (named after the tenant) and link them. You can rename/merge later from settings.

## What I need from you before building

Nothing — defaults above are sensible. If you'd rather invites use a magic-link-only flow (no password), say so and I'll switch it.