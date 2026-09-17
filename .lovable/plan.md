# Organisation card defaults — a template applied at client creation

Classification: SECURITY-RELEVANT. It adds a table holding organisation configuration, two
new guarded database functions, and one action that overwrites existing clients' ticked cards.
Invariants touched: 1 (deny by default, per-command policies), 2 (aal2 on the server), 3
(super_admin alone grants nothing), 5 (support grants read-only), 6 (one implementation, in the
database), 11 (a read predicate is never a write grant).

## The rule this respects

Resolution does not change. `app_private.client_cards_v2` stays exactly as it is: the cards the
organisation's purchase allows, intersected with the one ticked list stored for that client. The
default is written once, into that client's own list, at the moment the client is created. Nothing
in the resolution path reads it — that is what the two new proofs pin.

## 1. Where the default is stored

New table `public.org_card_defaults`: `firm_id` (primary key, references `firms`), `cards text[]`,
timestamps. No row means "no default set" — new clients then start with every available card, as
today. RLS on, `revoke all from anon, authenticated`, one per-command read policy `to authenticated`
scoped through the caller's organisation access; every write goes through the definer functions
below, never the table.

## 2. The three database functions

All `SET search_path`, `app_private.assert_aal2()` first, caller-scoped (no user-id argument),
`REVOKE EXECUTE from PUBLIC, anon`.

- `public.org_card_defaults(_firm_id)` — returns the stored list plus whether one is set. Read gate:
  the caller's own path to the organisation.
- `public.set_org_card_defaults(_firm_id, _cards)` — writes the template. Membership-only gate
  (organisation owner or active `firm_members` row), written inline exactly as
  `set_client_widget_enabled` does, so a read-only support grant and an unrelated super admin are
  both refused. Cards sanitised against `app_private.card_group_cards`. Audited as
  `org_card_defaults_set`. Changes no client.
- `public.apply_org_card_defaults(_firm_id)` — the "apply to all clients" action. Same
  membership-only gate, refuses when no default is set, overwrites every client's list in that
  organisation with the template, returns the number changed, and writes one
  `org_card_defaults_applied` audit row naming the count and the card list.

## 3. Client creation copies the template, in the same transaction

An `AFTER INSERT` trigger on `public.clients` writes the new client's `client_cards` row from the
organisation's template when one exists, and writes nothing when it does not. A trigger rather than
application code because it is genuinely the same transaction, and because it covers every creation
path — the admin dialog, "add client from Xero", anything added later — with one implementation.
The template is copied verbatim (as `copy_client_cards` already does), so a tick for a card the
purchase does not currently allow survives Advisory being switched off and on again; resolution
intersects with the purchase as always.

## 4. One rule for Advisory and Consolidation being switched on

`set_org_purchase` already ticks a newly enabled group's cards for every client in the organisation.
It will do the same to the template in the same statement. So the single rule is: **switching an
option on ticks its cards everywhere in that organisation — every client, and the template that new
clients start from.** No second rule, and no case where new clients silently miss a card the
existing ones just gained.

## 5. Retiring `firms.default_widgets`

It is not read anywhere under card_model_v2: the only remaining readers are
`getFirmPlanSummary` and `saveFirmDefaultWidgets` in `src/lib/tier-config.functions.ts`, and neither
is called by any screen. Both go, along with the `public.set_firm_default_widgets` function and its
register entry.

The column itself I propose to keep, empty of any code path, because the standing convention is to
retain v1 data for rollback — dropping it destroys DRTABT's old list. Say the word and I will drop
it in a follow-up migration instead.

## 6. The screen

On the organisation admin page, directly under "What this organisation has bought": a
**Default cards for new clients** panel listing the cards the purchase allows, grouped as the
purchase card groups them, ticked. Wording states plainly that it applies to clients added from now
on and changes no existing client. Below it, an "Apply to all clients in this organisation" button
behind a confirmation that names the exact number of clients affected and says their current ticks
will be replaced.

## 7. Proofs

Two new permanent matrix rows, run on every check:

- a client created in an organisation with a default gets exactly that list, and one created in an
  organisation without a default gets every available card;
- resolving an existing client's dashboard ignores the default entirely: change the template, then
  assert the client's visible cards are byte-identical before and after.

Plus authorisation rows: owner and active staff may set and apply; an active support grant, a member
of another organisation, an external adviser, a business owner and a super admin with no membership
are all refused.

## After

`bun run security:check` with the known-failure list unchanged, the Supabase linter for new
findings, a Security report, and `docs/security-backlog.md` plus `roadmap.md` updated in the same
change.
