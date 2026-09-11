# People and access — approved design

**Status:** approved design, NOT scheduled. Build only after Phases 4–7 are complete, because it changes the client read path that Phase 4 is still consolidating.

## Problem

Access today is all-or-one: an organisation member sees every client, a client viewer sees exactly one. There is nothing in between and no way to grant several at once. An external accountant working across several of an organisation's clients has to be added one client at a time, and an organisation with many clients makes that unworkable.

## Approved design

1. **Two scopes for a viewer grant**, both created from one screen and one invite:
   - *Selected clients* — tick boxes, select-all, search once the list is long. Creates ordinary per-client grants.
   - *Every client in this organisation* — a standing grant that automatically covers clients added later. Owner decision: standing, not a snapshot.
2. **Precedence:** a specific per-client grant overrides the standing grant for that client (so a viewer can be on a higher level for one client). The client's own entitlement always caps what is visible — a grant can never widen access beyond the client's tier.
3. **One dashboard level applies to the whole selection at invite time, adjustable per client afterwards.**
4. **One invite, not one per client.** The invite carries the scope and level; all grants are applied on acceptance.
5. **Revoking the standing grant removes all of it at once**, leaving only specific grants. The confirmation must say exactly what is being removed.
6. **Disclosure at the point of creation:** when a client is added, the confirmation names the people who will gain access to it via standing grants.
7. **Granularity stops at client level.** A viewer of a client sees all of that client's companies. If someone should see only one company of a group, split it into its own client — do not add a fourth permission level.
8. **Positive Traction's people appear inline in the client's people list with a "Positive Traction" badge** — visible, not hidden, and removable by the owner after handover. The badge reflects that their access comes from membership, not from the super_admin role.
9. **Practice team auto-add:** when Positive Traction creates a client organisation, the defined practice team is added as members automatically and audited, rather than anyone self-joining. Self-join stays blocked on handed-over organisations (backlog 30).
10. **Owner-approved permission change:** an organisation owner may invite and revoke *client viewers* for clients in their own organisation. Staff may see the list but not change it. Inviting *team members* remains super-admin only until the owner decides otherwise.

## Consequences to handle when this is built

- The standing grant is a new access path, not just bulk viewer rows: it needs a new grant shape and a change to the client read check. Under Project Knowledge section 2 it must be added to the rules as a named path BEFORE it is built, with matrix rows for: standing grant sees a newly added client; specific grant overrides standing; client entitlement caps the level; revoking standing leaves specific grants; a standing grant never confers write access; a standing grant never crosses organisations.
- Keep it inside the viewer concept. Do not introduce a read-only member role — that would be a seventh way to hold access.
- Members and client viewers stay separate in the UI for now. The earlier "merge into one People section" request is withdrawn.
