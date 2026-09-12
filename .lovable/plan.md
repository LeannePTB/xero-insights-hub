# People and access redesign — implementation plan (12 Sep 2026)

Classification: SECURITY-RELEVANT — a new access path, changes to the client read check, and one deliberate widening of who may grant viewer access.
Approved design: `docs/design/people-and-access.md`. Its ten decisions are settled and are not revisited here.

**Precondition:** nothing is built until the rules wording below is in Project Knowledge section 2.

## Verified live before writing this

- `client_access`: **0 rows** (0 users, 0 clients). 12 clients exist. So there is no data migration to do and nothing existing can change behaviour.
- The viewer read path is already one predicate: `app_private.has_client_access(user, client)` — a bare `EXISTS` on `client_access` — called from `app_private.user_can_read_client` and from the viewer read policies.
- One **write** policy also uses it today: `unreconciled_lines` "Viewers can update comments for their client". That is why the standing grant must not be folded into `has_client_access` itself.
- Viewer management today: `public.grant_client_access` / `revoke_client_access` / `set_client_access_tier` / `client_viewers`, each gated by `app_private.user_can_write_client` (membership or client owner). The server function `inviteClientViewer` additionally requires the `advisor` role, which is what item 6 changes.
- Invite machinery in place: `access_invites` (email-bound, `token_hash`, `expires_at`, `accepted_at`, single-use) with `role firm_member_role` — it carries no scope, level or client list yet.

## 1. Proposed wording for Project Knowledge section 2 (for the owner to apply)

> - **D. Standing viewer grant:** one row per person per organisation granting **read-only** access to **every client in that organisation**, including clients added later, at one dashboard level. It is a viewer grant, not membership: it never confers any write, never any organisation-level or platform data, never another organisation's clients, and never a role. A **specific** client grant (path *Client viewer*) overrides it for that client. The client's own entitlement always caps the level; a grant can never raise it. Created and revoked only by that organisation's owner, or by Positive Traction where it is a member. Revoking it removes the whole standing grant and leaves specific grants intact.
>
> Amend the existing **Client viewer** line to: "**Client viewer:** a `client_access` row, that client only, at the granted tier — a *specific* grant, which takes precedence over a standing grant."

## 2. Data shape — recommendation: a separate table

| Option | Effect on the read helpers | Precedence | Client added / removed |
| --- | --- | --- | --- |
| **A. `client_access.client_id` nullable + `scope` column** | Rewrites every consumer of `client_access` (`has_client_access`, `client_access_tiers`, `client_viewers`, four policies, the unique key). A missed `client_id is not null` filter silently becomes an all-clients grant. | Needs an ordering expression in every read | Nothing to do |
| **B. new `firm_viewer_access` (firm_id, user_id, tier)** *(recommended)* | `client_access` and `app_private.user_can_read_client` are **unchanged**. One new predicate, one new tier resolver. | Natural: specific row wins because it is looked up first | Nothing to do — the grant is by organisation, so a new client is covered and a removed client simply disappears |
| C. per-client rows written by trigger on client creation | Not a standing grant; loses the audit story and breaks decision 1 | — | Fragile |

Option B, with `unique (firm_id, user_id)`, `tier dashboard_tier`, `granted_by`, timestamps, RLS with per-command policies (owner or Positive Traction member reads and writes; the holder reads their own row), grants to `authenticated`/`service_role`, and the restrictive aal2 guard. `firm_id` deletes cascade with the organisation.

## 3. The read path

Two new `app_private` helpers, both `STABLE SECURITY DEFINER`, `SET search_path`, self-only (`_user_id is distinct from auth.uid()` → false), and the standard aal2 handling:

- `has_standing_client_access(user, client)` — `client → firm_id` then an `EXISTS` on `firm_viewer_access`. Fails closed when the client has no organisation.
- `has_client_read_access(user, client)` = `has_client_access(...) OR has_standing_client_access(...)`.

Then, exactly:

- `app_private.user_can_read_client` — swap its `has_client_access` term for `has_client_read_access`. **This is the only change to that function.**
- Viewer **read** policies that name `has_client_access` (`clients`, `client_notes`, `client_cost_classifications`, `client_true_breakeven_inputs`, `client_xero_orgs`, `unreconciled_lines` select, `unreconciled_uploads` select) — swap to `has_client_read_access`, one table at a time, matrix after each.
- `app_private.has_client_access` itself, `user_can_write_client`, `user_can_manage_client`, and the `unreconciled_lines` viewer **update** policy — **unchanged**, so specific grants remain the only viewer write path.
- Level resolution: new `app_private.viewer_tier(user, client)` = specific tier if a `client_access` row exists, else the standing tier, then `least(that, client_entitlement.tier)` by the existing tier order. `public.client_entitlement` keeps deciding the cap; only the viewer's own level goes through the new resolver. `client_access_tiers` gains the standing tier for the calling viewer.
- Tenant helpers (`user_can_access_tenant`, `has_tenant_access`, `client_for_tenant`, `assert_tenant_belongs_to_client`) need **no change** — they resolve a client and defer to `user_can_read_client`.

**Structural guarantee of no write access:** the standing grant exists only inside `has_client_read_access`, which is referenced only by `user_can_read_client` and by SELECT policies. Enforced, not remembered, by a new static guard (guard 8) that fails the build if `has_client_read_access` or `has_standing_client_access` appears in any INSERT/UPDATE/DELETE policy, in `user_can_write_client`/`user_can_manage_client`, or in any `FOR ALL` permissive policy — read from the live catalogue in the fixture, so a future migration cannot slip past it.

