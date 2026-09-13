# People and access — BUILT

**Status:** Original people-and-access batches 1–5 built 12 Sep 2026. External adviser/Business owner terminology and relationship foundation built 13 Sep 2026; Business owner self-service and billing remain unbuilt.

**What differs from the design as approved, and why**

- The All clients External adviser grant lives in its own table, `firm_viewer_access`, rather than as a flag on `client_access`. A separate table keeps specific per-client grants untouched, and lets the standing predicate be referenced by read paths only — which is what Project Knowledge section 2 requires. Rule 2 (precedence) and rule 5 (revoke all of it at once) behave exactly as approved.
- Decision 8's badge reads "Positive Traction"/"Traction Advisory" from the `practice_team` table, not from the `super_admin` role, so the badge cannot imply access. Removing one of our people after handover IS now possible (12 Sep 2026): `public.remove_firm_member` plus a Remove control on the organisation people list. Decision 8 is genuinely true. Removal is a soft removal (`firm_members.status = 'removed'`), owner-removes-staff or remove-yourself only, refused for the owner and for the last remaining member, and it changes no viewer grant, standing grant, Xero connection, snapshot or account.
- Rule 9's revoke wording gained a second warning the design did not anticipate: revoking one client from someone who holds All clients does not remove their access at all. The screen says so and offers the only real remedy — switch that person to a ticked list of clients with that client left out (backlog 44).
- No exclusion row type was added. Two scopes only, as approved.

## Terminology and the business-owner decision (13 Sep 2026)

Owner decision, recorded in Project Knowledge section 2:

- The user-facing name for a viewer grant is **External adviser**, shown as **All clients** or as the number of selected clients. "Standing grant" and "standing viewer grant" are retired from screens and from user-facing wording. Internal tables, columns, functions, matrix keys and audit action names are deliberately unchanged: `firm_viewer_access` remains the All clients scope, `client_access` the selected-client scope.
- An External adviser is **read-only** everywhere (Path D). The two writes a selected-client grant could once reach — scenario exclusions and unreconciled comments — were removed in Batch 3 (13 Sep 2026).
- A new **Business owner** relationship (Path E) is now recorded on a specific `client_access` row and its selected-client invite. It will later let a client run their own account while Positive Traction may still own the organisation. It is never an All clients grant and is not membership. Batch 2 does not yet grant self-service writes.
- **A client may have several Business owners** — business partners and spouses are normal — so no unique constraint is added for that relationship on `client_id`. Each row authorises only its own client.
- **Handover overlap:** once a business owner becomes the organisation owner they hold both an active `firm_members` row and a `business_owner` row. **Membership governs**, because it is the broader path and the self-service capabilities are a subset of it, so the two cannot conflict. If that membership is later removed or suspended, the relationship row is left in place by design and the person falls back to self-service on that one client only.
- Rows with no relationship recorded (`NULL`) display as **Not set** and stay read-only. Nothing is inferred or backfilled.
- Every relationship change goes through an aal2, caller-scoped, audited database function; direct writes to `client_access` are closed.

The relationship foundation is live: nullable enum-backed relationship fields, optional display-only labels, relationship-first invitation and People controls, audited assignment, and unconditional closure of direct authenticated `client_access` writes. Existing NULL rows remain read-only. Later self-service and billing capabilities remain separate security changes.

### People location decision (13 Sep 2026)

People and access now lives inside organisation settings, after the client/Xero resource controls and before ownership transfer and support access. This keeps membership and viewer management with the other organisation controls without creating another implementation. The former `/firms/$firmId/people` address redirects to the People section in settings so bookmarks and old links remain useful.

Visibility is unchanged: the section renders only for an active organisation member, and its existing caller-scoped functions still decide which lists and controls that member may use. A support grant may reach its existing read-only settings surfaces but does not see the People section; an External adviser or Business owner gains no organisation-settings access from this move.

## Approved cross-organisation landing requirement (13 Sep 2026)

External advisers and Business owners are not confined to one organisation. A person may hold access in several combinations at once: selected-client grants from multiple organisations; Business owner relationships for businesses held in different organisations; membership in one organisation and External adviser access in another; or All clients in one organisation and selected clients in another.

