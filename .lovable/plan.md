# Business owner self-service and External adviser terminology

## Classification and change gate

**SECURITY-RELEVANT.** This changes the meaning of a client-specific access row and will eventually add narrowly scoped write and billing capabilities.

The main threats are: silently promoting legacy or unclassified viewers; letting a person change their own relationship; reusing a broad read helper for writes; crossing client or organisation boundaries; exposing organisation billing or Xero files; allowing support grants, standing access, or `super_admin` status to gain client writes; or resolving a multi-organisation person's controls once per session so adviser-only access inherits membership or Business owner capabilities held elsewhere.

Project Knowledge was amended on 13 September 2026: Path D (External adviser) and Path E (Business owner) are in section 2, and rule 11 forbids a read predicate in any write or billing authorisation. The precondition is met.

## Settled owner decisions

- Organisation signups keep the existing organisation-owner membership path and full control. No change.
- A pre-handover **Business owner** may receive full self-service for specifically assigned clients while Positive Traction still owns the organisation.
- An **External adviser** is read-only. The two existing accidental specific-viewer writes—scenario exclusions and unreconciled comments—will be removed.
- A Business owner may manage only: their assigned client’s plan and billing, dashboard cards, break-even inputs, scenario exclusions, statement uploads/comments, and Xero connections.
- Organisation owners and active Positive Traction practice-team members of that same organisation may assign or remove the relationship through audited functions.
- Billing ships as a separate, later batch after payment, GST, webhook, product/price, and customer-binding checks are approved.
- External advisers do not choose a dashboard level. New adviser grants store `multi_company`, the highest existing enum value, only as a pass-through sentinel; `app_private.viewer_tier` continues to apply `least(grant tier, client entitlement)`, so Standard remains Standard and a grant can never lift the client ceiling.
- Invitations may carry an optional inviter-supplied name label. It is display-only, never identity: matching and authorisation continue to use the verified `auth.users` user id/email. Pending invitations show the label plus email; accepted accounts show the person’s own display name plus verified email.

## Terminology and data model

- User-facing “standing grant” / “standing viewer grant” becomes **External adviser**.
- All-client access shows **All clients**; selected access shows the selected-client count.
- Add nullable enum-backed `client_access.relationship` with only `business_owner` and `external_adviser`; existing rows remain `NULL` and display **Not set**.
- `NULL` is always read-only. There is no inference or automatic backfill from email, role, current writes, tier, client ownership, or organisation membership.
- `firm_viewer_access` is always External adviser / All clients and remains read-only.
- Business owner is available only on specific selected-client rows, never on an all-client grant. Each row authorises only its exact client.
- **One client may have several Business owners.** Business partners and spouses are normal, so no unique constraint is added for that relationship on `client_id`. Each row stands alone and authorises only its own client.
- **Handover overlap:** a Business owner who later becomes the organisation owner holds both an active `firm_members` row and a `business_owner` `client_access` row. **Membership governs**, because it is broader; the self-service capabilities are a subset of what membership already allows, so the two can never conflict or subtract from each other. If that membership is later removed or suspended, the relationship row is left untouched by design and the person falls back to Business owner self-service on that one client only.
- Keep `user_roles.client_viewer` as the existing coarse role; add no app role. The relationship on `client_access` is the load-bearing client-scoped distinction.
- Keep all internal table, column-except-the-new-column, function, matrix-key, and audit-action names unchanged.

All relationship and grant mutations must use AAL2, caller-scoped, audited database functions. The direct-write closure on `client_access` is **unconditional**: revoke authenticated INSERT, UPDATE and DELETE, drop the corresponding write policies, and leave the audited grant, tier-change, relationship-change and revoke functions as the only write path. Any screen that currently writes the table directly is re-routed through one of those functions in the same change rather than keeping a privilege. Invite acceptance remains service-role-only, row-locked, single-use, and revalidates every selected client against the invite’s organisation.

## Authorisation design

Do **not** widen `app_private.user_can_write_client`: it protects broader staff operations that Business owners must not inherit.

Add one caller-bound base predicate such as `app_private.has_business_owner_client_access(user_id, client_id)`. It returns true only when:

- the supplied user is the signed-in caller;
- the session is AAL2 at the callable boundary;
- an exact `client_access` row exists for that user and client; and
- `relationship = 'business_owner'`.

Use narrowly named database capabilities built from that predicate for self-service writes and billing. `has_client_access` and `has_client_read_access` remain read predicates and are forbidden in write policies/functions by an expanded static guard. External adviser, All clients, and `NULL` must never satisfy a write capability.