## 4. Invites

Extend `access_invites` rather than adding a table: `kind` (`member` | `viewer`, default `member`), nullable `scope` (`selected` | `all_clients`), nullable `tier`, and `client_ids uuid[]` for the selected case. `role` stays null for viewer invites. Token stays hashed, email-bound, single-use, expiring; the existing accept path gains a viewer branch that, inside one transaction, adds the `client_viewer` role plus either the specific `client_access` rows or the single `firm_viewer_access` row, then stamps `accepted_at` and writes an audit row.

The accountant sees: who invited them, the organisation, whether it is "all clients" or a named list, and the level — before accepting. **A client deleted or moved out of the organisation before acceptance is skipped silently on a selected-clients invite** (the ids are re-validated against the organisation at acceptance, never trusted from the invite); if none survive, acceptance fails with "those clients are no longer available" and the invite is left unaccepted for the owner to reissue.

## 5. UI

- **Viewer invite** (`/firms/$firmId/people`): two radio scopes — "Only the clients I tick" and "Every client in this organisation, including ones added later" — tick boxes with select-all and a search box that appears past ~8 clients, one level for the whole selection, and a plain-English summary line before Send.
- **People list:** members and viewers stay separate. Viewers grouped by person, standing grants badged "All clients", one-click revoke per grant. Revoking a standing grant names the person, the organisation and the client count being removed, and states that specific grants remain.
- **Adding a client:** the confirmation names the people who will gain access through standing grants.
- **Positive Traction's people** listed inline with a "Positive Traction" badge, removable by the owner after handover (existing member-removal path, no new permission).

## 6. The permission change — the only widening in the project

An organisation **owner** may invite, re-level and revoke client viewers for clients in their own organisation; **staff** may read the list only; team-member invites stay super-admin only.

Touched: `inviteClientViewer` (drop the `advisor` requirement, require owner-or-Positive-Traction through a database check); a new `app_private.can_manage_client_viewers(user, client)` = client's organisation owner **or** an active Positive Traction member — used by `grant_client_access`, `revoke_client_access`, `set_client_access_tier`, `client_viewers` and the new standing-grant functions, replacing `user_can_write_client` in those five places only; `client_access` write policies re-pointed to the same helper so staff cannot write viewer rows directly; `firm_viewer_access` policies; audit rows on every grant and revoke.

## 7. Matrix rows to add

Standing grant reads a newly added client; specific grant overrides standing for that client; entitlement caps the level below the granted one; revoking standing leaves specific grants working; standing grant denied on every write (notes, statutory accounts, classifications, break-even, unreconciled comment, client update); standing grant denied on another organisation's client; owner may grant and revoke viewers in their own organisation; owner denied in another organisation; staff may read the viewer list but not grant, re-level or revoke; support grant never manages viewers; viewer invite acceptance grants nothing beyond its scope.

## 8. Migration

`client_access` holds **0 rows**, so nothing is rewritten, re-keyed or back-filled; the table, its unique key and its policies keep their current shape and semantics. The 1,222 proved rows must stay green at every step; any change is a stop-and-report.

## 9. Batches — independently shippable, riskiest first

1. **Rules wording** (owner applies; docs only, no credits).
2. **Data shape and read path** — new table, two helpers, `user_can_read_client` swap, read policies table by table, guard 8, matrix. *Owner test:* every existing screen unchanged for a member, a client owner and Positive Traction. Medium-large.
3. **Grants and invites** — viewer-management helper, standing grant/revoke/re-level functions, invite columns and accept branch, audit. *Owner test:* invite yourself as an all-clients viewer at Standard, accept in a second browser, confirm read-only on every client and no write anywhere. Medium.
4. **UI** — invite screen, people list, revoke confirmations, add-client disclosure. *Owner test:* the wording tells the two scopes apart without explanation. Medium.
5. **Practice team and owner permission** — item 5 plus item 6. *Owner test:* create a test organisation and confirm the practice team appears as members with an audit row; as an owner, invite and revoke a viewer; as staff, confirm read-only. Medium.

## 10. Practice team auto-add (item 5)

Recommend a **table**, `practice_team` (user_id, added_by, timestamps), super-admin managed and audited — not a role (roles are for permissions, and `advisor` already means something else) and not a setting (an id list in a settings row cannot be audited row by row or foreign-keyed). `adminCreateOrganisation` inserts those members inside its existing all-or-nothing block, with one audit row per member. `admin_set_self_firm_membership` and its handed-over restriction (backlog 30) are untouched.

## 11. Owner decisions, with recommendations

1. **Last client removed from an organisation:** keep the standing grant (it is by organisation, and it will cover the next client). *Recommended:* keep, and show "no clients yet" rather than deleting the grant.
2. **A client handed to another organisation:** the standing grant does **not** follow it — access is by organisation, and following it would cross an organisation boundary. *Recommended:* drop coverage, and warn on the move screen naming who loses access.
3. **Owner revokes Positive Traction's membership:** revoke nothing else automatically, but tell the owner plainly that support and reporting stop, and require a typed confirmation. *Recommended:* no cascade, explicit warning.
4. **Standing grant level vs later tier upgrades:** the cap is dynamic, so a client upgraded later automatically shows the viewer more, up to the granted level. *Recommended:* dynamic (no re-grant needed).
5. **Existing single-client viewers:** none exist (0 rows), so no conversion offer is needed. *Recommended:* nothing.