Batch 4 must present these existing client-scoped access paths as one signed-in client list:

- List every client the person can already reach and group the results by organisation. Show the organisation name so similarly named clients can be distinguished. If there is only one reachable client, continue directly to it as today.
- The organisation name is presentation context only. Do not expose organisation billing, settings, members, plan, client count, Xero file list, or any other organisation-level data to someone who lacks membership in that organisation.
- Resolve access and controls separately for every client. A team member of organisation A who is an External adviser to organisation B receives team controls only on A's clients and read-only controls on B's. Never resolve one role for the whole session or inherit the widest access held elsewhere.
- Reveal nothing about inaccessible clients or organisations, including through group headings, counts, totals, ordering, or empty-state wording. Render an organisation group only when it contains a client returned by the caller-scoped client read.
- When switching clients or organisations, discard selected-client, dashboard-level, and cached access context and re-resolve them for the destination client.

This is an approved **presentation requirement**, not a new access path. The existing client-scoped database read decision remains authoritative; do not create an organisation-wide viewer permission, infer membership, or grant organisation data to support the landing view.

Batch 4 matrix coverage must prove:

1. An External adviser with grants in organisations A and B sees exactly the granted clients in both and no organisation-level data for either.
2. A person who is a team member of A and an External adviser to B receives team controls on A's clients and read-only access on B's, determined per client rather than per session.
3. A Business owner of a client in A and a client in B receives self-service on both exact clients and no organisation-level data in either.
4. The landing view reveals no client or organisation the person cannot reach.

## Problem

Access today is all-or-one: an organisation member sees every client, a client viewer sees exactly one. There is nothing in between and no way to grant several at once. An external accountant working across several of an organisation's clients has to be added one client at a time, and an organisation with many clients makes that unworkable.

## Approved design

1. **Two scopes for a viewer grant**, both created from one screen and one invite:
   - _Selected clients_ — tick boxes, select-all, search once the list is long. Creates ordinary per-client grants.
   - _Every client in this organisation_ — a standing grant that automatically covers clients added later. Owner decision: standing, not a snapshot.
2. **Precedence:** a specific per-client grant overrides the standing grant for that client (so a viewer can be on a higher level for one client). The client's own entitlement always caps what is visible — a grant can never widen access beyond the client's tier.
3. **One dashboard level applies to the whole selection at invite time, adjustable per client afterwards.**
4. **One invite, not one per client.** The invite carries the scope and level; all grants are applied on acceptance.
5. **Revoking the standing grant removes all of it at once**, leaving only specific grants. The confirmation must say exactly what is being removed.
6. **Disclosure at the point of creation:** when a client is added, the confirmation names the people who will gain access to it via standing grants.
7. **Granularity stops at client level.** A viewer of a client sees all of that client's companies. If someone should see only one company of a group, split it into its own client — do not add a fourth permission level.
8. **Positive Traction's people appear inline in the client's people list with a "Positive Traction" badge** — visible, not hidden, and removable by the owner after handover. The badge reflects that their access comes from membership, not from the super_admin role.
9. **Practice team auto-add:** when Positive Traction creates a client organisation, the defined practice team is added as members automatically and audited, rather than anyone self-joining. Self-join stays blocked on handed-over organisations (backlog 30).
10. **Owner-approved permission change:** an organisation owner may invite and revoke _client viewers_ for clients in their own organisation. Staff may see the list but not change it. Inviting _team members_ remains super-admin only until the owner decides otherwise.

## Consequences to handle when this is built

- The standing grant is a new access path, not just bulk viewer rows: it needs a new grant shape and a change to the client read check. Under Project Knowledge section 2 it must be added to the rules as a named path BEFORE it is built, with matrix rows for: standing grant sees a newly added client; specific grant overrides standing; client entitlement caps the level; revoking standing leaves specific grants; a standing grant never confers write access; a standing grant never crosses organisations.
- Keep it inside the viewer concept. Do not introduce a read-only member role — that would be a seventh way to hold access.
- Members and client viewers stay separate in the UI for now. The earlier "merge into one People section" request is withdrawn.