Relationship assignment/change is a separate audited function. It may be called only by the organisation owner or an active Positive Traction practice-team member who is also an active member of that organisation. It cannot be called by the grantee, staff generally, support access, unrelated super admins, or an unrelated organisation.

## Before and after access

| Surface | Current actors | After implementation |
|---|---|---|
| Dashboard and financial reads | Members, specific viewers, All clients External advisers, valid support reads | Unchanged; Business owner, External adviser, and Not set remain readable only at their existing tier/cap |
| Scenario exclusions | Members/client owner plus every specific `client_access` holder | Members/client owner plus exact Business owner only; External adviser/Not set denied |
| Unreconciled comments | Members/client owner plus every specific `client_access` holder, with the existing column-change trigger | Members/client owner plus exact Business owner only; preserve the comment-only trigger; External adviser/Not set denied |
| Statement upload/delete | Client owner or active organisation member | Add exact Business owner; adviser/Not set/All clients denied |
| Break-even inputs | Client owner or active organisation member | Add exact Business owner; adviser/Not set/All clients denied |
| Dashboard card switches | Client owner or active organisation member through `set_client_widget_enabled` | Add exact Business owner; organisation ceilings still cannot be overridden |
| Xero connection lifecycle | Client owner/active organisation member under current connection helpers | Add exact Business owner only for Xero connections linked or being linked to that exact client; no cross-client move or organisation-wide file list |
| Viewer/relationship management | Organisation owner or active practice-team member of that organisation | Same managers, now through audited relationship-aware functions; Business owner cannot grant or change access |
| Client billing | Staff/super-admin tooling; checkout/portal scaffolds are disabled and use an over-broad legacy read gate | Later billing batch: exact Business owner may start checkout/open portal for their client only; no organisation subscription, comp, trial, or direct tier write |
| Organisation/team/platform data | Membership or bounded platform paths | Unchanged; Business owner gains none |

Explicitly out of scope for Business owners: organisation settings, members, viewer grants, practice team, support grants, audit log, other clients, company/Xero files not linked to their client, report finalisation/deletion, statutory mappings, bookkeeping classifications, ownership transfer, comps/trials, platform controls, and direct subscription-row writes.

## Database, functions, and UI affected

### Relationship and invitations

- Add the enum and nullable relationship columns to `client_access` and `access_invites`; revoke defaults and preserve existing RLS/grants discipline.
- Add an optional, trimmed 1–80 character, non-email inviter label to viewer invitations and both resulting grant shapes (`client_access` and `firm_viewer_access`). Existing rows stay `NULL` and show email alone. Add the same optional Name input to the team-member invitation, stored on its invite only; after acceptance, the person’s own display name governs the membership list.
- Extend `grant_client_access`, the relationship-change function, `client_viewers`, `my_client_access`, and `apply_viewer_invite` to write/return the relationship safely.
- Keep `set_client_access_tier` and `revoke_client_access` behaviour, audit, and manager boundary; include relationship in audit metadata where relevant without renaming existing actions.
- Invite UI asks **Relationship** first, then **Scope**. External adviser keeps **All clients** and **Selected clients**. Business owner is limited to explicit selected-client access. Batch 2 removes the External adviser level selector and writes `multi_company` as a pass-through sentinel; the entitlement cap remains authoritative.
- Update People lists, pending invites, badges, and summaries to show Business owner, External adviser, or Not set; use **All clients** or the selected count.

### Self-service capability changes

- Replace `has_client_access` in scenario-exclusion write policies and `public.user_can_write_client_scenario` with member/client-owner OR exact Business owner capability.
- Replace the specific-viewer unreconciled-comment UPDATE predicate with exact Business owner; retain and verify `enforce_unreconciled_line_viewer_columns` so only `client_comment` can change on that path.
- Add exact Business owner branches to the statement upload/delete authorisation and required `unreconciled_uploads` / `unreconciled_lines` write policies without widening `assert_client_write_access` globally.
- Add exact Business owner to `client_true_breakeven_inputs` INSERT/UPDATE/DELETE policies.
- Add exact Business owner to `set_client_widget_enabled`; preserve entitlement and organisation exclusion ceilings.
- Add client-bound Xero helpers for connect/link/reconnect/disconnect. OAuth state must bind the server-resolved client and organisation; callback revalidation must reject moved or unrelated clients. Never allow a Business owner to move a connection between clients.
- Update the role-aware client screen so Business owners see only these controls; External adviser and Not set continue to receive read-only screens. Do not turn Business owners into organisation members or “advisors” in `getMyContext`.

### Cross-organisation landing in Batch 4

- Add one signed-in landing view that lists **every client the caller can already reach**, grouped by organisation. Show the organisation name only as the minimum context needed to distinguish clients with similar names; expose no organisation billing, settings, members, plan, client count, Xero file list, or other organisation-level data.
- This is presentation over existing client-scoped reads, not a new access path. Continue to derive visibility from the database's existing per-client read decision; do not add an organisation-wide viewer predicate or use an organisation identifier as a grant.
- If exactly one client is reachable, continue directly to that client as today. If several are reachable, show the grouped landing list regardless of whether they come from one or several organisations.
- Resolve the caller's access type and allowed controls **for each client**. Never calculate one session-wide role, reuse the broadest access held anywhere, or let membership in organisation A add controls to adviser access in organisation B.
- Support mixed access combinations: Business owner relationships in several organisations; membership in one organisation plus External adviser access in another; and All clients in one organisation plus selected-client grants in another.
- Do not reveal an inaccessible client or organisation through a row, heading, count, total, ordering rule, or empty-state wording. Organisation groups exist only when they contain at least one client returned by the caller-scoped client read.
- On every client or organisation switch, clear selected-client, dashboard-level, and cached access context, then re-resolve them for the destination client. Query/cache keys must include the destination client and any organisation context used for presentation.

### Billing batch, kept separate

- Replace the disabled checkout/portal `user_can_access_client` gate with a new exact Business owner billing predicate; never use a read predicate as a billing grant.
- Return a safe client-scoped billing DTO; do not expose Stripe identifiers.
- Derive client, customer, permitted product/price, return URLs, and metadata server-side. Existing Stripe customer/subscription bindings may not be reassigned by caller input.
- Let confirmed Stripe events update the exact client subscription; do not grant Business owners direct table writes or access to comp/trial/admin tier functions.
- Verify webhook signature, replay/idempotency, initial checkout completion, GST/tax treatment, price catalogue, cancellation/past-due behaviour, and audit events before enabling the UI.
- Positive Traction’s organisation subscription and ownership remain untouched; every client subscription remains independently scoped by `client_id`.

## Batches

1. **Rules and terminology:** owner amends Project Knowledge; update design/spec wording for Path D; finish External adviser labels, badges, and invite order without changing access.
2. **Relationship foundation plus owner corrections:** enum/nullable columns, audited assignment and grant functions, invite propagation/revalidation, display-only inviter labels, read DTOs, unconditional direct-write closure, External adviser pass-through tiers, People-page copy/badge/summary corrections, fixture/register/docs updates. Existing rows stay Not set/read-only.
3. **Remove accidental adviser writes:** scenario exclusions and unreconciled comments become Business-owner/member-only; preserve comment-column enforcement; add static write-helper guards.
4. **Operational self-service and cross-organisation client UI:** dashboard cards, break-even inputs, statements, and exact-client Xero lifecycle; per-client controls and denial states; plus one grouped landing list of every reachable client across organisations, with single-client direct entry and state re-resolution on every switch. This landing is presentation only and creates no access path.
5. **Billing readiness and launch:** separate approval gate, then exact-client checkout/portal and webhook lifecycle only after payment prerequisites pass.
6. **Proof and closure:** matrix, fixtures, generated docs, backlog/roadmap, owner-screen tests, live posture, linter, typecheck, and full Security report.

Each batch is one security change at a time, with current live objects re-read before edits and `bun run security:check` run after it.

## Matrix and verification

Add roles/fixtures for specific `client_access` rows classified as Business owner, External adviser, and `NULL`, while keeping existing internal matrix keys stable. Prove:

- identical reads at the same tier, with specific-over-All-clients precedence preserved;
- an External adviser on a Standard client resolves to Standard even though new adviser grants store `multi_company`, and changing the stored grant to the highest value cannot lift the result above the client entitlement;
- Business owner allows only the listed capabilities for the exact client;
- External adviser, All clients, and Not set deny every self-service write;
- the two former adviser writes now deny;
- cross-client and cross-organisation reads/writes/billing/Xero operations deny;
- Business owner is not membership, is absent from member lists and plan counts, and cannot manage viewers;
- two Business owners on one client both hold their own self-service capabilities, and neither reaches the other's clients or any other client in the organisation;
- a person holding both an active membership and a `business_owner` row is governed by membership, retains every membership capability, and loses nothing; after that membership is removed or suspended they keep Business owner self-service on that one client and nothing else;
- direct authenticated writes to `client_access` deny for every actor, including organisation owners and practice-team members, whose writes go through the audited functions;
- support grants and unrelated super admins still deny all self-service writes;
- suspended/removed membership does not supplement the relationship;
- relationship self-change and direct-table tampering deny;
- caller-supplied client/organisation/tenant/customer/price identifiers never grant access.
- inviter labels never participate in an auth-user lookup, grant match, access predicate, or authorisation decision; verified email stays visible and existing unlabeled rows show email alone.
- an External adviser with grants in organisations A and B sees exactly the granted clients in both, while receiving no organisation-level data from either;
- a person who is a team member of organisation A and an External adviser to organisation B receives team controls on A's clients and read-only access on B's clients, with the decision proved per client rather than once per session;
- a Business owner of one client in organisation A and one in organisation B receives exact-client self-service on both and no organisation-level data in either; and
- the landing view reveals no inaccessible client or organisation through rows, group headings, counts, totals, ordering, or empty-state wording.

## Batch 2 implementation boundary and owner-screen corrections

This implementation stops after the relationship foundation. It does not add Business owner self-service writes, alter support/team/super-admin access, or fix the two accidental adviser writes reserved for Batch 3.

- Change every practice-membership badge string to **Positive Traction**.
- Rewrite the People subtitle and route metadata around Team member, Business owner, and External adviser.
- Use `accountant@example.com` for the External adviser email placeholder.
- Before any selected client is ticked, show a neutral selection prompt instead of “0 of …”.
- Remove every External adviser level selector, including existing-grant controls. The stored tier remains for compatibility and enforcement; new adviser grants use `multi_company`, while existing values remain untouched unless a grant is reissued.
- Add a relationship-first control: Business owner forces selected clients; External adviser permits selected or All clients. In Batch 2 both relationships retain the same existing read access only; Business owner write capabilities do not begin until later batches.
- Add optional Name fields with shared Zod validation. A label is copied to pending viewer invites and accepted specific/All-clients grants. Lists prefer an accepted person’s own display name, then the inviter label, while always displaying verified email; pending invitations prefer the inviter label and always display the invite email.
- Add a static guard that fails if the label column is referenced by identity lookup or authorisation functions, and preserve the existing no-`profiles.email` guard.

Preserve every unrelated matrix expectation. Baseline evidence before this plan is 1,527 rows, 1,450 proved, 0 failures, 44 tests, live suite 18/18, fingerprint `25f4c08d9a77f9f5beb22a7c5340f1250ef056552f6a99e4aa35773365ca04a2`. Final reporting must show before/after totals and fingerprint, typecheck, security check, database linter/security scan, posture, and owner-screen tests for each relationship and scope.

## Exact proposed Project Knowledge wording

> **E. Business owner (specific client relationship):** a `client_access` row whose `relationship` is `business_owner` grants the named person AAL2-protected self-service access to that exact client only while the organisation may remain owned by Positive Traction. It is not organisation membership, does not appear in the member list, does not count toward organisation plan limits, and grants no organisation, team, support, platform, audit-log, other-client, or unrelated Xero-file access. It may authorise only the explicitly approved client self-service capabilities: the client’s plan and billing, dashboard cards, break-even inputs, scenario exclusions, statement uploads and comments, and Xero connections bound to that client. Each capability is enforced by a caller-scoped database predicate; `user_can_write_client` is not widened. A caller-supplied `firm_id`, `client_id`, `tenant_id`, Stripe customer, subscription, product, or price is always a filter and never a grant.
>
> `client_access.relationship = 'external_adviser'` and `NULL` are read-only. `firm_viewer_access` is the External adviser “All clients” scope and is always read-only. Neither adviser form may write scenario exclusions, unreconciled comments, billing, settings, Xero connections, or any client data. A specific grant continues to override an All clients grant for dashboard level only; it never imports write capability from the standing grant.
>
> Only the organisation owner, or an active Positive Traction practice-team member who is also an active member of that organisation, may assign, change, or remove a Business owner or External adviser relationship, through AAL2 caller-scoped audited database functions. The grantee, ordinary staff, support grants, and unrelated super admins may not change relationships. Existing and unclassified (`NULL`) rows remain read-only until explicitly classified; no migration may infer or backfill a privileged relationship.
>
> Business-owner billing is client-scoped: checkout and the billing portal derive the exact client, Stripe customer/subscription, product and price server-side; confirmed signed webhook events update only that client’s subscription. Business owners never receive direct subscription-table writes and cannot set comps, trials, organisation plans, ownership, or another client’s entitlement. Positive Traction’s organisation ownership and subscription remain unchanged.

## Recommendation

Proceed with the exact scope above. In particular, remove both accidental External adviser writes rather than preserving them, keep legacy `NULL` rows read-only, avoid widening shared write helpers, and do not enable billing until the separate payment-readiness gate passes.
